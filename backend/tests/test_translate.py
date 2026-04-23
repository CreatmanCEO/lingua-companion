import hashlib
import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.api.routes.translate import _translation_cache


@pytest.fixture(autouse=True)
def clear_cache():
    _translation_cache.clear()
    yield
    _translation_cache.clear()


@pytest.mark.asyncio
async def test_translate_en_to_ru():
    mock_response = MagicMock()
    mock_response.choices = [MagicMock()]
    mock_response.choices[0].message.content = '{"translated": "\u041f\u0440\u0438\u0432\u0435\u0442 \u043c\u0438\u0440"}'

    with patch("app.api.routes.translate.litellm.acompletion", new_callable=AsyncMock, return_value=mock_response):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.post("/api/v1/translate", json={"text": "Hello world", "to": "ru"})
            assert resp.status_code == 200
            assert resp.json()["translated"] == "\u041f\u0440\u0438\u0432\u0435\u0442 \u043c\u0438\u0440"
            assert resp.json()["cached"] is False


@pytest.mark.asyncio
async def test_translate_cache_hit():
    _translation_cache[hashlib.md5(b"Hello:ru").hexdigest()] = "\u041f\u0440\u0438\u0432\u0435\u0442"

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.post("/api/v1/translate", json={"text": "Hello", "to": "ru"})
        assert resp.status_code == 200
        assert resp.json()["cached"] is True
