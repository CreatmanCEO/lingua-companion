"""
TTS Fallback Chain Tests — LinguaCompanion

Tests for circuit breaker, cache, voice mapping, and provider fallback.
"""
import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from app.agents.tts import get_voice_name, synthesize, TTSProvider, _providers


def test_get_voice_name_known():
    result = get_voice_name("us-male")
    assert result == "us-male"


def test_get_voice_name_unknown():
    result = get_voice_name("unknown")
    assert result == "us-male"  # default


def test_provider_circuit_breaker():
    p = TTSProvider("test")
    assert p.is_available
    for _ in range(3):
        p.record_failure()
    assert not p.is_available  # in cooldown


def test_provider_recovery():
    p = TTSProvider("test", cooldown_seconds=0)
    for _ in range(3):
        p.record_failure()
    # cooldown_seconds=0 means immediate recovery
    assert p.is_available


@pytest.mark.asyncio
async def test_synthesize_uses_cache():
    from app.agents.tts import _tts_cache
    _tts_cache.clear()
    _tts_cache[("Hello", "us-male", "+0%")] = b"cached-audio"
    result = await synthesize("Hello", voice="us-male", rate="+0%")
    assert result == b"cached-audio"
    _tts_cache.clear()


@pytest.mark.asyncio
async def test_synthesize_backward_compat_edge_voice_name():
    """Passing an Edge-TTS voice name directly still works (backward compat)."""
    from app.agents.tts import _tts_cache
    _tts_cache.clear()
    _tts_cache[("Test", "gb-male", "+0%")] = b"compat-audio"
    result = await synthesize("Test", voice="en-GB-RyanNeural", rate="+0%")
    assert result == b"compat-audio"
    _tts_cache.clear()


def test_provider_success_resets_failures():
    p = TTSProvider("test")
    p.record_failure()
    p.record_failure()
    assert p.failure_count == 2
    p.record_success()
    assert p.failure_count == 0


@pytest.mark.asyncio
async def test_chain_falls_through_to_edge():
    """When ElevenLabs and Polly fail, Edge-TTS handles it."""
    from app.agents.tts import _tts_cache, _providers, _PROVIDER_FUNCS

    _tts_cache.clear()
    # Reset providers
    for p in _providers.values():
        p.failure_count = 0

    orig_funcs = dict(_PROVIDER_FUNCS)
    _PROVIDER_FUNCS["elevenlabs"] = AsyncMock(side_effect=RuntimeError("no keys"))
    _PROVIDER_FUNCS["polly"] = AsyncMock(side_effect=RuntimeError("no creds"))
    _PROVIDER_FUNCS["edge"] = AsyncMock(return_value=b"edge-audio")

    try:
        result = await synthesize("Fallback test", voice="us-male", rate="+0%")
        assert result == b"edge-audio"
    finally:
        _PROVIDER_FUNCS.update(orig_funcs)
        _tts_cache.clear()
        for p in _providers.values():
            p.failure_count = 0
