# LinguaCompanion

[![License: MIT](https://img.shields.io/github/license/CreatmanCEO/lingua-companion?color=yellow)](LICENSE)
[![Stars](https://img.shields.io/github/stars/CreatmanCEO/lingua-companion?style=flat&color=yellow)](https://github.com/CreatmanCEO/lingua-companion/stargazers)
[![Validate](https://github.com/CreatmanCEO/lingua-companion/actions/workflows/validate.yml/badge.svg)](https://github.com/CreatmanCEO/lingua-companion/actions/workflows/validate.yml)
[![Status](https://img.shields.io/badge/status-actively%20developed-22c55e)](#status)
[![Public access](https://img.shields.io/badge/public%20access-not%20yet-cc785c)](#status)
[![Next.js 16](https://img.shields.io/badge/Next.js-16-black)](https://nextjs.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-Python%203.12-009688)](https://fastapi.tiangolo.com)

🇬🇧 English · [🇷🇺 Русский](README.ru.md)

**Voice-first AI language-learning companion for Russian-speaking IT professionals — with native Russian/English code-switching support, conversational memory, scenario-based practice, and spaced-repetition phrase library.**

```
"Yesterday я работал над automation pipeline"
                    ↓
"Yesterday I worked on an automation pipeline."
```

## Status

**Actively developed. Public demo not available yet.**

The product is functional and has been live-tested across 9 development sessions in April 2026. **91 backend tests pass · E2E Playwright 10/11 · ElevenLabs TTS confirmed in production.** The deployment URL is intentionally not published in this README — the project is in active iteration and the author does not want anonymous traffic burning through production API budgets. A public-access announcement will follow when the workflow stabilises.

If you are evaluating this work for a role / partnership / collaboration: open an issue or reach the author via [@CreatmanCEO](https://github.com/CreatmanCEO) and a private demo can be arranged.

## What it looks like

<table>
  <tr>
    <td align="center"><img src="docs/screenshots/01-chat-with-grammar-variants.jpg" width="320" alt="Free Chat — voice message, 'Perfect!' feedback, Grammar / Variants toggle, bilingual EN/RU companion reply with Listen + EN buttons"/></td>
    <td align="center"><img src="docs/screenshots/02-scenarios-it.jpg" width="320" alt="Scenarios tab — Daily Stand-up (B1), Code Review (B1), Tech Demo (B2), Job Interview (B2), Sprint Planning (B1), Write a Slack Message (B1)"/></td>
  </tr>
  <tr>
    <td align="center"><b>Free Chat with Grammar / Variants toggle</b><br><sub>Voice or text in. Companion replies bilingually. Per-message reconstruction (✓ Grammar) and 5 alternative phrasings (≡ Variants).</sub></td>
    <td align="center"><b>Scenario practice</b><br><sub>IT-specific role-plays at B1 / B2 levels: stand-up, code review, tech demo, system-design interview, sprint planning, Slack writing.</sub></td>
  </tr>
  <tr>
    <td align="center"><img src="docs/screenshots/03-settings-companions.jpg" width="320" alt="Settings — three companion personalities (Alex Professional, Sam Casual, Morgan Mentor), four voice variants (US Male / US Female / GB Male / GB Female), Speed slider 0.8x to 1.2x, Topics filter (IT only / Mixed / Any)"/></td>
    <td align="center"><img src="docs/screenshots/04-phrase-library.jpg" width="320" alt="Phrase Library — All phrases / Due for review tabs, two cards: a Professional category card 'Could you provide an overview of the emerging trends in Python development?' (Due now) and a Slang category card 'Why you spamming me with the same stuff?' (Due now)"/></td>
  </tr>
  <tr>
    <td align="center"><b>Three companions, four voices</b><br><sub>Alex (professional), Sam (casual), Morgan (mentor). US / GB voice variants. Speed 0.8×–1.2×. Topic and CEFR-level filters.</sub></td>
    <td align="center"><b>Phrase Library with spaced repetition</b><br><sub>Saved phrases tagged Professional / Slang. Due-now / Due-for-review queue. Forgot / Hard / Easy review buttons feed an SRS schedule.</sub></td>
  </tr>
  <tr>
    <td align="center"><img src="docs/screenshots/05-learning-progress.jpg" width="320" alt="Learning Progress panel — 1 day streak with fire emoji, 3 sessions, 7 messages, 4h practice time, 2 phrases saved, Recent Activity bar chart with three bars labelled Apr 29"/></td>
    <td>&nbsp;</td>
  </tr>
  <tr>
    <td align="center"><b>Learning progress</b><br><sub>Streak tracking, session counts, practice time, phrases saved. Recent-activity bar chart for retention loop.</sub></td>
    <td>&nbsp;</td>
  </tr>
</table>

## Why this exists

Existing language apps optimise for vocabulary drills, gamified streaks, or generic conversation practice. None of them are built for **how a Russian-speaking IT professional actually wants to speak English** — with spontaneous code-switching, IT vocabulary as the lingua franca, and the goal of "sound like a colleague at a stand-up", not "pass an A2 exam."

LinguaCompanion is built around that user. The companion accepts mixed RU/EN speech, reconstructs the intent into natural English, returns a bilingual reply with click-to-listen TTS, and offers grammar correction or 5 alternative phrasings on demand. Scenario mode runs role-plays for daily stand-ups, code reviews, tech demos, system-design interviews, sprint planning, and Slack writing — each tagged at CEFR B1 or B2.

## Architecture

![Architecture: Next.js 16 → FastAPI WebSocket → 12 agents → Deepgram + Groq + ElevenLabs + Supabase](docs/architecture.svg)

| Layer | Technology | Notes |
|---|---|---|
| Frontend | Next.js 16 (App Router), React 19, Zustand 5, Tailwind, shadcn/ui | port 3001 — messenger-style UI |
| Backend | Python 3.12, FastAPI, WebSocket, Celery + Redis | port 8001 — `/ws/session` + `/api/v1/*` |
| **STT primary** | **Deepgram Nova-3** (`language=multi`) | code-switching confirmed: 6/6 spike tests |
| STT fallback | Groq Whisper large-v3-turbo | sub-second latency, auto-switch on Deepgram failure |
| LLM main | Groq Llama 3.3 70B via LiteLLM | hot-swap via `LLM_MODEL` env |
| LLM onboarding | DeepSeek (OpenRouter) | replaced rate-limited Gemma in commit `adbbcbf` |
| **TTS production** | **ElevenLabs** (confirmed: 40 KB audio per response) | three companion voices: Alex, Sam, Morgan |
| TTS fallbacks | AWS Polly · Edge-TTS · Google Neural2 | Polly currently blocked by IAM; Edge-TTS blocked from VPS IP |
| Database | Supabase (PostgreSQL + pgvector) | conversational memory + phrase library |
| Cache / queue | Upstash Redis (TLS) | Celery broker + per-session cache |
| Embeddings | Google Embeddings API | saves ~800 MB RAM vs local sentence-transformers |
| Pronunciation | Azure Speech SDK | phoneme-level scoring |
| Monorepo | Turborepo + pnpm workspaces | `apps/web`, `backend/`, `packages/types`, `infra/docker` |
| Deploy | Docker Compose · Coolify · nginx | sec VPS, TLS, reverse proxy |

For diagrams and the WebSocket / agent flow, see [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## What's built (real surface, not roadmap)

### Frontend (`apps/web/src/components/`, 15 components)

- `CompanionBubble`, `UserBubble` — message rendering with bilingual support
- `VoiceBar` — push-to-talk + recording indicator
- `ReconstructionBlock` — grammar correction with diff highlighting
- `VariantCards` — 5 alternative phrasings on demand
- `LoginScreen` — Google OAuth + email/password
- `SettingsPanel` — 3 companions × 4 voices × speed × topic × CEFR level × theme
- `PhraseLibrary` — saved phrases with spaced-repetition queue (Forgot / Hard / Easy)
- `StatsScreen` — streaks, sessions, messages, practice time, recent-activity chart
- `SessionSummary`, `HintOverlay`, `ThemeToggle`, plus `ui/` and `layout/`

### Backend (`backend/app/`, 12 agents + 9 routes)

- **Agents:** `stt`, `companion`, `memory`, `onboarding`, `orchestrator`, `phrase_variants`, `pronunciation`, `reconstruction`, `topic_discovery`, `tts`, `analytics`, plus `prompts/`
- **Routes:** `auth`, `opengraph`, `phrases`, `push`, `session`, `stats`, `translate`, `tts`, `ws` (WebSocket)
- **Migrations:** Alembic
- **Tests:** 91 backend pytest passing · E2E Playwright 10/11

## Project structure

```
lingua-companion/
├── apps/
│   └── web/              # Next.js 16 web client
├── backend/              # FastAPI + Celery + 12 agents
│   ├── app/agents/       # stt · companion · memory · reconstruction · …
│   ├── app/api/routes/   # auth · session · phrases · stats · ws · …
│   ├── app/prompts/      # prompt templates
│   ├── migrations/       # Alembic
│   └── tests/            # pytest
├── packages/
│   └── types/            # shared TypeScript types
├── infra/
│   └── docker/           # Docker Compose configs
├── docs/
│   ├── ARCHITECTURE.md       # system architecture + diagrams
│   ├── AI_PIPELINE.md        # agent flow detail
│   ├── API_KEYS.md           # required env vars + setup
│   ├── BACKLOG.md            # current priorities
│   ├── COMPETITIVE_ANALYSIS.md
│   ├── DESIGN_JOURNEY.md
│   ├── VPS_SETUP.md          # deployment runbook
│   ├── architecture.svg      # this README's hero diagram
│   └── screenshots/          # README assets
├── plans/                # per-iteration design docs
├── tests/
│   └── e2e/              # Playwright specs
├── CHANGELOG.md
├── CLAUDE.md
├── Makefile
└── README.md
```

## Working on it

The project is configured for [Claude Code](https://code.claude.com) as the primary development driver. See [`CLAUDE.md`](CLAUDE.md) for the project constitution (stack, commands, CRITICAL RULES, agent inventory). The same author maintains a [Claude Code Anti-Regression Setup](https://github.com/CreatmanCEO/claude-code-antiregression-setup) — the `.claude/` config, hooks, and subagents pattern there is what keeps refactors from breaking the existing 91-test suite.

```bash
# Bootstrap (assuming pnpm + Python 3.12 + Postgres locally or via .env)
pnpm install
cd backend && pip install -r requirements.txt && cd ..

# Run frontend dev server (port 3001)
pnpm --filter @lingua/web dev

# Run backend (port 8001)
cd backend && uvicorn app.main:app --reload --port 8001

# Tests
cd backend && pytest                          # 91 backend tests
pnpm --filter @lingua/web test               # frontend unit tests (Vitest)
pnpm --filter @lingua/web exec playwright test # E2E
```

Full session-by-session history of what was built and what broke is in [CHANGELOG.md](CHANGELOG.md).

## Limitations

This is a personal product in active development. Honest constraints:

- **No public deployment URL is published in this README.** The product runs on a personal VPS with metered API budgets. Anonymous traffic would directly burn through the author's Anthropic / Groq / Deepgram / ElevenLabs spend during iteration. Public access will be opened when the workflow stabilises.
- **Topic Discovery is currently disabled.** Earlier iterations had the companion proactively inject "Hey, saw this and thought of you…" snippets from HN / Reddit. It produced repetitive Rust-themed spam during testing and was disabled in commit `5546803`. Will return as Rich Link Cards in a future iteration.
- **TTS provider matrix is partially live.** ElevenLabs is confirmed working in production (40 KB audio per response). AWS Polly currently fails with `AccessDeniedException` (IAM policy fix pending). Edge-TTS is blocked from the VPS IP by Microsoft (HTTP 403). Google Neural2 is the working budget fallback.
- **Pronunciation analysis is wired but not yet exposed in the UI.** Azure Speech SDK integration exists at the agent layer; surfacing per-phoneme scoring in `CompanionBubble` is pending.
- **Free Chat sessions can stall on rapid send.** `tests/UX-Test-Report.md` flagged P3 issue: sending multiple messages within ~200 ms drops all but the first. Mitigation: WebSocket message queue with debounced flush, on the backlog.
- **A2 / B2 mode is fixed at the level toggle.** The companion does not auto-detect the user's level and adjust difficulty mid-session — you set it in Settings and it applies to subsequent turns. Adaptive difficulty is on the roadmap.

## Related

- [Claude Code Anti-Regression Setup](https://github.com/CreatmanCEO/claude-code-antiregression-setup) — sister repo by the same author. The `.claude/` config + subagents pattern that keeps the 91-test suite green during refactors.
- [ai-context-hierarchy](https://github.com/CreatmanCEO/ai-context-hierarchy) — sister repo. The Level 0 / Level 1 hierarchy used by Claude Code on this project to navigate between `apps/web`, `backend`, and `packages` without re-reading the whole tree each session.
- [claude-statusline](https://github.com/CreatmanCEO/claude-statusline) — sister repo. Statusline that surfaces context %, model, cost, and the VPS hosting this product during dev sessions.
- [notebooklm-claude-workflows](https://github.com/CreatmanCEO/notebooklm-claude-workflows) — sister repo. Used by this project's research workflow when picking design references and competitive analysis.

## Author

**Nick Podolyak** — Python developer and digital architect at [CREATMAN](https://creatman.site)

- GitHub: [@CreatmanCEO](https://github.com/CreatmanCEO)
- Habr: [creatman](https://habr.com/ru/users/creatman/)
- dev.to: [@creatman](https://dev.to/creatman)

## License

[MIT](LICENSE) · Nick Podolyak
