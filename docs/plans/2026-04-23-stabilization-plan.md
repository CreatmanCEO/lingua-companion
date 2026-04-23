# Lingua Companion Stabilization — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transform Lingua Companion from a prototype into a working daily-use English learning tool.

**Architecture:** Replace single-model LLM config with per-task model router via OpenRouter. Extract hardcoded prompts into YAML-based Prompt Engine. Replace Edge-TTS with ElevenLabs→Polly→Edge fallback chain. Add translation via LLM+cache. Fix critical UX bugs (analysis disappearing, compact mic, error toasts).

**Tech Stack:** FastAPI, LiteLLM+OpenRouter, DeepSeek V3.2, Qwen3 235B, ElevenLabs, AWS Polly, Edge-TTS, Redis cache, structlog, Next.js, Zustand, TypeScript

**Order:** Infrastructure first (config, logging), then Prompt Engine, then Model Router integration into agents, then TTS chain, then Translation, then frontend bug fixes. Each task is independently testable and committable.

---

## Task 1: Model Router — Config + Environment

**Files:**
- Modify: `backend/app/core/config.py`
- Modify: `backend/.env.example`

**Step 1: Update config.py with per-task model routing**

Replace single `LLM_MODEL` with per-task models. Keep `LLM_MODEL` as fallback for backward compat.

```python
# backend/app/core/config.py
from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    # App
    APP_NAME: str = "LinguaCompanion API"
    DEBUG: bool = False
    VERSION: str = "0.2.0"

    # Database
    DATABASE_URL: str = "sqlite:///./dev.db"

    # Redis
    REDIS_URL: str = "redis://localhost:6380/0"

    # --- LLM Model Router ---
    OPENROUTER_API_KEY: Optional[str] = None
    # Legacy fallback (used if per-task model not set)
    LLM_MODEL: str = "openrouter/deepseek/deepseek-v3.2"
    # Per-task models
    MODEL_COMPANION: str = "openrouter/deepseek/deepseek-v3.2"
    MODEL_RECONSTRUCTION: str = "openrouter/deepseek/deepseek-v3.2"
    MODEL_VARIANTS: str = "openrouter/deepseek/deepseek-v3.2"
    MODEL_TRANSLATION: str = "openrouter/qwen/qwen3-235b-a22b-2507"
    MODEL_EXTRACTION: str = "openrouter/qwen/qwen3-235b-a22b-2507"
    MODEL_ONBOARDING: str = "openrouter/google/gemma-4-31b-it:free"
    MODEL_TOPIC_DISCOVERY: str = "openrouter/qwen/qwen3-235b-a22b-2507"

    # --- STT ---
    DEEPGRAM_API_KEY: Optional[str] = None
    GROQ_API_KEY: Optional[str] = None
    STT_PROVIDER: str = "deepgram"
    WHISPER_MODEL: str = "whisper-large-v3-turbo"

    # --- TTS Fallback Chain ---
    ELEVENLABS_API_KEYS: str = ""  # comma-separated: sk_xxx,sk_yyy,sk_zzz
    AWS_ACCESS_KEY_ID: Optional[str] = None
    AWS_SECRET_ACCESS_KEY: Optional[str] = None
    AWS_REGION: str = "us-east-1"

    # --- Embeddings ---
    GEMINI_API_KEY: Optional[str] = None
    GOOGLE_EMBEDDINGS_MODEL: str = "text-embedding-004"

    # --- Auth ---
    SECRET_KEY: str = "dev-secret-key-change-in-production"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7

    class Config:
        env_file = ".env"
        case_sensitive = True
        extra = "ignore"


settings = Settings()
```

**Step 2: Update .env.example**

Add new env vars with comments explaining each.

**Step 3: Run existing tests to verify no breakage**

Run: `cd /c/lingua-companion && python -m pytest backend/tests/ -v`
Expected: All existing tests pass (config changes are backward-compatible).

**Step 4: Commit**

```bash
git add backend/app/core/config.py backend/.env.example
git commit -m "feat: model router config — per-task model routing via OpenRouter"
```

---

## Task 2: Structured Logging

**Files:**
- Modify: `backend/app/main.py`
- Create: `backend/app/core/logging.py`

**Step 1: Create logging configuration**

```python
# backend/app/core/logging.py
import logging
import structlog
import uuid


def setup_logging(debug: bool = False):
    """Configure structlog with JSON output and correlation IDs."""
    structlog.configure(
        processors=[
            structlog.contextvars.merge_contextvars,
            structlog.processors.add_log_level,
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.dev.ConsoleRenderer() if debug else structlog.processors.JSONRenderer(),
        ],
        logger_factory=structlog.stdlib.LoggerFactory(),
        wrapper_class=structlog.stdlib.BoundLogger,
    )
    logging.basicConfig(
        level=logging.DEBUG if debug else logging.INFO,
        format="%(message)s",
    )


def new_session_id() -> str:
    """Generate a short correlation ID for a WebSocket session."""
    return uuid.uuid4().hex[:8]
```

**Step 2: Wire into main.py**

Add `setup_logging(settings.DEBUG)` call in lifespan startup. Import and call before app creation.

**Step 3: Test logging works**

Run: `cd /c/lingua-companion && python -c "from app.core.logging import setup_logging; setup_logging(True); import structlog; log = structlog.get_logger(); log.info('test', key='value')"`
Expected: Colored console output with timestamp and key=value.

**Step 4: Commit**

```bash
git add backend/app/core/logging.py backend/app/main.py
git commit -m "feat: structured logging with structlog + correlation IDs"
```

---

## Task 3: Prompt Engine — Registry + Builder

**Files:**
- Create: `backend/app/prompts/__init__.py`
- Create: `backend/app/prompts/registry.py`
- Create: `backend/app/prompts/builder.py`
- Create: `backend/tests/test_prompt_engine.py`

**Step 1: Write failing tests**

```python
# backend/tests/test_prompt_engine.py
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
    assert "Alex" in tpl["system"]


def test_builder_assembles_prompt():
    builder = PromptBuilder("companion")
    builder.with_persona("alex")
    builder.with_block("level_adaptation", level="B1")
    system, params = builder.build()
    assert "Alex" in system
    assert "B1" in system
    assert "model" in params
    assert params["model"] == "openrouter/deepseek/deepseek-v3.2"


def test_builder_without_optional_blocks():
    builder = PromptBuilder("reconstruction")
    system, params = builder.build()
    assert "grammar coach" in system.lower() or "corrected" in system.lower()
    assert params["temperature"] == 0.3


def test_builder_with_scenario():
    builder = PromptBuilder("companion")
    builder.with_persona("sam")
    builder.with_block("scenario_context", scenario={"companionRole": "Tech Lead", "userRole": "Junior Dev"})
    system, params = builder.build()
    assert "Tech Lead" in system
    assert "Sam" in system


def test_builder_with_topic():
    builder = PromptBuilder("companion")
    builder.with_persona("morgan")
    builder.with_block("topic_context", topic={"title": "Rust async", "source": "HN", "discussion_prompt": "What do you think?"})
    system, params = builder.build()
    assert "Rust async" in system


def test_translation_template():
    builder = PromptBuilder("translation")
    system, params = builder.build()
    assert params["model"] == "openrouter/qwen/qwen3-235b-a22b-2507"
    assert params["temperature"] == 0.1
```

**Step 2: Run tests to verify they fail**

Run: `cd /c/lingua-companion && python -m pytest backend/tests/test_prompt_engine.py -v`
Expected: FAIL — modules don't exist yet.

**Step 3: Implement registry.py**

```python
# backend/app/prompts/__init__.py
from .builder import PromptBuilder
from .registry import PromptRegistry

__all__ = ["PromptBuilder", "PromptRegistry"]
```

```python
# backend/app/prompts/registry.py
import yaml
import logging
from pathlib import Path
from functools import lru_cache

logger = logging.getLogger(__name__)

TEMPLATES_DIR = Path(__file__).parent / "templates"
BLOCKS_DIR = Path(__file__).parent / "blocks"


class PromptRegistry:
    """Loads and caches YAML prompt templates and blocks."""

    def __init__(self, templates_dir: Path = TEMPLATES_DIR, blocks_dir: Path = BLOCKS_DIR):
        self._templates_dir = templates_dir
        self._blocks_dir = blocks_dir
        self._cache: dict[str, dict] = {}

    def get(self, name: str) -> dict:
        """Load a template by name. Supports 'companion/alex' nested paths."""
        if name in self._cache:
            return self._cache[name]

        path = self._templates_dir / f"{name}.yaml"
        if not path.exists():
            raise FileNotFoundError(f"Template not found: {path}")

        with open(path, "r", encoding="utf-8") as f:
            data = yaml.safe_load(f)

        self._cache[name] = data
        return data

    def get_block(self, name: str) -> dict:
        """Load a prompt block by name."""
        cache_key = f"__block__{name}"
        if cache_key in self._cache:
            return self._cache[cache_key]

        path = self._blocks_dir / f"{name}.yaml"
        if not path.exists():
            raise FileNotFoundError(f"Block not found: {path}")

        with open(path, "r", encoding="utf-8") as f:
            data = yaml.safe_load(f)

        self._cache[cache_key] = data
        return data

    def clear_cache(self):
        self._cache.clear()


# Singleton
_registry = PromptRegistry()


def get_registry() -> PromptRegistry:
    return _registry
```

**Step 4: Implement builder.py**

```python
# backend/app/prompts/builder.py
import logging
from .registry import get_registry

logger = logging.getLogger(__name__)


class PromptBuilder:
    """Assembles a system prompt from template + persona + blocks."""

    def __init__(self, task: str):
        self._registry = get_registry()
        self._template = self._registry.get(task)
        self._persona_text = ""
        self._blocks: list[str] = []

    def with_persona(self, name: str) -> "PromptBuilder":
        """Load companion persona overlay."""
        task_dir = self._template.get("persona_dir", "companion")
        try:
            persona = self._registry.get(f"{task_dir}/{name.lower()}")
            self._persona_text = persona.get("system", "")
        except FileNotFoundError:
            logger.warning("Persona %s not found, using base only", name)
        return self

    def with_block(self, block_name: str, **kwargs) -> "PromptBuilder":
        """Add a context block with variable substitution."""
        # Skip if required data is empty/None
        skip_keys = {"errors", "scenario", "topic", "facts"}
        for key in skip_keys:
            if key in kwargs and not kwargs[key]:
                return self

        try:
            block = self._registry.get_block(block_name)
            template_str = block.get("template", "")
            # Simple variable substitution
            for key, value in kwargs.items():
                if isinstance(value, dict):
                    # For dicts, replace {{key.subkey}} patterns
                    for subkey, subval in value.items():
                        template_str = template_str.replace(
                            "{{" + f"{key}.{subkey}" + "}}", str(subval)
                        )
                elif isinstance(value, list):
                    template_str = template_str.replace(
                        "{{" + key + "}}", "\n".join(str(v) for v in value)
                    )
                else:
                    template_str = template_str.replace(
                        "{{" + key + "}}", str(value)
                    )
            self._blocks.append(template_str)
        except FileNotFoundError:
            logger.warning("Block %s not found, skipping", block_name)
        return self

    def build(self) -> tuple[str, dict]:
        """
        Returns (system_prompt, model_params).
        model_params: {model, temperature, max_tokens}
        """
        parts = [self._template.get("system", "")]

        if self._persona_text:
            parts.append(self._persona_text)

        for block_text in self._blocks:
            if block_text.strip():
                parts.append(block_text.strip())

        system_prompt = "\n\n".join(p for p in parts if p.strip())

        params = {
            "model": self._template.get("model", "openrouter/deepseek/deepseek-v3.2"),
            "temperature": self._template.get("temperature", 0.7),
            "max_tokens": self._template.get("max_tokens", 400),
        }

        return system_prompt, params
```

**Step 5: Run tests**

Run: `cd /c/lingua-companion && python -m pytest backend/tests/test_prompt_engine.py -v`
Expected: FAIL — YAML templates don't exist yet (created in Task 4).

**Step 6: Commit engine code (templates in next task)**

```bash
git add backend/app/prompts/ backend/tests/test_prompt_engine.py
git commit -m "feat: Prompt Engine — registry + builder (templates in next commit)"
```

---

## Task 4: Prompt Engine — YAML Templates + Blocks

**Files:**
- Create: `backend/app/prompts/templates/reconstruction.yaml`
- Create: `backend/app/prompts/templates/phrase_variants.yaml`
- Create: `backend/app/prompts/templates/companion/base.yaml`
- Create: `backend/app/prompts/templates/companion/alex.yaml`
- Create: `backend/app/prompts/templates/companion/sam.yaml`
- Create: `backend/app/prompts/templates/companion/morgan.yaml`
- Create: `backend/app/prompts/templates/translation.yaml`
- Create: `backend/app/prompts/templates/onboarding.yaml`
- Create: `backend/app/prompts/templates/fact_extraction.yaml`
- Create: `backend/app/prompts/templates/topic_discovery.yaml`
- Create: `backend/app/prompts/blocks/level_adaptation.yaml`
- Create: `backend/app/prompts/blocks/error_tracking.yaml`
- Create: `backend/app/prompts/blocks/memory_context.yaml`
- Create: `backend/app/prompts/blocks/scenario_context.yaml`
- Create: `backend/app/prompts/blocks/topic_context.yaml`

**Step 1: Create all template YAML files**

Extract prompts from current Python files into YAML. Each template has: version, model, temperature, max_tokens, system.

Key templates to create (content extracted from existing agent .py files):
- `reconstruction.yaml`: prompt from `reconstruction.py:30-70`, model=MODEL_RECONSTRUCTION, temp=0.3
- `phrase_variants.yaml`: prompt from `phrase_variants.py:27-57`, model=MODEL_VARIANTS, temp=0.7, **add `translation` field requirement to JSON format**
- `companion/base.yaml`: common prompt from `companion.py:23-54`, model=MODEL_COMPANION, temp=0.7, persona_dir=companion
- `companion/alex.yaml`: persona from `companion.py:58-67`
- `companion/sam.yaml`: persona from `companion.py:69-77`
- `companion/morgan.yaml`: persona from `companion.py:78-88`
- `translation.yaml`: new prompt, model=MODEL_TRANSLATION, temp=0.1, max_tokens=200
- `onboarding.yaml`: prompt from `onboarding.py:18-37`, model=MODEL_ONBOARDING, temp=0.7
- `fact_extraction.yaml`: prompt from `memory.py:221-240`, model=MODEL_EXTRACTION, temp=0.0
- `topic_discovery.yaml`: new prompt, model=MODEL_TOPIC_DISCOVERY, temp=0.5

Key blocks:
- `level_adaptation.yaml`: CEFR level vocabulary rules
- `error_tracking.yaml`: repeated errors → explicit correction
- `memory_context.yaml`: user facts + RAG results
- `scenario_context.yaml`: role-play context
- `topic_context.yaml`: fresh topic for companion

**IMPORTANT for phrase_variants.yaml:** Add `"translation"` field to JSON schema:
```yaml
system: |
  ... (existing prompt) ...
  
  Each variant is an object with:
  - "text": the English variant
  - "context": when to use it (3-7 words in English)
  - "translation": Russian translation of the variant
  
  JSON format:
  {
    "simple": {"text": "...", "context": "...", "translation": "..."},
    ...
  }
```

**Step 2: Run prompt engine tests**

Run: `cd /c/lingua-companion && python -m pytest backend/tests/test_prompt_engine.py -v`
Expected: ALL PASS.

**Step 3: Commit**

```bash
git add backend/app/prompts/templates/ backend/app/prompts/blocks/
git commit -m "feat: Prompt Engine YAML templates — all agents + blocks"
```

---

## Task 5: Integrate Prompt Engine into Agents

**Files:**
- Modify: `backend/app/agents/reconstruction.py`
- Modify: `backend/app/agents/phrase_variants.py`
- Modify: `backend/app/agents/companion.py`
- Modify: `backend/app/agents/onboarding.py`
- Modify: `backend/app/agents/memory.py` (extract_facts only)

**Step 1: Update reconstruction.py**

Replace `SYSTEM_PROMPT` constant and `settings.LLM_MODEL` with PromptBuilder:

```python
# At top of reconstruct():
from app.prompts import PromptBuilder

async def reconstruct(transcript: str) -> dict:
    system_prompt, params = PromptBuilder("reconstruction").build()
    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": f"Transcript: {transcript}"},
    ]
    # ... same retry logic but use params["model"], params["temperature"], params["max_tokens"]
```

Remove the hardcoded `SYSTEM_PROMPT` constant. Keep `REQUIRED_FIELDS`, `_validate_result`, retry logic.

**Step 2: Update phrase_variants.py**

Same pattern. Replace `SYSTEM_PROMPT` and `settings.LLM_MODEL`. Keep `_normalize_variant`, `_validate_variants`, retry logic.

Update `_normalize_variant` to handle new `translation` field:
```python
def _normalize_variant(value, sentence: str) -> dict:
    if isinstance(value, dict) and "text" in value:
        if "context" not in value:
            value["context"] = ""
        if "translation" not in value:
            value["translation"] = ""
        return value
    if isinstance(value, str):
        return {"text": value, "context": "", "translation": ""}
    return {"text": sentence, "context": "", "translation": ""}
```

**Step 3: Update companion.py**

Replace `COMPANION_PROMPTS`, `_COMMON_PROMPT`, `_build_messages` with PromptBuilder.

New `_build_messages` signature adds `user_level`, `repeated_errors`, `topic`:
```python
def _build_messages(
    user_message: str,
    companion: str = "Alex",
    history: list[dict] | None = None,
    scenario: dict | None = None,
    memory_context: str | None = None,
    user_level: str = "B1",
    repeated_errors: list | None = None,
    topic: dict | None = None,
) -> tuple[list[dict], dict]:
    """Returns (messages, params) using PromptBuilder."""
    builder = PromptBuilder("companion") \
        .with_persona(companion) \
        .with_block("level_adaptation", level=user_level) \
        .with_block("error_tracking", errors=repeated_errors or []) \
        .with_block("memory_context", facts=memory_context or "") \
        .with_block("scenario_context", scenario=scenario) \
        .with_block("topic_context", topic=topic)
    
    system_prompt, params = builder.build()
    messages = [{"role": "system", "content": system_prompt}]
    if history:
        messages.extend(history[-MAX_HISTORY_MESSAGES:])
    messages.append({"role": "user", "content": user_message})
    return messages, params
```

Update `generate_response` and `generate_response_stream` to use `params["model"]` instead of `settings.LLM_MODEL`.

**Step 4: Update onboarding.py and memory.py extract_facts**

Same pattern: replace hardcoded prompts with PromptBuilder calls.

**Step 5: Run ALL existing tests**

Run: `cd /c/lingua-companion && python -m pytest backend/tests/ -v`
Expected: All tests pass. Mocked litellm calls don't care about model name changes.

**Step 6: Commit**

```bash
git add backend/app/agents/
git commit -m "feat: integrate Prompt Engine into all agents — no more hardcoded prompts"
```

---

## Task 6: TTS Fallback Chain

**Files:**
- Rewrite: `backend/app/agents/tts.py`
- Modify: `backend/requirements.txt`
- Create: `backend/tests/test_tts_chain.py`

**Step 1: Add dependencies**

Add to requirements.txt: `elevenlabs>=1.0.0` and `aioboto3>=12.0.0`

**Step 2: Write failing tests**

```python
# backend/tests/test_tts_chain.py
import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from app.agents.tts import TTSChain, synthesize, get_voice_name


def test_get_voice_name_known():
    assert get_voice_name("us-male") != ""

def test_get_voice_name_unknown_returns_default():
    name = get_voice_name("unknown-voice")
    assert name != ""

@pytest.mark.asyncio
async def test_synthesize_returns_bytes():
    with patch("app.agents.tts._tts_chain") as mock_chain:
        mock_chain.synthesize = AsyncMock(return_value=b"fake-audio")
        result = await synthesize("Hello", voice="us-male")
        assert isinstance(result, bytes)
        assert len(result) > 0

@pytest.mark.asyncio
async def test_chain_falls_back_on_failure():
    chain = TTSChain()
    # Mock all providers: first fails, second succeeds
    with patch.object(chain, "_elevenlabs_tts", side_effect=Exception("quota")), \
         patch.object(chain, "_polly_tts", return_value=b"polly-audio"), \
         patch.object(chain, "_edge_tts", return_value=b"edge-audio"):
        result = await chain.synthesize("Test")
        assert result.audio == b"polly-audio"
        assert result.provider == "polly"
```

**Step 3: Implement TTSChain**

Rewrite `backend/app/agents/tts.py` with:
- `TTSChain` class with circuit breaker pattern
- `_elevenlabs_tts()`: rotates 3 API keys, uses `elevenlabs` SDK
- `_polly_tts()`: uses `aioboto3` with Generative engine
- `_edge_tts()`: current Edge-TTS code (preserved as emergency fallback)
- Keep existing `synthesize()` function signature for backward compat (delegates to chain)
- Keep existing `get_voice_name()` function
- Keep LRU cache (check cache BEFORE chain)

**Step 4: Run tests**

Run: `cd /c/lingua-companion && python -m pytest backend/tests/test_tts_chain.py -v`
Expected: ALL PASS.

**Step 5: Commit**

```bash
git add backend/app/agents/tts.py backend/requirements.txt backend/tests/test_tts_chain.py
git commit -m "feat: TTS fallback chain — ElevenLabs → AWS Polly �� Edge-TTS"
```

---

## Task 7: Translation Endpoint

**Files:**
- Create: `backend/app/api/routes/translate.py`
- Modify: `backend/app/main.py` (register route)
- Create: `backend/tests/test_translate.py`

**Step 1: Write failing tests**

```python
# backend/tests/test_translate.py
import pytest
from unittest.mock import AsyncMock, patch
from httpx import AsyncClient, ASGITransport
from app.main import app


@pytest.mark.asyncio
async def test_translate_en_to_ru():
    mock_response = MagicMock()
    mock_response.choices = [MagicMock()]
    mock_response.choices[0].message.content = '{"translated": "Привет мир"}'
    
    with patch("app.api.routes.translate.litellm.acompletion", new_callable=AsyncMock, return_value=mock_response):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.post("/api/v1/translate", json={"text": "Hello world", "to": "ru"})
            assert resp.status_code == 200
            data = resp.json()
            assert "translated" in data


@pytest.mark.asyncio
async def test_translate_ru_to_en():
    mock_response = MagicMock()
    mock_response.choices = [MagicMock()]
    mock_response.choices[0].message.content = '{"translated": "Hello world"}'
    
    with patch("app.api.routes.translate.litellm.acompletion", new_callable=AsyncMock, return_value=mock_response):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.post("/api/v1/translate", json={"text": "Привет мир", "to": "en"})
            assert resp.status_code == 200
```

**Step 2: Implement translate route**

```python
# backend/app/api/routes/translate.py
import json
import hashlib
import logging
import litellm
from fastapi import APIRouter
from pydantic import BaseModel
from app.prompts import PromptBuilder

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1", tags=["translate"])

# In-memory cache (Redis integration in Task 8)
_translation_cache: dict[str, str] = {}


class TranslateRequest(BaseModel):
    text: str
    to: str  # "ru" or "en"


class TranslateResponse(BaseModel):
    translated: str
    cached: bool = False


@router.post("/translate", response_model=TranslateResponse)
async def translate(req: TranslateRequest):
    cache_key = hashlib.md5(f"{req.text}:{req.to}".encode()).hexdigest()
    
    if cache_key in _translation_cache:
        return TranslateResponse(translated=_translation_cache[cache_key], cached=True)
    
    system_prompt, params = PromptBuilder("translation").build()
    
    lang_name = "Russian" if req.to == "ru" else "English"
    
    response = await litellm.acompletion(
        model=params["model"],
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": f"Translate to {lang_name}: {req.text}"},
        ],
        response_format={"type": "json_object"},
        temperature=params["temperature"],
        max_tokens=params["max_tokens"],
    )
    
    raw = response.choices[0].message.content
    result = json.loads(raw)
    translated = result.get("translated", req.text)
    
    _translation_cache[cache_key] = translated
    logger.info("Translated %d chars to %s", len(req.text), req.to)
    
    return TranslateResponse(translated=translated)
```

**Step 3: Register route in main.py**

Add `from app.api.routes.translate import router as translate_router` and `app.include_router(translate_router)`.

**Step 4: Run tests**

Run: `cd /c/lingua-companion && python -m pytest backend/tests/test_translate.py -v`
Expected: ALL PASS.

**Step 5: Commit**

```bash
git add backend/app/api/routes/translate.py backend/app/main.py backend/tests/test_translate.py
git commit -m "feat: translation endpoint — LLM-based RU<->EN with cache"
```

---

## Task 8: Refactor ws.py → Thin Transport + Orchestrator

**Files:**
- Rewrite: `backend/app/agents/orchestrator.py`
- Modify: `backend/app/api/routes/ws.py`
- Modify: `backend/tests/test_ws_session.py`
- Modify: `backend/tests/test_orchestrator.py`

**Step 1: Extract pipeline logic to orchestrator.py**

Move `run_companion_and_variants()`, `_stream_companion()`, `_build_memory_context()`, `_memory_write_behind()`, `process_text()`, `process_onboarding()` from ws.py into `PipelineOrchestrator` class in orchestrator.py.

The orchestrator receives `session` dict and `websocket` as dependencies. It owns all pipeline logic.

**Step 2: Slim down ws.py to ~100 lines**

ws.py only handles: WebSocket accept/disconnect, message routing (binary vs JSON), session_config updates, rate limiting, concurrency guard. Delegates all pipeline work to orchestrator.

**Step 3: Wire vocab_gaps tracking**

In orchestrator's reconstruction step, after getting `changes[]`, call `track_vocab_gap()` for each change:
```python
# After reconstruction returns:
for change in reconstruction_result.get("changes", []):
    asyncio.create_task(
        track_vocab_gap(user_id, change["original"], change["corrected"])
    )
```

**Step 4: Update existing tests**

Update imports in test files. Mock orchestrator instead of inlined ws.py functions.

**Step 5: Run ALL backend tests**

Run: `cd /c/lingua-companion && python -m pytest backend/tests/ -v`
Expected: ALL PASS.

**Step 6: Commit**

```bash
git add backend/app/agents/orchestrator.py backend/app/api/routes/ws.py backend/tests/
git commit -m "refactor: extract pipeline logic from ws.py to PipelineOrchestrator"
```

---

## Task 9: Frontend — Per-Message Analysis (Bug #6 Fix)

**Files:**
- Modify: `apps/web/src/store/chatStore.ts`
- Modify: `apps/web/src/app/page.tsx`
- Modify: `apps/web/src/components/layout/ChatArea.tsx`
- Modify: `apps/web/src/hooks/useVoiceSession.ts`

**Step 1: Update chatStore.ts**

Remove global `currentReconstruction`, `currentVariants`, `isAnalysing` fields.
Analysis data already lives in `Message.reconstruction` and `Message.variants` — use those directly.

Add `translatedTexts: Record<string, string>` and `setTranslation(id, text)` action.

Add `processingMessageId: string | null` to track which message is being processed.

**Step 2: Update page.tsx callbacks**

When `reconstruction_result` arrives → `updateMessage(processingMessageId, {reconstruction: result, isAnalysed: true})`.
When `variants_result` arrives → `updateMessage(processingMessageId, {variants: result})`.
Remove `clearAnalysis()` calls on new message send.

**Step 3: Update ChatArea.tsx**

Render reconstruction/variants per-message:
```tsx
{message.reconstruction && <ReconstructionBlock result={message.reconstruction} />}
{message.variants && <VariantCards variants={message.variants} />}
```

Remove dependency on global `currentReconstruction`/`currentVariants`.

**Step 4: Test manually**

Open https://lingua.creatman.site/, send voice message, verify analysis appears below it.
Send second voice message, verify first message's analysis stays visible.

**Step 5: Commit**

```bash
git add apps/web/src/
git commit -m "fix: analysis results per-message — no longer disappear on new message"
```

---

## Task 10: Frontend — Translation Toggle

**Files:**
- Modify: `apps/web/src/components/CompanionBubble.tsx`
- Modify: `apps/web/src/components/VariantCards.tsx`
- Modify: `apps/web/src/store/chatStore.ts`
- Create: `apps/web/src/lib/translate.ts`

**Step 1: Create translate client**

```typescript
// apps/web/src/lib/translate.ts
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8001";
const cache: Record<string, string> = {};

export async function translate(text: string, to: "ru" | "en"): Promise<string> {
  const key = `${text}:${to}`;
  if (cache[key]) return cache[key];
  
  const resp = await fetch(`${API_URL}/api/v1/translate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, to }),
  });
  const data = await resp.json();
  cache[key] = data.translated;
  return data.translated;
}
```

**Step 2: Add translate button to CompanionBubble**

Add 🔄 button next to ▶ Listen. On click:
- Call `translate(message.text, "ru")`
- Toggle between original and translated text
- Store in chatStore.translatedTexts

**Step 3: Update VariantCards**

Show `variant.translation` if available (comes from backend now).
Add 🔄 button fallback for cards without backend translation.

**Step 4: Test manually**

Open app, get companion response, click 🔄, verify Russian translation appears.

**Step 5: Commit**

```bash
git add apps/web/src/
git commit -m "feat: translation toggle on companion messages and variant cards"
```

---

## Task 11: Frontend — Compact VoiceBar (Bug #7 Fix)

**Files:**
- Modify: `apps/web/src/components/VoiceBar.tsx`

**Step 1: Redesign VoiceBar layout**

Single row, Telegram-style:
```
[text input ........................] [🎤 36px] [➤ send]
```

Recording state — same row, red border:
```
[🔴 0:03 ████████████████] [⬛ stop 36px]
```

Key changes:
- Remove mode toggle (text/voice pills). Always show both.
- Mic button: `36px` round, inline right of text input
- Send button: only visible when text input not empty
- Mic button: hold to record (same logic, smaller visual)
- Recording: red border on entire bar, timer + mini waveform inline
- Processing: spinner replaces mic button, same position

**Step 2: Test on mobile**

Open https://lingua.creatman.site/ on phone. Verify:
- Input bar is one row at bottom
- Mic button is small, doesn't dominate screen
- Hold to record works
- Text input and send work

**Step 3: Commit**

```bash
git add apps/web/src/components/VoiceBar.tsx
git commit -m "fix: compact VoiceBar — inline mic 36px, single row, Telegram-style"
```

---

## Task 12: Frontend — Error Toasts + Partial Results

**Files:**
- Modify: `apps/web/src/app/page.tsx`
- Modify: `apps/web/src/hooks/useVoiceSession.ts`

**Step 1: Add error toast**

Use a simple toast component (div with absolute positioning, auto-dismiss 5s).
Wire `onError` callback to show toast with error message.

**Step 2: Fix partial results**

In useVoiceSession.ts, don't wait for ALL THREE pending results. Show each result as it arrives:
- `reconstruction_result` → immediately update message, show ReconstructionBlock
- `variants_result` → immediately update message, show VariantCards
- `companion_response` → immediately show CompanionBubble

Remove the `checkAllPendingDone()` gate. Each result independently resolves its part of the UI.

Keep 15s timeout but only for the overall processing state (spinner on input bar), not for individual results.

**Step 3: Test**

Send voice message. Verify:
- Reconstruction appears immediately when ready (before variants)
- Companion response streams independently
- Variants appear when ready
- No infinite spinner

**Step 4: Commit**

```bash
git add apps/web/src/
git commit -m "fix: error toasts + partial result rendering — no more infinite spinner"
```

---

## Task 13: Push to GitHub + Deploy Verification

**Step 1: Run full test suite**

Run: `cd /c/lingua-companion && python -m pytest backend/tests/ -v`
Run: `cd /c/lingua-companion/apps/web && npx vitest run`
Expected: All pass.

**Step 2: Push all commits**

```bash
cd /c/lingua-companion
git push origin HEAD
```

**Step 3: Verify live site**

Open https://lingua.creatman.site/ and test:
1. Voice message → STT → reconstruction → variants (with translations) → companion response
2. Click ��� on companion message → Russian translation
3. Compact mic button
4. Second voice message → first analysis stays visible
5. Error toast on backend failure

---

## Summary

| Task | What | Files Changed |
|------|------|--------------|
| 1 | Model Router config | config.py |
| 2 | Structured logging | logging.py, main.py |
| 3 | Prompt Engine code | prompts/registry.py, builder.py |
| 4 | YAML templates | 10 templates + 5 blocks |
| 5 | Integrate into agents | 5 agent files |
| 6 | TTS fallback chain | tts.py rewrite |
| 7 | Translation endpoint | translate.py, main.py |
| 8 | ws.py refactor | orchestrator.py, ws.py |
| 9 | Per-message analysis | chatStore, page, ChatArea |
| 10 | Translation UI | CompanionBubble, VariantCards |
| 11 | Compact VoiceBar | VoiceBar.tsx |
| 12 | Error toasts + partial results | page.tsx, useVoiceSession |
| 13 | Push + verify | git push, manual test |

**Estimated commits:** 13
**Backend tasks:** 1-8
**Frontend tasks:** 9-12
**Integration:** 13
