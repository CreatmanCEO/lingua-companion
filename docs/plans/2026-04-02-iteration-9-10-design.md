# Design: Iterations 9-10 — AI Quality, Translation, Push, Content, Progress

> **Date:** 2026-04-02
> **Status:** APPROVED
> **Target user:** Personal tool (single user)
> **Branch:** feat/iteration-7-8 (accumulating all features before merge to main)
> **Priority order:** AI quality → Translation → Push → Content → Progress

---

## Context

Iteration 7-8 delivered: Edge-TTS, compact UI, settings, streaming companion, memory agent (pgvector), onboarding. All in feat/iteration-7-8 branch (16 commits, 122 tests).

Now: improve AI quality and add content/progress features.

---

## Iteration 9: AI Quality + Core UX

### 9.1 Error Tracking (3+ repeats → explicit correction)

**No new UI.** Changes only in backend pipeline + companion prompt.

- Reconstruction agent already returns `error_type` and `changes[]`
- After each reconstruction → update `session["error_history"]` (list of {type, pattern, count})
- Compare new changes against history patterns (fuzzy match on type + similar words)
- When `count >= 3` → pass `repeated_errors` list to companion prompt
- Companion switches from implicit recasting to explicit sandwich method for those patterns
- Persist to `vocab_gaps` table via Memory Agent (already exists)

Companion prompt addition:
```
The user has repeated these errors 3+ times this session:
{repeated_errors}
For THESE specific errors, use explicit correction with sandwich method:
"Great sentence! One thing: use '{correct}' instead of '{wrong}' — {brief_rule}. Keep going!"
For all other errors, continue with implicit recasting.
```

### 9.2 Adaptive Level (Comprehensible Input i+1)

**No new UI.** CEFR level from user_facts (set during onboarding, changeable in Settings).

Companion prompt addition:
```
User's CEFR level: {level}

Vocabulary adaptation:
- A2: Simple words (go, make, thing). Short sentences. No idioms.
- B1: Common professional words (implement, deploy, resolve).
  Introduce 1-2 new words per response with brief context.
- B2: Varied vocabulary freely. Idioms OK.
  Challenge with nuanced synonyms.

Rule: ~80% familiar vocabulary + ~20% slightly above their level.
When using a potentially new word, clarify in context:
"You could refactor — that means restructure — the module."
```

### 9.3 Translation Toggle

**UI:** 🔄 button on every message bubble (both user and companion).

```
[message text in English]
[▶ Listen]  [🔄]
    ↓ tap 🔄 ↓
[текст сообщения на русском]
[▶ Listen]  [🔄]
    ↓ tap 🔄 ↓
(back to English)
```

**Backend:** `POST /api/v1/translate`
- Input: `{text: string, to: "ru"|"en"}`
- Output: `{translated: string}`
- Implementation: LLM call (Groq Llama, ~20 tokens, cheap)
- Simple prompt: "Translate the following text to {language}. Return only the translation."

**Frontend:**
- ActionPill 🔄 on CompanionBubble and UserBubble
- `chatStore`: `translatedTexts: Map<string, string>` (messageId → translated)
- Cache: don't re-request same message
- Toggle state per message: showing original or translated

### 9.4 Silence Threshold

**Trivial fix** in `useAudioRecorder.ts`:
```typescript
const MIN_RECORDING_DURATION_MS = 500;
// In stopRecording: if duration < MIN_RECORDING_DURATION_MS, return null
```

### 9.5 Companion-Initiated Messages + Web Push

**When companion initiates:**
1. User inactive 4+ hours
2. Current time within user's active hours (from Settings)
3. Not already sent today (max 1/day)

**Backend architecture:**
```
Celery Beat (every 30 min)
  → check_initiative_needed(user_id)
    → conditions met?
      → generate companion message (topic from hardcoded list Phase 1)
      → save to pending_messages table
      → send Web Push notification
      → when user opens app → fetch pending → show in chat
```

**Database:**
```sql
push_subscriptions: user_id, endpoint, p256dh, auth, created_at
pending_messages: user_id, text, companion, topic_title, topic_url, created_at, delivered bool
```

**Backend endpoints:**
- `POST /api/v1/push/subscribe` — save push subscription
- `GET /api/v1/push/pending` — fetch undelivered messages, mark delivered
- Celery task: `check_all_users_initiative` (Beat schedule: every 30 min)

**Web Push:**
- `pip install pywebpush`
- VAPID keys in .env (generate once: `vapid --gen`)
- Payload: `{title: "Alex", body: "Hey! Saw this article about Rust...", url: "/"}`

**Frontend:**
- `Notification.requestPermission()` on mount (if not asked before)
- Service Worker `public/sw.js` — handles push event, shows notification
- Click notification → open app
- On app open → fetch pending messages → insert into chat

**Settings — new section:**
```
Notifications
  [✓] Push notifications
  Active hours: [09:00] — [22:00]
```

**Phase 1 topics:** 20 hardcoded IT topics. Phase 2 → Topic Discovery replaces this.

---

## Iteration 10: Content + Progress

### 10.6 Topic Discovery (HN + Reddit RSS)

**Backend:** Celery task `fetch_topics`.
- Sources: HN frontpage RSS (`hnrss.org/frontpage`), Reddit (`r/programming`, `r/webdev` RSS)
- Parse RSS → extract title, url, description
- LLM generates discussion prompt personalized to user level
- Store in `topics` table: user_id, title, url, description, discussion_prompt, source, created_at
- Schedule: every 4 hours (Celery Beat)
- Keep last 20 topics per user

**Replaces** hardcoded topic list from 9.5.

### 10.7 Rich Link Card

**UI component** in chat when companion shares a topic.

```
┌──────────────────────────────────┐
│ [G] github.blog                  │
│ [preview image area]             │
│ **Copilot gets Rust support**    │
│ The new refactoring tools...     │
│ [Read ↗]          · 3 min read  │
└──────────────────────────────────┘
```

**Backend:** `GET /api/v1/opengraph?url=...` — fetches og:title, og:description, og:image, favicon.
- Cache in Redis (24h TTL)
- Favicon via Google Favicon API: `https://www.google.com/s2/favicons?domain=...`

**Frontend:** RichLinkCard component (already partially exists in CompanionBubble as hardcoded demo).
- Triggered by `message.richCard` field (not string matching)
- Add `richCard?: {title, description, url, image?, source, readTime?}` to Message interface

### 10.8 Phrase Library + Spaced Repetition (SM-2)

**Database:**
```sql
saved_phrases: id, user_id, text, style, context, source_message_id,
               ease_factor float DEFAULT 2.5, interval int DEFAULT 1,
               repetitions int DEFAULT 0, next_review timestamp,
               created_at
```

**Backend:**
- `POST /api/v1/phrases` — save phrase
- `GET /api/v1/phrases` — list all (with search/filter)
- `GET /api/v1/phrases/due` — phrases due for review today
- `POST /api/v1/phrases/{id}/review` — SM-2 update (quality 0-5)
- SM-2 algorithm: standard implementation (ease_factor, interval, repetitions)

**Companion integration:**
- When phrases are due → companion naturally weaves them into conversation
- Added to companion prompt: "Try to naturally use these phrases the user is reviewing: [list]"

**Frontend:**
- [+ Save] on VariantCards → POST to backend (currently only console.log)
- Phrase Library screen (new tab or accessible from Settings)
- Review mode: show phrase → user tries to use it → companion evaluates

### 10.9 Post-session Summary

**Trigger:** Two ways:
1. **Button** in header menu (⋯) → "End session" → confirmation dialog → summary
2. **Auto-suggest:** If 10+ messages in session AND 15-30 min since last message → companion sends "Would you like to see your session summary?"

**Button UX:** NOT easy to accidentally tap. Inside ⋯ menu, with confirmation: "End this session and see summary? [Cancel] [End session]"

**Summary content:**
```
┌──────────────────────────────────┐
│ 📊 Session Summary              │
│                                  │
│ Duration: 12 min                 │
│ Messages: 18                     │
│ New words: deploy, refactor      │
│                                  │
│ Top errors:                      │
│  • Past tense (3x)              │
│  • Articles (2x)                │
│                                  │
│ Phrases saved: 4                 │
│                                  │
│ "Great progress today! Focus     │
│  on past tense next time."      │
│                                  │
│ [Save summary]  [New session]   │
└──────────────────────────────────┘
```

**Backend:** LLM generates personalized summary from session history + error_history.

### 10.10 Stats / Progress

**Frontend screen** (new tab "Stats" in sidebar or accessible from Settings).

Components:
- **Streak counter** — consecutive days with at least 1 session
- **L2 ratio graph** — % English words per session (line chart, trend up)
- **Error breakdown** — pie chart: articles, tenses, prepositions, code-switching
- **Level progress bar** — A2 ████████░░ B1
- **Words learned** — count from Phrase Library

**Database:**
```sql
session_stats: id, user_id, session_date, duration_sec, message_count,
               l2_ratio float, error_count, error_breakdown jsonb,
               words_learned int, created_at
```

**Backend:** Analytics aggregation after each session end (or periodic).

**Charting:** `recharts` (lightweight, React-native, no D3 dependency).

---

## Out of Scope

- Auth (NextAuth.js) — personal tool, single user
- Pronunciation scoring — Phase 2
- Companion avatars (photo) — cosmetic
- Mobile app (Expo) — Phase 2
- Grammar Tooltip (click on word) — nice-to-have, later
- Variant Detail Sheet — nice-to-have, later

---

## Risk Assessment

| Risk | Mitigation |
|------|-----------|
| Celery Beat adds infra complexity | Single worker + beat in one container |
| Web Push browser support | Fallback: no push, just check on open |
| SM-2 algorithm correctness | Well-documented, many reference implementations |
| pywebpush VAPID setup | One-time setup, keys in .env |
| Stats charting bundle size | recharts tree-shakeable, ~40KB gzipped |
