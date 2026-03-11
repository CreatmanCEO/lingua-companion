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

            # 2. STT
            try:
                stt_result = await transcribe(audio_bytes, "audio.webm")
                await send_event(websocket, "stt_result", stt_result)
            except Exception as e:
                await send_event(websocket, "error", {"message": f"STT failed: {str(e)}"})
                continue

            transcript = stt_result.get("text", "")
            if not transcript.strip():
                await send_event(websocket, "error", {"message": "Empty transcript"})
                continue

            # 3. Parallel: Reconstruction + PhraseVariants
            try:
                reconstruction_task = asyncio.create_task(reconstruct(transcript))
                variants_task = asyncio.create_task(get_variants(transcript))

                # Отправляем результаты по мере готовности
                done, pending = await asyncio.wait(
                    [reconstruction_task, variants_task],
                    return_when=asyncio.FIRST_COMPLETED
                )

                for task in done:
                    if task is reconstruction_task:
                        await send_event(websocket, "reconstruction_result", task.result())
                    elif task is variants_task:
                        await send_event(websocket, "variants_result", task.result())

                # Дождаться оставшиеся
                for task in pending:
                    result = await task
                    if task is reconstruction_task:
                        await send_event(websocket, "reconstruction_result", result)
                    elif task is variants_task:
                        await send_event(websocket, "variants_result", result)

            except Exception as e:
                await send_event(websocket, "error", {"message": f"Processing failed: {str(e)}"})

    except WebSocketDisconnect:
        pass  # Normal disconnect
    except Exception as e:
        # Unexpected error - try to notify client
        try:
            await send_event(websocket, "error", {"message": f"Server error: {str(e)}"})
        except:
            pass
