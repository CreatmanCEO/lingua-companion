# Plan: WebSocket Endpoint /ws/session

Date: 2026-03-11
Status: DRAFT

## Goal

Создать WebSocket endpoint `/ws/session`, который:
1. Принимает бинарные аудио-фреймы из браузера
2. Транскрибирует через STT Agent (Deepgram primary / Groq fallback)
3. Параллельно запускает Reconstruction + PhraseVariants через asyncio.gather
4. Стримит JSON-события клиенту по мере готовности каждого этапа

Бюджет латентности: < 3.5 секунд end-to-end.

## Current State

### Существующий код

| Файл | Статус | Что делает |
|------|--------|------------|
| `backend/app/agents/stt.py` | READY | `transcribe(audio_bytes, filename)` -> dict с text, language, provider, latency_ms, fallback |
| `backend/app/agents/reconstruction.py` | READY | `reconstruct(transcript)` -> dict с corrected, original_intent, main_error, error_type, explanation |
| `backend/app/agents/phrase_variants.py` | READY | `get_variants(sentence)` -> dict с simple, professional, colloquial, slang, idiom |
| `backend/app/agents/orchestrator.py` | STUB | Пустой файл, нужна полная реализация |
| `backend/app/main.py` | READY | FastAPI app с CORS, health endpoint, закомментированные роутеры |
| `backend/app/core/config.py` | READY | Settings с pydantic-settings |
| `backend/app/api/` | NOT EXISTS | Директория не создана |
| `backend/tests/` | NOT EXISTS | Директория не создана |

### Зависимости (requirements.txt)

- `fastapi==0.115.0` — WebSocket support встроен
- `websockets==13.0` — уже установлен
- `httpx==0.27.2` — для Deepgram HTTP calls
- `litellm==1.48.0` — для LLM calls в reconstruction/phrase_variants

## Implementation Steps

### Step 1: backend/app/api/__init__.py

Создать пустой `__init__.py` для пакета api.

```python
# backend/app/api/__init__.py
"""API routes package."""
```

### Step 2: backend/app/api/routes/__init__.py

Создать пустой `__init__.py` для подпакета routes.

```python
# backend/app/api/routes/__init__.py
"""HTTP and WebSocket route modules."""
```

### Step 3: backend/app/api/routes/ws.py

WebSocket endpoint с полной логикой обработки аудио.

**Imports:**
```python
import asyncio
import json
import time
from typing import Any

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from starlette.websockets import WebSocketState

from app.agents.stt import transcribe
from app.agents.reconstruction import reconstruct
from app.agents.phrase_variants import get_variants
```

**Структура:**

```python
router = APIRouter()

async def send_event(ws: WebSocket, event_type: str, data: dict) -> None:
    """Отправить JSON-событие клиенту (если соединение открыто)."""
    if ws.client_state == WebSocketState.CONNECTED:
        await ws.send_json({"type": event_type, **data})


@router.websocket("/ws/session")
async def websocket_session(websocket: WebSocket):
    """
    Voice session WebSocket endpoint.

    Protocol:
    - Client sends: binary audio frames (webm/opus, m4a, mp3, wav)
    - Server sends: JSON events as each stage completes

    Events (server -> client):
    - stt_result: {text, language, provider, latency_ms, fallback}
    - reconstruction_result: {corrected, original_intent, main_error, error_type, explanation}
    - variants_result: {simple, professional, colloquial, slang, idiom}
    - error: {message}
    """
    await websocket.accept()

    try:
        while True:
            # 1. Receive binary audio
            audio_bytes = await websocket.receive_bytes()
            session_start = time.time()

            # 2. STT
            try:
                stt_result = await transcribe(audio_bytes, "audio.webm")
                await send_event(websocket, "stt_result", stt_result)
            except Exception as e:
                await send_event(websocket, "error", {"message": f"STT failed: {str(e)}"})
                continue

            transcript = stt_result.get("text", "")
            if not transcript.strip():
                await send_event(websocket, "error", {"message": "Empty transcript"})
                continue

            # 3. Parallel: Reconstruction + PhraseVariants
            try:
                reconstruction_task = asyncio.create_task(reconstruct(transcript))
                variants_task = asyncio.create_task(get_variants(transcript))

                # Отправляем результаты по мере готовности
                done, pending = await asyncio.wait(
                    [reconstruction_task, variants_task],
                    return_when=asyncio.FIRST_COMPLETED
                )

                for task in done:
                    if task is reconstruction_task:
                        await send_event(websocket, "reconstruction_result", task.result())
                    elif task is variants_task:
                        await send_event(websocket, "variants_result", task.result())

                # Дождаться оставшиеся
                for task in pending:
                    result = await task
                    if task is reconstruction_task:
                        await send_event(websocket, "reconstruction_result", result)
                    elif task is variants_task:
                        await send_event(websocket, "variants_result", result)

            except Exception as e:
                await send_event(websocket, "error", {"message": f"Processing failed: {str(e)}"})

    except WebSocketDisconnect:
        pass  # Normal disconnect
    except Exception as e:
        # Unexpected error - try to notify client
        try:
            await send_event(websocket, "error", {"message": f"Server error: {str(e)}"})
        except:
            pass
```

**Ключевые решения:**

1. **PhraseVariants получает raw transcript** (не corrected) — это осознанный tradeoff latency > accuracy, как указано в требованиях.

2. **asyncio.wait с FIRST_COMPLETED** — позволяет отправлять результаты по мере готовности, не ждать обоих.

3. **WebSocketState check** перед отправкой — защита от отправки в закрытый сокет.

4. **Filename "audio.webm"** по умолчанию — Chrome MediaRecorder создает webm/opus.

### Step 4: backend/app/agents/orchestrator.py

Полная реализация оркестратора как модуля с типизированными функциями.

```python
"""
Orchestrator Agent — LinguaCompanion

Координирует AI pipeline:
1. STT (transcribe)
2. Parallel: Reconstruction + PhraseVariants
3. (Future) Companion + TTS + Memory

Используется как WebSocket endpoint и как standalone API.
"""
import asyncio
import time
from dataclasses import dataclass
from typing import Optional

from app.agents.stt import transcribe
from app.agents.reconstruction import reconstruct
from app.agents.phrase_variants import get_variants


@dataclass
class PipelineResult:
    """Result of full voice pipeline execution."""
    # STT
    transcript: str
    language: str
    stt_provider: str
    stt_latency_ms: float
    stt_fallback: bool

    # Reconstruction
    corrected: str
    original_intent: str
    main_error: Optional[str]
    error_type: str
    explanation: Optional[str]

    # Variants
    simple: str
    professional: str
    colloquial: str
    slang: str
    idiom: str

    # Timing
    total_latency_ms: float


async def run_pipeline(audio_bytes: bytes, filename: str = "audio.webm") -> PipelineResult:
    """
    Execute full voice pipeline synchronously (for HTTP API).

    Returns PipelineResult with all fields populated.
    Raises exception on critical failure (STT).
    On LLM failure, returns degraded results (raw transcript in all fields).
    """
    start = time.time()

    # 1. STT
    stt_result = await transcribe(audio_bytes, filename)
    transcript = stt_result.get("text", "")

    if not transcript.strip():
        raise ValueError("Empty transcript from STT")

    # 2. Parallel processing
    reconstruction_result, variants_result = await asyncio.gather(
        reconstruct(transcript),
        get_variants(transcript),
        return_exceptions=True
    )

    # Handle exceptions gracefully
    if isinstance(reconstruction_result, Exception):
        reconstruction_result = {
            "corrected": transcript,
            "original_intent": transcript,
            "main_error": None,
            "error_type": "none",
            "explanation": None,
        }

    if isinstance(variants_result, Exception):
        variants_result = {k: transcript for k in ["simple", "professional", "colloquial", "slang", "idiom"]}

    total_ms = (time.time() - start) * 1000

    return PipelineResult(
        transcript=transcript,
        language=stt_result.get("language", "unknown"),
        stt_provider=stt_result.get("provider", "unknown"),
        stt_latency_ms=stt_result.get("latency_ms", 0),
        stt_fallback=stt_result.get("fallback", False),
        corrected=reconstruction_result.get("corrected", transcript),
        original_intent=reconstruction_result.get("original_intent", transcript),
        main_error=reconstruction_result.get("main_error"),
        error_type=reconstruction_result.get("error_type", "none"),
        explanation=reconstruction_result.get("explanation"),
        simple=variants_result.get("simple", transcript),
        professional=variants_result.get("professional", transcript),
        colloquial=variants_result.get("colloquial", transcript),
        slang=variants_result.get("slang", transcript),
        idiom=variants_result.get("idiom", transcript),
        total_latency_ms=round(total_ms, 1),
    )
```

**Зачем отдельный orchestrator.py:**
- Переиспользуется в HTTP endpoint (POST /api/v1/voice)
- Testable unit без WebSocket overhead
- Типизированный PipelineResult для downstream consumers

### Step 5: backend/app/main.py

Подключить WebSocket роутер.

**Изменения:**

```python
# Добавить импорт
from app.api.routes.ws import router as ws_router

# После CORS middleware, перед health endpoint
app.include_router(ws_router)
```

**Полный файл после изменения:**

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.core.config import settings
from app.api.routes.ws import router as ws_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    print(f"🚀 {settings.APP_NAME} v{settings.VERSION} starting...")
    yield
    print("👋 Shutting down...")


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.VERSION,
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3001", "https://lingua.creatman.site"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# WebSocket routes
app.include_router(ws_router)


@app.get("/health")
async def health():
    return {"status": "ok", "version": settings.VERSION}
```

### Step 6: backend/tests/ structure

Создать структуру тестов.

**Файлы:**
- `backend/tests/__init__.py` — пустой
- `backend/tests/conftest.py` — pytest fixtures
- `backend/tests/fixtures/` — директория для тестовых аудио
- `backend/tests/test_ws_session.py` — тесты WebSocket endpoint
- `backend/tests/test_orchestrator.py` — unit тесты orchestrator

**backend/tests/conftest.py:**

```python
import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app


@pytest.fixture
def anyio_backend():
    return "asyncio"


@pytest.fixture
async def client():
    """Async HTTP client for testing."""
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test"
    ) as ac:
        yield ac
```

**backend/tests/test_ws_session.py:**

```python
import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, AsyncMock
from app.main import app


@pytest.fixture
def test_client():
    return TestClient(app)


def test_websocket_accepts_connection(test_client):
    """WebSocket endpoint accepts connections."""
    with test_client.websocket_connect("/ws/session") as websocket:
        # Just test connection works
        pass


def test_websocket_handles_empty_audio(test_client):
    """Empty audio returns error event."""
    with patch("app.api.routes.ws.transcribe", new_callable=AsyncMock) as mock_stt:
        mock_stt.return_value = {"text": "", "language": "en", "provider": "mock", "latency_ms": 0, "fallback": False}

        with test_client.websocket_connect("/ws/session") as websocket:
            websocket.send_bytes(b"fake_audio")
            response = websocket.receive_json()

            assert response["type"] == "error"
            assert "Empty transcript" in response["message"]


def test_websocket_full_pipeline(test_client):
    """Full pipeline returns all expected events."""
    with patch("app.api.routes.ws.transcribe", new_callable=AsyncMock) as mock_stt, \
         patch("app.api.routes.ws.reconstruct", new_callable=AsyncMock) as mock_recon, \
         patch("app.api.routes.ws.get_variants", new_callable=AsyncMock) as mock_variants:

        mock_stt.return_value = {
            "text": "test transcript",
            "language": "en",
            "provider": "mock",
            "latency_ms": 100,
            "fallback": False
        }
        mock_recon.return_value = {
            "corrected": "test corrected",
            "original_intent": "test",
            "main_error": None,
            "error_type": "none",
            "explanation": None
        }
        mock_variants.return_value = {
            "simple": "simple",
            "professional": "professional",
            "colloquial": "colloquial",
            "slang": "slang",
            "idiom": "idiom"
        }

        with test_client.websocket_connect("/ws/session") as websocket:
            websocket.send_bytes(b"fake_audio")

            events = []
            for _ in range(3):  # Expect 3 events
                events.append(websocket.receive_json())

            event_types = {e["type"] for e in events}
            assert "stt_result" in event_types
            assert "reconstruction_result" in event_types
            assert "variants_result" in event_types
```

**backend/tests/test_orchestrator.py:**

```python
import pytest
from unittest.mock import patch, AsyncMock
from app.agents.orchestrator import run_pipeline, PipelineResult


@pytest.mark.asyncio
async def test_run_pipeline_success():
    """Orchestrator returns PipelineResult on success."""
    with patch("app.agents.orchestrator.transcribe", new_callable=AsyncMock) as mock_stt, \
         patch("app.agents.orchestrator.reconstruct", new_callable=AsyncMock) as mock_recon, \
         patch("app.agents.orchestrator.get_variants", new_callable=AsyncMock) as mock_variants:

        mock_stt.return_value = {
            "text": "Hello world",
            "language": "en",
            "provider": "deepgram",
            "latency_ms": 500,
            "fallback": False
        }
        mock_recon.return_value = {
            "corrected": "Hello, world!",
            "original_intent": "greeting",
            "main_error": None,
            "error_type": "none",
            "explanation": None
        }
        mock_variants.return_value = {
            "simple": "Hi!",
            "professional": "Good day.",
            "colloquial": "Hey there!",
            "slang": "Yo!",
            "idiom": "Hello and welcome!"
        }

        result = await run_pipeline(b"audio", "test.webm")

        assert isinstance(result, PipelineResult)
        assert result.transcript == "Hello world"
        assert result.corrected == "Hello, world!"
        assert result.simple == "Hi!"
        assert result.total_latency_ms > 0


@pytest.mark.asyncio
async def test_run_pipeline_empty_transcript():
    """Orchestrator raises ValueError on empty transcript."""
    with patch("app.agents.orchestrator.transcribe", new_callable=AsyncMock) as mock_stt:
        mock_stt.return_value = {"text": "  ", "language": "en", "provider": "mock", "latency_ms": 0, "fallback": False}

        with pytest.raises(ValueError, match="Empty transcript"):
            await run_pipeline(b"audio")


@pytest.mark.asyncio
async def test_run_pipeline_llm_failure_graceful():
    """Orchestrator degrades gracefully on LLM failure."""
    with patch("app.agents.orchestrator.transcribe", new_callable=AsyncMock) as mock_stt, \
         patch("app.agents.orchestrator.reconstruct", new_callable=AsyncMock) as mock_recon, \
         patch("app.agents.orchestrator.get_variants", new_callable=AsyncMock) as mock_variants:

        mock_stt.return_value = {
            "text": "test",
            "language": "en",
            "provider": "deepgram",
            "latency_ms": 100,
            "fallback": False
        }
        mock_recon.side_effect = Exception("LLM timeout")
        mock_variants.side_effect = Exception("LLM timeout")

        result = await run_pipeline(b"audio")

        # Should degrade to raw transcript
        assert result.corrected == "test"
        assert result.simple == "test"
```

## Dependencies

### Existing (no changes needed)
- fastapi==0.115.0 — WebSocket support built-in
- websockets==13.0 — already in requirements
- starlette — comes with fastapi

### New imports used
- `starlette.websockets.WebSocketState` — for connection state check
- `dataclasses.dataclass` — for PipelineResult

## Error Handling Strategy

| Error | Handling | User sees |
|-------|----------|-----------|
| Deepgram 429/500 | Auto-fallback to Groq (in stt.py) | stt_result with fallback=true |
| Groq STT failure | Return error event | error: "STT failed: ..." |
| Empty transcript | Return error event | error: "Empty transcript" |
| Reconstruction LLM failure | Degrade to raw transcript | reconstruction_result with corrected=transcript |
| PhraseVariants LLM failure | Degrade to raw transcript in all variants | variants_result with all fields=transcript |
| WebSocket disconnect | Catch exception, clean exit | (connection closed) |
| Unexpected exception | Log, send error event, continue | error: "Server error: ..." |

## Test Strategy

### Unit Tests
1. `test_orchestrator.py` — тесты run_pipeline с моками агентов
2. `test_ws_session.py` — тесты WebSocket endpoint с TestClient

### Integration Tests (manual, with real audio)
1. Файл `tests/fixtures/test_mixed_ru_en.webm` — записанная смешанная фраза
2. Запустить `make dev-api`, подключиться через `websocat`:
   ```bash
   cat tests/fixtures/test_mixed_ru_en.webm | websocat ws://localhost:8001/ws/session
   ```

### Latency Test
1. Измерить общее время от отправки аудио до получения последнего события
2. Цель: < 3.5 секунд

## Risk Flags

1. **WebSocket + Uvicorn workers**: при масштабировании на несколько workers, WebSocket сессии не shared. Для Phase 1 (single worker) это OK.

2. **Memory usage**: каждый WebSocket держит соединение. При 100+ concurrent connections возможны проблемы на 4GB VPS. Мониторить через structlog.

3. **Deepgram timeout**: httpx.AsyncClient timeout=15.0 в stt.py. Если Deepgram отвечает > 15s, fallback на Groq. Это OK.

4. **LiteLLM rate limits**: Groq free tier — 30 RPM. При активном использовании возможны 429. Phase 2: добавить retry с exponential backoff.

## Out of Scope

- Companion Agent response (Phase 1.5)
- TTS streaming (Phase 1.5)
- Memory Agent writes (Phase 1.5)
- User authentication (отдельная задача)
- Rate limiting на WebSocket (отдельная задача)
- Streaming transcription (real-time VAD) — Phase 2

## File Summary

| File | Action | Lines (approx) |
|------|--------|----------------|
| `backend/app/api/__init__.py` | CREATE | 2 |
| `backend/app/api/routes/__init__.py` | CREATE | 2 |
| `backend/app/api/routes/ws.py` | CREATE | 80 |
| `backend/app/agents/orchestrator.py` | REWRITE | 100 |
| `backend/app/main.py` | MODIFY | +3 lines |
| `backend/tests/__init__.py` | CREATE | 0 |
| `backend/tests/conftest.py` | CREATE | 20 |
| `backend/tests/test_ws_session.py` | CREATE | 70 |
| `backend/tests/test_orchestrator.py` | CREATE | 70 |

Total: ~350 lines new code, 3 lines modified.

## Execution Order

1. Step 1-2: Create api package structure
2. Step 3: Create ws.py with WebSocket endpoint
3. Step 4: Implement orchestrator.py
4. Step 5: Modify main.py to include router
5. Step 6: Create tests
6. Run `make test-api` to verify
7. Manual test with websocat or browser
