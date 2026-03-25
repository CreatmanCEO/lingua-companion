# Plan: Companion Agent -- real LLM responses instead of demo stubs

Date: 2026-03-25
Status: DRAFT

## Goal

Implement Companion Agent that conducts contextual dialogue via Groq Llama 3.3 70B.
Replace getCompanionResponse() demo stub with real LLM responses.
Companion responds in English, understands RU/EN code-switching, plays one of three personas.

## Current State

**Backend:**
- backend/app/agents/companion.py -- empty stub (5 lines, TODO)
- backend/app/api/routes/ws.py -- pipeline: audio -> STT -> parallel(Reconstruction, Variants) -> send to client. Companion NOT called
- backend/app/agents/reconstruction.py + phrase_variants.py -- working agents via litellm.acompletion(), pattern to copy
- backend/app/core/config.py -- LLM_MODEL = groq/llama-3.3-70b-versatile, GROQ_API_KEY
- WebSocket sends events: stt_result, reconstruction_result, variants_result, error

**Frontend:**
- apps/web/src/lib/demo.ts -- getCompanionResponse() returns random hardcoded response
- apps/web/src/app/page.tsx -- companion response added via setTimeout(1500ms) after onVariantsResult
- apps/web/src/hooks/useVoiceSession.ts -- handles 4 WS event types, does NOT know about companion_response
- apps/web/src/store/chatStore.ts -- stores activeCompanion (Alex/Sam/Morgan), activeScenario, messages[]

**Persona data (DESIGN_JOURNEY.md section 4):**
- Alex: Professional -- clear, business-like
- Sam: Casual -- friendly, with humor
- Morgan: Mentor -- patient, explains why

## Answers to Key Questions

**Q1: Where to call companion agent?**
In ws.py -- AFTER receiving reconstruction result. Companion gets corrected text from reconstruction, dialog history, companion name + scenario context. Runs parallel with variants (both depend on reconstruction, not on each other).

**Q2: Do we need a new WS event type?**
Yes -- companion_response. Add to ws.py, useVoiceSession.ts, WebSocketEventType.

**Q3: How to pass dialog history?**
Frontend sends JSON on WS connect: type=session_config, companion=Alex, scenario=null. Backend stores session state in WebSocket session memory (dict). History accumulates during dialog. Phase 1 -- no persistence.

**Q4: System prompt for three personas?**
Dict COMPANION_PROMPTS in companion.py -- keyed by companion name. Common part + persona-specific part + scenario-specific part.

**Q5: What to change on frontend?**
Add onCompanionResponse callback, remove getCompanionResponse demo calls, send session_config on connect, add sendText for text input.

## Implementation Steps

### Step 1: Backend -- backend/app/agents/companion.py

Implement async function generate_response(user_message, companion, history, scenario) returning dict.

Signature:
- user_message: str -- reconstructed English text
- companion: str -- Alex or Sam or Morgan
- history: list[dict] -- conversation history as LLM messages [{role, content}]
- scenario: dict or None -- scenario context with companionRole, userRole
- Returns: {text: companion response string, companion: name}

Details:
- Three system prompts in COMPANION_PROMPTS dict: Alex (professional), Sam (casual), Morgan (mentor)
- Common system prompt: You are [name], AI companion for Russian-speaking IT dev learning English. ALWAYS respond in English. User may speak mixed RU/EN. Keep responses 1-3 sentences. Ask follow-up questions. Use IT vocabulary naturally.
- Persona-specific additions (tone, style examples)
- Scenario mode: append companionRole and userRole to system prompt
- LLM call: litellm.acompletion(), model=settings.LLM_MODEL, temperature=0.7, max_tokens=200
- DO NOT use response_format=json_object -- companion responds in plain text
- Fallback: on LLM error return generic response, do not break pipeline

### Step 2: Backend -- update WS protocol in backend/app/api/routes/ws.py

**2a.** Add JSON message support from client (currently only binary audio):
- In while True loop: use receive() instead of receive_bytes()
- If message contains text -- parse JSON: session_config or text_message
- If message contains bytes -- current audio logic
- Store session state: companion name, scenario, history list

**2b.** Add companion agent call after reconstruction:
- Current pipeline: STT -> parallel(Reconstruction, Variants)
- New approach: STT -> parallel(Reconstruction, Variants). When Reconstruction done, fire Companion task parallel with remaining variants wait.
- Implementation: asyncio.wait FIRST_COMPLETED. When reconstruction done -- start companion. Keep waiting for variants + companion.
- Send companion_response event to client
- Add user message and companion response to session history

**2c.** Add text_message handling:
- Skip STT (text already available)
- Run Reconstruction, then parallel(Variants, Companion)
- This replaces demo handleSendText on frontend

**2d.** Limit history: max 20 messages (sliding window), trim old ones.

### Step 3: Frontend -- update apps/web/src/hooks/useVoiceSession.ts

- Add companion_response to WebSocketEventType
- Add CompanionResult interface: { text: string, companion: string }
- Add onCompanionResponse callback to VoiceSessionCallbacks
- In ws.onmessage add case companion_response
- Update pending logic: processing ends after ALL THREE: reconstruction + variants + companion (add companion field to pendingResultsRef)
- Add sendConfig(companion, scenario) method -- sends session_config JSON via ws.send()
- Add sendText(text) method -- sends text_message JSON

### Step 4: Frontend -- update apps/web/src/app/page.tsx

**4a.** Add onCompanionResponse callback: setIsTyping(false) + addMessage with sender=companion

**4b.** Remove ALL getCompanionResponse() calls:
- line ~77-83 (in onVariantsResult) -- remove setTimeout + getCompanionResponse
- line ~133-142 (in handleSendText) -- replace with sendText(text)
- line ~167-175 (in handleSendAudio demo mode) -- keep as offline fallback

**4c.** In handleSendText -- call sendText(text) instead of demo setTimeout

**4d.** On WS connect -- send sendConfig(activeCompanion, activeScenario)

**4e.** On companion or scenario change -- resend sendConfig()

**4f.** Keep fallback: if !isConnected, use getCompanionResponse() as demo

### Step 5: Welcome messages -- DEFERRED

Keep welcome messages hardcoded in demo.ts. LLM-generated welcome -- Phase 2.

### Step 6: Backend tests -- backend/tests/test_companion.py (new file)

**6a. Unit tests companion agent (7 tests):**
- test_generate_response_returns_text
- test_generate_response_alex_persona
- test_generate_response_sam_persona
- test_generate_response_morgan_persona
- test_generate_response_with_scenario
- test_generate_response_with_history
- test_generate_response_llm_failure
- All tests mock litellm.acompletion

**6b. Update backend/tests/test_ws_session.py:**
- test_websocket_full_pipeline -- expect 4 events (+ companion_response)
- test_websocket_text_message -- new: send text via JSON
- test_websocket_session_config -- new: set companion/scenario
- Add companion agent mock to all existing tests

### Step 7: Frontend tests

- Update useVoiceSession tests -- add companion_response event handling
- Verify getCompanionResponse is not called when connected

## Testing Strategy

1. Unit tests (Step 6a): companion.py in isolation, mock litellm -- 7 tests
2. Integration tests (Step 6b): WS pipeline with mocked agents -- update 4 + add 3 tests
3. Manual E2E: run backend + frontend, verify dialog manually
4. All existing tests must continue passing

## Execution Order

    Step 1 -> Step 6a   (companion agent + unit tests)
    Step 2 -> Step 6b   (ws.py changes + integration tests)
    Step 3 -> Step 4 -> Step 7   (frontend changes + tests)
    Step 5 -- deferred (welcome stays hardcoded)

## Risks

1. **Latency**: Companion LLM call adds ~0.3-0.5s. Mitigation: start companion after reconstruction is ready, parallel with variants. Do not block variants delivery waiting for companion.

2. **Groq rate limits**: three parallel LLM calls (reconstruction + variants + companion) on one API key. Groq free tier = 30 req/min, 6000 tokens/min. At 10 req/min user = 30 req/min to Groq -- borderline. Mitigation: monitor 429s, add retry with backoff in litellm.

3. **History overflow**: without history limit LLM context window overflows. Mitigation: sliding window 20 messages, trim old ones.

4. **WS protocol breaking change**: adding JSON messages changes protocol. Mitigation: backward compatible -- binary = audio (current logic), text/JSON = new logic.

5. **Frontend state complexity**: pending logic gets more complex (3 events instead of 2). Mitigation: pendingResultsRef adds companion field.

6. **Existing tests**: test_websocket_full_pipeline expects 3 events. Mitigation: update to expect 4 events, add companion mock.

## Out of Scope

- Memory Agent (pgvector RAG) -- Phase 1 without cross-session memory
- TTS (voicing companion responses) -- separate task
- Streaming companion response (token-by-token) -- Phase 2
- LLM-generated welcome messages -- keep hardcoded
- Companion initiates (shares news) -- separate task with Topic Discovery
- Analytics Agent integration -- separate task
- History persistence between reconnects -- Phase 2
- Onboarding (companion selection) -- separate UI task

## Affected Files

| File | Action |
|------|--------|
| backend/app/agents/companion.py | Full implementation (from stub) |
| backend/app/api/routes/ws.py | Extend: JSON messages, companion call, text input |
| backend/tests/test_companion.py | New file -- 7 unit tests |
| backend/tests/test_ws_session.py | Update: +companion mock, +text message tests |
| apps/web/src/hooks/useVoiceSession.ts | Extend: companion event, sendConfig, sendText |
| apps/web/src/app/page.tsx | Refactor: remove demo, connect real responses |
| apps/web/src/lib/demo.ts | DO NOT delete -- getCompanionResponse stays as offline fallback |
