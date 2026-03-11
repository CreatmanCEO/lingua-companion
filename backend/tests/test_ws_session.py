import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, AsyncMock
from app.main import app


@pytest.fixture
def test_client():
    return TestClient(app)


def test_websocket_accepts_connection(test_client):
    """WebSocket endpoint accepts connections."""
    with test_client.websocket_connect("/ws/session") as websocket:
        # Just test connection works
        pass


def test_websocket_handles_empty_audio(test_client):
    """Empty audio returns error event."""
    with patch("app.api.routes.ws.transcribe", new_callable=AsyncMock) as mock_stt:
        mock_stt.return_value = {"text": "", "language": "en", "provider": "mock", "latency_ms": 0, "fallback": False}

        with test_client.websocket_connect("/ws/session") as websocket:
            websocket.send_bytes(b"fake_audio")
            response = websocket.receive_json()

            assert response["type"] == "error"
            assert "Empty transcript" in response["message"]


def test_websocket_full_pipeline(test_client):
    """Full pipeline returns all expected events."""
    with patch("app.api.routes.ws.transcribe", new_callable=AsyncMock) as mock_stt, \
         patch("app.api.routes.ws.reconstruct", new_callable=AsyncMock) as mock_recon, \
         patch("app.api.routes.ws.get_variants", new_callable=AsyncMock) as mock_variants:

        mock_stt.return_value = {
            "text": "test transcript",
            "language": "en",
            "provider": "mock",
            "latency_ms": 100,
            "fallback": False
        }
        mock_recon.return_value = {
            "corrected": "test corrected",
            "original_intent": "test",
            "main_error": None,
            "error_type": "none",
            "explanation": None
        }
        mock_variants.return_value = {
            "simple": "simple",
            "professional": "professional",
            "colloquial": "colloquial",
            "slang": "slang",
            "idiom": "idiom"
        }

        with test_client.websocket_connect("/ws/session") as websocket:
            websocket.send_bytes(b"fake_audio")

            events = []
            for _ in range(3):  # Expect 3 events
                events.append(websocket.receive_json())

            event_types = {e["type"] for e in events}
            assert "stt_result" in event_types
            assert "reconstruction_result" in event_types
            assert "variants_result" in event_types
