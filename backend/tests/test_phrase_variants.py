"""
Тесты Phrase Variants Agent -- LinguaCompanion

4 unit-теста: все LLM вызовы замоканы через litellm.acompletion.
"""
import json
import pytest
from unittest.mock import patch, AsyncMock, MagicMock


@pytest.fixture
def mock_llm_response():
    """Фабрика мок-ответов от LLM."""
    def _make(content: str):
        mock_resp = MagicMock()
        mock_resp.choices = [MagicMock()]
        mock_resp.choices[0].message.content = content
        return mock_resp
    return _make


FULL_VARIANTS = {
    "simple": {"text": "I fixed the bug.", "context": "daily standup"},
    "professional": {"text": "I resolved the defect.", "context": "status report"},
    "colloquial": {"text": "I squashed that bug.", "context": "chat with colleague"},
    "slang": {"text": "Crushed it, no cap.", "context": "casual Slack message"},
    "idiom": {"text": "That bug is history.", "context": "celebrating a win"},
}


@pytest.mark.asyncio
async def test_get_variants_returns_5_styles(mock_llm_response):
    """get_variants возвращает 5 стилей с text и context."""
    with patch("app.agents.phrase_variants.litellm.acompletion", new_callable=AsyncMock) as mock_llm:
        mock_llm.return_value = mock_llm_response(json.dumps(FULL_VARIANTS))

        from app.agents.phrase_variants import get_variants
        result = await get_variants("I fixed the bug.")

        assert len(result) == 5
        for style in ["simple", "professional", "colloquial", "slang", "idiom"]:
            assert style in result
            assert "text" in result[style]
            assert "context" in result[style]


@pytest.mark.asyncio
async def test_get_variants_validates_missing_styles(mock_llm_response):
    """Если LLM вернул не все 5 стилей — недостающие заполняются fallback."""
    partial = {
        "simple": {"text": "Simple version.", "context": "easy"},
        "professional": {"text": "Formal version.", "context": "work"},
    }

    with patch("app.agents.phrase_variants.litellm.acompletion", new_callable=AsyncMock) as mock_llm:
        mock_llm.return_value = mock_llm_response(json.dumps(partial))

        from app.agents.phrase_variants import get_variants
        result = await get_variants("Test sentence.")

        # Все 5 стилей должны быть
        assert len(result) == 5
        assert result["simple"]["text"] == "Simple version."
        # Недостающие заполняются исходным предложением
        assert result["slang"]["text"] == "Test sentence."
        assert result["idiom"]["text"] == "Test sentence."


@pytest.mark.asyncio
async def test_get_variants_backward_compat(mock_llm_response):
    """Если LLM вернул строку вместо объекта — конвертируется в {text, context}."""
    old_format = {
        "simple": "Simple text",
        "professional": "Professional text",
        "colloquial": "Colloquial text",
        "slang": "Slang text",
        "idiom": "Idiom text",
    }

    with patch("app.agents.phrase_variants.litellm.acompletion", new_callable=AsyncMock) as mock_llm:
        mock_llm.return_value = mock_llm_response(json.dumps(old_format))

        from app.agents.phrase_variants import get_variants
        result = await get_variants("Test sentence.")

        for style in ["simple", "professional", "colloquial", "slang", "idiom"]:
            assert isinstance(result[style], dict)
            assert "text" in result[style]
            assert "context" in result[style]
        assert result["simple"]["text"] == "Simple text"


@pytest.mark.asyncio
async def test_get_variants_fallback_on_failure(mock_llm_response):
    """При полном провале LLM — fallback с исходным предложением."""
    with patch("app.agents.phrase_variants.litellm.acompletion", new_callable=AsyncMock) as mock_llm:
        mock_llm.side_effect = Exception("API unavailable")

        from app.agents.phrase_variants import get_variants
        result = await get_variants("Test sentence.")

        assert len(result) == 5
        for style in ["simple", "professional", "colloquial", "slang", "idiom"]:
            assert result[style]["text"] == "Test sentence."
