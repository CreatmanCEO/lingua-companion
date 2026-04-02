import asyncio
import json
import logging
import time

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from starlette.websockets import WebSocketState

logger = logging.getLogger(__name__)

from app.agents.stt import transcribe
from app.agents.reconstruction import reconstruct
from app.agents.phrase_variants import get_variants, REQUIRED_STYLES
from app.agents.companion import generate_response, generate_response_stream, _FALLBACK_RESPONSE
from app.agents.memory import (
    search_memory, get_user_facts, store_memory,
    extract_facts, upsert_fact, track_vocab_gap, USER_ID,
)
from app.agents.onboarding import (
    get_onboarding_response, extract_onboarding_data, is_onboarding_complete,
)


router = APIRouter()

# Максимальный размер аудио: 1MB (защита от DoS)
MAX_AUDIO_SIZE = 1 * 1024 * 1024

# Максимальное количество сообщений в истории сессии
MAX_HISTORY_MESSAGES = 20

# Rate limiting: максимум сообщений в минуту на сессию
MAX_MESSAGES_PER_MINUTE = 15


def _check_rate_limit(session: dict) -> bool:
    """Check if session exceeds rate limit. Returns True if blocked."""
    now = time.time()
    timestamps = session["message_timestamps"]
    # Remove timestamps older than 60 seconds
    session["message_timestamps"] = [t for t in timestamps if now - t < 60]
    if len(session["message_timestamps"]) >= MAX_MESSAGES_PER_MINUTE:
        return True
    session["message_timestamps"].append(now)
    return False


async def send_event(ws: WebSocket, event_type: str, data: dict) -> None:
    """Отправить JSON-событие клиенту (если соединение открыто)."""
    if ws.client_state == WebSocketState.CONNECTED:
        await ws.send_json({"type": event_type, **data})


async def _build_memory_context(user_id: str, query: str) -> str | None:
    """READ: поиск по памяти + факты пользователя → строка контекста."""
    try:
        facts, memories = await asyncio.gather(
            get_user_facts(user_id),
            search_memory(user_id, query, top_k=5),
            return_exceptions=True,
        )

        parts = []
        if isinstance(facts, dict) and facts:
            facts_str = ", ".join(f"{k}: {v}" for k, v in facts.items())
            parts.append(f"Known facts: {facts_str}")

        if isinstance(memories, list) and memories:
            mem_texts = [m["text"] for m in memories[:3]]
            parts.append("Related memories: " + " | ".join(mem_texts))

        return "\n".join(parts) if parts else None

    except Exception:
        logger.error("Memory READ failed", exc_info=True)
        return None


async def _memory_write_behind(user_id: str, user_text: str, companion_text: str) -> None:
    """WRITE (fire-and-forget): store memory, extract facts, track vocab."""
    try:
        # Store conversation exchange
        await store_memory(user_id, f"User: {user_text}\nAssistant: {companion_text}", {
            "type": "conversation",
        })

        # Extract facts from user message
        facts = await extract_facts(user_text)
        for key, value in facts.items():
            if key and value:
                await upsert_fact(user_id, key, str(value))

    except Exception:
        logger.error("Memory WRITE failed", exc_info=True)


async def _stream_companion(
    websocket: WebSocket,
    corrected: str,
    session: dict,
    memory_context: str | None = None,
) -> str:
    """Стримит companion токены через WS. Возвращает полный текст."""
    companion_name = session.get("companion", "Alex")
    full_text = _FALLBACK_RESPONSE

    try:
        async for event in generate_response_stream(
            user_message=corrected,
            companion=companion_name,
            history=session.get("history", []),
            scenario=session.get("scenario"),
            memory_context=memory_context,
        ):
            if event["type"] == "token":
                await send_event(websocket, "companion_token", {
                    "delta": event["delta"],
                    "companion": companion_name,
                })
            elif event["type"] == "done":
                full_text = event.get("text", _FALLBACK_RESPONSE)
                await send_event(websocket, "companion_response", {
                    "text": full_text,
                    "companion": companion_name,
                })
    except Exception:
        logger.error("Companion stream failed", exc_info=True)
        await send_event(websocket, "companion_response", {
            "text": _FALLBACK_RESPONSE,
            "companion": companion_name,
            "degraded": True,
        })
        full_text = _FALLBACK_RESPONSE

    return full_text


async def run_companion_and_variants(
    websocket: WebSocket,
    transcript: str,
    reconstruction_result: dict,
    variants_task: asyncio.Task,
    session: dict,
) -> None:
    """
    Запускает streaming companion параллельно с variants.
    Отправляет reconstruction_result, companion_token(s), variants_result, companion_response.
    """
    # Отправляем reconstruction_result сразу
    await send_event(websocket, "reconstruction_result", reconstruction_result)

    corrected = reconstruction_result.get("corrected", transcript)

    # Memory READ: search + facts → context for companion
    memory_context = await _build_memory_context(USER_ID, corrected)

    # Запускаем companion streaming как task (with memory context)
    companion_task = asyncio.create_task(
        _stream_companion(websocket, corrected, session, memory_context=memory_context),
        name="companion_stream",
    )

    # Ожидаем variants (если ещё не готов)
    if not variants_task.done():
        try:
            variants_result = await variants_task
            await send_event(websocket, "variants_result", variants_result)
        except Exception:
            logger.error("Variants task failed", exc_info=True)
            fallback_variants = {k: {"text": corrected, "context": ""} for k in REQUIRED_STYLES}
            await send_event(websocket, "variants_result", {**fallback_variants, "degraded": True})
    else:
        try:
            await send_event(websocket, "variants_result", variants_task.result())
        except Exception:
            logger.error("Variants task failed (already done)", exc_info=True)
            fallback_variants = {k: {"text": corrected, "context": ""} for k in REQUIRED_STYLES}
            await send_event(websocket, "variants_result", {**fallback_variants, "degraded": True})

    # Ожидаем завершения companion streaming
    companion_text = await companion_task

    # Обновляем историю сессии
    history = session.setdefault("history", [])
    history.append({"role": "user", "content": corrected})
    history.append({"role": "assistant", "content": companion_text})

    if len(history) > MAX_HISTORY_MESSAGES:
        session["history"] = history[-MAX_HISTORY_MESSAGES:]

    # Memory WRITE (fire-and-forget, non-blocking)
    asyncio.create_task(
        _memory_write_behind(USER_ID, corrected, companion_text),
        name="memory_write",
    )


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


async def process_onboarding(
    websocket: WebSocket,
    text: str,
    session: dict,
) -> None:
    """
    Обработка onboarding сообщения: без pipeline (no STT/Reconstruction/Variants).
    Только onboarding agent → проверка завершённости → сохранение фактов.
    """
    if not text.strip():
        await send_event(websocket, "error", {"message": "Empty text message"})
        return

    try:
        onboarding_history = session.get("onboarding_history", [])

        result = await get_onboarding_response(text, onboarding_history)

        # Обновляем историю onboarding
        onboarding_history.append({"role": "user", "content": text})
        onboarding_history.append({"role": "assistant", "content": result["text"]})
        session["onboarding_history"] = onboarding_history

        # Отправляем ответ как companion_response
        await send_event(websocket, "companion_response", {
            "text": result["text"],
            "companion": "Onboarding",
        })

        # Проверяем завершённость
        data = await extract_onboarding_data(onboarding_history)
        if is_onboarding_complete(data):
            # Сохраняем факты в memory
            for key, value in data.items():
                asyncio.create_task(
                    upsert_fact(USER_ID, key, str(value)),
                    name=f"onboarding_fact_{key}",
                )

            # Переключаем на companion mode
            session["onboarding"] = False

            # Маппинг стиля → companion
            style_to_companion = {
                "professional": "Alex",
                "casual": "Sam",
                "mentor": "Morgan",
            }
            chosen = style_to_companion.get(data.get("style", ""), "Alex")
            session["companion"] = chosen

            await send_event(websocket, "onboarding_complete", {
                "data": data,
                "companion": chosen,
            })

    except Exception as e:
        logger.error("Onboarding processing failed", exc_info=True)
        await send_event(
            websocket, "error", {"message": f"Onboarding failed: {str(e)}"}
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

    # Состояние сессии: companion, scenario, history, processing, rate limiting, onboarding
    session: dict = {
        "companion": "Alex",
        "scenario": None,
        "history": [],
        "processing": False,
        "message_timestamps": [],
        "onboarding": False,
        "onboarding_history": [],
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
                        if "onboarding" in data:
                            session["onboarding"] = data["onboarding"]
                        continue

                    elif msg_type == "text_message":
                        # Concurrent processing check
                        if session["processing"]:
                            await send_event(websocket, "error", {
                                "message": "Already processing a request",
                            })
                            continue
                        # Rate limit check
                        if _check_rate_limit(session):
                            await send_event(websocket, "error", {
                                "message": "Rate limit exceeded",
                            })
                            continue
                        # Текстовое сообщение — роутинг: onboarding или обычный pipeline
                        text = data.get("text", "")
                        session["processing"] = True
                        try:
                            if session.get("onboarding"):
                                await process_onboarding(websocket, text, session)
                            else:
                                await process_text(websocket, text, session)
                        finally:
                            session["processing"] = False
                        continue

                except json.JSONDecodeError:
                    await send_event(
                        websocket, "error",
                        {"message": "Invalid JSON message"},
                    )
                    continue

            # Обработка бинарных аудио-сообщений (существующая логика)
            if "bytes" in message:
                # Concurrent processing check
                if session["processing"]:
                    await send_event(websocket, "error", {
                        "message": "Already processing a request",
                    })
                    continue
                # Rate limit check
                if _check_rate_limit(session):
                    await send_event(websocket, "error", {
                        "message": "Rate limit exceeded",
                    })
                    continue

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
                session["processing"] = True
                try:
                    stt_result = await transcribe(audio_bytes, "audio.webm")
                    await send_event(websocket, "stt_result", stt_result)
                except Exception as e:
                    session["processing"] = False
                    await send_event(
                        websocket, "error",
                        {"message": f"STT failed: {str(e)}"},
                    )
                    continue

                transcript = stt_result.get("text", "")
                if not transcript.strip():
                    session["processing"] = False
                    await send_event(
                        websocket, "error", {"message": "Empty transcript"}
                    )
                    continue

                # Send processing_started before pipeline
                await send_event(websocket, "processing_started", {
                    "transcript": transcript,
                })

                # 3. Reconstruction -> parallel(Variants, Companion)
                # Degraded mode: each stage fails independently
                tasks = {}

                # Reconstruction with degraded fallback
                try:
                    recon_task = asyncio.create_task(
                        reconstruct(transcript), name="reconstruction"
                    )
                    tasks["reconstruction"] = recon_task
                    reconstruction_result = await recon_task
                except Exception:
                    logger.error("Reconstruction failed, using raw transcript", exc_info=True)
                    reconstruction_result = {
                        "corrected": transcript,
                        "original_intent": transcript,
                        "main_error": None,
                        "error_type": "none",
                        "explanation": None,
                        "changes": [],
                        "degraded": True,
                    }

                corrected = reconstruction_result.get("corrected", transcript)

                # Variants with corrected text
                variants_task = asyncio.create_task(
                    get_variants(corrected), name="variants"
                )
                tasks["variants"] = variants_task

                try:
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
                finally:
                    session["processing"] = False

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
