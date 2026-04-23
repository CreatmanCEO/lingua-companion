"""
Orchestrator Agent — LinguaCompanion

PipelineOrchestrator: encapsulates ALL pipeline logic extracted from ws.py.
ws.py remains a thin WebSocket transport layer.

Pipelines:
- run_voice: STT → Reconstruct → parallel(Variants + Companion) → Memory
- run_text: Reconstruct → parallel(Variants + Companion) → Memory
- run_onboarding: Onboarding agent → fact extraction
"""

import asyncio
import logging
import time
from dataclasses import dataclass
from typing import Optional

from fastapi import WebSocket
from starlette.websockets import WebSocketState

from app.agents.stt import transcribe
from app.agents.reconstruction import reconstruct
from app.agents.phrase_variants import get_variants, REQUIRED_STYLES
from app.agents.companion import generate_response_stream, _FALLBACK_RESPONSE
from app.agents.memory import (
    search_memory, get_user_facts, store_memory,
    extract_facts, upsert_fact, track_vocab_gap, USER_ID,
)
from app.agents.onboarding import (
    get_onboarding_response, extract_onboarding_data, is_onboarding_complete,
)

logger = logging.getLogger(__name__)

# Максимальное количество сообщений в истории сессии
MAX_HISTORY_MESSAGES = 20


@dataclass
class PipelineResult:
    """Result of full voice pipeline execution (for HTTP API)."""
    transcript: str
    language: str
    stt_provider: str
    stt_latency_ms: float
    stt_fallback: bool
    corrected: str
    original_intent: str
    main_error: Optional[str]
    error_type: str
    explanation: Optional[str]
    simple: dict
    professional: dict
    colloquial: dict
    slang: dict
    idiom: dict
    total_latency_ms: float


async def run_pipeline(audio_bytes: bytes, filename: str = "audio.webm") -> PipelineResult:
    """
    Execute full voice pipeline synchronously (for HTTP API).
    Kept for backward compatibility.
    """
    start = time.time()

    stt_result = await transcribe(audio_bytes, filename)
    transcript = stt_result.get("text", "")

    if not transcript.strip():
        raise ValueError("Empty transcript from STT")

    try:
        reconstruction_result = await reconstruct(transcript)
    except Exception:
        reconstruction_result = {
            "corrected": transcript,
            "original_intent": transcript,
            "main_error": None,
            "error_type": "none",
            "explanation": None,
        }

    corrected = reconstruction_result.get("corrected", transcript)

    try:
        variants_result = await get_variants(corrected)
    except Exception:
        variants_result = {k: {"text": corrected, "context": ""} for k in ["simple", "professional", "colloquial", "slang", "idiom"]}

    total_ms = (time.time() - start) * 1000

    return PipelineResult(
        transcript=transcript,
        language=stt_result.get("language", "unknown"),
        stt_provider=stt_result.get("provider", "unknown"),
        stt_latency_ms=stt_result.get("latency_ms", 0),
        stt_fallback=stt_result.get("fallback", False),
        corrected=reconstruction_result.get("corrected", transcript),
        original_intent=reconstruction_result.get("original_intent", transcript),
        main_error=reconstruction_result.get("main_error"),
        error_type=reconstruction_result.get("error_type", "none"),
        explanation=reconstruction_result.get("explanation"),
        simple=variants_result.get("simple", {"text": corrected, "context": ""}),
        professional=variants_result.get("professional", {"text": corrected, "context": ""}),
        colloquial=variants_result.get("colloquial", {"text": corrected, "context": ""}),
        slang=variants_result.get("slang", {"text": corrected, "context": ""}),
        idiom=variants_result.get("idiom", {"text": corrected, "context": ""}),
        total_latency_ms=round(total_ms, 1),
    )


async def send_event(ws: WebSocket, event_type: str, data: dict) -> None:
    """Send JSON event to client (if connection is open)."""
    if ws.client_state == WebSocketState.CONNECTED:
        await ws.send_json({"type": event_type, **data})


class PipelineOrchestrator:
    """Encapsulates all pipeline logic for a WebSocket session."""

    def __init__(self, session: dict):
        self.session = session

    # ------------------------------------------------------------------
    # Public pipelines
    # ------------------------------------------------------------------

    async def run_voice(self, audio_bytes: bytes, websocket: WebSocket) -> None:
        """Full voice pipeline: STT -> Reconstruct -> parallel(Variants + Companion) -> Memory."""
        # 1. STT
        stt_result = await transcribe(audio_bytes, "audio.webm")
        await send_event(websocket, "stt_result", stt_result)

        transcript = stt_result.get("text", "")
        if not transcript.strip():
            await send_event(websocket, "error", {"message": "Empty transcript"})
            return

        # Send processing_started before pipeline
        await send_event(websocket, "processing_started", {"transcript": transcript})

        # 2. Reconstruction with degraded fallback
        try:
            reconstruction_result = await reconstruct(transcript)
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

        # 3. Track vocab gaps from reconstruction changes
        for change in reconstruction_result.get("changes", []):
            asyncio.create_task(
                track_vocab_gap(USER_ID, change.get("original", ""), change.get("corrected", "")),
                name="vocab_gap",
            )

        # 4. Parallel: variants + companion streaming
        variants_task = asyncio.create_task(get_variants(corrected), name="variants")

        await self._run_companion_and_variants(
            websocket, transcript, reconstruction_result, variants_task,
        )

    async def run_text(self, text: str, websocket: WebSocket) -> None:
        """Text pipeline: Reconstruct -> parallel(Variants + Companion) -> Memory."""
        if not text.strip():
            await send_event(websocket, "error", {"message": "Empty text message"})
            return

        try:
            # 1. Reconstruction
            reconstruction_result = await reconstruct(text)
            corrected = reconstruction_result.get("corrected", text)

            # 2. Track vocab gaps from reconstruction changes
            for change in reconstruction_result.get("changes", []):
                asyncio.create_task(
                    track_vocab_gap(USER_ID, change.get("original", ""), change.get("corrected", "")),
                    name="vocab_gap",
                )

            # 3. Parallel: variants + companion streaming
            variants_task = asyncio.create_task(get_variants(corrected), name="variants")

            await self._run_companion_and_variants(
                websocket, text, reconstruction_result, variants_task,
            )
        except Exception as e:
            await send_event(websocket, "error", {"message": f"Processing failed: {str(e)}"})

    async def run_onboarding(self, text: str, websocket: WebSocket) -> None:
        """Onboarding pipeline: onboarding agent -> fact extraction."""
        if not text.strip():
            await send_event(websocket, "error", {"message": "Empty text message"})
            return

        try:
            onboarding_history = self.session.get("onboarding_history", [])

            result = await get_onboarding_response(text, onboarding_history)

            # Update onboarding history
            onboarding_history.append({"role": "user", "content": text})
            onboarding_history.append({"role": "assistant", "content": result["text"]})
            self.session["onboarding_history"] = onboarding_history

            # Send response as companion_response
            await send_event(websocket, "companion_response", {
                "text": result["text"],
                "companion": "Onboarding",
            })

            # Check completion
            data = await extract_onboarding_data(onboarding_history)
            if is_onboarding_complete(data):
                # Save facts to memory
                for key, value in data.items():
                    asyncio.create_task(
                        upsert_fact(USER_ID, key, str(value)),
                        name=f"onboarding_fact_{key}",
                    )

                # Switch to companion mode
                self.session["onboarding"] = False

                style_to_companion = {
                    "professional": "Alex",
                    "casual": "Sam",
                    "mentor": "Morgan",
                }
                chosen = style_to_companion.get(data.get("style", ""), "Alex")
                self.session["companion"] = chosen

                await send_event(websocket, "onboarding_complete", {
                    "data": data,
                    "companion": chosen,
                })

        except Exception as e:
            logger.error("Onboarding processing failed", exc_info=True)
            await send_event(websocket, "error", {"message": f"Onboarding failed: {str(e)}"})

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------

    async def _build_memory_context(self, user_id: str, query: str) -> str | None:
        """READ: memory search + user facts -> context string.

        Side effect: caches raw facts dict in self.session["_cached_facts"].
        """
        try:
            facts, memories = await asyncio.gather(
                get_user_facts(user_id),
                search_memory(user_id, query, top_k=5),
                return_exceptions=True,
            )

            parts = []
            if isinstance(facts, dict) and facts:
                self.session["_cached_facts"] = facts
                facts_str = ", ".join(f"{k}: {v}" for k, v in facts.items())
                parts.append(f"Known facts: {facts_str}")

            if isinstance(memories, list) and memories:
                mem_texts = [m["text"] for m in memories[:3]]
                parts.append("Related memories: " + " | ".join(mem_texts))

            return "\n".join(parts) if parts else None

        except Exception:
            logger.error("Memory READ failed", exc_info=True)
            return None

    async def _memory_write_behind(self, user_id: str, user_text: str, companion_text: str) -> None:
        """WRITE (fire-and-forget): store memory, extract facts."""
        try:
            await store_memory(user_id, f"User: {user_text}\nAssistant: {companion_text}", {
                "type": "conversation",
            })

            facts = await extract_facts(user_text)
            for key, value in facts.items():
                if key and value:
                    await upsert_fact(user_id, key, str(value))

        except Exception:
            logger.error("Memory WRITE failed", exc_info=True)

    async def _stream_companion(
        self,
        websocket: WebSocket,
        corrected: str,
        memory_context: str | None = None,
        user_level: str = "B1",
        repeated_errors: list | None = None,
    ) -> str:
        """Stream companion tokens via WS. Returns full text."""
        companion_name = self.session.get("companion", "Alex")
        full_text = _FALLBACK_RESPONSE

        try:
            async for event in generate_response_stream(
                user_message=corrected,
                companion=companion_name,
                history=self.session.get("history", []),
                scenario=self.session.get("scenario"),
                memory_context=memory_context,
                user_level=user_level,
                repeated_errors=repeated_errors,
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

    async def _run_companion_and_variants(
        self,
        websocket: WebSocket,
        transcript: str,
        reconstruction_result: dict,
        variants_task: asyncio.Task,
    ) -> None:
        """
        Send reconstruction_result, stream companion, wait for variants, update history + memory.
        """
        # Send reconstruction_result immediately
        await send_event(websocket, "reconstruction_result", reconstruction_result)

        corrected = reconstruction_result.get("corrected", transcript)

        # --- Error tracking: session-level counting ---
        error_history = self.session.setdefault("error_history", [])

        for change in reconstruction_result.get("changes", []):
            error_type = change.get("type", "")
            original = change.get("original", "").lower()

            # Find matching existing error
            matched = False
            for entry in error_history:
                if entry["type"] == error_type and (
                    original in entry["pattern"] or entry["pattern"] in original
                ):
                    entry["count"] += 1
                    matched = True
                    break

            if not matched:
                error_history.append({"pattern": original, "type": error_type, "count": 1})

        # Collect repeated errors (3+ occurrences)
        repeated_errors = [
            f"{e['pattern']} ({e['type']}, {e['count']}x)"
            for e in error_history if e["count"] >= 3
        ]

        # Memory READ: search + facts -> context for companion
        memory_context = await self._build_memory_context(USER_ID, corrected)

        # --- Adaptive level wiring (uses facts cached by _build_memory_context) ---
        user_level = "B1"  # default
        cached_facts = self.session.get("_cached_facts")
        if cached_facts:
            user_level = cached_facts.get("level", "B1")

        # Start companion streaming
        companion_task = asyncio.create_task(
            self._stream_companion(
                websocket, corrected,
                memory_context=memory_context,
                user_level=user_level,
                repeated_errors=repeated_errors,
            ),
            name="companion_stream",
        )

        # Wait for variants
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

        # Wait for companion streaming to finish
        companion_text = await companion_task

        # Update session history
        history = self.session.setdefault("history", [])
        history.append({"role": "user", "content": corrected})
        history.append({"role": "assistant", "content": companion_text})

        if len(history) > MAX_HISTORY_MESSAGES:
            self.session["history"] = history[-MAX_HISTORY_MESSAGES:]

        # Memory WRITE (fire-and-forget, non-blocking)
        asyncio.create_task(
            self._memory_write_behind(USER_ID, corrected, companion_text),
            name="memory_write",
        )
