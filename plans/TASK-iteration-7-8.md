# Task: Iteration 7-8 Implementation

> **Ветка:** `feat/iteration-7-8`
> **План:** `docs/plans/2026-04-02-iteration-7-8-plan.md`
> **Дизайн:** `docs/plans/2026-04-02-iteration-7-8-design.md`
> **Дата:** 2026-04-02

---

## Твоя роль

Ты — implementer. Выполняешь план из `docs/plans/2026-04-02-iteration-7-8-plan.md` задача за задачей. Используй superpowers:executing-plans skill.

## Первое что сделать

1. Создай ветку: `git checkout -b feat/iteration-7-8`
2. Прочитай ВСЕ файлы из списка ниже перед началом работы
3. Начинай с Task 1

## Критические правила

1. **Работай ТОЛЬКО в ветке `feat/iteration-7-8`** — НЕ в main
2. **TDD:** test first → verify fails → implement → verify passes
3. **После КАЖДОЙ task запусти тесты:**
   - Backend: `cd C:/lingua-companion/backend && python -m pytest tests/ -v`
   - Frontend: `cd C:/lingua-companion/apps/web && pnpm lint && pnpm test`
4. **Если тесты упали — ИСПРАВЬ прежде чем перейти к следующей task**
5. **Каждая task = один коммит** с сообщением из плана
6. **НЕ оставляй мусор** — неиспользуемые импорты, пустые TODO, закомментированный код
7. **Все ответы на русском языке**

## Файлы для изучения ПЕРЕД началом

### План и дизайн (источники истины):
- `docs/plans/2026-04-02-iteration-7-8-plan.md` — 14 задач
- `docs/plans/2026-04-02-iteration-7-8-design.md` — утверждённый дизайн

### Backend (что менять):
- `backend/app/agents/companion.py` — streaming в Task 7
- `backend/app/agents/memory.py` — переписать в Task 10
- `backend/app/agents/tts.py` — создать в Task 1 (сейчас не существует)
- `backend/app/api/routes/ws.py` — streaming в Task 7, memory в Task 11, onboarding в Task 14
- `backend/app/api/routes/tts.py` — создать в Task 1
- `backend/app/main.py` — зарегистрировать tts router
- `backend/app/core/config.py` — Settings
- `backend/requirements.txt` — добавить edge-tts

### Frontend (что менять):
- `apps/web/src/app/page.tsx` — Tasks 3, 6, 8, 12, 14
- `apps/web/src/components/layout/Header.tsx` — Task 3
- `apps/web/src/components/layout/CompanionBar.tsx` — УДАЛИТЬ в Task 3
- `apps/web/src/components/layout/ChatArea.tsx` — Tasks 4, 8
- `apps/web/src/components/CompanionBubble.tsx` — Tasks 2, 8
- `apps/web/src/components/VariantCards.tsx` — Task 2
- `apps/web/src/hooks/useVoiceSession.ts` — Tasks 8, 14
- `apps/web/src/store/chatStore.ts` — Tasks 5, 8, 14
- `apps/web/src/lib/tts.ts` — УДАЛИТЬ в Task 2

### Спецификации:
- `docs/DESIGN_JOURNEY.md` — UX spec (§4 companions, §8 components, §9 voice bar)
- `docs/AI_PIPELINE.md` — pipeline architecture
- `docs/COMPETITIVE_ANALYSIS.md` — §6 prompt insights, §7 UX patterns

### Тесты (что обновлять/создавать):
- `backend/tests/test_tts.py` — создать в Task 1
- `backend/tests/test_companion.py` — обновить в Task 7
- `backend/tests/test_ws_session.py` — обновить в Tasks 7, 11, 14
- `backend/tests/test_memory.py` — создать в Task 10
- `apps/web/src/components/__tests__/` — обновить в Tasks 2, 3

## Порядок выполнения

### Iteration 7: UX Quality (Tasks 1-8)

| Task | Описание | Коммит |
|------|----------|--------|
| 1 | Edge-TTS backend: agent + POST /api/v1/tts + 8 tests | `feat: Edge-TTS agent + /api/v1/tts endpoint with LRU cache` |
| 2 | Edge-TTS frontend: replace Web Speech API, delete tts.ts | `feat: replace Web Speech API with Edge-TTS` |
| 3 | Compact Header: merge companion info, delete CompanionBar | `refactor: compact header — merge companion info, remove CompanionBar` |
| 4 | Auto-hide header: useScrollDirection hook | `feat: auto-hide header on scroll down` |
| 5 | Settings Panel: settingsStore + SettingsPanel component | `feat: Settings panel` |
| 6 | Settings integration: wire into page.tsx | `feat: integrate Settings panel` |
| 7 | Streaming companion backend: generate_response_stream() | `feat: streaming companion via litellm stream=True` |
| 8 | Streaming companion frontend: typewriter effect | `feat: streaming companion frontend — typewriter effect` |

### Iteration 8: Personalization (Tasks 9-14)

| Task | Описание | Коммит |
|------|----------|--------|
| 9 | DB schema: pgvector migrations (user_facts, memory_vectors, vocab_gaps) | `feat: Supabase migrations — user_facts, memory_vectors, vocab_gaps` |
| 10 | Memory Agent: embed, search, store, fact extraction + 6 tests | `feat: Memory Agent — embed, search, store, fact extraction` |
| 11 | Memory integration: RAG context in companion, async write-behind | `feat: integrate Memory Agent — RAG context, async write-behind` |
| 12 | Hint Overlay: 4-step paged tooltips | `feat: Hint Overlay — 4-step onboarding tooltips` |
| 13 | Onboarding Agent: system prompt, extract data + 5 tests | `feat: Onboarding Agent` |
| 14 | Onboarding integration: WS + frontend + localStorage | `feat: conversational onboarding` |

## Edge-TTS голоса (для Task 1)

```python
VOICES = {
    "us-male": "en-US-GuyNeural",
    "us-female": "en-US-JennyNeural",
    "gb-male": "en-GB-RyanNeural",
    "gb-female": "en-GB-SoniaNeural",
}
```

## Settings хранение (для Task 5)

```typescript
// localStorage keys
"lc-companion"     // "Alex" | "Sam" | "Morgan"
"lc-voice"         // "us-male" | "us-female" | "gb-male" | "gb-female"
"lc-rate"          // "0.8" .. "1.2"
"lc-topic"         // "it" | "mixed" | "any"
"lc-level"         // "A2" | "B1" | "B2"
"lc-theme"         // "dark" | "light"
"lc-onboarded"     // "true" | null
"lc-hints-seen"    // "true" | null
```

## Memory Agent (для Task 10)

```python
USER_ID = "default"  # single user, no auth

async def embed_text(text: str) -> list[float]:  # Google Embeddings API, 768-dim
async def search_memory(user_id, query, top_k=5) -> list[dict]:  # cosine similarity
async def store_memory(user_id, text, metadata) -> None:  # embed + INSERT
async def get_user_facts(user_id) -> dict:  # SELECT key, value
async def upsert_fact(user_id, key, value) -> None:  # INSERT ON CONFLICT UPDATE
async def track_vocab_gap(user_id, word, correct) -> None:  # UPSERT error_count++
async def extract_facts(text) -> dict:  # LLM extraction (~50 tokens)
```

## После ВСЕХ задач

1. Запусти полный тест-сьют: backend + frontend
2. Проверь что нет мусора: `git diff --stat`
3. **НЕ мержи в main** — оставь ветку для ревью

## Ожидаемый результат

- Все существующие тесты проходят (34 backend + 49 frontend)
- ~30 новых тестов (8 tts + 5 header + 6 memory + 5 onboarding + tests for streaming/settings/overlay)
- 14 коммитов в ветке `feat/iteration-7-8`
- Edge-TTS работает, Settings открываются, companion стримится, memory сохраняет
