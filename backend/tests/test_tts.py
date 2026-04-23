"""
Тесты Edge-TTS Agent — LinguaCompanion

8 unit-тестов: edge_tts.Communicate замокан.
"""
import pytest
from unittest.mock import patch, AsyncMock, MagicMock


async def _async_iter(items):
    """Helper: async generator из списка."""
    for item in items:
        yield item


@pytest.mark.asyncio
async def test_synthesize_returns_bytes():
    """synthesize() возвращает непустые bytes."""
    with patch("app.agents.tts.edge_tts.Communicate") as MockComm:
        instance = MagicMock()
        instance.stream.return_value = _async_iter([
            {"type": "audio", "data": b"\xff\xfb\x90\x00" * 100},
            {"type": "WordBoundary", "offset": 0},
            {"type": "audio", "data": b"\xff\xfb\x90\x00" * 50},
        ])
        MockComm.return_value = instance

        from app.agents.tts import synthesize, _tts_cache
        _tts_cache.clear()
        audio = await synthesize("Hello world")

        assert isinstance(audio, bytes)
        assert len(audio) > 0


@pytest.mark.asyncio
async def test_synthesize_with_voice():
    """synthesize() передаёт voice в Communicate."""
    with patch("app.agents.tts.edge_tts.Communicate") as MockComm:
        instance = MagicMock()
        instance.stream.return_value = _async_iter([
            {"type": "audio", "data": b"\x00" * 10},
        ])
        MockComm.return_value = instance

        from app.agents.tts import synthesize, _tts_cache
        _tts_cache.clear()
        await synthesize("Test", voice="en-GB-RyanNeural")

        MockComm.assert_called_once()
        call_args = MockComm.call_args
        assert call_args[0][1] == "en-GB-RyanNeural"


@pytest.mark.asyncio
async def test_synthesize_with_rate():
    """synthesize() передаёт rate в Communicate."""
    with patch("app.agents.tts.edge_tts.Communicate") as MockComm:
        instance = MagicMock()
        instance.stream.return_value = _async_iter([
            {"type": "audio", "data": b"\x00" * 10},
        ])
        MockComm.return_value = instance

        from app.agents.tts import synthesize, _tts_cache
        _tts_cache.clear()
        await synthesize("Test", rate="+10%")

        MockComm.assert_called_once()
        call_kwargs = MockComm.call_args.kwargs
        assert call_kwargs.get("rate") == "+10%"


@pytest.mark.asyncio
async def test_synthesize_caches_result():
    """Повторный вызов с теми же параметрами возвращает кеш."""
    with patch("app.agents.tts.edge_tts.Communicate") as MockComm:
        instance = MagicMock()
        instance.stream.return_value = _async_iter([
            {"type": "audio", "data": b"\xaa" * 10},
        ])
        MockComm.return_value = instance

        from app.agents.tts import synthesize, _tts_cache
        _tts_cache.clear()

        result1 = await synthesize("Cache test", voice="en-US-GuyNeural", rate="+0%")

        # Второй вызов — не должен вызывать Communicate снова
        result2 = await synthesize("Cache test", voice="en-US-GuyNeural", rate="+0%")

        assert result1 == result2
        assert MockComm.call_count == 1


@pytest.mark.asyncio
async def test_synthesize_default_voice():
    """Без voice используется дефолтный en-US-GuyNeural."""
    with patch("app.agents.tts.edge_tts.Communicate") as MockComm:
        instance = MagicMock()
        instance.stream.return_value = _async_iter([
            {"type": "audio", "data": b"\x00" * 10},
        ])
        MockComm.return_value = instance

        from app.agents.tts import synthesize, DEFAULT_VOICE, _tts_cache
        _tts_cache.clear()
        await synthesize("Default voice test")

        call_args = MockComm.call_args
        assert call_args[0][1] == DEFAULT_VOICE


def test_voices_dict():
    """VOICES содержит 4 голоса с правильными ключами."""
    from app.agents.tts import VOICES
    assert len(VOICES) == 4
    assert "us-male" in VOICES
    assert "us-female" in VOICES
    assert "gb-male" in VOICES
    assert "gb-female" in VOICES


def test_get_voice_name():
    """get_voice_name() returns the voice key (or default for unknown)."""
    from app.agents.tts import get_voice_name
    assert get_voice_name("us-male") == "us-male"
    assert get_voice_name("gb-female") == "gb-female"
    assert get_voice_name("invalid") == "us-male"  # fallback to default key


@pytest.mark.asyncio
async def test_tts_endpoint_returns_audio():
    """POST /api/v1/tts возвращает audio/mpeg."""
    with patch("app.agents.tts.edge_tts.Communicate") as MockComm:
        instance = MagicMock()
        instance.stream.return_value = _async_iter([
            {"type": "audio", "data": b"\xff\xfb" * 100},
        ])
        MockComm.return_value = instance

        from app.agents.tts import _tts_cache
        _tts_cache.clear()

        from httpx import AsyncClient, ASGITransport
        from app.main import app
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            resp = await client.post(
                "/api/v1/tts",
                json={"text": "Hello", "voice": "us-male", "rate": "1.0"},
            )

        assert resp.status_code == 200
        assert resp.headers["content-type"] == "audio/mpeg"
        assert len(resp.content) > 0
