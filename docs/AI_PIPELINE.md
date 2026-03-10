# LinguaCompanion — AI Pipeline Specification

## Spike Test Results (2026-03-10)

| Provider | Model | Avg Latency | Code-Switching | Role |
|----------|-------|-------------|---------------|------|
| Deepgram | Nova-3, language=multi | 2.56s | **6/6** ✅ | **PRIMARY STT** |
| Groq | Whisper large-v3-turbo | 0.67s | 3/6 ⚠️ | **FALLBACK STT** |
| Gemini | 2.5 Flash Lite | 2.31s | 4/6 | LLM only, not STT |

**Why Deepgram is primary**: Groq systematically loses one language in genuinely mixed
RU/EN utterances (e.g. "Я люблю учить английский" spoken as mixed → transcribed as pure RU).
Deepgram `language=multi` correctly preserves both languages in all tested cases.

## Multi-Agent Architecture

```
User speaks (mixed RU/EN)
        │
        ▼ WebSocket audio chunk (webm/opus)
┌───────────────────────────────────────────┐
│           ORCHESTRATOR AGENT              │
│   FastAPI WebSocket + asyncio             │
└───────────┬───────────────────────────────┘
            │
            ▼
┌───────────────────────────────────────────┐
│              STT AGENT                    │
│  Primary:  Deepgram Nova-3 language=multi │
│  Fallback: Groq Whisper (auto-switch)     │
│  Output:   raw transcript (RU+EN mixed)   │
└───────────┬───────────────────────────────┘
            │
            ├────────────────────────┐
            ▼                        ▼
┌─────────────────────┐  ┌──────────────────────────┐
│  RECONSTRUCTION     │  │   PHRASE VARIANTS         │
│  AGENT              │  │   AGENT                   │
│                     │  │                           │
│  Input: raw mixed   │  │  Input: raw mixed          │
│  Output:            │  │  Output: 5 variants        │
│  - corrected EN     │  │  simultaneously:           │
│  - grammar note     │  │  ✅ Simple                 │
│  - explanation (RU) │  │  📊 Professional           │
│  LLM: Groq 70B      │  │  😊 Colloquial             │
│  Temp: 0.3          │  │  😎 Slang                  │
└──────────┬──────────┘  │  🎭 Idiom                  │
           │             │  LLM: Groq 70B, Temp: 0.7  │
           │             └──────────┬─────────────────┘
           └──────────┬─────────────┘
                      │ (merged response)
                      ▼
┌───────────────────────────────────────────┐
│           COMPANION AGENT                 │
│  Input: corrected text + user history     │
│  Output: dialogue response (streaming)    │
│  Style profiles:                          │
│    🧑‍🏫 Mentor  👨‍💻 Colleague  😄 Friend     │
│    💪 Coach   👔 Interview Prep           │
│  LLM: Groq 70B, streaming                 │
└───────────┬───────────────────────────────┘
            │
            ├──────────────────────────────┐
            ▼                              ▼ (async, non-blocking)
┌─────────────────────┐        ┌──────────────────────┐
│   TTS AGENT         │        │   MEMORY AGENT        │
│  Google Neural2     │        │  Google Embeddings    │
│  → audio stream     │        │  + pgvector search    │
└─────────────────────┘        │  Stores: interests,   │
                               │  vocab gaps, history  │
                               └──────────────────────┘

Background (Celery, every 4h):
┌───────────────────────────────────────────┐
│         TOPIC DISCOVERY AGENT             │
│  Sources: HN API, Reddit, RSS feeds       │
│  → LLM generates prompt at user level     │
│  → stores in topics table                 │
└───────────────────────────────────────────┘
```

## Latency Budget

```
STT (Deepgram)       ~2.5s   ← bottleneck
Reconstruction       ~0.5s   ┐ parallel
Phrase Variants      ~0.5s   ┘
Companion (stream)   ~0.3s first token
TTS                  ~0.3s
─────────────────────────────
Total target         < 3.5s end-to-end
```

Note: Reconstruction and Phrase Variants run **in parallel** (asyncio.gather) after STT.
This saves ~0.5s vs sequential execution.

## Agent Specifications

### STT Agent (`backend/app/agents/stt.py`)

```python
# Primary
await transcribe_deepgram(audio_bytes, mime_type)
# → model=nova-3, language=multi, smart_format=true

# Fallback (auto on Deepgram failure)
await transcribe_groq(audio_bytes, filename)
# → model=whisper-large-v3-turbo, language=None
```

**Critical**: `language=None` in Groq enables auto-detection.
`language=multi` in Deepgram enables code-switching mode.
Do NOT hardcode `language="ru"` — kills code-switching.

### Reconstruction Agent (`backend/app/agents/reconstruction.py`)

Input: mixed RU/EN transcript
Output JSON:
```json
{
  "corrected": "Yesterday I was working on an automation pipeline.",
  "original_intent": "...",
  "main_error": "missing verb conjugation",
  "error_type": "grammar|vocabulary|code_switching|none",
  "explanation": "Нужно добавить 'was working' (RU explanation)"
}
```
Model: `groq/llama-3.3-70b-versatile`, temperature: 0.3

### Phrase Variants Agent (`backend/app/agents/phrase_variants.py`)

Input: corrected English sentence
Output JSON:
```json
{
  "simple":       "I fixed that bug yesterday.",
  "professional": "I resolved the defect yesterday.",
  "colloquial":   "I squashed that bug yesterday.",
  "slang":        "Crushed that bug, no cap.",
  "idiom":        "I nailed it — that bug is history."
}
```
Model: `groq/llama-3.3-70b-versatile`, temperature: 0.7, response_format: json_object

### Companion Agent (`backend/app/agents/companion.py`)

System prompt varies by style profile (set per user in DB).
Always includes:
- User's known interests (from Memory Agent)
- Recent vocabulary errors (from Analytics Agent)
- Current session context

### Memory Agent (`backend/app/agents/memory.py`)

- Embedding: Google Embeddings API (Phase 1) — saves 800MB RAM
- Storage: pgvector in Supabase
- Retrieval: cosine similarity, top-5, threshold 0.75
- Write: async background task (non-blocking)

### Topic Discovery Agent (`backend/app/agents/topic_discovery.py`)

- Celery beat schedule: every 4 hours
- Sources: HN top stories, Reddit (r/programming, r/MachineLearning), RSS
- Scoring: relevance to user interest graph
- Output: LLM-generated discussion prompt at user's CEFR level

## LLM Switching

All LLM calls go through **LiteLLM**. Switch provider via single env var:

```bash
# Phase 1
LLM_MODEL=groq/llama-3.3-70b-versatile

# Phase 2 (better quality, same API call)
LLM_MODEL=gemini/gemini-2.0-flash
```

No code changes needed — just .env update.

## Audio Format

- Client sends: `webm/opus` (MediaRecorder default in Chrome)
- Deepgram accepts: webm, mp4, mp3, wav, ogg, flac
- WebSocket message: binary audio bytes
- Chunk size: 2-5 seconds for acceptable latency

## Error Handling

```
Deepgram 429/500 → auto-fallback to Groq (logged)
Groq timeout     → return partial result with error flag
LLM failure      → return raw STT transcript (degraded mode)
Memory failure   → continue without context (logged)
```

User should never see a hard error — always degraded response.
