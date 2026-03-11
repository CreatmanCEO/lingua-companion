# Plan: Task 4 — AI Agents Implementation (Companion + TTS + Memory)

Date: 2026-03-11
Status: READY TO IMPLEMENT

## Goal

Реализовать оставшиеся AI агенты из мультиагентной архитектуры.
Приоритет: заменяемость провайдеров + минимальная стоимость.

---

## API Strategy: Cost-First, Swap-Ready

### Принцип: одна env переменная = смена провайдера

Уже работает для LLM через LiteLLM (`LLM_MODEL`).
Task 4 распространяет этот паттерн на TTS и Embeddings.

### Таблица провайдеров по агентам

| Агент | Self (бесплатно) | Commercial (дёшево) | Env переключатель |
|-------|-----------------|---------------------|-------------------|
| Companion | Groq Llama 3.3 70B free | Gemini 2.5 Flash $0.075/1M | `LLM_MODEL` |
| TTS | edge-tts (Microsoft, $0) | Google Neural2 free 1M/мес | `TTS_PROVIDER` |
| Memory embeddings | Google Embeddings API free | Google $0.025/1M | `EMBEDDINGS_MODEL` |
| Analytics | Python only — $0 | Python only — $0 | — |

### Почему edge-tts для self version

- `pip install edge-tts` — те же голоса что в Microsoft Edge
- Полностью бесплатно, без API ключей
- Качество достаточное для MVP
- Переключение на Google Neural2 = смена одной переменной

---

## Scope

### 4.1 — companion.py (диалог, 5 стилей)

**Что делает**: отвечает на фразу пользователя в одном из 5 стилей
(Simple / Professional / Colloquial / Slang / Idiom)

**Провайдер**: LiteLLM → `settings.LLM_MODEL` (уже настроен)

**System prompt**: Alex IT persona (уже в прототипе v2, перенести)

**Файл**: `backend/app/agents/companion.py`

```python
async def get_companion_response(
    transcript: str,
    style: str = "colloquial",  # simple|professional|colloquial|slang|idiom
    conversation_history: list[dict] = None,
    user_context: dict = None,
) -> AsyncIterator[str]:  # streaming
```

**Особенности**:
- Streaming ответ (yield chunks)
- Принимает контекст памяти пользователя (user_context)
- 5 стилей как в VariantCards
- Temperature 0.8 для живости диалога

---

### 4.2 — tts.py (синтез речи)

**Что делает**: text → audio bytes (mp3/opus)

**Файл**: `backend/app/agents/tts.py`

```python
async def synthesize(
    text: str,
    voice: str = "en-US-GuyNeural",  # edge-tts default
) -> bytes:  # mp3 bytes
    provider = settings.TTS_PROVIDER  # "edge" | "google" | "elevenlabs"
```

**Провайдеры**:

```python
# edge-tts (бесплатно, self version)
async def _edge_tts(text: str, voice: str) -> bytes:
    communicate = edge_tts.Communicate(text, voice)
    # stream to bytes

# Google Neural2 (free tier, commercial)
async def _google_tts(text: str) -> bytes:
    # Google Cloud TTS API
    # GOOGLE_TTS_API_KEY уже в .env.example

# ElevenLabs (Phase 2, premium)
async def _elevenlabs_tts(text: str) -> bytes:
    # placeholder, Phase 2
```

**Голоса для edge-tts**:
- `en-US-GuyNeural` — мужской, нейтральный
- `en-US-JennyNeural` — женский, дружелюбный
- Выбор голоса через `TTS_VOICE` env

---

### 4.3 — memory.py (pgvector RAG)

**Что делает**: сохраняет и извлекает контекст пользователя

**Файл**: `backend/app/agents/memory.py`

```python
async def save_interaction(
    user_id: str,
    original: str,
    corrected: str,
    main_error: str | None,
) -> None:  # async, non-blocking

async def get_user_context(
    user_id: str,
    query: str,
    limit: int = 5,
) -> dict:  # {interests, vocab_gaps, recent_errors}
```

**Провайдер embeddings**: `settings.EMBEDDINGS_MODEL`
- `google` → Google Embeddings API (free 1M/мес) ← дефолт
- `nomic` → nomic-embed-text через Ollama (полностью бесплатно, self-hosted)

**Хранилище**: pgvector в Supabase (уже настроен)

**Схема**: таблица `memories` уже в ARCHITECTURE.md

---

### 4.4 — .env.example обновление

Добавить новые переменные:

```dotenv
# TTS
TTS_PROVIDER=edge              # edge | google | elevenlabs
TTS_VOICE=en-US-GuyNeural      # edge-tts voice name

# Embeddings
EMBEDDINGS_MODEL=google        # google | nomic

# Memory
MEMORY_ENABLED=true
MEMORY_CONTEXT_LIMIT=5         # сколько воспоминаний брать в контекст
```

---

### 4.5 — WebSocket обновление (/ws/session)

Добавить новые события в JSON stream:

```
Текущие события:     stt_result → reconstruction_result → variants_result
После Task 4:        + companion_chunk (streaming) → tts_ready
```

**ws.py изменения**:
```python
# После variants_result:
async for chunk in get_companion_response(transcript, style):
    await websocket.send_json({"type": "companion_chunk", "text": chunk})

tts_audio = await synthesize(companion_response)
await websocket.send_bytes(tts_audio)
await websocket.send_json({"type": "tts_ready"})
```

---

## Порядок выполнения

```
Шаг 1  → companion.py (LiteLLM streaming)
Шаг 2  → tts.py (edge-tts primary, google fallback)
Шаг 3  → memory.py (embeddings + pgvector)
Шаг 4  → config.py обновить (TTS_PROVIDER, EMBEDDINGS_MODEL, TTS_VOICE)
Шаг 5  → .env.example обновить
Шаг 6  → ws.py: добавить companion + tts события
Шаг 7  → тесты: companion, tts, memory (mock внешних API)
Шаг 8  → code review
Шаг 9  → коммит
```

**Зависимости для установки**:
```
edge-tts>=6.1.9
google-cloud-texttospeech>=2.16.0  # уже может быть в requirements
```

---

## Out of Scope (Task 4)

- topic_discovery.py → Task 5 (Celery)
- analytics.py → Task 5
- Auth (NextAuth.js) → Task 6
- ElevenLabs TTS → Phase 2
- Nomic embeddings local → Phase 2

---

## Успешный результат

- [ ] companion.py: streaming ответ в 5 стилях через LiteLLM
- [ ] tts.py: edge-tts работает, переключается на Google одной переменной
- [ ] memory.py: save + retrieve через pgvector + Google Embeddings
- [ ] /ws/session: полный pipeline включая companion + tts
- [ ] Все тесты зелёные (моки для внешних API)
- [ ] TTS_PROVIDER, EMBEDDINGS_MODEL задокументированы в .env.example
