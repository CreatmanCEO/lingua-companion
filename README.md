# LinguaCompanion AI

> Voice-first AI language learning companion for Russian-speaking IT professionals.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Stack: Next.js + FastAPI](https://img.shields.io/badge/Stack-Next.js%20%2B%20FastAPI-blue)](#)
[![AI: Groq + Gemini](https://img.shields.io/badge/AI-Groq%20%2B%20Gemini-green)](#)

## What is this?

LinguaCompanion is a **voice-first conversational platform** that helps users achieve English fluency through continuous AI-driven dialogue. Built specifically for Russian-speaking IT professionals — with native support for Russian/English code-switching.

```
"Yesterday я работал над automation pipeline"
                    ↓
"Yesterday I worked on an automation pipeline."
```

## Key Features

- 🎤 **Hybrid STT** — Russian + English mixed speech recognition (Whisper via Groq)
- 🧠 **Intent Reconstruction** — fills vocabulary gaps, corrects grammar in context
- 💬 **Messenger-style UI** — familiar chat interface with voice messages
- 🔄 **Conversational Memory** — remembers your interests, weak points, history
- 📰 **Topic Discovery** — proactive discussions based on real tech news (HN, Reddit, blogs)
- 🗣️ **Pronunciation Analysis** — phoneme-level scoring via Azure Speech SDK
- 📊 **Fluency Analytics** — tracks progress over time

## Architecture

```
apps/
├── web/          # Next.js 15 (App Router) — web application
└── mobile/       # Expo (React Native) — Phase 2
packages/
├── api-client/   # Shared API calls
├── types/        # Shared TypeScript types
└── utils/        # Shared utilities
backend/
├── api/          # FastAPI application
├── agents/       # AI pipeline (STT, LLM, memory, topics)
└── workers/      # Celery background tasks
infra/
├── docker/       # Docker Compose configs
└── nginx/        # Reverse proxy config
```

## Tech Stack

| Layer | Phase 1 (Private) | Phase 2 (Commercial) |
|-------|-------------------|----------------------|
| Frontend | Next.js 15 + shadcn/ui | + Expo (React Native) |
| Backend | FastAPI (Python 3.12) | Same |
| LLM | Groq (Llama 3.3 70B) | Gemini 2.0 Flash |
| STT | Groq Whisper large-v3-turbo | Same or Gemini native |
| TTS | Google Neural2 | ElevenLabs |
| Pronunciation | Azure Speech SDK | Same |
| Database | Supabase (PostgreSQL + pgvector) | Self-hosted Postgres |
| Vector DB | pgvector | Qdrant |
| Cache | Redis (Upstash) | Self-hosted Redis |
| Auth | NextAuth.js v5 | Clerk |
| Hosting | VPS + Docker + Coolify | Same + scale |

## Development Setup

See [docs/SETUP.md](docs/SETUP.md) for full setup instructions.

```bash
git clone https://github.com/CreatmanCEO/lingua-companion.git
cd lingua-companion
cp .env.example .env  # fill in your API keys
make dev              # starts all services
```

## Docs

- [Architecture](docs/ARCHITECTURE.md) — system design and component overview
- [API Keys](docs/API_KEYS.md) — where to get all required credentials
- [VPS Setup](docs/VPS_SETUP.md) — Coolify deployment guide
- [AI Pipeline](docs/AI_PIPELINE.md) — voice processing pipeline details
- [Workflow](docs/WORKFLOW.md) — Claude Code anti-regression workflow

## Roadmap

- [x] PRD and architecture design
- [x] Repository structure
- [ ] Technical spike (STT code-switching validation)
- [ ] Phase 1 MVP (private web app)
- [ ] Phase 2 mobile app + commercial launch

## Author

**Nick (Nikolay Podolyak)** — Technical Product Architect at [CREATMAN](https://creatman.site)

## License

MIT
