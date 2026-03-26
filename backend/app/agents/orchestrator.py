"""
Orchestrator Agent — LinguaCompanion

Координирует AI pipeline:
1. STT (transcribe)
2. Parallel: Reconstruction + PhraseVariants
3. (Future) Companion + TTS + Memory

Используется как WebSocket endpoint и как standalone API.
"""
import asyncio
import time
from dataclasses import dataclass
from typing import Optional

from app.agents.stt import transcribe
from app.agents.reconstruction import reconstruct
from app.agents.phrase_variants import get_variants


@dataclass
class PipelineResult:
    """Result of full voice pipeline execution."""
    # STT
    transcript: str
    language: str
    stt_provider: str
    stt_latency_ms: float
    stt_fallback: bool

    # Reconstruction
    corrected: str
    original_intent: str
    main_error: Optional[str]
    error_type: str
    explanation: Optional[str]

    # Variants (each is {"text": "...", "context": "..."})
    simple: dict
    professional: dict
    colloquial: dict
    slang: dict
    idiom: dict

    # Timing
    total_latency_ms: float


async def run_pipeline(audio_bytes: bytes, filename: str = "audio.webm") -> PipelineResult:
    """
    Execute full voice pipeline synchronously (for HTTP API).

    Returns PipelineResult with all fields populated.
    Raises exception on critical failure (STT).
    On LLM failure, returns degraded results (raw transcript in all fields).
    """
    start = time.time()

    # 1. STT
    stt_result = await transcribe(audio_bytes, filename)
    transcript = stt_result.get("text", "")

    if not transcript.strip():
        raise ValueError("Empty transcript from STT")

    # 2. Reconstruction first, then variants with corrected text
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
