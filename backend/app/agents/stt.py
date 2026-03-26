"""
STT Agent — LinguaCompanion

Spike results (2026-03-10):
- Deepgram Nova-3 (language=multi): 6/6 code-switching, avg 2.56s  ← PRIMARY
- Groq Whisper large-v3-turbo:      3/6 code-switching, avg 0.67s  ← FALLBACK
- Gemini 2.5 Flash Lite:            4/6 code-switching, avg 2.31s

Groq is faster but loses one language in genuinely mixed speech.
Deepgram language=multi correctly detects all RU+EN combinations.
"""
import logging
import time
import httpx
import json
from groq import AsyncGroq
from app.core.config import settings

logger = logging.getLogger(__name__)


# ── Deepgram (Primary) ────────────────────────────────────────────────

async def transcribe_deepgram(audio_bytes: bytes, mime_type: str = "audio/mp4") -> dict:
    """
    Primary STT: Deepgram Nova-3 with language=multi.
    Best for Russian/English code-switching.
    
    language=multi: Deepgram's dedicated code-switching mode.
    Correctly transcribes mixed RU/EN speech preserving both languages.
    """
    url = (
        "https://api.deepgram.com/v1/listen"
        "?model=nova-3"
        "&language=multi"
        "&smart_format=true"
        "&punctuate=true"
    )
    start = time.time()
    async with httpx.AsyncClient(timeout=15.0) as client:
        response = await client.post(
            url,
            content=audio_bytes,
            headers={
                "Authorization": f"Token {settings.DEEPGRAM_API_KEY}",
                "Content-Type": mime_type,
            },
        )
        response.raise_for_status()
        data = response.json()

    latency_ms = (time.time() - start) * 1000
    alt = data["results"]["channels"][0]["alternatives"][0]

    text = alt.get("transcript", "").strip()
    logger.info("Deepgram transcription: %.1fms, %d chars", latency_ms, len(text))
    return {
        "text": text,
        "language": "multi",
        "provider": "deepgram",
        "model": "nova-3",
        "latency_ms": round(latency_ms, 1),
    }


# ── Groq Whisper (Fallback) ────────────────────────────────────────────

_groq_client = None

def _get_groq():
    global _groq_client
    if not _groq_client:
        _groq_client = AsyncGroq(api_key=settings.GROQ_API_KEY)
    return _groq_client


async def transcribe_groq(audio_bytes: bytes, filename: str = "audio.m4a") -> dict:
    """
    Fallback STT: Groq Whisper large-v3-turbo.
    Faster (0.67s avg) but may lose one language in mixed speech.
    Use when Deepgram is unavailable.
    """
    start = time.time()
    result = await _get_groq().audio.transcriptions.create(
        file=(filename, audio_bytes),
        model=settings.WHISPER_MODEL,
        response_format="verbose_json",
        language=None,  # auto-detect
    )
    latency_ms = (time.time() - start) * 1000

    text = result.text.strip()
    logger.info("Groq transcription: %.1fms, %d chars", latency_ms, len(text))
    return {
        "text": text,
        "language": result.language,
        "provider": "groq",
        "model": settings.WHISPER_MODEL,
        "latency_ms": round(latency_ms, 1),
    }


# ── Orchestrated transcribe with fallback ─────────────────────────────

async def transcribe(audio_bytes: bytes, filename: str = "audio.m4a") -> dict:
    """
    Transcribe audio with automatic fallback.
    
    Primary:  Deepgram Nova-3 (language=multi) — best code-switching
    Fallback: Groq Whisper   (language=None)  — fast, good quality
    
    Returns:
        {
            "text":       str,    # transcript
            "language":   str,    # detected language(s)
            "provider":   str,    # "deepgram" | "groq"
            "model":      str,
            "latency_ms": float,
            "fallback":   bool,   # True if fallback was used
        }
    """
    provider = getattr(settings, "STT_PROVIDER", "deepgram")

    if provider == "deepgram" and settings.DEEPGRAM_API_KEY:
        try:
            ext = filename.rsplit(".", 1)[-1].lower()
            mime = {"m4a": "audio/mp4", "mp3": "audio/mpeg",
                    "wav": "audio/wav", "ogg": "audio/ogg"}.get(ext, "audio/mp4")
            result = await transcribe_deepgram(audio_bytes, mime)
            result["fallback"] = False
            return result
        except Exception as e:
            logger.warning("Deepgram failed, falling back to Groq", exc_info=True)

    # Groq fallback
    result = await transcribe_groq(audio_bytes, filename)
    result["fallback"] = provider == "deepgram"
    return result
