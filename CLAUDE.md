# LinguaCompanion AI — Claude Code Project Constitution

## Project Overview

Voice-first AI language learning platform for Russian-speaking IT professionals.
Core differentiator: native Russian/English code-switching support.
Target user: IT developer, A2-B1 English, wants to speak like a colleague, not a textbook.

## Tech Stack

| Layer | Technology | Notes |
|-------|-----------|-------|
| Frontend | Next.js 15 (App Router), TypeScript, Tailwind CSS, shadcn/ui | Port 3001 |
| Backend | Python 3.12, FastAPI, Celery + Redis | Port 8001 |
| Database | PostgreSQL + pgvector (Supabase) | `chqbcqabqrnaqsiaomly.supabase.co` |
| Cache / Queue | Upstash Redis (TLS) | `darling-dove-67484.upstash.io:6379` |
| STT Primary | **Deepgram Nova-3, language=multi** | Spike confirmed: 6/6 code-switching ✅ |
| STT Fallback | Groq Whisper large-v3-turbo | Fast (0.67s), auto-switch on Deepgram failure |
| LLM Phase 1 | Groq Llama 3.3 70B via LiteLLM | Hot-swap via LLM_MODEL env |
| LLM Phase 2 | Gemini 2.5 Flash (lingua-bro GCP project) | Separate quota |
| TTS Phase 1 | Google Neural2 | |
| TTS Phase 2 | ElevenLabs | |
| Embeddings | Google Embeddings API | Saves 800MB RAM vs local model |
| Pronunciation | Azure Speech SDK | Phase 2 only |
| Vector DB | pgvector → Qdrant (Phase 2) | |
| Monorepo | Turborepo + pnpm workspaces | |
| Infra | Docker Compose, Coolify | VPS 178.17.50.45 |

## Repository Structure

```
apps/web/          — Next.js 15 frontend (messenger UI) [не инициализирован]
packages/          — Shared types, api-client
backend/           — FastAPI + Celery workers
  app/agents/      — 9 AI agents (stt ✅, остальные — заглушки)
  app/api/routes/  — HTTP + WebSocket endpoints [пусто — следующий шаг]
  app/core/        — Config ✅, database, auth
  app/models/      — SQLAlchemy models
  app/services/    — Business logic
  tests/           — pytest tests
infra/             — docker-compose.yml ✅, nginx configs
docs/              — Architecture ✅, VPS setup ✅, AI Pipeline ✅, API keys ✅
plans/             — Claude Code implementation plans (planner agent output)
.claude/           — Claude Code agents ✅, settings ✅
CHANGELOG.md       — История всего сделанного ✅
```

## Key Commands

```bash
make dev           # Start all services
make dev-api       # Backend only (FastAPI + Celery + Redis + DB)
make dev-web       # Frontend only (Next.js)
make test          # Full test suite
make test-api      # pytest backend
make test-web      # vitest frontend
make lint          # Lint everything
make build         # Production build
make deploy        # Deploy via Coolify webhook
```

## CRITICAL RULES

- NEVER delete or rewrite working tests without explicit request
- NEVER delete files without user confirmation
- NEVER modify .env or .env.example without explicit request
- ALWAYS run tests after any code change: `make test`
- ALWAYS do git checkpoint before large refactors
- One task at a time — do NOT make multiple unrelated changes simultaneously
- If unsure about intent — ASK, do not guess
- NEVER break existing API contracts without updating all consumers
- When modifying AI pipeline — test with sample audio in tests/fixtures/
- When changing STT — remember Deepgram is primary, Groq is fallback (see docs/AI_PIPELINE.md)

## Working Style

- Plan FIRST, code SECOND — never start coding without confirmed plan
- Small diffs: one module → tests → next module
- After every change: run tests and show output
- Use subagents for codebase research to preserve main context window
- At 60-70% context: /compact with summary of current state
- At topic switch: /clear

## Agents

- `planner` — before any complex task, research + plan, never writes code
- `tester` — after code changes, run and interpret tests
- `code-reviewer` — before commits, review for correctness and style

## AI Pipeline Notes

See full pipeline spec: **docs/AI_PIPELINE.md**

Key facts:
- Voice pipeline latency budget: **< 3.5 seconds end-to-end**
- STT primary: Deepgram Nova-3 `language=multi` (**spike confirmed 2026-03-10, 6/6**)
- STT fallback: Groq Whisper (auto-switch on Deepgram failure)
- LLM switching: change `LLM_MODEL` env var — LiteLLM handles the rest
- Reconstruction + PhraseVariants run **in parallel** after STT (asyncio.gather)
- Memory writes are **async, non-blocking**
- Embeddings: Google API (Phase 1) to save RAM on 4GB VPS

## Environment Variables (key ones)

```
# STT
STT_PROVIDER=deepgram
DEEPGRAM_API_KEY=...          # Nova-3, language=multi

# LLM
LLM_MODEL=groq/llama-3.3-70b-versatile
GROQ_API_KEY=...              # Whisper fallback + LLM

# Google
GEMINI_API_KEY=...            # Lingua Bro GCP project (lingua-bro)
GOOGLE_TTS_API_KEY=...

# Database
DATABASE_URL=postgresql://postgres:...@db.chqbcqabqrnaqsiaomly.supabase.co:5432/postgres
SUPABASE_URL=https://chqbcqabqrnaqsiaomly.supabase.co
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...

# Cache
REDIS_URL=rediss://default:...@darling-dove-67484.upstash.io:6379
UPSTASH_REDIS_REST_URL=https://darling-dove-67484.upstash.io
UPSTASH_REDIS_REST_TOKEN=...

# App
SECRET_KEY=...
ENVIRONMENT=production
PORT=8001
```

Full list: see `.env.example` and `docs/API_KEYS.md`

## VPS Infrastructure (178.17.50.45)

- RAM: 4GB | Disk: 60GB | OS: Ubuntu 24.04
- Swap: 2GB (persisted in /etc/fstab)
- Coolify panel: http://178.17.50.45:8000

### Coolify Applications

| App | Domain | Port | Build |
|-----|--------|------|-------|
| `lingua-companion-backend` | https://api.lingua.creatman.site | 8001 | Dockerfile `/backend/Dockerfile` |
| `lingua-companion-frontend` | https://lingua.creatman.site | 3001 | nixpacks, base `/apps/web` |

### Port Allocation

```
22    → SSH
80    → Nginx (existing: creatman.site portfolio)
443   → Nginx (existing: creatman.site portfolio)
3000  → creatman-portfolio (Next.js, existing)
3001  → LinguaCompanion web app
5433  → PostgreSQL (LinguaCompanion, local dev only)
6380  → Redis (LinguaCompanion, local dev only — prod uses Upstash)
6333  → Qdrant (Phase 2)
8000  → Coolify panel
8001  → FastAPI backend (LinguaCompanion)
32685 → Amnezia VPN (UDP)
```

Full VPS setup: **docs/VPS_SETUP.md**

## External Services Summary

| Service | Project/DB | Purpose | Status |
|---------|-----------|---------|--------|
| Supabase | Lingua Companion (`chqbcqabqrnaqsiaomly`) | PostgreSQL + pgvector | ✅ Active |
| Upstash Redis | `lingua-companion` (Frankfurt) | Cache + Celery broker | ✅ Active |
| Deepgram | — | STT Primary | ✅ $199.77 balance |
| Groq | — | LLM + STT Fallback | ✅ |
| Google Cloud | `lingua-bro` project | Gemini + TTS + Embeddings | ✅ |
| GitHub | `CreatmanCEO/lingua-companion` | Source control + deploy key | ✅ |
| Coolify | VPS 178.17.50.45:8000 | Deployment platform | ✅ |

## Phase 1 Scope (MVP)

1. Hybrid STT: Deepgram Nova-3 primary + Groq fallback
2. Reconstruction Agent: grammar correction + RU→EN filling
3. Phrase Variants Agent: 5 simultaneous style variants (Simple/Professional/Colloquial/Slang/Idiom)
4. Companion Agent: dialogue with 5 style profiles
5. Messenger-style chat UI (Next.js + shadcn/ui + WebSocket)
6. Voice recording in browser (MediaRecorder API → WebSocket)
7. User Memory: pgvector-based RAG (interests, vocab gaps, history)
8. Topic Discovery: Celery task, HN + Reddit + RSS every 4h
9. Auth: NextAuth.js v5 (Google OAuth + email magic link)
10. Analytics: passive aggregator (speed, vocab, grammar trends)

## What's Done vs What's Next

### ✅ Done
- Full project structure and monorepo setup
- CLAUDE.md, agents, CI rules
- Backend: FastAPI entry, config, requirements, Dockerfile
- STT agent (stt.py) — fully implemented with Deepgram primary + Groq fallback
- 8 agent stubs created
- docker-compose.yml
- All external services configured (Supabase, Upstash, Deepgram, Coolify)
- DNS A-records for both domains
- Coolify apps registered with correct domains and env vars
- Full documentation (ARCHITECTURE, AI_PIPELINE, VPS_SETUP, API_KEYS, CHANGELOG)

### 🔜 Next (in order)
1. **WebSocket endpoint** `/ws/session` — binary audio → STT → JSON stream
2. **Orchestrator** — parallel asyncio.gather for Reconstruction + PhraseVariants
3. **Next.js VoiceRecorder** — MediaRecorder → WebSocket → streaming UI

See: **docs/CLAUDE_CODE_START_PROMPT.md** for exact Claude Code instructions.

## Out of Scope for Phase 1

- Pronunciation analysis (Azure Speech SDK) → Phase 2
- Mobile app (Expo React Native) → Phase 2
- Payments/subscriptions → Phase 2
- Shadowing trainer → Phase 2
- Multi-user rooms → Phase 2
- Self-hosted PostgreSQL → Phase 2
