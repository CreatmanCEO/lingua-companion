import asyncio
import json
import logging

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from starlette.websockets import WebSocketState

logger = logging.getLogger(__name__)

from app.agents.stt import transcribe
from app.agents.reconstruction import reconstruct
from app.agents.phrase_variants import get_variants
from app.agents.companion import generate_response


router = APIRouter()

# Максимальный размер аудио: 1MB (защита от DoS)
MAX_AUDIO_SIZE = 1 * 1024 * 1024

# Максимальное количество сообщений в истории сессии
MAX_HISTORY_MESSAGES = 20


async def send_event(ws: WebSocket, event_type: str, data: dict) -> None:
    """Отправить JSON-событие клиенту (если соединение открыто)."""
    if ws.client_state == WebSocketState.CONNECTED:
        await ws.send_json({"type": event_type, **data})


async def run_companion_and_variants(
    websocket: WebSocket,
    transcript: str,
    reconstruction_result: dict,
    variants_task: asyncio.Task,
    session: dict,
) -> None:
    """
    Запускает companion параллельно с оставшимся ожиданием variants.
    Вызывается после получения результата reconstruction.

    Отправляет reconstruction_result, variants_result и companion_response.
    """
    # Отправляем reconstruction_result сразу
    await send_event(websocket, "reconstruction_result", reconstruction_result)

    # Запускаем companion параллельно с variants (если ещё не завершён)
    corrected = reconstruction_result.get("corrected", transcript)
    companion_task = asyncio.create_task(
        generate_response(
            user_message=corrected,
            companion=session.get("companion", "Alex"),
            history=session.get("history", []),
            scenario=session.get("scenario"),
        ),
        name="companion",
    )

    # Ожидаем оба: variants + companion
    remaining = set()
    if not variants_task.done():
        remaining.add(variants_task)
    else:
        # Variants уже готов -- отправляем
        await send_event(websocket, "variants_result", variants_task.result())
    remaining.add(companion_task)

    task_to_event = {
        variants_task: "variants_result",
        companion_task: "companion_response",
    }

    while remaining:
        done, remaining = await asyncio.wait(
            remaining, return_when=asyncio.FIRST_COMPLETED
        )
        for task in done:
            event_type = task_to_event.get(task)
            if event_type:
                await send_event(websocket, event_type, task.result())

    # Обновляем историю сессии
    history = session.setdefault("history", [])
    history.append({"role": "user", "content": corrected})
    companion_result = companion_task.result()
    history.append({
        "role": "assistant",
        "content": companion_result.get("text", ""),
    })

    # Обрезаем историю до лимита (скользящее окно)
    if len(history) > MAX_HISTORY_MESSAGES:
        session["history"] = history[-MAX_HISTORY_MESSAGES:]


async def process_text(
    websocket: WebSocket,
    text: str,
    session: dict,
) -> None:
    """
    Обработка текстового сообщения: Reconstruction -> parallel(Variants, Companion).
    Пропускает STT (текст уже доступен).
    """
    if not text.strip():
        await send_event(websocket, "error", {"message": "Empty text message"})
        return

    try:
        # Сначала reconstruction
        reconstruction_result = await reconstruct(text)
        corrected = reconstruction_result.get("corrected", text)

        # Затем параллельно: variants + companion
        variants_task = asyncio.create_task(
            get_variants(corrected), name="variants"
        )

        await run_companion_and_variants(
            websocket, text, reconstruction_result, variants_task, session
        )
    except Exception as e:
        await send_event(
            websocket, "error", {"message": f"Processing failed: {str(e)}"}
        )


@router.websocket("/ws/session")
async def websocket_session(websocket: WebSocket):
    """
    Voice session WebSocket endpoint.

    Protocol:
    - Client sends: binary audio frames (webm/opus, m4a, mp3, wav)
    - Client sends: JSON text messages (session_config, text_message)
    - Server sends: JSON events as each stage completes

    Events (server -> client):
    - stt_result: {text, language, provider, latency_ms, fallback}
    - reconstruction_result: {corrected, original_intent, main_error, ...}
    - variants_result: {simple, professional, colloquial, slang, idiom}
    - companion_response: {text, companion}
    - error: {message}

    JSON messages (client -> server):
    - session_config: {companion, scenario}
    - text_message: {text}
    """
    await websocket.accept()
    logger.info("WebSocket connected")

    # Состояние сессии: companion, scenario, history
    session: dict = {
        "companion": "Alex",
        "scenario": None,
        "history": [],
    }

    try:
        while True:
            # Получаем сообщение любого типа (binary или text)
            message = await websocket.receive()

            # Обработка текстовых JSON-сообщений от клиента
            if "text" in message:
                try:
                    data = json.loads(message["text"])
                    msg_type = data.get("type")

                    if msg_type == "session_config":
                        # Обновляем настройки сессии
                        if "companion" in data:
                            session["companion"] = data["companion"]
                        if "scenario" in data:
                            session["scenario"] = data["scenario"]
                        continue

                    elif msg_type == "text_message":
                        # Текстовое сообщение -- без STT
                        text = data.get("text", "")
                        await process_text(websocket, text, session)
                        continue

                except json.JSONDecodeError:
                    await send_event(
                        websocket, "error",
                        {"message": "Invalid JSON message"},
                    )
                    continue

            # Обработка бинарных аудио-сообщений (существующая логика)
            if "bytes" in message:
                audio_bytes = message["bytes"]
                logger.info("Received audio: %d bytes", len(audio_bytes))

                # Validate audio size (DoS protection)
                if len(audio_bytes) > MAX_AUDIO_SIZE:
                    await send_event(websocket, "error", {
                        "message": (
                            f"Audio too large: {len(audio_bytes)} bytes "
                            f"(max {MAX_AUDIO_SIZE})"
                        )
                    })
                    continue

                # 2. STT
                try:
                    stt_result = await transcribe(audio_bytes, "audio.bin")
                    await send_event(websocket, "stt_result", stt_result)
                except Exception as e:
                    await send_event(
                        websocket, "error",
                        {"message": f"STT failed: {str(e)}"},
                    )
                    continue

                transcript = stt_result.get("text", "")
                if not transcript.strip():
                    await send_event(
                        websocket, "error", {"message": "Empty transcript"}
                    )
                    continue

                # 3. Reconstruction -> parallel(Variants, Companion)
                # Стратегия: сначала reconstruction, потом variants с corrected текстом.
                # Variants и companion работают параллельно.
                tasks = {}
                try:
                    recon_task = asyncio.create_task(
                        reconstruct(transcript), name="reconstruction"
                    )
                    tasks["reconstruction"] = recon_task

                    # Ждём reconstruction первым
                    reconstruction_result = await recon_task
                    corrected = reconstruction_result.get("corrected", transcript)

                    # Variants получает corrected текст (не raw transcript)
                    variants_task = asyncio.create_task(
                        get_variants(corrected), name="variants"
                    )
                    tasks["variants"] = variants_task

                    # Запускаем companion + ждём variants
                    await run_companion_and_variants(
                        websocket,
                        transcript,
                        reconstruction_result,
                        variants_task,
                        session,
                    )

                except Exception as e:
                    logger.error("Pipeline failed", exc_info=True)
                    for task in tasks.values():
                        if not task.done():
                            task.cancel()
                    await send_event(
                        websocket, "error",
                        {"message": f"Processing failed: {str(e)}"},
                    )

    except WebSocketDisconnect:
        logger.info("WebSocket disconnected")
    except Exception as e:
        # Unexpected error - try to notify client
        try:
            await send_event(
                websocket, "error",
                {"message": f"Server error: {str(e)}"},
            )
        except Exception:
            pass
