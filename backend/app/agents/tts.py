"""
Edge-TTS Agent — LinguaCompanion

Ответственность:
- Синтез речи через Edge-TTS (Microsoft Neural voices)
- LRU кеш (50 записей) для повторных запросов
- 4 голоса: US/GB × Male/Female
"""
import logging
from collections import OrderedDict

import edge_tts

logger = logging.getLogger(__name__)

# Доступные голоса
VOICES = {
    "us-male": "en-US-GuyNeural",
    "us-female": "en-US-JennyNeural",
    "gb-male": "en-GB-RyanNeural",
    "gb-female": "en-GB-SoniaNeural",
}

DEFAULT_VOICE = "en-US-GuyNeural"

# LRU кеш: (text, voice, rate) -> bytes
_tts_cache: OrderedDict[tuple[str, str, str], bytes] = OrderedDict()
_CACHE_MAX_SIZE = 50


def get_voice_name(voice_key: str) -> str:
    """Получить имя голоса Edge-TTS по ключу. Fallback на DEFAULT_VOICE."""
    return VOICES.get(voice_key, DEFAULT_VOICE)


async def synthesize(
    text: str,
    voice: str = DEFAULT_VOICE,
    rate: str = "+0%",
) -> bytes:
    """
    Синтезирует речь через Edge-TTS.

    Args:
        text: Текст для синтеза
        voice: Имя голоса Edge-TTS (например en-US-GuyNeural)
        rate: Скорость речи (например +10%, -20%)

    Returns:
        bytes: Аудио в формате MP3
    """
    cache_key = (text, voice, rate)

    # Проверяем кеш
    if cache_key in _tts_cache:
        _tts_cache.move_to_end(cache_key)
        return _tts_cache[cache_key]

    # Синтез
    communicate = edge_tts.Communicate(text, voice, rate=rate)
    audio_chunks: list[bytes] = []

    async for chunk in communicate.stream():
        if chunk["type"] == "audio":
            audio_chunks.append(chunk["data"])

    audio_data = b"".join(audio_chunks)

    if not audio_data:
        raise ValueError("Edge-TTS returned empty audio")

    # Сохраняем в кеш
    _tts_cache[cache_key] = audio_data
    _tts_cache.move_to_end(cache_key)

    # Ограничиваем размер кеша
    while len(_tts_cache) > _CACHE_MAX_SIZE:
        _tts_cache.popitem(last=False)

    logger.info("TTS synthesized: %d bytes, voice=%s, rate=%s", len(audio_data), voice, rate)
    return audio_data
