import asyncio
import json
import time
from typing import Any

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from starlette.websockets import WebSocketState

from app.agents.stt import transcribe
from app.agents.reconstruction import reconstruct
from app.agents.phrase_variants import get_variants


router = APIRouter()

# Максимальный размер аудио: 1MB (защита от DoS)
MAX_AUDIO_SIZE = 1 * 1024 * 1024


async def send_event(ws: WebSocket, event_type: str, data: dict) -> None:
    """Отправить JSON-событие клиенту (если соединение открыто)."""
    if ws.client_state == WebSocketState.CONNECTED:
        await ws.send_json({"type": event_type, **data})


@router.websocket("/ws/session")
async def websocket_session(websocket: WebSocket):
    """
    Voice session WebSocket endpoint.

    Protocol:
    - Client sends: binary audio frames (webm/opus, m4a, mp3, wav)
    - Server sends: JSON events as each stage completes

    Events (server -> client):
    - stt_result: {text, language, provider, latency_ms, fallback}
    - reconstruction_result: {corrected, original_intent, main_error, error_type, explanation}
    - variants_result: {simple, professional, colloquial, slang, idiom}
    - error: {message}
    """
    await websocket.accept()

    try:
        while True:
            # 1. Receive binary audio
            audio_bytes = await websocket.receive_bytes()
            session_start = time.time()

            # 1.1 Validate audio size (DoS protection)
            if len(audio_bytes) > MAX_AUDIO_SIZE:
                await send_event(websocket, "error", {
                    "message": f"Audio too large: {len(audio_bytes)} bytes (max {MAX_AUDIO_SIZE})"
                })
                continue

            # 2. STT
            try:
                # Filename определяет MIME-тип в STT; используем нейтральный
                # STT агент сам определит формат по magic bytes или использует default
                stt_result = await transcribe(audio_bytes, "audio.bin")
                await send_event(websocket, "stt_result", stt_result)
            except Exception as e:
                await send_event(websocket, "error", {"message": f"STT failed: {str(e)}"})
                continue

            transcript = stt_result.get("text", "")
            if not transcript.strip():
                await send_event(websocket, "error", {"message": "Empty transcript"})
                continue

            # 3. Parallel: Reconstruction + PhraseVariants
            # Используем именованные задачи для надёжной идентификации
            tasks = {}
            try:
                tasks["reconstruction_result"] = asyncio.create_task(
                    reconstruct(transcript), name="reconstruction"
                )
                tasks["variants_result"] = asyncio.create_task(
                    get_variants(transcript), name="variants"
                )

                # Mapping task -> event_type для идентификации
                task_to_event = {task: event for event, task in tasks.items()}
                all_tasks = set(tasks.values())

                # Отправляем результаты по мере готовности
                while all_tasks:
                    done, all_tasks = await asyncio.wait(
                        all_tasks, return_when=asyncio.FIRST_COMPLETED
                    )
                    for task in done:
                        event_type = task_to_event[task]
                        await send_event(websocket, event_type, task.result())

            except Exception as e:
                # Отменяем pending задачи при ошибке
                for task in tasks.values():
                    if not task.done():
                        task.cancel()
                await send_event(websocket, "error", {"message": f"Processing failed: {str(e)}"})

    except WebSocketDisconnect:
        pass  # Normal disconnect
    except Exception as e:
        # Unexpected error - try to notify client
        try:
            await send_event(websocket, "error", {"message": f"Server error: {str(e)}"})
        except Exception:
            pass
