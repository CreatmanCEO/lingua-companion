"""
TTS Fallback Chain — LinguaCompanion

Chain: ElevenLabs -> AWS Polly -> Edge-TTS (emergency)
Circuit breaker: 3 failures -> 60s cooldown per provider.
LRU cache: 50 entries checked BEFORE chain.
"""
import time
import logging
from collections import OrderedDict
from dataclasses import dataclass
from typing import Optional

import edge_tts

from app.core.config import settings

logger = logging.getLogger(__name__)

# Voice mapping per provider
VOICE_MAP = {
    "elevenlabs": {
        "us-male": "pNInz6obpgDQGcFmaJgB",      # Adam
        "us-female": "21m00Tcm4TlvDq8ikWAM",     # Rachel
        "gb-male": "IKne3meq5aSn9XLyUdCD",       # Charlie
        "gb-female": "ThT5KcBeYPX3keUQqHPh",     # Dorothy
    },
    "polly": {
        "us-male": "Matthew",
        "us-female": "Ruth",
        "gb-male": "Arthur",
        "gb-female": "Amy",
    },
    "edge": {
        "us-male": "en-US-GuyNeural",
        "us-female": "en-US-JennyNeural",
        "gb-male": "en-GB-RyanNeural",
        "gb-female": "en-GB-SoniaNeural",
    },
}

# Backward compat: expose VOICES as alias for edge map
VOICES = VOICE_MAP["edge"]

DEFAULT_VOICE_KEY = "us-male"
# Legacy constant kept for backward compat with imports
DEFAULT_VOICE = VOICE_MAP["edge"][DEFAULT_VOICE_KEY]

# LRU cache
_tts_cache: OrderedDict[tuple, bytes] = OrderedDict()
_CACHE_MAX_SIZE = 50


@dataclass
class TTSProvider:
    name: str
    enabled: bool = True
    failure_count: int = 0
    last_failure: float = 0
    cooldown_seconds: float = 60
    max_failures: int = 3

    @property
    def is_available(self) -> bool:
        if not self.enabled:
            return False
        if self.failure_count >= self.max_failures:
            if time.time() - self.last_failure < self.cooldown_seconds:
                return False
            # Cooldown expired, reset
            self.failure_count = 0
        return True

    def record_failure(self):
        self.failure_count += 1
        self.last_failure = time.time()

    def record_success(self):
        self.failure_count = 0


@dataclass
class TTSResult:
    audio: bytes
    provider: str
    latency_ms: float


# Provider instances
_providers = {
    "elevenlabs": TTSProvider("elevenlabs"),
    "polly": TTSProvider("polly"),
    "edge": TTSProvider("edge", max_failures=999),  # never disable
}

_CHAIN_ORDER = ["elevenlabs", "polly", "edge"]

# ElevenLabs key rotation
_elevenlabs_key_index = 0


async def _elevenlabs_tts(text: str, voice_key: str, rate: str) -> bytes:
    """Synthesize via ElevenLabs API."""
    global _elevenlabs_key_index

    raw_keys = settings.ELEVENLABS_API_KEYS.strip()
    if not raw_keys:
        raise RuntimeError("No ElevenLabs API keys configured")

    keys = [k.strip() for k in raw_keys.split(",") if k.strip()]
    if not keys:
        raise RuntimeError("No ElevenLabs API keys configured")

    key = keys[_elevenlabs_key_index % len(keys)]
    _elevenlabs_key_index = (_elevenlabs_key_index + 1) % len(keys)

    voice_id = VOICE_MAP["elevenlabs"].get(voice_key, VOICE_MAP["elevenlabs"][DEFAULT_VOICE_KEY])

    from elevenlabs import AsyncElevenLabs

    client = AsyncElevenLabs(api_key=key)
    try:
        response = await client.text_to_speech.convert(
            voice_id=voice_id,
            text=text,
            model_id="eleven_multilingual_v2",
        )
        # response is an async iterator of bytes chunks
        chunks = []
        async for chunk in response:
            chunks.append(chunk)
        audio = b"".join(chunks)

        if not audio:
            raise RuntimeError("ElevenLabs returned empty audio")
        return audio
    finally:
        await client.close()


async def _polly_tts(text: str, voice_key: str, rate: str) -> bytes:
    """Synthesize via AWS Polly."""
    if not settings.AWS_ACCESS_KEY_ID or not settings.AWS_SECRET_ACCESS_KEY:
        raise RuntimeError("No AWS credentials configured")

    voice_id = VOICE_MAP["polly"].get(voice_key, VOICE_MAP["polly"][DEFAULT_VOICE_KEY])

    import aioboto3

    session = aioboto3.Session(
        aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
        aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
        region_name=settings.AWS_REGION,
    )

    async with session.client("polly") as polly:
        response = await polly.synthesize_speech(
            Text=text,
            OutputFormat="mp3",
            VoiceId=voice_id,
            Engine="generative",
        )
        audio_stream = response["AudioStream"]
        audio = await audio_stream.read()

    if not audio:
        raise RuntimeError("AWS Polly returned empty audio")
    return audio


async def _edge_tts_synth(text: str, voice_key: str, rate: str) -> bytes:
    """Synthesize via Edge-TTS (free, always available)."""
    voice = VOICE_MAP["edge"].get(voice_key, VOICE_MAP["edge"][DEFAULT_VOICE_KEY])

    communicate = edge_tts.Communicate(text, voice, rate=rate)
    audio_chunks: list[bytes] = []

    async for chunk in communicate.stream():
        if chunk["type"] == "audio":
            audio_chunks.append(chunk["data"])

    audio_data = b"".join(audio_chunks)

    if not audio_data:
        raise ValueError("Edge-TTS returned empty audio")

    return audio_data


_PROVIDER_FUNCS = {
    "elevenlabs": _elevenlabs_tts,
    "polly": _polly_tts,
    "edge": _edge_tts_synth,
}


async def _synthesize_with_chain(text: str, voice_key: str, rate: str) -> TTSResult:
    """Try each provider in chain order, return first success."""
    errors = []

    for provider_name in _CHAIN_ORDER:
        provider = _providers[provider_name]
        if not provider.is_available:
            logger.debug("TTS provider %s unavailable (circuit breaker)", provider_name)
            continue

        func = _PROVIDER_FUNCS[provider_name]
        t0 = time.time()
        try:
            audio = await func(text, voice_key, rate)
            latency = (time.time() - t0) * 1000
            provider.record_success()
            logger.info(
                "TTS success: provider=%s, %d bytes, %.0fms",
                provider_name, len(audio), latency,
            )
            return TTSResult(audio=audio, provider=provider_name, latency_ms=latency)
        except Exception as e:
            latency = (time.time() - t0) * 1000
            provider.record_failure()
            errors.append(f"{provider_name}: {e}")
            logger.warning(
                "TTS provider %s failed (%.0fms): %s", provider_name, latency, e,
            )

    raise RuntimeError(f"All TTS providers failed: {'; '.join(errors)}")


def get_voice_name(voice_key: str) -> str:
    """Return voice_key if valid, DEFAULT_VOICE_KEY otherwise."""
    if voice_key in VOICE_MAP["edge"]:
        return voice_key
    return DEFAULT_VOICE_KEY


async def synthesize(
    text: str,
    voice: str = DEFAULT_VOICE_KEY,
    rate: str = "+0%",
) -> bytes:
    """
    Synthesize speech via TTS fallback chain.

    Args:
        text: Text to synthesize
        voice: Voice key (e.g. "us-male", "gb-female")
        rate: Speech rate in SSML format (e.g. "+10%", "-20%")

    Returns:
        bytes: Audio in MP3 format
    """
    # Normalize voice: if caller passed an Edge-TTS name, map it back to key
    voice_key = voice
    if voice_key not in VOICE_MAP["edge"]:
        # Try reverse lookup from edge voice names for backward compat
        for key, edge_name in VOICE_MAP["edge"].items():
            if voice == edge_name:
                voice_key = key
                break
        else:
            voice_key = DEFAULT_VOICE_KEY

    cache_key = (text, voice_key, rate)

    # Check cache
    if cache_key in _tts_cache:
        _tts_cache.move_to_end(cache_key)
        return _tts_cache[cache_key]

    # Synthesize via chain
    result = await _synthesize_with_chain(text, voice_key, rate)

    # Store in cache
    _tts_cache[cache_key] = result.audio
    _tts_cache.move_to_end(cache_key)

    # Limit cache size
    while len(_tts_cache) > _CACHE_MAX_SIZE:
        _tts_cache.popitem(last=False)

    return result.audio
