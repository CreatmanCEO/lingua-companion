# LinguaCompanion — System Architecture

## Overview

LinguaCompanion is built as a monorepo with a clear separation between frontend, backend, and AI pipeline components. The system is designed to scale from a private web app (Phase 1) to a cross-platform commercial product (Phase 2).

## High-Level Architecture

```
┌─────────────────────────────────────────────────┐
│                   CLIENT LAYER                   │
│  Next.js 15 Web App    │    Expo Mobile (Ph.2)   │
│  (Messenger UI)        │    (React Native)        │
└──────────────┬──────────────────────────────────┘
               │ HTTPS / WebSocket
┌──────────────▼──────────────────────────────────┐
│                  NGINX (reverse proxy + SSL)      │
└──────────────┬──────────────────────────────────┘
               │
┌──────────────▼──────────────────────────────────┐
│              FASTAPI BACKEND                      │
│  /api/speech  │  /api/chat  │  /api/memory       │
│  /api/topics  │  /api/users │  /api/analytics    │
└───┬───────────┬─────────────┬────────────────────┘
    │           │             │
    ▼           ▼             ▼
┌───────┐  ┌────────┐  ┌──────────┐  ┌──────────┐
│ Groq  │  │ Groq   │  │ pgvector │  │  Redis   │
│Whisper│  │Llama   │  │ (memory) │  │ (cache)  │
│ (STT) │  │70B(LLM)│  │          │  │          │
└───────┘  └────────┘  └──────────┘  └──────────┘
                              │
                    ┌─────────▼───────────┐
                    │    PostgreSQL        │
                    │  (Supabase Ph.1)     │
                    └─────────────────────┘
```

## Component Details

### 1. Voice Pipeline (Core)

The most critical path — must complete in < 3 seconds:

```
User speaks
    │
    ▼ MediaRecorder API (WebAudio)
Audio chunk (webm/opus, ~2-5 sec)
    │
    ▼ POST /api/speech/transcribe
Groq Whisper large-v3-turbo
    │ ~0.3-0.8s
    ▼
Multilingual transcript
{
  "text": "Yesterday я работал над automation pipeline",
  "segments": [
    {"text": "Yesterday ", "lang": "en"},
    {"text": "я работал над ", "lang": "ru"},
    {"text": "automation pipeline", "lang": "en"}
  ]
}
    │
    ▼ Intent Reconstruction (LLM prompt)
Groq Llama 3.3 70B (streaming)
    │ ~0.5-1.5s
    ▼
{
  "corrected": "Yesterday I worked on an automation pipeline.",
  "alternatives": {
    "simple": "Yesterday I worked on an automation pipeline.",
    "advanced": "Yesterday I was developing an automation pipeline.",
    "colloquial": "Yesterday I was putting together an automation setup."
  },
  "grammar_notes": ["verb tense: 'работал' → 'worked'"]
}
    │
    ▼ Memory update (async, non-blocking)
    ▼ AI response generation (streaming)
Response streamed to client
```

### 2. Conversational Memory Engine

Uses sentence-transformers (multilingual-e5-large) to create embeddings of:
- User messages and topics
- Interests extracted from conversations
- Vocabulary weaknesses (recurring errors)

Stored in PostgreSQL + pgvector. Queried via cosine similarity for context injection.

```python
# Memory retrieval flow
user_message_embedding = embed(user_message)
relevant_memories = pgvector.search(
    embedding=user_message_embedding,
    limit=5,
    threshold=0.75
)
# Injected into LLM system prompt as context
```

### 3. Topic Discovery Engine

Background Celery task running every 4 hours:

```
Fetch sources:
  - Hacker News API (top stories)
  - Reddit API (r/programming, r/MachineLearning, r/artificial)
  - RSS feeds (TechCrunch, The Verge, OpenAI blog)
      │
      ▼
Score relevance against user interest graph
      │
      ▼
LLM generates discussion prompt at user's proficiency level
      │
      ▼
Store in topics table → Push to user's feed
```

### 4. Data Model

```sql
-- Core tables
users (id, email, native_lang, target_lang, proficiency, interests[], created_at)
sessions (id, user_id, mode, started_at, ended_at, fluency_score)
messages (id, session_id, role, original_text, corrected_text, audio_url, created_at)
speech_analyses (id, message_id, pronunciation_score, grammar_score, fluency_score)
memories (id, user_id, content, embedding vector(768), type, created_at)
topics (id, title, content, source_url, relevance_score, created_at)
user_topics (user_id, topic_id, shown_at, responded_at)
```

## Phase 1 → Phase 2 Migration Path

| Component | Phase 1 | Phase 2 Change |
|-----------|---------|----------------|
| LLM | Groq free tier | Gemini 2.0 Flash ($0.10/1M tokens) |
| Database | Supabase hosted | Self-hosted PostgreSQL |
| Vector | pgvector in Supabase | Dedicated Qdrant instance |
| Auth | NextAuth.js | Clerk (multi-tenant) |
| Mobile | PWA only | Expo React Native |
| Audio | Supabase Storage | Cloudflare R2 |
| TTS | Google Neural2 | ElevenLabs |

## VPS Resource Planning (178.17.50.45, 4GB RAM)

```
Service          RAM Usage    Notes
─────────────────────────────────────────
Next.js          ~200MB       
FastAPI          ~150MB       
PostgreSQL       ~300MB       
Redis            ~50MB        
Nginx            ~20MB        
Celery worker    ~200MB       
multilingual-e5  ~800MB       ML model in RAM (!)
─────────────────────────────────────────
Total            ~1.7GB       
Buffer           ~2.3GB       OS + spikes
```

**Note**: multilingual-e5-large requires ~800MB RAM. On 4GB VPS this works but leaves limited headroom. If memory pressure occurs, use Google embeddings API instead (free tier, 1500 req/day).

## Security Notes

- All API keys in environment variables, never in code
- Audio files deleted from storage after processing (configurable retention)
- User data isolated by user_id in all queries
- Rate limiting on all public endpoints (via Redis)
- WebSocket connections authenticated via JWT
