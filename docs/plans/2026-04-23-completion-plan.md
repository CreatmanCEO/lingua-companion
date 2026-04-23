# Lingua Companion — Full Completion Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Complete ALL remaining features to make Lingua Companion a fully working language learning product.

**Architecture:** 6 waves ordered by dependencies. Each wave builds on the previous.

---

## Wave 1: Core Learning Features (no new deps)

### Task 14: Silence Threshold (XS)
**Files:** Modify: `apps/web/src/hooks/useAudioRecorder.ts`

Add `MIN_RECORDING_MS = 500` check in `stopRecording()`. If duration < 500ms, return null and don't send audio. VoiceBar should handle null return gracefully (ignore, don't send).

### Task 15: Error Tracking — Session-Level Counting
**Files:**
- Modify: `backend/app/agents/orchestrator.py` — add `error_history` to session, count repeated errors
- Block `error_tracking.yaml` already exists in Prompt Engine

After reconstruction returns `changes[]`:
1. Compare each change against `session["error_history"]` (list of `{pattern, type, count}`)
2. Fuzzy match: same `error_type` + similar words → increment count
3. New error → add to history with count=1
4. When `count >= 3` → add to `repeated_errors` list
5. Pass `repeated_errors` to companion via `PromptBuilder.with_block("error_tracking")`

### Task 16: Adaptive Level Wiring
**Files:**
- Modify: `backend/app/agents/orchestrator.py` — load user level from facts, pass to companion

In orchestrator, before calling companion:
1. `facts = await get_user_facts(user_id)` (already called for memory context)
2. `user_level = facts.get("level", "B1")`
3. Pass to companion: `generate_response_stream(..., user_level=user_level)`

The `level_adaptation` block in Prompt Engine already handles the rest.

### Task 17: Message Persistence (localStorage)
**Files:**
- Modify: `apps/web/src/store/chatStore.ts` — persist messages to localStorage
- Max 200 messages stored, prune oldest on overflow
- Load on mount, save on every addMessage/updateMessage
- Audio blobs NOT persisted (too large), only text/metadata

---

## Wave 2: Auth + User Isolation

### Task 18: Supabase Auth
**Files:**
- Create: `backend/app/api/routes/auth.py` — login/register/me endpoints
- Modify: `backend/app/main.py` — register auth routes
- Modify: `backend/app/api/routes/ws.py` — extract user_id from token
- Create: `apps/web/src/lib/auth.ts` — auth client
- Modify: `apps/web/src/app/page.tsx` — login gate

Use Supabase Auth (already have credentials in .env):
- `POST /api/v1/auth/login` — email+password → JWT
- `POST /api/v1/auth/register` — create user
- `GET /api/v1/auth/me` — validate token, return user
- WebSocket: send token in first `session_config` message
- Frontend: simple login screen, store JWT in localStorage

### Task 19: User-Scoped Memory
**Files:**
- Modify: `backend/app/agents/orchestrator.py` — use real user_id from session
- Modify: `backend/app/api/routes/ws.py` — pass user_id to orchestrator

Replace hardcoded `USER_ID = "default"` with actual user ID from auth token. Session now carries `session["user_id"]` extracted from JWT.

---

## Wave 3: Content & Learning

### Task 20: Topic Discovery
**Files:**
- Rewrite: `backend/app/agents/topic_discovery.py` — full implementation
- Create: `backend/migrations/002_topics_table.sql`
- Modify: `backend/app/main.py` — register Celery beat task (or simple background task)

Implementation:
- Fetch RSS from HN (`hnrss.org/frontpage`) + Reddit (`r/programming`)
- Parse title, url, description
- LLM generates discussion_prompt via Prompt Engine (topic_discovery template)
- Store in `topics` table: user_id, title, url, description, discussion_prompt, source, created_at
- Simple asyncio background task every 4 hours (no Celery needed for single-user)
- Orchestrator picks latest unseen topic for companion

### Task 21: Phrase Library + SM-2
**Files:**
- Create: `backend/app/api/routes/phrases.py` — CRUD + review endpoints
- Create: `backend/migrations/003_phrases_table.sql`
- Create: `apps/web/src/components/PhraseLibrary.tsx` — new screen/tab
- Modify: `apps/web/src/components/VariantCards.tsx` — wire Save button

Backend:
- `POST /api/v1/phrases` — save phrase {text, style, context, translation}
- `GET /api/v1/phrases` — list all (with search)
- `GET /api/v1/phrases/due` — phrases due for review today
- `POST /api/v1/phrases/{id}/review` — SM-2 update (quality 0-5)
- SM-2 algorithm: standard (ease_factor, interval, repetitions, next_review)

Frontend:
- PhraseLibrary screen accessible from header menu
- Cards with phrase, translation, next review date
- Review mode: flash card style

---

## Wave 4: Feedback & Engagement

### Task 22: Post-Session Summary
**Files:**
- Create: `backend/app/api/routes/session.py` — summary endpoint
- Modify: `apps/web/src/app/page.tsx` — end session button + summary modal

`POST /api/v1/session/summary`:
- Input: session history + error_history
- LLM generates summary: duration, message count, new words, top errors, advice
- Return structured JSON for frontend display

Frontend: "End session" in header ⋯ menu → confirmation → summary card → "New session" button.

### Task 23: Stats / Progress
**Files:**
- Create: `backend/app/api/routes/stats.py`
- Create: `backend/migrations/004_session_stats.sql`
- Create: `apps/web/src/components/StatsScreen.tsx`

Backend: session_stats table, aggregation endpoint.
Frontend: streak counter, error breakdown, level progress bar. Use simple CSS bars/charts (no recharts dep to keep bundle small).

### Task 24: Rich Link Card
**Files:**
- Create: `backend/app/api/routes/opengraph.py` — OG metadata fetcher
- Modify: `apps/web/src/components/CompanionBubble.tsx` — render rich cards from message data

`GET /api/v1/opengraph?url=...` → {title, description, image, favicon}. Redis cache 24h TTL.
CompanionBubble checks `message.richCard` field, renders card if present.

---

## Wave 5: Push Notifications

### Task 25: Web Push + Companion-Initiated Messages
**Files:**
- Create: `backend/app/api/routes/push.py`
- Create: `backend/migrations/005_push_tables.sql`
- Create: `apps/web/public/sw.js` — Service Worker
- Modify: `apps/web/src/app/page.tsx` — register SW, request permission

Backend: VAPID keys, push_subscriptions table, pending_messages table.
Background task: check every 30 min if user inactive 4+ hours → generate message → send push.

---

## Wave 6: Deploy

### Task 26: Coolify Deploy
- Merge feat/iteration-7-8 → main
- Update Coolify env vars on VPS 178.17.50.45
- Trigger deploy
- Verify live site

---

## Dependency Graph

```
Wave 1 (14,15,16,17) → independent, can parallel
Wave 2 (18,19) → 18 before 19
Wave 3 (20,21) → after Wave 2 (need user_id)
Wave 4 (22,23,24) → after Wave 2 (need user_id for stats)
Wave 5 (25) → after Wave 2 + Wave 3
Wave 6 (26) → after everything
```
