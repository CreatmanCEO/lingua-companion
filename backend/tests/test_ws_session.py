"""
Тесты WebSocket endpoint /ws/session -- LinguaCompanion

Все внешние агенты (STT, Reconstruction, Variants, Companion) замоканы.
"""
import json
import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, AsyncMock
from app.main import app


# Общие mock-данные для переиспользования в тестах
MOCK_STT_RESULT = {
    "text": "test transcript",
    "language": "en",
    "provider": "mock",
    "latency_ms": 100,
    "fallback": False,
}

MOCK_RECON_RESULT = {
    "corrected": "test corrected",
    "original_intent": "test",
    "main_error": None,
    "error_type": "none",
    "explanation": None,
}

MOCK_VARIANTS_RESULT = {
    "simple": {"text": "simple", "context": "easy"},
    "professional": {"text": "professional", "context": "work"},
    "colloquial": {"text": "colloquial", "context": "chat"},
    "slang": {"text": "slang", "context": "casual"},
    "idiom": {"text": "idiom", "context": "expression"},
}

MOCK_COMPANION_RESULT = {
    "text": "That sounds interesting!",
    "companion": "Alex",
}


async def _mock_companion_stream(*args, **kwargs):
    """Мок async generator для generate_response_stream."""
    companion = kwargs.get("companion", "Alex")
    yield {"type": "token", "delta": "That sounds "}
    yield {"type": "token", "delta": "interesting!"}
    yield {"type": "done", "text": "That sounds interesting!", "companion": companion}


async def _mock_companion_stream_fail(*args, **kwargs):
    """Мок stream с ошибкой — fallback."""
    raise Exception("Companion LLM failed")
    yield  # noqa: unreachable — нужен для async generator


def _patch_all_agents():
    """Контекстный менеджер для мока всех четырёх агентов."""
    return (
        patch("app.api.routes.ws.transcribe", new_callable=AsyncMock),
        patch("app.api.routes.ws.reconstruct", new_callable=AsyncMock),
        patch("app.api.routes.ws.get_variants", new_callable=AsyncMock),
        patch("app.api.routes.ws.generate_response_stream", side_effect=_mock_companion_stream),
    )


@pytest.fixture
def test_client():
    return TestClient(app)


def test_websocket_accepts_connection(test_client):
    """WebSocket endpoint accepts connections."""
    with test_client.websocket_connect("/ws/session"):
        # Just test connection works
        pass


def test_websocket_handles_empty_audio(test_client):
    """Empty audio returns error event after stt_result."""
    with patch(
        "app.api.routes.ws.transcribe", new_callable=AsyncMock
    ) as mock_stt:
        mock_stt.return_value = {
            "text": "", "language": "en",
            "provider": "mock", "latency_ms": 0, "fallback": False,
        }

        with test_client.websocket_connect("/ws/session") as websocket:
            websocket.send_bytes(b"fake_audio")

            # First we get stt_result
            stt_response = websocket.receive_json()
            assert stt_response["type"] == "stt_result"

            # Then we get error for empty transcript
            error_response = websocket.receive_json()
            assert error_response["type"] == "error"
            assert "Empty transcript" in error_response["message"]


def test_websocket_full_pipeline(test_client):
    """Full pipeline returns expected events (stt + recon + variants + companion_tokens + companion)."""
    p1, p2, p3, p4 = _patch_all_agents()
    with p1 as mock_stt, p2 as mock_recon, \
         p3 as mock_variants, p4:

        mock_stt.return_value = MOCK_STT_RESULT
        mock_recon.return_value = MOCK_RECON_RESULT
        mock_variants.return_value = MOCK_VARIANTS_RESULT

        with test_client.websocket_connect("/ws/session") as websocket:
            websocket.send_bytes(b"fake_audio")

            # Collect events: stt + processing_started + recon + variants + 2 tokens + companion_response = 7
            events = []
            for _ in range(7):
                events.append(websocket.receive_json())

            event_types = {e["type"] for e in events}
            assert "stt_result" in event_types
            assert "processing_started" in event_types
            assert "reconstruction_result" in event_types
            assert "variants_result" in event_types
            assert "companion_token" in event_types
            assert "companion_response" in event_types

            companion_event = next(
                e for e in events if e["type"] == "companion_response"
            )
            assert companion_event["text"] == "That sounds interesting!"
            assert companion_event["companion"] == "Alex"

            mock_variants.assert_called_once_with("test corrected")


def test_websocket_stt_exception(test_client):
    """STT exception returns error event."""
    with patch(
        "app.api.routes.ws.transcribe", new_callable=AsyncMock
    ) as mock_stt:
        mock_stt.side_effect = Exception("STT service unavailable")

        with test_client.websocket_connect("/ws/session") as websocket:
            websocket.send_bytes(b"fake_audio")

            error_response = websocket.receive_json()
            assert error_response["type"] == "error"
            assert "STT service unavailable" in error_response["message"]


def test_websocket_client_disconnect(test_client):
    """Client disconnect is handled gracefully."""
    with patch(
        "app.api.routes.ws.transcribe", new_callable=AsyncMock
    ) as mock_stt:
        async def slow_stt(*args, **kwargs):
            import asyncio
            await asyncio.sleep(0.1)
            return {
                "text": "test", "language": "en",
                "provider": "mock", "latency_ms": 0, "fallback": False,
            }

        mock_stt.side_effect = slow_stt

        # Connect and immediately disconnect - should not raise
        with test_client.websocket_connect("/ws/session") as websocket:
            websocket.send_bytes(b"fake_audio")
            # Close immediately without waiting for response

        # If we get here without exception, the test passes


def test_websocket_session_config(test_client):
    """session_config устанавливает companion и scenario."""
    async def _morgan_stream(*args, **kwargs):
        companion = kwargs.get("companion", "Alex")
        assert companion == "Morgan", f"Expected Morgan, got {companion}"
        assert kwargs.get("scenario", {}).get("companionRole") == "Tech Lead"
        yield {"type": "token", "delta": "Let's review!"}
        yield {"type": "done", "text": "Let's review!", "companion": companion}

    p1 = patch("app.api.routes.ws.transcribe", new_callable=AsyncMock)
    p2 = patch("app.api.routes.ws.reconstruct", new_callable=AsyncMock)
    p3 = patch("app.api.routes.ws.get_variants", new_callable=AsyncMock)
    p4 = patch("app.api.routes.ws.generate_response_stream", side_effect=_morgan_stream)

    with p1 as mock_stt, p2 as mock_recon, p3 as mock_variants, p4:
        mock_stt.return_value = MOCK_STT_RESULT
        mock_recon.return_value = MOCK_RECON_RESULT
        mock_variants.return_value = MOCK_VARIANTS_RESULT

        with test_client.websocket_connect("/ws/session") as websocket:
            websocket.send_text(json.dumps({
                "type": "session_config",
                "companion": "Morgan",
                "scenario": {
                    "companionRole": "Tech Lead",
                    "userRole": "Developer",
                },
            }))

            websocket.send_bytes(b"fake_audio")

            events = []
            for _ in range(6):  # stt + processing_started + recon + variants + token + companion
                events.append(websocket.receive_json())

            companion_event = next(e for e in events if e["type"] == "companion_response")
            assert companion_event["companion"] == "Morgan"


def test_websocket_text_message(test_client):
    """text_message обрабатывается без STT."""
    p1, p2, p3, p4 = _patch_all_agents()
    with p1 as mock_stt, p2 as mock_recon, \
         p3 as mock_variants, p4:

        mock_recon.return_value = MOCK_RECON_RESULT
        mock_variants.return_value = MOCK_VARIANTS_RESULT

        with test_client.websocket_connect("/ws/session") as websocket:
            websocket.send_text(json.dumps({
                "type": "text_message",
                "text": "I want to learn English",
            }))

            events = []
            # recon + variants + 2 tokens + companion_response = 5
            for _ in range(5):
                events.append(websocket.receive_json())

            event_types = {e["type"] for e in events}
            assert "reconstruction_result" in event_types
            assert "variants_result" in event_types
            assert "companion_response" in event_types

            mock_stt.assert_not_called()


def test_websocket_text_message_empty(test_client):
    """Пустое текстовое сообщение возвращает ошибку."""
    with test_client.websocket_connect("/ws/session") as websocket:
        websocket.send_text(json.dumps({
            "type": "text_message",
            "text": "   ",
        }))

        error_response = websocket.receive_json()
        assert error_response["type"] == "error"
        assert "Empty text" in error_response["message"]


def test_websocket_reconstruction_failure_degrades(test_client):
    """При ошибке reconstruction pipeline продолжает с raw transcript."""
    p1, p2, p3, p4 = _patch_all_agents()
    with p1 as mock_stt, p2 as mock_recon, \
         p3 as mock_variants, p4:

        mock_stt.return_value = MOCK_STT_RESULT
        mock_recon.side_effect = Exception("Reconstruction failed")
        mock_variants.return_value = MOCK_VARIANTS_RESULT

        with test_client.websocket_connect("/ws/session") as websocket:
            websocket.send_bytes(b"fake_audio")

            events = []
            for _ in range(7):  # stt + processing_started + recon(degraded) + variants + 2 tokens + companion
                events.append(websocket.receive_json())

            event_types = {e["type"] for e in events}
            assert "stt_result" in event_types
            assert "reconstruction_result" in event_types

            recon_event = next(e for e in events if e["type"] == "reconstruction_result")
            assert recon_event.get("degraded") is True
            assert recon_event["corrected"] == "test transcript"


def test_websocket_companion_failure_degrades(test_client):
    """При ошибке companion stream pipeline отправляет fallback ответ."""
    p1 = patch("app.api.routes.ws.transcribe", new_callable=AsyncMock)
    p2 = patch("app.api.routes.ws.reconstruct", new_callable=AsyncMock)
    p3 = patch("app.api.routes.ws.get_variants", new_callable=AsyncMock)
    p4 = patch("app.api.routes.ws.generate_response_stream", side_effect=_mock_companion_stream_fail)

    with p1 as mock_stt, p2 as mock_recon, p3 as mock_variants, p4:
        mock_stt.return_value = MOCK_STT_RESULT
        mock_recon.return_value = MOCK_RECON_RESULT
        mock_variants.return_value = MOCK_VARIANTS_RESULT

        with test_client.websocket_connect("/ws/session") as websocket:
            websocket.send_bytes(b"fake_audio")

            events = []
            for _ in range(5):
                events.append(websocket.receive_json())

            event_types = {e["type"] for e in events}
            assert "companion_response" in event_types

            companion_event = next(e for e in events if e["type"] == "companion_response")
            assert companion_event.get("degraded") is True
            assert len(companion_event["text"]) > 0


def test_websocket_variants_failure_degrades(test_client):
    """При ошибке variants pipeline отправляет fallback варианты."""
    p1, p2, p3, p4 = _patch_all_agents()
    with p1 as mock_stt, p2 as mock_recon, \
         p3 as mock_variants, p4:

        mock_stt.return_value = MOCK_STT_RESULT
        mock_recon.return_value = MOCK_RECON_RESULT
        mock_variants.side_effect = Exception("Variants LLM failed")

        with test_client.websocket_connect("/ws/session") as websocket:
            websocket.send_bytes(b"fake_audio")

            events = []
            for _ in range(7):  # stt + processing_started + recon + variants(degraded) + 2 tokens + companion
                events.append(websocket.receive_json())

            event_types = {e["type"] for e in events}
            assert "variants_result" in event_types

            variants_event = next(e for e in events if e["type"] == "variants_result")
            assert variants_event.get("degraded") is True


def test_websocket_concurrent_processing_blocked(test_client):
    """processing flag блокирует параллельные запросы."""
    p1, p2, p3, p4 = _patch_all_agents()
    with p1 as mock_stt, p2 as mock_recon, \
         p3 as mock_variants, p4:

        import asyncio as _asyncio

        async def slow_reconstruct(*args, **kwargs):
            await _asyncio.sleep(0.2)
            return MOCK_RECON_RESULT

        mock_recon.side_effect = slow_reconstruct
        mock_variants.return_value = MOCK_VARIANTS_RESULT

        with test_client.websocket_connect("/ws/session") as websocket:
            websocket.send_text(json.dumps({
                "type": "text_message",
                "text": "first message",
            }))
            websocket.send_text(json.dumps({
                "type": "text_message",
                "text": "second message",
            }))

            # Собираем ответы: 5 от первого (recon + variants + 2 tokens + companion) + 1 error или более
            events = []
            for _ in range(6):
                events.append(websocket.receive_json())

            event_types = [e["type"] for e in events]
            assert "reconstruction_result" in event_types


def test_websocket_rate_limit(test_client):
    """Rate limit блокирует после MAX_MESSAGES_PER_MINUTE сообщений."""
    from app.api.routes.ws import MAX_MESSAGES_PER_MINUTE

    p1, p2, p3, p4 = _patch_all_agents()
    with p1 as mock_stt, p2 as mock_recon, \
         p3 as mock_variants, p4:

        mock_recon.return_value = MOCK_RECON_RESULT
        mock_variants.return_value = MOCK_VARIANTS_RESULT

        with test_client.websocket_connect("/ws/session") as websocket:
            for i in range(MAX_MESSAGES_PER_MINUTE + 1):
                websocket.send_text(json.dumps({
                    "type": "text_message",
                    "text": f"message {i}",
                }))

                resp = websocket.receive_json()

                if resp["type"] == "error" and "Rate limit" in resp["message"]:
                    assert i >= MAX_MESSAGES_PER_MINUTE
                    return
                else:
                    # Drain remaining events: recon + variants + 2 tokens + companion = 5 total, already read 1
                    for _ in range(4):
                        websocket.receive_json()

            pytest.fail("Rate limit was not enforced")
