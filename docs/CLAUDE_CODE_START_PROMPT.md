# Claude Code — Start Prompt

Copy-paste this at the start of every Claude Code session:

---

```
Read CLAUDE.md fully, then docs/AI_PIPELINE.md.

Confirm back:
1. Which STT provider is primary and why (one sentence)
2. Which two agents run in parallel after STT and why
3. Which LLM is used and how to switch it

Then wait for my first task. Do not write any code yet.
```

---

## Infrastructure Status (as of 2026-03-11)

All external services are configured and ready:

| Service | Status | Details |
|---------|--------|---------|
| Supabase PostgreSQL | ✅ | `chqbcqabqrnaqsiaomly.supabase.co` |
| Upstash Redis | ✅ | `darling-dove-67484.upstash.io:6379` (Frankfurt, TLS) |
| Deepgram | ✅ | $199.77 balance, Nova-3 ready |
| Groq | ✅ | LLM + STT fallback |
| Coolify backend | ✅ | `https://api.lingua.creatman.site` |
| Coolify frontend | ✅ | `https://lingua.creatman.site` |
| DNS | ✅ | Both A-records pointing to 178.17.50.45 |

Env vars are loaded in Coolify for the backend app.
**Missing before first deploy**: DEEPGRAM_API_KEY and GROQ_API_KEY (add via Coolify UI).

---

## Task 1 — FastAPI WebSocket Endpoint

**File**: `backend/app/api/routes/session.py`

```
Implement WebSocket endpoint /ws/session.

Flow:
1. Client connects via WebSocket
2. Client sends binary audio chunks (webm/opus)
3. Accumulate chunks until silence or 30s
4. Call STTAgent.transcribe(audio_bytes) → STTResult
5. Stream back JSON messages:
   {"type": "stt_result", "transcript": "...", "provider": "deepgram"}
   {"type": "processing"}
   {"type": "response", "reconstruction": "...", "variants": [...]}
   {"type": "error", "message": "..."}

Requirements:
- Use FastAPI WebSocket (not socketio)
- Handle disconnect gracefully
- Log each message type
- Write integration test: connect → send fixture audio → assert stt_result received

Audio fixture for tests: tests/fixtures/mixed_ru_en.m4a (create a simple one with silence if missing)
```

---

## Task 2 — Orchestrator: Parallel Agents

**File**: `backend/app/agents/orchestrator.py`

```
Implement the Orchestrator agent.

After STT result arrives, run in PARALLEL:
- ReconstructionAgent.process(transcript) 
- PhraseVariantsAgent.process(transcript)

Use asyncio.gather() — both must start simultaneously.

Then run sequentially:
- CompanionAgent.respond(reconstruction_result)

Return an OrchestratorResult dataclass with all outputs.

Requirements:
- Timeout: 5 seconds total for parallel step
- Log timing for each agent
- Write unit test: mock all agents, verify parallel execution via timing (< 1.5s for both)
```

---

## Task 3 — Next.js VoiceRecorder Component

**File**: `apps/web/src/components/VoiceRecorder.tsx`

```
First, initialize the Next.js app:
pnpm create next-app apps/web --typescript --tailwind --app --no-src-dir

Then implement VoiceRecorder component:

State machine:
  idle → recording → processing → idle

Behavior:
- Press button → start MediaRecorder (webm/opus, 250ms timeslice)
- Each ondataavailable chunk → send via WebSocket to ws://localhost:8001/ws/session
- On message type "stt_result" → show transcript in UI
- On message type "response" → show reconstruction + 5 variants
- On message type "error" → show error state
- Press button again → stop recording

UI:
- Big round button (mic icon when idle, stop icon when recording)
- Waveform animation while recording (CSS only, no libraries)
- Loading spinner during processing
- shadcn/ui components

Requirements:
- Handle WebSocket reconnect (exponential backoff)
- Show connection status indicator
- Write Vitest test: mock WebSocket, simulate message flow
```

---

## Notes for Claude Code

- All agents in `backend/app/agents/` are currently stubs — implement them one by one
- STT agent (`stt.py`) is fully implemented — use it as reference for style
- Use `make test-api` after every backend change
- Use `make test-web` after every frontend change
- Commit after each working task: `git add -A && git commit -m "feat: [task name]"`
