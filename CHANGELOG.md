# LinguaCompanion — Changelog

> Хронология всего что было сделано. Новое — сверху.

---

## [2026-03-11] — Infrastructure Setup (Session 3)

### ✅ Coolify — Deployment Platform
- Завершён онбординг: сервер `localhost` (host.docker.internal), Docker Engine, проект `My first project`
- Включён API Access в Settings → Advanced
- Создан API токен `vps-automation` с root правами
- **Приложение `lingua-companion-backend`**: `https://api.lingua.creatman.site`, порт 8001, build pack `dockerfile`, Dockerfile `/backend/Dockerfile`
- **Приложение `lingua-companion-frontend`**: `https://lingua.creatman.site`, порт 3001, build pack `nixpacks`, base dir `/apps/web`
- Env vars для backend загружены через Coolify API

### ✅ Upstash Redis
- База `lingua-companion` создана: Frankfurt, Germany (eu-central-1), Free Tier
- 256 MB storage, 50 GB bandwidth, TLS включён
- Endpoint: `darling-dove-67484.upstash.io:6379`
- Credentials сохранены на VPS: `/tmp/lingua_env_creds.txt`

### ✅ Supabase — Credential Rotation
- Database password сброшен и обновлён (был exposed в git)
- Получены новые API ключи (legacy anon + service_role)
- Publishable key (новая система): `sb_publishable_8s2r2q0L-...`
- Все credentials сохранены на VPS: `/tmp/lingua_env_creds.txt`

### ✅ DNS
- A-запись `lingua.creatman.site` → `178.17.50.45`
- A-запись `api.lingua.creatman.site` → `178.17.50.45`

---

## [2026-03-10] — STT Spike + AI Pipeline Design (Session 2)

### ✅ STT Comparative Spike (DECISION CLOSED)
- Протестировано 3 провайдера на 6 аудиофайлах с реальным RU/EN code-switching
- Скрипт: `C:\Users\creat\Desktop\spike_stt.py` (v7)

| Provider | Model | Avg Latency | Code-Switching |
|----------|-------|-------------|---------------|
| Deepgram | Nova-3, language=multi | 2.56s | **6/6** ✅ |
| Groq | Whisper large-v3-turbo | 0.67s | 3/6 ⚠️ |
| Gemini | 2.5 Flash Lite | 2.31s | 4/6 |

- **Решение**: Deepgram Nova-3 = Primary STT, Groq Whisper = Fallback
- Groq системно теряет один язык в смешанных фразах — неприемлемо
- Deepgram balance: $199.77 (~46,000 минут аудио по $0.0043/min)

### ✅ Backend Agent Implementation
- `backend/app/agents/stt.py` — полностью реализован:
  - Deepgram Nova-3 primary с `language=multi`
  - Groq Whisper fallback с авто-переключением
  - Dataclass `STTResult` с метаданными
- 8 заглушек агентов созданы (orchestrator, reconstruction, phrase_variants, companion, memory, topic_discovery, pronunciation, analytics)

### ✅ Documentation Created
- `docs/AI_PIPELINE.md` — полная multi-agent спецификация
- `docs/CLAUDE_CODE_START_PROMPT.md` — стартовый промпт для Claude Code + первые 3 задачи
- `docs/ARCHITECTURE.md` — обновлена диаграмма, добавлен Deepgram

### ✅ Config Updates
- `backend/app/core/config.py` — добавлены `DEEPGRAM_API_KEY`, `STT_PROVIDER`
- `.env.example` — обновлён
- `CLAUDE.md` — обновлён (STT решение, порты, embeddings strategy)

### ✅ Google Cloud — Lingua Bro Project
- Создан отдельный GCP проект `lingua-bro` для LinguaCompanion
- API ключ создан, сохранён на VPS: `/tmp/gemini_lingua_key.txt`
- Доступные квоты: Gemini 2.5 Flash (5 RPM), Gemini 2.5 Flash Lite (10 RPM)

---

## [2026-03-09] — Project Foundation (Session 1)

### ✅ GitHub Repository
- Репо создано: `https://github.com/CreatmanCEO/lingua-companion`
- Monorepo структура: Turborepo + pnpm workspaces
- `.gitignore`, `.env.example`, `README.md`

### ✅ Claude Code Setup
- `CLAUDE.md` — Project Constitution (правила, стек, агенты, scope)
- `.claude/agents/planner.md` — planner agent
- `.claude/agents/tester.md` — tester agent
- `.claude/agents/code-reviewer.md` — code-reviewer agent
- `.claude/settings.json` — разрешения

### ✅ Backend Foundation
- `backend/app/main.py` — FastAPI app entry point
- `backend/app/core/config.py` — Pydantic Settings
- `backend/requirements.txt` — все зависимости Phase 1
- `backend/Dockerfile` — multi-stage build

### ✅ Infrastructure
- `infra/docker/docker-compose.yml` — все сервисы (FastAPI, Next.js, PostgreSQL, Redis)
- `docs/VPS_SETUP.md` — полная инструкция по настройке VPS
- `docs/API_KEYS.md` — какие ключи нужны и где взять

### ✅ VPS (178.17.50.45) — Initial Setup
- RAM: 4GB | Disk: 59GB free | Swap: 2GB | OS: Ubuntu 24.04
- Docker + Coolify установлены и запущены
- SSH deploy key `lingua-companion-deploy` создан и добавлен в GitHub
- Порты зарезервированы: 3001 (Next.js), 8001 (FastAPI), 5433 (PostgreSQL), 6380 (Redis)

### ✅ Supabase Project
- Проект создан: `Lingua Companion` (ID: `chqbcqabqrnaqsiaomly`)
- PostgreSQL + pgvector готовы

### ✅ PRD & Architecture
- `lingua_companion_prd.md` — Product Requirements Document
- `LinguaCompanion_Vision_v2.docx` — Vision документ
- `LinguaCompanion_TechArchitecture.md` — Tech Architecture

---

## Pending (следующая сессия)

- [ ] **WebSocket endpoint** `/ws/session` — FastAPI, binary audio → STT → JSON stream
- [ ] **Orchestrator** — parallel asyncio.gather для Reconstruction + PhraseVariants
- [ ] **Next.js VoiceRecorder** — MediaRecorder → WebSocket → UI
- [ ] Добавить DEEPGRAM_API_KEY в Coolify env vars (через UI)
- [ ] Добавить GROQ_API_KEY в Coolify env vars
- [ ] Инициализировать Next.js app в `apps/web/`
