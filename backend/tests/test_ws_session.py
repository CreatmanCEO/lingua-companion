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
    "simple": "simple",
    "professional": "professional",
    "colloquial": "colloquial",
    "slang": "slang",
    "idiom": "idiom",
}

MOCK_COMPANION_RESULT = {
    "text": "That sounds interesting!",
    "companion": "Alex",
}


def _patch_all_agents():
    """Контекстный менеджер для мока всех четырёх агентов."""
    return (
        patch("app.api.routes.ws.transcribe", new_callable=AsyncMock),
        patch("app.api.routes.ws.reconstruct", new_callable=AsyncMock),
        patch("app.api.routes.ws.get_variants", new_callable=AsyncMock),
        patch("app.api.routes.ws.generate_response", new_callable=AsyncMock),
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
    """Full pipeline returns all 4 expected events (stt + recon + variants + companion)."""
    p1, p2, p3, p4 = _patch_all_agents()
    with p1 as mock_stt, p2 as mock_recon, \
         p3 as mock_variants, p4 as mock_companion:

        mock_stt.return_value = MOCK_STT_RESULT
        mock_recon.return_value = MOCK_RECON_RESULT
        mock_variants.return_value = MOCK_VARIANTS_RESULT
        mock_companion.return_value = MOCK_COMPANION_RESULT

        with test_client.websocket_connect("/ws/session") as websocket:
            websocket.send_bytes(b"fake_audio")

            events = []
            for _ in range(4):  # Expect 4 events
                events.append(websocket.receive_json())

            event_types = {e["type"] for e in events}
            assert "stt_result" in event_types
            assert "reconstruction_result" in event_types
            assert "variants_result" in event_types
            assert "companion_response" in event_types

            # Проверяем содержимое companion_response
            companion_event = next(
                e for e in events if e["type"] == "companion_response"
            )
            assert companion_event["text"] == "That sounds interesting!"
            assert companion_event["companion"] == "Alex"


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
    p1, p2, p3, p4 = _patch_all_agents()
    with p1 as mock_stt, p2 as mock_recon, \
         p3 as mock_variants, p4 as mock_companion:

        mock_stt.return_value = MOCK_STT_RESULT
        mock_recon.return_value = MOCK_RECON_RESULT
        mock_variants.return_value = MOCK_VARIANTS_RESULT
        mock_companion.return_value = {
            "text": "Let's review the code!",
            "companion": "Morgan",
        }

        with test_client.websocket_connect("/ws/session") as websocket:
            # Отправляем session_config
            websocket.send_text(json.dumps({
                "type": "session_config",
                "companion": "Morgan",
                "scenario": {
                    "companionRole": "Tech Lead",
                    "userRole": "Developer",
                },
            }))

            # Отправляем аудио -- companion должен быть Morgan
            websocket.send_bytes(b"fake_audio")

            events = []
            for _ in range(4):
                events.append(websocket.receive_json())

            # Проверяем что companion agent был вызван с Morgan
            call_kwargs = mock_companion.call_args.kwargs
            assert call_kwargs["companion"] == "Morgan"
            assert call_kwargs["scenario"]["companionRole"] == "Tech Lead"


def test_websocket_text_message(test_client):
    """text_message обрабатывается без STT."""
    p1, p2, p3, p4 = _patch_all_agents()
    with p1 as mock_stt, p2 as mock_recon, \
         p3 as mock_variants, p4 as mock_companion:

        mock_recon.return_value = MOCK_RECON_RESULT
        mock_variants.return_value = MOCK_VARIANTS_RESULT
        mock_companion.return_value = MOCK_COMPANION_RESULT

        with test_client.websocket_connect("/ws/session") as websocket:
            # Отправляем текстовое сообщение
            websocket.send_text(json.dumps({
                "type": "text_message",
                "text": "I want to learn English",
            }))

            events = []
            for _ in range(3):  # reconstruction + variants + companion (no STT)
                events.append(websocket.receive_json())

            event_types = {e["type"] for e in events}
            assert "reconstruction_result" in event_types
            assert "variants_result" in event_types
            assert "companion_response" in event_types

            # STT НЕ должен вызываться для текстовых сообщений
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
