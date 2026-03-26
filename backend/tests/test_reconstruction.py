"""
Тесты Reconstruction Agent -- LinguaCompanion

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


@pytest.mark.asyncio
async def test_reconstruct_returns_required_fields(mock_llm_response):
    """reconstruct возвращает все 6 обязательных полей включая changes."""
    llm_output = json.dumps({
        "corrected": "I went to the office.",
        "original_intent": "The user went to the office.",
        "main_error": "past tense",
        "error_type": "grammar",
        "explanation": "Используйте went вместо go.",
        "changes": [{"original": "go", "corrected": "went", "type": "grammar"}],
    })

    with patch("app.agents.reconstruction.litellm.acompletion", new_callable=AsyncMock) as mock_llm:
        mock_llm.return_value = mock_llm_response(llm_output)

        from app.agents.reconstruction import reconstruct
        result = await reconstruct("I go to office")

        assert "corrected" in result
        assert "original_intent" in result
        assert "main_error" in result
        assert "error_type" in result
        assert "explanation" in result
        assert "changes" in result
        assert isinstance(result["changes"], list)
        assert len(result["changes"]) == 1


@pytest.mark.asyncio
async def test_reconstruct_json_parse_failure_retries(mock_llm_response):
    """При JSON parse failure делается 1 retry с temperature=0.1."""
    valid_output = json.dumps({
        "corrected": "Hello world.",
        "original_intent": "Hello world.",
        "main_error": None,
        "error_type": "none",
        "explanation": None,
        "changes": [],
    })

    with patch("app.agents.reconstruction.litellm.acompletion", new_callable=AsyncMock) as mock_llm:
        # Первый вызов — невалидный JSON, второй — валидный
        mock_llm.side_effect = [
            mock_llm_response("not valid json {{{"),
            mock_llm_response(valid_output),
        ]

        from app.agents.reconstruction import reconstruct
        result = await reconstruct("Hello world")

        assert result["corrected"] == "Hello world."
        assert mock_llm.call_count == 2
        # Второй вызов должен быть с temperature=0.1
        second_call = mock_llm.call_args_list[1]
        assert second_call.kwargs["temperature"] == 0.1


@pytest.mark.asyncio
async def test_reconstruct_fallback_on_total_failure(mock_llm_response):
    """При полном провале LLM возвращается fallback с raw transcript."""
    with patch("app.agents.reconstruction.litellm.acompletion", new_callable=AsyncMock) as mock_llm:
        mock_llm.side_effect = Exception("API unavailable")

        from app.agents.reconstruction import reconstruct
        result = await reconstruct("test input")

        assert result["corrected"] == "test input"
        assert result["original_intent"] == "test input"
        assert result["error_type"] == "none"
        assert result["changes"] == []


@pytest.mark.asyncio
async def test_reconstruct_missing_fields_filled(mock_llm_response):
    """Если LLM не вернул все поля — они заполняются defaults."""
    partial_output = json.dumps({
        "corrected": "Fixed sentence.",
        "error_type": "grammar",
    })

    with patch("app.agents.reconstruction.litellm.acompletion", new_callable=AsyncMock) as mock_llm:
        mock_llm.return_value = mock_llm_response(partial_output)

        from app.agents.reconstruction import reconstruct
        result = await reconstruct("broken sentence")

        assert result["corrected"] == "Fixed sentence."
        assert result["original_intent"] == "broken sentence"  # filled from transcript
        assert result["main_error"] is None  # default
        assert result["explanation"] is None  # default
        assert result["changes"] == []  # default
