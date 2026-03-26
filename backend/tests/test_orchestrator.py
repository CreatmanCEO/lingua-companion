import pytest
from unittest.mock import patch, AsyncMock
from app.agents.orchestrator import run_pipeline, PipelineResult


@pytest.mark.asyncio
async def test_run_pipeline_success():
    """Orchestrator returns PipelineResult on success."""
    with patch("app.agents.orchestrator.transcribe", new_callable=AsyncMock) as mock_stt, \
         patch("app.agents.orchestrator.reconstruct", new_callable=AsyncMock) as mock_recon, \
         patch("app.agents.orchestrator.get_variants", new_callable=AsyncMock) as mock_variants:

        mock_stt.return_value = {
            "text": "Hello world",
            "language": "en",
            "provider": "deepgram",
            "latency_ms": 500,
            "fallback": False
        }
        mock_recon.return_value = {
            "corrected": "Hello, world!",
            "original_intent": "greeting",
            "main_error": None,
            "error_type": "none",
            "explanation": None
        }
        mock_variants.return_value = {
            "simple": "Hi!",
            "professional": "Good day.",
            "colloquial": "Hey there!",
            "slang": "Yo!",
            "idiom": "Hello and welcome!"
        }

        result = await run_pipeline(b"audio", "test.webm")

        assert isinstance(result, PipelineResult)
        assert result.transcript == "Hello world"
        assert result.corrected == "Hello, world!"
        assert result.simple == "Hi!"
        assert result.total_latency_ms > 0

        # Variants должен получить corrected текст, а не raw transcript
        mock_variants.assert_called_once_with("Hello, world!")


@pytest.mark.asyncio
async def test_run_pipeline_empty_transcript():
    """Orchestrator raises ValueError on empty transcript."""
    with patch("app.agents.orchestrator.transcribe", new_callable=AsyncMock) as mock_stt:
        mock_stt.return_value = {"text": "  ", "language": "en", "provider": "mock", "latency_ms": 0, "fallback": False}

        with pytest.raises(ValueError, match="Empty transcript"):
            await run_pipeline(b"audio")


@pytest.mark.asyncio
async def test_run_pipeline_llm_failure_graceful():
    """Orchestrator degrades gracefully on LLM failure."""
    with patch("app.agents.orchestrator.transcribe", new_callable=AsyncMock) as mock_stt, \
         patch("app.agents.orchestrator.reconstruct", new_callable=AsyncMock) as mock_recon, \
         patch("app.agents.orchestrator.get_variants", new_callable=AsyncMock) as mock_variants:

        mock_stt.return_value = {
            "text": "test",
            "language": "en",
            "provider": "deepgram",
            "latency_ms": 100,
            "fallback": False
        }
        mock_recon.side_effect = Exception("LLM timeout")
        mock_variants.side_effect = Exception("LLM timeout")

        result = await run_pipeline(b"audio")

        # Should degrade to raw transcript
        assert result.corrected == "test"
        assert result.simple == "test"
