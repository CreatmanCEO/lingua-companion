# Design: Stabilization + Model Router + TTS Chain + Translation + Prompt Engine

> **Date:** 2026-04-23
> **Status:** APPROVED
> **Goal:** Make the product actually work for daily English practice

---

## Decisions Made

| Decision | Choice | Reason |
|----------|--------|--------|
| LLM Provider | OpenRouter (key: sk-or-v1-...) | Unified API, model flexibility |
| Companion/Reconstruction/Variants model | `deepseek/deepseek-v3.2` ($0.25/$0.38) | GPT-5 class quality, cheapest viable option |
| Translation/Extraction model | `qwen/qwen3-235b-a22b-2507` ($0.07/$0.10) | Best open-source for Russian, ultra-cheap |
| Onboarding model | `google/gemma-4-31b-it:free` | Free, sufficient for 4 questions |
| Topic Discovery model | `qwen/qwen3-235b-a22b-2507` | Batch task, cheapest possible |
| TTS Primary | ElevenLabs (3 keys rotation, free tier) | Best quality, already paid |
| TTS Fallback | AWS Polly Generative | Credentials available, 12-month free tier |
| TTS Emergency | Edge-TTS | Free, unlimited, current implementation |
| Translation | LLM via OpenRouter + Redis cache | No DeepL/Azure accounts, LLM is $0.000003/req |
| NO OpenAI | Principle | User decision, non-negotiable |

---

## Architecture Changes

### 1. Model Router (config.py)

Replace single `LLM_MODEL` with per-task routing:

```python
OPENROUTER_API_KEY: str
MODEL_COMPANION: str = "openrouter/deepseek/deepseek-v3.2"
MODEL_RECONSTRUCTION: str = "openrouter/deepseek/deepseek-v3.2"
MODEL_VARIANTS: str = "openrouter/deepseek/deepseek-v3.2"
MODEL_TRANSLATION: str = "openrouter/qwen/qwen3-235b-a22b-2507"
MODEL_EXTRACTION: str = "openrouter/qwen/qwen3-235b-a22b-2507"
MODEL_ONBOARDING: str = "openrouter/google/gemma-4-31b-it:free"
MODEL_TOPIC_DISCOVERY: str = "openrouter/qwen/qwen3-235b-a22b-2507"
```

Each agent reads its own model variable. LiteLLM handles `openrouter/` prefix natively.

### 2. Prompt Engine (backend/app/prompts/)

```
backend/app/prompts/
├── registry.py          -- load/cache YAML templates
├── builder.py           -- runtime prompt assembly
├── templates/
│   ├── companion/
│   │   ├── base.yaml
│   │   ├── alex.yaml
│   │   ├── sam.yaml
│   │   └── morgan.yaml
│   ├── reconstruction.yaml
│   ├── phrase_variants.yaml
│   ├── translation.yaml
│   ├── onboarding.yaml
│   ├── fact_extraction.yaml
│   └── topic_discovery.yaml
└── blocks/
    ├── level_adaptation.yaml
    ├── error_tracking.yaml
    ├── memory_context.yaml
    ├── scenario_context.yaml
    └── topic_context.yaml
```

Templates in YAML with Jinja2-style variables. Builder assembles system prompt + model params per request.

Each agent replaces hardcoded prompt strings with:
```python
system_prompt, params = PromptBuilder("companion") \
    .with_persona(companion) \
    .with_block("level_adaptation", level=user_level) \
    .with_block("error_tracking", errors=repeated_errors) \
    .with_block("memory_context", facts=memory_context) \
    .with_block("scenario_context", scenario=scenario) \
    .with_block("topic_context", topic=topic) \
    .build()
```

### 3. TTS Fallback Chain (agents/tts.py)

Complete rewrite. Circuit breaker pattern:
- ElevenLabs: 3 keys rotated, max_failures=3 then 60s cooldown
- AWS Polly: Generative engine (Ruth/Matthew), same circuit breaker
- Edge-TTS: max_failures=999 (never disabled)

Voice mapping per provider:
```python
VOICE_MAP = {
    "elevenlabs": {"us-male": "echo-voice-id", "us-female": "nova-voice-id", ...},
    "polly": {"us-male": "Matthew", "us-female": "Ruth", ...},
    "edge": {"us-male": "en-US-GuyNeural", "us-female": "en-US-JennyNeural", ...},
}
```

routes/tts.py stays the same (POST /api/v1/tts). Frontend unchanged.

### 4. Translation

**Backend:**
- `POST /api/v1/translate` -- {text, to: "ru"|"en"} -> {translated}
- Model: MODEL_TRANSLATION (Qwen 235B)
- Redis cache: key=hash(text+lang), TTL 7 days
- Template in Prompt Engine: templates/translation.yaml

**Phrase Variants extension:**
- Add `translation` field to each variant in prompt
- Output: `{text, context, translation}` instead of `{text, context}`

**Frontend:**
- Toggle button on CompanionBubble and VariantCards
- chatStore: `translatedTexts: Record<string, string>`
- Client-side cache: don't re-request same message

### 5. Bug Fixes

**Analysis per-message (bug #6):**
- Move `reconstruction` and `variants` INTO Message object (already defined in interface but stored globally)
- Remove global `currentReconstruction`/`currentVariants` from chatStore
- Each message owns its analysis results

**Companion language stability (bug #5):**
- DeepSeek V3.2 follows instructions much better than Llama 3.3
- Prompt Engine adds few-shot examples of correct English-only responses

**Compact VoiceBar (bug #7):**
- Single row: [text input] [mic 36px] [send]
- Mic button inline, not separate mode
- Hold to record, release to send (same logic, smaller button)
- Recording state: red border on input + timer inline

**Structured logging:**
- Configure structlog in main.py
- Correlation ID per WebSocket session
- JSON format, file handler + console
- Log every pipeline step with timing

**Error toasts (frontend):**
- WebSocket error events → toast notification
- 15s timeout → user-visible message

### 6. ws.py Refactor

Extract pipeline logic to orchestrator.py:
```python
class PipelineOrchestrator:
    async def run_voice(self, audio: bytes, ws) -> None
    async def run_text(self, text: str, ws) -> None
    async def run_onboarding(self, text: str, ws) -> None
```

ws.py becomes thin transport layer (~100 lines).

### 7. vocab_gaps Wiring

Connect `track_vocab_gap()` to reconstruction pipeline:
- After reconstruction returns `changes[]`, call `track_vocab_gap()` for each change
- Count repeated errors in session
- Pass to Prompt Engine `error_tracking` block when count >= 3

---

## Files Changed

### Backend (modify)
- `app/core/config.py` -- add per-task model vars, OpenRouter key, ElevenLabs/AWS keys
- `app/agents/companion.py` -- use PromptBuilder instead of hardcoded prompts
- `app/agents/reconstruction.py` -- use PromptBuilder
- `app/agents/phrase_variants.py` -- use PromptBuilder + add translation field
- `app/agents/onboarding.py` -- use PromptBuilder
- `app/agents/memory.py` -- use PromptBuilder for extract_facts
- `app/agents/tts.py` -- complete rewrite (fallback chain)
- `app/agents/orchestrator.py` -- complete rewrite (pipeline logic from ws.py)
- `app/api/routes/ws.py` -- thin transport layer, delegate to orchestrator
- `app/api/routes/tts.py` -- no changes (same interface)
- `app/main.py` -- add structlog config, translation route, CORS update
- `requirements.txt` -- add elevenlabs, aioboto3, jinja2

### Backend (new)
- `app/prompts/registry.py`
- `app/prompts/builder.py`
- `app/prompts/templates/*.yaml` (10 files)
- `app/prompts/blocks/*.yaml` (5 files)
- `app/api/routes/translate.py`

### Frontend (modify)
- `src/store/chatStore.ts` -- analysis per-message, translatedTexts
- `src/components/VoiceBar.tsx` -- compact inline mic
- `src/components/CompanionBubble.tsx` -- add translate toggle
- `src/components/VariantCards.tsx` -- show translation, add translate button
- `src/components/layout/ChatArea.tsx` -- per-message analysis rendering
- `src/app/page.tsx` -- update callbacks for per-message analysis, error toasts

### Delete
- Dead code in orchestrator.py (replaced entirely)

---

## Cost Estimate (100 conversations, 20 messages each)

| Component | Model | Est. Cost |
|-----------|-------|-----------|
| Companion (2000 calls) | DeepSeek V3.2 | ~$0.95 |
| Reconstruction (600 calls) | DeepSeek V3.2 | ~$0.15 |
| Variants (600 calls) | DeepSeek V3.2 | ~$0.15 |
| Translation (800 calls) | Qwen 235B | ~$0.003 |
| Extraction (200 calls) | Qwen 235B | ~$0.002 |
| Onboarding (100 calls) | Gemma 4 free | $0 |
| TTS (2000 calls) | ElevenLabs free | $0 |
| **Total** | | **~$1.25** |

At $10/month subscription: profitable at 800 conversations/month.
