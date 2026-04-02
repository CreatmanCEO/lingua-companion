"""
Тесты Onboarding Agent — LinguaCompanion

5 unit-тестов: LLM замокан.
"""
import pytest
from unittest.mock import patch, AsyncMock, MagicMock


@pytest.fixture
def mock_llm_response():
    """Фабрика мок-ответов от LLM."""
    def _make(text: str):
        mock_resp = MagicMock()
        mock_resp.choices = [MagicMock()]
        mock_resp.choices[0].message.content = text
        return mock_resp
    return _make


@pytest.mark.asyncio
async def test_get_onboarding_response_returns_text(mock_llm_response):
    """get_onboarding_response() возвращает dict с text."""
    with patch("app.agents.onboarding.litellm.acompletion", new_callable=AsyncMock) as mock_llm:
        mock_llm.return_value = mock_llm_response("Hi! What's your name?")

        from app.agents.onboarding import get_onboarding_response
        result = await get_onboarding_response("Hello", [])

        assert "text" in result
        assert result["text"] == "Hi! What's your name?"


@pytest.mark.asyncio
async def test_get_onboarding_response_uses_system_prompt(mock_llm_response):
    """get_onboarding_response() использует ONBOARDING_SYSTEM_PROMPT."""
    with patch("app.agents.onboarding.litellm.acompletion", new_callable=AsyncMock) as mock_llm:
        mock_llm.return_value = mock_llm_response("Nice to meet you!")

        from app.agents.onboarding import get_onboarding_response
        await get_onboarding_response("My name is Alex", [])

        call_args = mock_llm.call_args.kwargs["messages"]
        system_msg = call_args[0]["content"]
        assert "onboarding" in system_msg.lower() or "name" in system_msg.lower()


@pytest.mark.asyncio
async def test_extract_onboarding_data_parses_json(mock_llm_response):
    """extract_onboarding_data() парсит JSON из LLM."""
    with patch("app.agents.onboarding.litellm.acompletion", new_callable=AsyncMock) as mock_llm:
        mock_llm.return_value = mock_llm_response(
            '{"name": "Alex", "level": "B1", "specialty": "backend", "style": "professional"}'
        )

        from app.agents.onboarding import extract_onboarding_data
        result = await extract_onboarding_data([
            {"role": "assistant", "content": "What's your name?"},
            {"role": "user", "content": "Alex, I'm a backend dev at B1"},
        ])

        assert result["name"] == "Alex"
        assert result["level"] == "B1"


@pytest.mark.asyncio
async def test_extract_onboarding_data_failure_returns_empty(mock_llm_response):
    """extract_onboarding_data() при ошибке возвращает пустой dict."""
    with patch("app.agents.onboarding.litellm.acompletion", new_callable=AsyncMock) as mock_llm:
        mock_llm.side_effect = Exception("LLM failed")

        from app.agents.onboarding import extract_onboarding_data
        result = await extract_onboarding_data([])

        assert result == {}


def test_is_onboarding_complete():
    """is_onboarding_complete() проверяет наличие всех ключей."""
    from app.agents.onboarding import is_onboarding_complete

    assert is_onboarding_complete({"name": "Alex", "level": "B1", "specialty": "dev", "style": "casual"})
    assert not is_onboarding_complete({"name": "Alex"})
    assert not is_onboarding_complete({})
