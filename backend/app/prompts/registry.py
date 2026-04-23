"""
Prompt Registry — loads and caches YAML templates and blocks from disk.
"""
from pathlib import Path

import yaml

_BASE_DIR = Path(__file__).parent
_TEMPLATES_DIR = _BASE_DIR / "templates"
_BLOCKS_DIR = _BASE_DIR / "blocks"


class PromptRegistry:
    """In-memory cache for YAML prompt templates and blocks."""

    def __init__(self) -> None:
        self._cache: dict[str, dict] = {}

    def get(self, name: str) -> dict:
        """Load a template by name (supports nested paths like 'companion/alex')."""
        key = f"template:{name}"
        if key not in self._cache:
            path = _TEMPLATES_DIR / f"{name}.yaml"
            if not path.exists():
                raise FileNotFoundError(f"Template not found: {path}")
            with open(path, encoding="utf-8") as f:
                self._cache[key] = yaml.safe_load(f)
        return self._cache[key]

    def get_block(self, name: str) -> dict:
        """Load a prompt block by name."""
        key = f"block:{name}"
        if key not in self._cache:
            path = _BLOCKS_DIR / f"{name}.yaml"
            if not path.exists():
                raise FileNotFoundError(f"Block not found: {path}")
            with open(path, encoding="utf-8") as f:
                self._cache[key] = yaml.safe_load(f)
        return self._cache[key]
