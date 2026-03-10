# LinguaCompanion — System Architecture

## Overview

LinguaCompanion is a monorepo with clear separation between frontend, backend, and AI pipeline.
Designed to scale from private web app (Phase 1) to cross-platform commercial product (Phase 2).

## High-Level Architecture

```
┌────────────────────────────────────────────────┐
│                  CLIENT LAYER                   │
│   Next.js 15 Web App (port 3001)                │
│   Messenger UI — voice + text                   │
└──────────────────┬─────────────────────────────┘
                   │ HTTPS / WebSocket
┌──────────────────▼─────────────────────────────┐
│            NGINX (reverse proxy + SSL)          │
└──────────────────┬─────────────────────────────┘
                   │
┌──────────────────▼─────────────────────────────┐
│         FASTAPI BACKEND (port 8001)             │
│  WebSocket /ws/session  │  REST /api/v1/*       │
└──────┬──────────┬────────────────┬─────────────┘
       │          │                │
       ▼          ▼                ▼
┌──────────┐ ┌─────────┐   ┌────────────┐  ┌─────────┐
│ Deepgram │ │  Groq   │   │  pgvector  │  │  Redis  │
│ Nova-3   │ │ Llama70B│   │  (memory)  │  │ (cache) │
│ (STT★)   │ │  (LLM)  │   │            │  │         │
└──────────┘ └─────────┘   └────────────┘  └─────────┘
  ★ Groq Whisper = STT fallback

┌────────────────────────────────────────────────┐
│          CELERY WORKERS (background)            │
│  topic_discovery (4h) │ memory_write (async)   │
└────────────────────────────────────────────────┘
```

## Voice Pipeline (Critical Path)

Target: **< 3.5 seconds end-to-end**

```
User speaks (mixed RU/EN)
    │
    ▼ MediaRecorder API → WebSocket (webm/opus chunks)
    │
    ▼ STT AGENT
    │  Primary:  Deepgram Nova-3, language=multi  ~2.5s
    │  Fallback: Groq Whisper, language=None      ~0.7s
    │
    ▼ Raw transcript: "I'm going to supermarket хочу купить яблок"
    │
    ├──────────────────────────┐
    ▼                          ▼  (parallel, asyncio.gather)
RECONSTRUCTION AGENT     PHRASE VARIANTS AGENT
    │  ~0.5s                   │  ~0.5s
    ▼                          ▼
corrected EN sentence     5 style variants
+ grammar note (RU)       Simple / Professional /
                          Colloquial / Slang / Idiom
    └──────────┬───────────────┘
               │
               ▼ COMPANION AGENT (streaming)
               │  ~0.3s first token
               │
               ▼ TTS AGENT
                  Google Neural2  ~0.3s
```

## Multi-Agent System (9 Agents)

| Agent | File | Trigger | Model |
|-------|------|---------|-------|
| Orchestrator | agents/orchestrator.py | Always | — |
| STT | agents/stt.py | Per audio chunk | Deepgram Nova-3 |
| Reconstruction | agents/reconstruction.py | After STT | Groq 70B |
| Phrase Variants | agents/phrase_variants.py | After STT (parallel) | Groq 70B |
| Companion | agents/companion.py | After Reconstruction | Groq 70B |
| Memory | agents/memory.py | Async background | Google Embeddings |
| Topic Discovery | agents/topic_discovery.py | Celery every 4h | Groq 70B |
| Pronunciation | agents/pronunciation.py | Phase 2 | Azure Speech |
| Analytics | agents/analytics.py | Passive | Python |

Full agent specs: **docs/AI_PIPELINE.md**

## Data Model

```sql
users (
  id, email, native_lang, target_lang,
  proficiency, style_profile, interests[], created_at
)
sessions (id, user_id, mode, started_at, ended_at, fluency_score)
messages (
  id, session_id, role,
  original_text, corrected_text, audio_url, created_at
)
speech_analyses (id, message_id, pronunciation_score, grammar_score)
memories (id, user_id, content, embedding vector(768), type, created_at)
topics (id, title, content, source_url, relevance_score, created_at)
user_topics (user_id, topic_id, shown_at, responded_at)
```

## VPS Resource Planning (178.17.50.45, 4GB RAM)

```
Service                RAM      Notes
──────────────────────────────────────────────────
Next.js (prod build)   ~200MB
FastAPI + Uvicorn      ~150MB
PostgreSQL             ~300MB
Redis                  ~50MB
Nginx                  ~20MB
Celery worker          ~200MB
──────────────────────────────────────────────────
Total                  ~920MB
Buffer                 ~3.0GB   OS + spikes + swap
```

**Note**: Google Embeddings API used instead of local multilingual-e5-large model.
Saves 800MB RAM. Phase 2: switch to local model or Qdrant cloud.

## Phase 1 → Phase 2 Migration

| Component | Phase 1 | Phase 2 |
|-----------|---------|---------|
| STT primary | Deepgram Nova-3 | Deepgram Nova-3 (same) |
| LLM | Groq Llama 3.3 70B | Gemini 2.0 Flash |
| TTS | Google Neural2 | ElevenLabs |
| Embeddings | Google API | Local multilingual-e5 |
| Database | Supabase | Self-hosted PostgreSQL |
| Vector | pgvector (Supabase) | Qdrant |
| Auth | NextAuth.js v5 | Clerk |
| Audio storage | Memory/temp | Cloudflare R2 |
| Pronunciation | — | Azure Speech SDK |
| Mobile | PWA | Expo React Native |
