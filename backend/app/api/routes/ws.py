"""
WebSocket transport layer — LinguaCompanion

Thin transport: accept/disconnect, message routing, rate limiting, concurrency guard.
All pipeline logic lives in app.agents.orchestrator.PipelineOrchestrator.
"""

import json
import logging
import time

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from starlette.websockets import WebSocketState

from app.agents.orchestrator import PipelineOrchestrator, send_event

logger = logging.getLogger(__name__)

router = APIRouter()

# Максимальный размер аудио: 1MB (защита от DoS)
MAX_AUDIO_SIZE = 1 * 1024 * 1024

# Rate limiting: максимум сообщений в минуту на сессию
MAX_MESSAGES_PER_MINUTE = 15


def _check_rate_limit(session: dict) -> bool:
    """Check if session exceeds rate limit. Returns True if blocked."""
    now = time.time()
    timestamps = session["message_timestamps"]
    session["message_timestamps"] = [t for t in timestamps if now - t < 60]
    if len(session["message_timestamps"]) >= MAX_MESSAGES_PER_MINUTE:
        return True
    session["message_timestamps"].append(now)
    return False


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
    - processing_started: {transcript}
    - reconstruction_result: {corrected, original_intent, main_error, ...}
    - variants_result: {simple, professional, colloquial, slang, idiom}
    - companion_token: {delta, companion}
    - companion_response: {text, companion}
    - onboarding_complete: {data, companion}
    - error: {message}

    JSON messages (client -> server):
    - session_config: {companion, scenario, onboarding}
    - text_message: {text}
    """
    await websocket.accept()
    logger.info("WebSocket connected")

    session: dict = {
        "companion": "Alex",
        "scenario": None,
        "history": [],
        "processing": False,
        "message_timestamps": [],
        "onboarding": False,
        "onboarding_history": [],
        "error_history": [],
    }
    orchestrator = PipelineOrchestrator(session)

    try:
        while True:
            message = await websocket.receive()

            # --- Text JSON messages ---
            if "text" in message:
                try:
                    data = json.loads(message["text"])
                    msg_type = data.get("type")

                    if msg_type == "session_config":
                        if "companion" in data:
                            session["companion"] = data["companion"]
                        if "scenario" in data:
                            session["scenario"] = data["scenario"]
                        if "onboarding" in data:
                            session["onboarding"] = data["onboarding"]
                        continue

                    elif msg_type == "text_message":
                        if session["processing"]:
                            await send_event(websocket, "error", {"message": "Already processing a request"})
                            continue
                        if _check_rate_limit(session):
                            await send_event(websocket, "error", {"message": "Rate limit exceeded"})
                            continue

                        text = data.get("text", "")
                        session["processing"] = True
                        try:
                            if session.get("onboarding"):
                                await orchestrator.run_onboarding(text, websocket)
                            else:
                                await orchestrator.run_text(text, websocket)
                        finally:
                            session["processing"] = False
                        continue

                except json.JSONDecodeError:
                    await send_event(websocket, "error", {"message": "Invalid JSON message"})
                    continue

            # --- Binary audio messages ---
            if "bytes" in message:
                if session["processing"]:
                    await send_event(websocket, "error", {"message": "Already processing a request"})
                    continue
                if _check_rate_limit(session):
                    await send_event(websocket, "error", {"message": "Rate limit exceeded"})
                    continue

                audio_bytes = message["bytes"]
                logger.info("Received audio: %d bytes", len(audio_bytes))

                if len(audio_bytes) > MAX_AUDIO_SIZE:
                    await send_event(websocket, "error", {
                        "message": f"Audio too large: {len(audio_bytes)} bytes (max {MAX_AUDIO_SIZE})"
                    })
                    continue

                session["processing"] = True
                try:
                    await orchestrator.run_voice(audio_bytes, websocket)
                except Exception as e:
                    logger.error("Pipeline failed", exc_info=True)
                    await send_event(websocket, "error", {"message": f"Processing failed: {str(e)}"})
                finally:
                    session["processing"] = False

    except WebSocketDisconnect:
        logger.info("WebSocket disconnected")
    except Exception as e:
        try:
            await send_event(websocket, "error", {"message": f"Server error: {str(e)}"})
        except Exception:
            pass
