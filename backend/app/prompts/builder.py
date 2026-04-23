"""
Prompt Builder — assembles system prompts from template + persona + blocks.
"""
from __future__ import annotations

import re

from .registry import PromptRegistry

_registry = PromptRegistry()


def _is_empty(value: object) -> bool:
    """Check if a value should be considered empty (skip block)."""
    if value is None:
        return True
    if isinstance(value, (list, dict, str)) and len(value) == 0:
        return True
    return False


def _resolve_var(key: str, kwargs: dict) -> str:
    """Resolve a {{key}} or {{key.subkey}} variable against kwargs."""
    parts = key.split(".")
    value = kwargs.get(parts[0])
    if value is None:
        return ""
    # Drill into nested dict keys
    for part in parts[1:]:
        if isinstance(value, dict):
            value = value.get(part, "")
        else:
            return ""
    # Format lists as newline-joined
    if isinstance(value, list):
        return "\n".join(str(item) for item in value)
    return str(value)


def _substitute(template: str, kwargs: dict) -> str:
    """Replace {{key}} and {{key.subkey}} patterns in template."""
    def replacer(match: re.Match) -> str:
        return _resolve_var(match.group(1).strip(), kwargs)
    return re.sub(r"\{\{(.+?)\}\}", replacer, template)


class PromptBuilder:
    """Fluent builder that assembles system prompts from YAML templates."""

    def __init__(self, task: str) -> None:
        self._template = _registry.get(task)
        self._system_parts: list[str] = [self._template.get("system", "")]
        self._params: dict = {
            "model": self._template.get("model", ""),
            "temperature": self._template.get("temperature", 0.7),
            "max_tokens": self._template.get("max_tokens", 400),
        }

    def with_persona(self, name: str) -> PromptBuilder:
        """Load a persona overlay and append its system text."""
        persona_dir = self._template.get("persona_dir", "")
        if persona_dir:
            persona = _registry.get(f"{persona_dir}/{name}")
        else:
            persona = _registry.get(name)
        persona_system = persona.get("system", "")
        if persona_system:
            self._system_parts.append(persona_system)
        return self

    def with_block(self, block_name: str, **kwargs: object) -> PromptBuilder:
        """Add a context block. Skips silently if key data is empty/None."""
        # Check if all kwargs are empty — skip the block entirely
        if all(_is_empty(v) for v in kwargs.values()):
            return self
        block = _registry.get_block(block_name)
        rendered = _substitute(block.get("template", ""), kwargs)
        self._system_parts.append(rendered)
        return self

    def build(self) -> tuple[str, dict]:
        """Return (system_prompt, model_params)."""
        system_prompt = "\n\n".join(part for part in self._system_parts if part)
        return system_prompt, dict(self._params)
