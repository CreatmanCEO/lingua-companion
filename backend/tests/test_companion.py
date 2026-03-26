"""
Тесты Companion Agent -- LinguaCompanion

7 unit-тестов: все LLM вызовы замоканы через litellm.acompletion.
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
async def test_generate_response_returns_text(mock_llm_response):
    """generate_response возвращает dict с text и companion."""
    with patch("app.agents.companion.litellm.acompletion", new_callable=AsyncMock) as mock_llm:
        mock_llm.return_value = mock_llm_response("Sure, let's discuss that!")

        from app.agents.companion import generate_response
        result = await generate_response("I want to learn English")

        assert "text" in result
        assert "companion" in result
        assert result["text"] == "Sure, let's discuss that!"
        mock_llm.assert_called_once()


@pytest.mark.asyncio
async def test_generate_response_alex_persona(mock_llm_response):
    """Alex персона использует правильный системный промпт."""
    with patch("app.agents.companion.litellm.acompletion", new_callable=AsyncMock) as mock_llm:
        mock_llm.return_value = mock_llm_response("That's a solid approach.")

        from app.agents.companion import generate_response
        result = await generate_response("How do I structure code?", companion="Alex")

        assert result["companion"] == "Alex"
        # Проверяем что системный промпт содержит Alex и Professional
        call_args = mock_llm.call_args
        messages = call_args.kwargs["messages"]
        system_msg = messages[0]["content"]
        assert "Alex" in system_msg
        assert "Professional" in system_msg


@pytest.mark.asyncio
async def test_generate_response_sam_persona(mock_llm_response):
    """Sam персона использует casual промпт."""
    with patch("app.agents.companion.litellm.acompletion", new_callable=AsyncMock) as mock_llm:
        mock_llm.return_value = mock_llm_response("Oh nice, tell me more!")

        from app.agents.companion import generate_response
        result = await generate_response("I fixed a bug", companion="Sam")

        assert result["companion"] == "Sam"
        call_args = mock_llm.call_args
        messages = call_args.kwargs["messages"]
        system_msg = messages[0]["content"]
        assert "Sam" in system_msg
        assert "Casual" in system_msg


@pytest.mark.asyncio
async def test_generate_response_morgan_persona(mock_llm_response):
    """Morgan персона использует mentor промпт."""
    with patch("app.agents.companion.litellm.acompletion", new_callable=AsyncMock) as mock_llm:
        mock_llm.return_value = mock_llm_response("Great progress!")

        from app.agents.companion import generate_response
        result = await generate_response("I try to speak better", companion="Morgan")

        assert result["companion"] == "Morgan"
        call_args = mock_llm.call_args
        messages = call_args.kwargs["messages"]
        system_msg = messages[0]["content"]
        assert "Morgan" in system_msg
        assert "Mentor" in system_msg


@pytest.mark.asyncio
async def test_generate_response_with_scenario(mock_llm_response):
    """Сценарий добавляет роли в системный промпт."""
    with patch("app.agents.companion.litellm.acompletion", new_callable=AsyncMock) as mock_llm:
        mock_llm.return_value = mock_llm_response("Let's review the PR.")

        from app.agents.companion import generate_response
        scenario = {
            "companionRole": "Tech Lead reviewing your pull request",
            "userRole": "Developer defending code decisions",
        }
        result = await generate_response(
            "I refactored the auth module",
            companion="Alex",
            scenario=scenario,
        )

        assert result["text"] == "Let's review the PR."
        call_args = mock_llm.call_args
        messages = call_args.kwargs["messages"]
        system_msg = messages[0]["content"]
        assert "Tech Lead" in system_msg
        assert "Developer defending" in system_msg
        assert "Scenario mode" in system_msg


@pytest.mark.asyncio
async def test_generate_response_with_history(mock_llm_response):
    """История диалога передаётся в LLM."""
    with patch("app.agents.companion.litellm.acompletion", new_callable=AsyncMock) as mock_llm:
        mock_llm.return_value = mock_llm_response("Sounds like a plan!")

        from app.agents.companion import generate_response
        history = [
            {"role": "user", "content": "I work on a web app"},
            {"role": "assistant", "content": "What tech stack are you using?"},
        ]
        result = await generate_response(
            "We use React and FastAPI",
            companion="Sam",
            history=history,
        )

        assert result["text"] == "Sounds like a plan!"
        call_args = mock_llm.call_args
        messages = call_args.kwargs["messages"]
        # system + 2 history + 1 user = 4 messages
        assert len(messages) == 4
        assert messages[1]["content"] == "I work on a web app"
        assert messages[2]["content"] == "What tech stack are you using?"
        assert messages[3]["content"] == "We use React and FastAPI"


@pytest.mark.asyncio
async def test_companion_prompt_contains_recasting():
    """Системный промпт содержит стратегию implicit recasting."""
    from app.agents.companion import COMPANION_PROMPTS
    for name, prompt in COMPANION_PROMPTS.items():
        assert "recasting" in prompt.lower(), f"{name} prompt missing recasting strategy"
        assert "sandwich" in prompt.lower(), f"{name} prompt missing sandwich method"
        assert "scaffolding" in prompt.lower() or "scaffold" in prompt.lower(), \
            f"{name} prompt missing scaffolding"


@pytest.mark.asyncio
async def test_companion_max_tokens_increased(mock_llm_response):
    """max_tokens должен быть >= 400."""
    with patch("app.agents.companion.litellm.acompletion", new_callable=AsyncMock) as mock_llm:
        mock_llm.return_value = mock_llm_response("Test response")

        from app.agents.companion import generate_response
        await generate_response("Hello")

        call_kwargs = mock_llm.call_args.kwargs
        assert call_kwargs["max_tokens"] >= 400


@pytest.mark.asyncio
async def test_generate_response_llm_failure(mock_llm_response):
    """При ошибке LLM возвращается fallback ответ."""
    with patch("app.agents.companion.litellm.acompletion", new_callable=AsyncMock) as mock_llm:
        mock_llm.side_effect = Exception("API rate limit exceeded")

        from app.agents.companion import generate_response
        result = await generate_response("Hello", companion="Alex")

        assert "text" in result
        assert "companion" in result
        assert result["companion"] == "Alex"
        # Fallback ответ не должен быть пустым
        assert len(result["text"]) > 0
