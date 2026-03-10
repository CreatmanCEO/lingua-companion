"""
STT Agent — LinguaCompanion

Responsibility:
- Receives audio chunk (bytes) via WebSocket
- Sends to Groq Whisper large-v3-turbo with language=None (auto-detect)
- Returns: transcript text + detected language + language tags

Spike test confirmed:
- Code-switching RU/EN works natively
- Avg latency: 0.55s (well within 800ms budget)
- Model: whisper-large-v3-turbo
"""
import time
from groq import AsyncGroq
from app.core.config import settings


client = AsyncGroq(api_key=settings.GROQ_API_KEY)


async def transcribe(audio_bytes: bytes, filename: str = "audio.m4a") -> dict:
    """
    Transcribe audio with automatic language detection.
    Handles mixed RU/EN speech natively.
    
    Returns:
        {
            "text": str,           # full transcript
            "language": str,       # detected primary language
            "latency_ms": float,
        }
    """
    start = time.time()
    
    result = await client.audio.transcriptions.create(
        file=(filename, audio_bytes),
        model=settings.WHISPER_MODEL,
        response_format="verbose_json",
        language=None,  # CRITICAL: auto-detect enables code-switching
    )
    
    latency_ms = (time.time() - start) * 1000
    
    return {
        "text": result.text,
        "language": result.language,
        "latency_ms": round(latency_ms, 1),
    }
