"""
TTS REST endpoint — LinguaCompanion

POST /api/v1/tts — синтез речи через Edge-TTS
GET  /api/v1/tts/voices — список доступных голосов
"""
import logging

from fastapi import APIRouter, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel, Field

from app.agents.tts import synthesize, get_voice_name, VOICES

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/tts", tags=["tts"])


class TtsRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=2000)
    voice: str = Field(default="us-male")
    rate: str = Field(default="1.0")


def _rate_to_ssml(rate: str) -> str:
    """Конвертирует rate из '0.8'–'1.2' формата в SSML '+0%'–'+20%' формат."""
    try:
        value = float(rate)
        percent = round((value - 1.0) * 100)
        sign = "+" if percent >= 0 else ""
        return f"{sign}{percent}%"
    except (ValueError, TypeError):
        return "+0%"


@router.post("")
async def tts_synthesize(req: TtsRequest) -> Response:
    """Синтез речи. Возвращает audio/mpeg."""
    voice_name = get_voice_name(req.voice)
    ssml_rate = _rate_to_ssml(req.rate)

    try:
        audio = await synthesize(req.text, voice=voice_name, rate=ssml_rate)
    except Exception:
        logger.error("TTS synthesis failed", exc_info=True)
        raise HTTPException(status_code=500, detail="TTS synthesis failed")

    return Response(content=audio, media_type="audio/mpeg")


@router.get("/voices")
async def tts_voices():
    """Список доступных голосов."""
    return {
        "voices": [
            {"key": key, "name": name}
            for key, name in VOICES.items()
        ]
    }
