# Design: Iterations 7-8 — Edge-TTS, Compact UI, Streaming, Memory, Onboarding

> **Date:** 2026-04-02
> **Status:** APPROVED
> **Target user:** Personal tool (single user, no auth)
> **Priority order:** Edge-TTS → Compact UI + Settings → Streaming → Memory → Onboarding

---

## Context

LinguaCompanion — voice-first AI language learning for Russian-speaking IT devs. Current state: working chat with Companion Agent (3 personas), Reconstruction, Phrase Variants, deployed on VPS. 34 backend + 49 frontend tests passing.

**User pain points (prioritized):**
1. TTS voice is terrible (Web Speech API)
2. Header wastes space, no settings, can't choose companion/voice/style
3. Waiting for full companion response (no streaming)
4. No memory between sessions
5. No onboarding for new users

---

## Iteration 7: UX Quality

### 7.1 Edge-TTS

**Backend:** New agent `backend/app/agents/tts.py` + endpoint `POST /api/v1/tts`.

- `pip install edge-tts`
- Input: `{text: string, voice: string, rate: string}`
- Output: audio/mpeg stream
- 4 voices:
  - `en-US-GuyNeural` (US Male)
  - `en-US-JennyNeural` (US Female)
  - `en-GB-RyanNeural` (GB Male)
  - `en-GB-SoniaNeural` (GB Female)
- SSML support for speed control (rate from settings)
- In-memory LRU cache (50 entries, same text+voice = cached)
- Fallback: Web Speech API if Edge-TTS unavailable

**Frontend:** Replace `window.speechSynthesis` with fetch + audio playback.
- CompanionBubble: Listen → fetch `/api/v1/tts` → `new Audio(blobURL)` → play
- VariantCards: same for each card's play button
- Remove inline Web Speech API code
- Voice preference from localStorage settings

### 7.2 Compact UI

**Header — single row ~48px, auto-hide on scroll:**

```
┌─────────────────────────────────────┐
│ [L] LinguaCompanion  Alex🟢    ⚙️  │  ← 48px total
├─────────────────────────────────────┤
│ [💬 Free Chat] [🎭 Scenario]       │  ← 36px tabs
└─────────────────────────────────────┘
```

- Logo mark + app name (left)
- Companion name + online indicator (center)
- Settings gear only (right) — theme toggle moved to Settings
- CompanionBar component removed — info merged into header
- Auto-hide: scroll down → header+tabs slide up; scroll up → return (like Telegram)

### 7.3 Settings Panel

**Sheet (slide-in from right) triggered by ⚙️:**

```
┌──────────────────────────┐
│ Settings            [✕]  │
│                          │
│ Companion                │
│ (●) Alex  ( ) Sam  ( ) Morgan │
│                          │
│ Voice                    │
│ [🇺🇸 US] [🇬🇧 GB]        │
│ [👨 Male] [👩 Female]     │
│ [▶ Test voice]           │
│                          │
│ Speed  [━━━━●━━] 0.9x    │
│                          │
│ Topics                   │
│ ( ) IT only              │
│ (●) Mixed (IT + casual)  │
│ ( ) Any topic            │
│                          │
│ Level                    │
│ [A2] [B1] [B2]          │
│                          │
│ Theme                    │
│ [🌙 Dark] [☀️ Light]     │
└──────────────────────────┘
```

- Uses shadcn/ui Sheet (already installed)
- All settings saved to localStorage (Phase 1)
- Companion change → sendConfig() via WebSocket
- Topic preference → injected into companion system prompt
- Voice selection → stored for Edge-TTS calls

### 7.4 Streaming Companion

**Backend:** `litellm.acompletion(..., stream=True)` in companion.py.

New WebSocket event `companion_token`:
```json
{"type": "companion_token", "delta": "That's ", "companion": "Alex"}
{"type": "companion_token", "delta": "a great ", "companion": "Alex"}
{"type": "companion_response", "text": "That's a great point!", "companion": "Alex"}
```

- Tokens sent via WS as generated (~0.3s to first token)
- Final `companion_response` contains full text (for history)
- `pendingResultsRef` waits for `companion_response` (not `companion_token`)

**Frontend:**
- CompanionBubble appears immediately on first `companion_token`
- Text appends in real-time (typewriter effect)
- `chatStore`: new action `appendToLastCompanion(delta)`
- `onCompanionToken` callback in useVoiceSession
- Typing animation replaced by real streaming

---

## Iteration 8: Personalization

### 8.1 Memory Agent (pgvector RAG)

**What companion remembers:**
- Facts: name, level, specialty, interests, tech stack
- Vocab gaps: words/constructions with repeated errors
- Session summaries: 3-5 sentence LLM-generated summary per session
- Conversation history: full history for vector search

**Database (Supabase):**
```sql
user_facts: user_id, key, value, updated_at
memory_vectors: user_id, text, embedding vector(768), metadata jsonb, created_at
vocab_gaps: user_id, word, correct_form, error_count, last_seen
```

**Architecture:**
```
User message → Memory READ (vector search top-5, ~100ms)
            → Companion prompt enriched with context
            → Companion response
            → Memory WRITE async (embed + store, non-blocking)
            → Fact extraction async (LLM, ~50 tokens)
```

**Embeddings:** Google Embeddings API (already in stack).

**For single user:** user_id = "default", no auth needed.

### 8.2 Onboarding

**Step 1: Hint Overlay (4 steps, paged):**

Step-by-step tooltips pointing at real UI elements:
1. ⚙️ Settings → "Choose companion, voice and style"
2. Tabs → "Practice freely or pick a scenario"
3. Analyse button → "Get corrections and 5 style variants"
4. Mic button → "Hold mic to speak or switch to text"

Each step: tap → next tooltip. Final: "Got it!" → dismiss.
Shows once (localStorage flag).

**Step 2: Conversational onboarding (in chat):**

Companion asks questions naturally:
- "What's your name?"
- "How would you rate your English? A2, B1, or B2?"
- "What do you work with?"
- "Pick your style: 1) Professional 2) Casual 3) Mentor"

Backend: special onboarding system prompt, `extract_onboarding_data()` parses answers.
After completion: facts saved to memory, companion switches to chosen persona, `localStorage.setItem("onboarded", "true")`.

---

## Out of Scope

- Auth (NextAuth.js) — personal tool, no multi-user
- Pronunciation scoring — Phase 2 (Azure Speech SDK)
- Topic Discovery + Rich Cards — after Memory is working
- Session Summary / Stats / Phrase Library screens — after Analytics Agent
- Companion avatars (photo generation) — cosmetic, later
- Database migrations for analytics/topics tables — not needed yet
- Celery Beat setup — not needed until Topic Discovery

---

## Risk Assessment

| Risk | Mitigation |
|------|-----------|
| Edge-TTS is unofficial API | Fallback to Web Speech API; edge-tts stable 3+ years |
| pgvector setup on Supabase | Supabase has native pgvector support, well documented |
| Streaming adds WS protocol complexity | Final `companion_response` event preserves backward compat |
| Auto-hide header may feel janky | Use CSS `position: sticky` + `transform` with will-change |
| Onboarding extraction may misparse | Validate extracted data, ask again if unclear |
