"""
Тесты Memory Agent — LinguaCompanion

6 unit-тестов: все внешние вызовы (DB, Google API, LLM) замоканы.
"""
import pytest
from unittest.mock import patch, AsyncMock, MagicMock

# Импортируем модуль до patching
import app.agents.memory as memory_module


@pytest.mark.asyncio
async def test_embed_text_returns_768_dim():
    """embed_text() возвращает список из 768 float."""
    mock_embedding = [0.1] * 768

    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = {"embedding": {"values": mock_embedding}}

    mock_client = AsyncMock()
    mock_client.post.return_value = mock_resp
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=False)

    with patch.object(memory_module.httpx, "AsyncClient", return_value=mock_client):
        result = await memory_module.embed_text("Hello world")

    assert isinstance(result, list)
    assert len(result) == 768


@pytest.mark.asyncio
async def test_embed_text_error_returns_zeros():
    """embed_text() при ошибке API возвращает нулевой вектор."""
    mock_resp = MagicMock()
    mock_resp.status_code = 400
    mock_resp.text = "Bad request"

    mock_client = AsyncMock()
    mock_client.post.return_value = mock_resp
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=False)

    with patch.object(memory_module.httpx, "AsyncClient", return_value=mock_client):
        result = await memory_module.embed_text("test")

    assert len(result) == 768
    assert all(v == 0.0 for v in result)


@pytest.mark.asyncio
async def test_extract_facts_returns_dict():
    """extract_facts() возвращает dict с фактами."""
    mock_resp = MagicMock()
    mock_resp.choices = [MagicMock()]
    mock_resp.choices[0].message.content = '{"name": "Alex", "level": "B1"}'

    with patch.object(memory_module.litellm, "acompletion", new_callable=AsyncMock) as mock_llm:
        mock_llm.return_value = mock_resp
        result = await memory_module.extract_facts("My name is Alex and I'm at B1 level")

    assert isinstance(result, dict)
    assert result.get("name") == "Alex"
    assert result.get("level") == "B1"


@pytest.mark.asyncio
async def test_extract_facts_failure_returns_empty():
    """extract_facts() при ошибке LLM возвращает пустой dict."""
    with patch.object(memory_module.litellm, "acompletion", new_callable=AsyncMock) as mock_llm:
        mock_llm.side_effect = Exception("LLM failed")
        result = await memory_module.extract_facts("test text")

    assert result == {}


class MockPoolAcquire:
    """Mock async context manager for pool.acquire()."""
    def __init__(self, conn):
        self._conn = conn

    async def __aenter__(self):
        return self._conn

    async def __aexit__(self, *args):
        pass


@pytest.mark.asyncio
async def test_store_memory_calls_db():
    """store_memory() вызывает embed + INSERT."""
    mock_conn = AsyncMock()
    mock_pool = MagicMock()
    mock_pool.acquire.return_value = MockPoolAcquire(mock_conn)

    with patch.object(memory_module, "get_pool", new_callable=AsyncMock, return_value=mock_pool), \
         patch.object(memory_module, "embed_text", new_callable=AsyncMock, return_value=[0.1] * 768):
        await memory_module.store_memory("default", "Test memory text", {"source": "test"})

    mock_conn.execute.assert_called_once()
    call_args = str(mock_conn.execute.call_args)
    assert "INSERT INTO memory_vectors" in call_args


@pytest.mark.asyncio
async def test_get_user_facts_returns_dict():
    """get_user_facts() возвращает dict с фактами из БД."""
    mock_conn = AsyncMock()
    mock_conn.fetch.return_value = [
        {"key": "name", "value": "Alex"},
        {"key": "level", "value": "B1"},
    ]
    mock_pool = MagicMock()
    mock_pool.acquire.return_value = MockPoolAcquire(mock_conn)

    with patch.object(memory_module, "get_pool", new_callable=AsyncMock, return_value=mock_pool):
        result = await memory_module.get_user_facts("default")

    assert result == {"name": "Alex", "level": "B1"}
