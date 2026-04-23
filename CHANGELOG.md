# LinguaCompanion — Changelog

> Хронология всего что было сделано. Новое — сверху.

---

## [2026-04-23] — Stabilization + Full Feature Completion (Session 7-8)

### ✅ Architecture
- **feat**: Model Router — per-task LLM model routing via OpenRouter (DeepSeek V3.2 for chat/JSON, Qwen3 235B for translation/extraction, Gemma 4 for onboarding)
- **feat**: Prompt Engine — YAML template registry + runtime builder with blocks (10 templates, 5 blocks). All hardcoded prompts extracted from Python agents
- **feat**: TTS Fallback Chain — ElevenLabs (3 keys rotation) → AWS Polly Generative → Edge-TTS. Circuit breaker pattern
- **refactor**: Orchestrator — pipeline logic extracted from `ws.py` (490→140 lines) into `PipelineOrchestrator` class
- **feat**: Structured Logging — `structlog` with correlation IDs per WebSocket session

### ✅ New Features
- **feat**: Translation — `POST /api/v1/translate` + 🔄 toggle on companion messages and variant cards
- **feat**: Phrase Library + SM-2 — save variants, review flashcards with spaced repetition scheduling
- **feat**: Topic Discovery — HN + Reddit RSS fetch → LLM discussion prompts → background 4h task
- **feat**: Post-Session Summary — LLM-generated learning insights (duration, errors, new words, advice)
- **feat**: Stats / Progress — streak counter, activity chart, total stats, session recording
- **feat**: Rich Link Card — auto-preview URLs in companion messages via OpenGraph
- **feat**: Supabase Auth — email/password + Google OAuth, WebSocket token auth
- **feat**: Web Push — Service Worker, push subscriptions, pending companion messages
- **feat**: Message Persistence — localStorage with 200 message limit
- **feat**: Conversational Onboarding — Onboarding Agent + 4-step hint overlay tooltips
- **feat**: Memory Agent — RAG context, async write-behind, embed/search/store/fact extraction
- **feat**: Streaming Companion — `litellm stream=True` + typewriter effect on frontend
- **feat**: Settings Panel — user preferences UI, integrated into app
- **feat**: Compact Header — merged companion info, removed CompanionBar, auto-hide on scroll

### ✅ Bug Fixes
- **fix**: Per-message analysis — reconstruction + variants stored per-message, no longer disappear
- **fix**: Compact VoiceBar — Telegram-style single-row (36px mic), removed mode toggle
- **fix**: Error toasts — WebSocket errors shown to user (was `console.log` only)
- **fix**: Partial results — reconstruction/variants/companion render independently
- **fix**: Silence threshold — recordings under 500ms ignored
- **fix**: Error tracking — 3+ repeated errors → sandwich correction method
- **fix**: Adaptive level — user CEFR level from onboarding → vocabulary adaptation
- **fix**: User-scoped memory — real `user_id` from auth replaces hardcoded `"default"`
- **fix**: `vocab_gaps` wiring — `track_vocab_gap()` connected to reconstruction pipeline
- **fix**: Memory pool shutdown, empty TTS audio validation
- **fix**: ESLint — impure `Date.now()` in render, unused Theme import

### ✅ Infrastructure
- All API tokens configured in `.env` (OpenRouter, ElevenLabs x3, AWS Polly, Supabase)
- 5 DB migrations (topics, phrases, session_stats, push tables, user_facts, memory_vectors, vocab_gaps)
- Iteration 9-10 design docs

### 📊 Tests
- Backend: **91+ tests passing**
- Frontend: **67+ tests passing**

### 📁 New Files
- Backend: ~15 new files (routes, migrations, prompts, templates, blocks)
- Frontend: ~8 new files (components, lib, service worker)

---

## [2026-03-26] — Global Agent Fixes + Competitive Analysis (Session 6)

### ✅ Конкурентный анализ
- **docs**: `COMPETITIVE_ANALYSIS.md` — 881 строк, 8 конкурентов (Gliglish, Speak, Praktika, ELSA, TalkPal, Duolingo Max, Replika, Character.AI)
- **docs**: Промпты конкурентов (Duolingo leak), open-source проекты, UX flows, unit economics
- **insight**: Implicit recasting (70%) + sandwich method — лучшая стратегия коррекции для A2-B1
- **insight**: Code-switching is NORMAL — не запрещать, а принимать

### ✅ Pipeline Fix [CRITICAL]
- **fix**: `get_variants()` теперь получает `corrected` текст вместо сырого RU/EN transcript
- **arch**: Audio path приведён к тому же порядку что и text path: Reconstruction → parallel(Variants, Companion)

### ✅ Промпты агентов — переписаны на основе исследования
- **feat**: Companion: implicit recasting, sandwich method, scaffolding, conversation repair
- **feat**: Companion: code-switching awareness ("This is NORMAL"), max 2 corrections/turn
- **feat**: Morgan: может давать подсказки на русском для A2-B1
- **feat**: Alex: professional но не only-IT, адаптируется к теме
- **feat**: Sam: contractions, filler words, casual connectors
- **feat**: Reconstruction: 3 few-shot примера, поле `changes` для git-diff, retry + validation
- **feat**: Phrase Variants: context/subtitles "когда использовать", новый формат `{text, context}`

### ✅ Надёжность
- **feat**: Degraded mode — падение одного агента не ломает pipeline
- **feat**: Logging во всех агентах (замена print → logging)
- **feat**: LLM retry (`num_retries=2`) во всех агентах
- **feat**: Prompt injection protection во всех промптах
- **feat**: Rate limiting (15 msg/min) + блокировка параллельных запросов
- **feat**: Валидация ответов LLM (required fields + defaults)
- **fix**: MIME mapping: добавлен `webm`, default fallback `audio/webm`
- **fix**: Убраны неиспользуемые импорты (`json` в stt.py, `asyncio` в orchestrator.py)

### 📊 Тесты
- Backend: **34/34 passed** (было 18, +16 новых)
- Новые файлы: `test_reconstruction.py` (4), `test_phrase_variants.py` (4)
- Новые тесты: degraded mode (3), rate limiting (2), prompt (3), pipeline (1)

---

## [2026-03-25] — Companion Agent + Code Review Fixes (Session 5)

### ✅ Companion Agent — реальные LLM ответы
- **feat**: `companion.py` — полная реализация с 3 персонами (Alex/Sam/Morgan)
- **feat**: System prompts: Professional, Casual, Mentor стили
- **feat**: Поддержка сценариев (companionRole/userRole в system prompt)
- **feat**: Скользящее окно истории (20 сообщений)
- **feat**: Fallback при ошибке LLM — generic ответ, pipeline не ломается
- **arch**: Companion вызывается ПОСЛЕ reconstruction, параллельно с variants

### ✅ WebSocket Protocol v2
- **feat**: JSON messages от клиента: `session_config`, `text_message`
- **feat**: Новый event `companion_response` от сервера
- **feat**: `process_text()` — обработка текста без STT (Reconstruction → Variants + Companion)
- **feat**: `run_companion_and_variants()` — оркестрация параллельных задач
- **arch**: Backward compatible: binary = audio (v1), JSON = новые команды

### ✅ Frontend Integration
- **feat**: `sendConfig(companion, scenario)` — отправка настроек сессии
- **feat**: `sendText(text)` — текстовые сообщения через WS
- **feat**: `onCompanionResponse` callback — реальные ответы companion
- **feat**: `pendingResultsRef` расширен до 3 полей (reconstruction + variants + companion)
- **refactor**: Demo getCompanionResponse() сохранён как offline fallback

### ✅ Code Review — 17 fixes (PR #1 merged)
- **fix(critical)**: XSS через `dangerouslySetInnerHTML` → React `<FormatExplanation>` компонент
- **fix(critical)**: Race condition — `pendingResultsRef` не сбрасывался при reconnect
- **fix(critical)**: Processing timeout 15s — защита от бесконечного спиннера
- **fix**: TTS cleanup on unmount, ActionPill DRY extraction, demo.ts extraction
- **a11y**: aria-labels, убран запрет zoom (WCAG 1.4.4)
- **feat**: Error Boundary, `MAX_MESSAGES = 100`, `timestamp: number`

### ✅ API Keys
- **fix**: Deepgram/Groq ключи обновлены, Supabase ACTIVE

### 📁 Новые/изменённые файлы
```
backend/app/agents/companion.py        — NEW: полная реализация (из stub)
backend/app/api/routes/ws.py           — UPDATED: JSON protocol, companion call
backend/tests/test_companion.py        — NEW: 7 unit тестов
backend/tests/test_ws_session.py       — UPDATED: +3 теста (session_config, text_message)
apps/web/src/hooks/useVoiceSession.ts  — UPDATED: companion_response, sendConfig, sendText
apps/web/src/app/page.tsx              — UPDATED: real responses, demo fallback
apps/web/src/app/error.tsx             — NEW: Error Boundary
apps/web/src/components/ui/ActionPill.tsx — NEW: shared component
apps/web/src/lib/demo.ts              — NEW: extracted demo logic
plans/PLAN-companion-agent-2026-03-25.md — NEW
plans/PLAN-code-review-fixes-2026-03-25.md — NEW
```

### 📊 Тесты
- Backend: **18/18 passed** (pytest) — было 8, +10 новых
- Frontend: **49/49 passed** (vitest) — было 45, +4 новых
- ESLint: **0 errors, 0 warnings**

---

## [2026-03-11] — WebSocket Pipeline + Multi-Agent Workflow (Session 4)

### ✅ WebSocket Endpoint `/ws/session`
- **feat**: Полная реализация voice pipeline: binary audio → STT → JSON stream
- **feat**: Параллельный запуск Reconstruction + PhraseVariants через `asyncio.wait(FIRST_COMPLETED)`
- **feat**: Streaming событий по мере готовности (не ждём оба результата)
- **arch**: Именованные asyncio tasks для надёжной идентификации

### ✅ DoS Protection & Stability
- **fix**: `MAX_AUDIO_SIZE = 1MB` — защита от memory exhaustion
- **fix**: Отмена pending задач через `task.cancel()` при ошибке/disconnect
- **fix**: `except Exception:` вместо bare `except:` (PEP8)
- **fix**: Нейтральный filename `audio.bin` вместо hardcoded `audio.webm`

### ✅ Testing
- **test**: 6 тестов (orchestrator: 3, ws_session: 3)
- Покрытие: success path, empty transcript, LLM failure graceful degradation
- Моки изолируют от внешних API (Deepgram, Groq, LiteLLM)

### ✅ Multi-Agent Workflow
- Параллельная работа: code-reviewer + tester одновременно в разных терминалах
- Planner агент обнаружил что Task 2 (STT integration) уже выполнена
- Code review выявил 4 WARNING, все исправлены до коммита

### ✅ Windows Compatibility
- **fix**: `nul` в `.gitignore` (Windows-специфичный артефакт от vim)
- Уроки: vim создаёт `nul` при merge conflict, LF/CRLF warnings нормальны

### 📁 Новые файлы
```
backend/app/api/__init__.py
backend/app/api/routes/__init__.py
backend/app/api/routes/ws.py          — WebSocket endpoint
backend/app/agents/orchestrator.py    — PipelineResult + run_pipeline()
backend/tests/__init__.py
backend/tests/conftest.py
backend/tests/test_ws_session.py
backend/tests/test_orchestrator.py
plans/PLAN-ws-session-001.md
plans/PLAN-stt-integration-002.md
```

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

- [x] ~~WebSocket endpoint `/ws/session`~~ ✅ Session 4
- [x] ~~Orchestrator — parallel asyncio.gather~~ ✅ Session 4
- [ ] **Next.js VoiceRecorder** — MediaRecorder → WebSocket → streaming UI
- [ ] Добавить DEEPGRAM_API_KEY в Coolify env vars (через UI)
- [ ] Добавить GROQ_API_KEY в Coolify env vars
- [ ] Инициализировать Next.js app в `apps/web/`
- [ ] E2E тест с реальным аудио через websocat
