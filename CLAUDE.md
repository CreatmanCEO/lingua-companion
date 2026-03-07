# LinguaCompanion AI — Claude Code Project Constitution

## Project Overview

Voice-first AI language learning platform for Russian-speaking IT professionals.
Supports Russian/English code-switching via hybrid STT pipeline.

## Architecture

- **Frontend**: Next.js 15 (App Router), TypeScript, Tailwind CSS, shadcn/ui
- **Backend**: Python 3.12, FastAPI, Celery + Redis
- **Database**: PostgreSQL + pgvector (via Supabase in Phase 1)
- **AI - LLM**: Groq API (Llama 3.3 70B) → Gemini 2.0 Flash (Phase 2)
- **AI - STT**: Groq Whisper large-v3-turbo
- **AI - TTS**: Google Neural2 TTS
- **AI - Pronunciation**: Azure Speech SDK (Phase 2)
- **AI - Embeddings**: multilingual-e5-large (runs locally, no external API)
- **Vector DB**: pgvector → Qdrant (Phase 2)
- **Infrastructure**: VPS 178.17.50.45 (4GB RAM / 60GB), Docker Compose, Coolify, Nginx
- **Monorepo**: Turborepo + pnpm workspaces

## Repository Structure

```
apps/web/          — Next.js 15 frontend
apps/mobile/       — Expo React Native (Phase 2, placeholder)
packages/          — Shared code (types, api-client, utils)
backend/           — FastAPI + Celery workers
infra/             — Docker Compose, Nginx, Coolify configs
docs/              — Architecture docs
plans/             — Claude Code implementation plans (subagent output)
.claude/           — Claude Code agents, hooks, rules
```

## Key Commands

```bash
make dev           # Start all services (Next.js + FastAPI + Redis + DB)
make dev-web       # Start only frontend
make dev-api       # Start only backend
make test          # Run full test suite (pytest + vitest)
make test-api      # Backend tests only
make test-web      # Frontend tests only
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
- When modifying AI pipeline — test with sample audio files in tests/fixtures/

## Working Style

- Plan FIRST, code SECOND — never start coding without confirmed plan
- Small diffs: one module → tests → next module
- After every change: run tests and show output
- Use subagents for codebase research to preserve main context window
- At 60-70% context utilization: /compact with summary of current state
- At topic switch: /clear

## Agents

- Use `planner` agent before any complex task
- Use `tester` agent after code changes
- Use `code-reviewer` agent before commits

## AI Pipeline Notes

- Voice pipeline latency target: < 3 seconds end-to-end
- STT → LLM chain must be async with streaming responses
- Groq API key env var: GROQ_API_KEY
- Embeddings run locally — no external API call for memory search
- Azure Speech key: AZURE_SPEECH_KEY + AZURE_SPEECH_REGION
- Gemini key: GOOGLE_API_KEY

## VPS / Infrastructure

- VPS IP: 178.17.50.45
- RAM: 4GB | Storage: 60GB
- All services run in Docker containers via Docker Compose
- Coolify manages deployments (webhook auto-deploy from GitHub)
- Nginx handles SSL termination + reverse proxy
- Port allocation documented in: docs/VPS_SETUP.md

## Port Allocation (178.17.50.45)

```
80    → Nginx (HTTP → redirect to HTTPS)
443   → Nginx (HTTPS, terminates SSL)
3000  → Next.js web app (internal)
8000  → FastAPI backend (internal)
5432  → PostgreSQL (internal only)
6379  → Redis (internal only)
8001  → Qdrant (internal only, Phase 2)
3001  → Reserved for future service
8888  → Coolify panel
```

## Phase 1 Scope (MVP)

1. Hybrid STT (RU+EN code-switching via Groq Whisper)
2. Sentence reconstruction via LLM (Groq Llama 3.3 70B)
3. Messenger-style chat UI (Next.js + shadcn/ui)
4. Conversation AI with basic streaming responses
5. User memory (interests, history, vocab weaknesses via pgvector)
6. Basic topic discovery (RSS + Hacker News API)
7. Auth (NextAuth.js v5 — Google OAuth + email)

## Out of Scope for Phase 1

- Pronunciation analysis → Phase 2
- Mobile app → Phase 2
- Payments/subscriptions → Phase 2
- Shadowing trainer → Phase 2
- Retelling trainer with video → Phase 2
- Multi-user rooms → Phase 2
