# Iteration 7-8 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** UX quality (Edge-TTS, compact header, settings, streaming) + personalization (memory agent, onboarding).

**Architecture:** Backend FastAPI (Python 3.12) + Frontend Next.js 15 (TypeScript). WebSocket /ws/session + REST POST /api/v1/tts. Supabase PostgreSQL + pgvector for memory.

**Tech Stack additions:** edge-tts (backend), pgvector SQL migrations (Supabase), Google Embeddings API.

**Current state:** 34 backend + 49 frontend tests passing. Companion agent with 3 personas. Web Speech API TTS (bad). No settings/streaming/memory/onboarding.

---

## Iteration 7: UX Quality

---

### Task 1: Edge-TTS backend agent + endpoint

**Files:** Create: backend/app/agents/tts.py, backend/app/api/routes/tts.py, backend/tests/test_tts.py. Modify: backend/app/main.py, backend/requirements.txt.

**Steps:** 1.1) Add edge-tts==6.1.18. 1.2) tts.py: 4 voices (GuyNeural, JennyNeural, RyanNeural, SoniaNeural), VOICES dict, synthesize() with OrderedDict LRU cache (50), edge_tts.Communicate().stream(). 1.3) tts route: POST /api/v1/tts -> audio/mpeg, GET /api/v1/tts/voices. 1.4) Register in main.py. 1.5) 8 tests.

**Commit:** feat: Edge-TTS agent + /api/v1/tts endpoint with LRU cache

---

### Task 2: Edge-TTS frontend integration

**Files:** Create: apps/web/src/lib/edgeTts.ts. Modify: CompanionBubble.tsx, VariantCards.tsx, VariantCards.test.tsx. Delete: apps/web/src/lib/tts.ts.

**Steps:** 2.1) edgeTts.ts: VoiceKey, getSavedVoice/Rate, playTts (fetch -> Audio -> play, Web Speech fallback), stopTts, isTtsPlaying. 2.2) CompanionBubble: replace speechSynthesis. 2.3) VariantCards: same. 2.4) Delete tts.ts. 2.5) Mock edgeTts in tests.

**Commit:** feat: replace Web Speech API with Edge-TTS

---

### Task 3: Compact Header

**Files:** Modify: Header.tsx. Delete: CompanionBar.tsx. Modify: page.tsx. Create: Header.test.tsx.

**Steps:** 3.1) Header: props (companionName, isOnline, isTyping, onSettingsClick, scenarioName?, onEndScenario?), h-12 [Logo][Name+dot][Gear]. 3.2) Remove CompanionBar. 3.3) Delete CompanionBar. 3.4) 5 tests.

**Commit:** refactor: compact header -- merge companion info, remove CompanionBar

---

### Task 4: Auto-hide header on scroll

**Files:** Create: useScrollDirection.ts + test. Modify: page.tsx, ChatArea.tsx (forwardRef).

**Steps:** useScrollDirection(scrollRef, threshold=10) -> up/down/null. ChatArea forwardRef. Wrap Header+TabBar: translateY transition. Tests.

**Commit:** feat: auto-hide header on scroll down

---

### Task 5: Settings Panel

**Files:** Create: settingsStore.ts, SettingsPanel.tsx + test.

**Steps:** Zustand store: voice, rate, topicPreference, level, theme + localStorage. shadcn Sheet: Companion/Voice/Speed/Topics/Level/Theme. Tests.

**Commit:** feat: Settings panel

---

### Task 6: Settings integration

**Files:** Modify: page.tsx.

**Steps:** settingsOpen state, SettingsPanel render, localStorage load, next-themes.

**Commit:** feat: integrate Settings panel

---

### Task 7: Streaming companion backend

**Files:** Modify: companion.py, ws.py, test_companion.py, test_ws_session.py.

**Steps:** 7.1) generate_response_stream() async generator: litellm stream=True, yields token/done. Keep generate_response(). 7.2) ws.py: stream tokens -> companion_token events -> companion_response. 7.3) Tests.

**Commit:** feat: streaming companion via litellm stream=True

---

### Task 8: Streaming companion frontend

**Files:** Modify: chatStore.ts, useVoiceSession.ts, page.tsx, ChatArea.tsx, CompanionBubble.tsx.

**Steps:** 8.1) chatStore: streamingCompanionText, append/clear. 8.2) useVoiceSession: companion_token. 8.3) page.tsx callbacks. 8.4) ChatArea: streaming bubble. 8.5) CompanionBubble: isStreaming, cursor.

**Commit:** feat: streaming companion frontend -- typewriter effect

---

## Iteration 8: Personalization

---

### Task 9: Database schema

**Files:** Create: backend/migrations/001_memory_tables.sql. Modify: config.py.

**Steps:** CREATE EXTENSION vector. Tables: user_facts (key-value, UNIQUE user_id+key), memory_vectors (embedding vector(768), HNSW index), vocab_gaps (error_count, UNIQUE user_id+word). Config: GOOGLE_EMBEDDINGS_MODEL.

**Commit:** feat: Supabase migrations -- user_facts, memory_vectors, vocab_gaps

---

### Task 10: Memory Agent backend

**Files:** Rewrite: memory.py. Create: test_memory.py.

**Steps:** USER_ID=default. embed_text (Google API 768-dim), get_pool (asyncpg max=5), search_memory (cosine top-5), get_user_facts, store_memory, upsert_fact, track_vocab_gap, extract_facts (LLM). All try/except. 6 tests.

**Commit:** feat: Memory Agent -- embed, search, store, fact extraction

---

### Task 11: Memory integration

**Files:** Modify: ws.py, test_ws_session.py.

**Steps:** READ: search_memory + get_user_facts -> memory_context -> generate_response_stream(). WRITE (fire-and-forget): store, extract facts, track vocab. Mock in tests.

**Commit:** feat: integrate Memory Agent -- RAG context, async write-behind

---

### Task 12: Hint Overlay

**Files:** Create: HintOverlay.tsx + test. Modify: page.tsx.

**Steps:** 4-step overlay (Settings/Tabs/Analyse/Mic). Next/Got it!. localStorage hints-seen. 4 tests.

**Commit:** feat: Hint Overlay -- 4-step onboarding tooltips

---

### Task 13: Conversational onboarding

**Files:** Create: onboarding.py + test.

**Steps:** ONBOARDING_SYSTEM_PROMPT (4 questions one at a time). get_onboarding_response, extract_onboarding_data, is_onboarding_complete. 5 tests.

**Commit:** feat: Onboarding Agent

---

### Task 14: Onboarding integration

**Files:** Modify: ws.py, useVoiceSession.ts, chatStore.ts, page.tsx, tests.

**Steps:** Backend: onboarding flag, process_onboarding (no pipeline), onboarding_complete event. Frontend: localStorage, companion switch. 2 tests.

**Commit:** feat: conversational onboarding

---

## Risk Assessment

| Risk | Mitigation | Tasks |
|------|-----------|-------|
| edge-tts instability | Web Speech API fallback | 1-2 |
| pgvector not enabled | CREATE EXTENSION IF NOT EXISTS | 9 |
| Embeddings quota | Non-blocking ops | 10-11 |
| Streaming breaks WS | companion_response compat | 7-8 |
| Header jank | will-change + transitions | 4 |
| Onboarding misparse | validates all fields | 13-14 |

## Out of Scope

Auth, Pronunciation, Topic Discovery, Stats, Avatars, Celery Beat, SQLAlchemy ORM
