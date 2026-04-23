import pytest
from app.prompts.registry import PromptRegistry
from app.prompts.builder import PromptBuilder


def test_registry_loads_template():
    registry = PromptRegistry()
    tpl = registry.get("reconstruction")
    assert tpl is not None
    assert "model" in tpl
    assert "system" in tpl


def test_registry_loads_companion_persona():
    registry = PromptRegistry()
    tpl = registry.get("companion/alex")
    assert tpl is not None
    assert "system" in tpl


def test_builder_assembles_companion_prompt():
    builder = PromptBuilder("companion/base")
    builder.with_persona("alex")
    builder.with_block("level_adaptation", level="B1")
    system, params = builder.build()
    assert "B1" in system
    assert params["model"] == "openrouter/deepseek/deepseek-v3.2"


def test_builder_reconstruction():
    builder = PromptBuilder("reconstruction")
    system, params = builder.build()
    assert "corrected" in system.lower() or "grammar" in system.lower()
    assert params["temperature"] == 0.3


def test_builder_with_scenario():
    builder = PromptBuilder("companion/base")
    builder.with_persona("sam")
    builder.with_block("scenario_context", scenario={"companionRole": "Tech Lead", "userRole": "Junior Dev"})
    system, params = builder.build()
    assert "Tech Lead" in system


def test_builder_skips_empty_blocks():
    builder = PromptBuilder("companion/base")
    builder.with_persona("morgan")
    builder.with_block("error_tracking", errors=[])
    builder.with_block("scenario_context", scenario=None)
    system, params = builder.build()
    # Should NOT contain error tracking or scenario text
    assert "repeated these errors" not in system
    assert "Scenario mode" not in system


def test_builder_with_topic():
    builder = PromptBuilder("companion/base")
    builder.with_persona("morgan")
    builder.with_block("topic_context", topic={"title": "Rust async", "source": "HN", "discussion_prompt": "What do you think?"})
    system, params = builder.build()
    assert "Rust async" in system


def test_translation_template():
    builder = PromptBuilder("translation")
    system, params = builder.build()
    assert params["model"] == "openrouter/qwen/qwen3-235b-a22b-2507"
    assert params["temperature"] == 0.1


def test_variants_has_translation_field():
    builder = PromptBuilder("phrase_variants")
    system, params = builder.build()
    assert "translation" in system.lower()
