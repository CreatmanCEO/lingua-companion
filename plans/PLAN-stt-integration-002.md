# Plan: STT Integration Review (Task 2)

Date: 2026-03-11
Status: ANALYSIS COMPLETE - NO CHANGES REQUIRED

## Goal

Проверить, нужно ли заменять mock STT на реальный Deepgram Nova-3 в orchestrator.py.

## Analysis Summary

**ВЫВОД: Задача 2 уже выполнена. STT Agent полностью реализован с Deepgram primary + Groq fallback. Orchestrator использует реальный STT.**

## Current State

### 1. STT Agent (`backend/app/agents/stt.py`) — FULLY IMPLEMENTED

Файл содержит полноценную production-ready реализацию:

```python
# Primary: Deepgram Nova-3
async def transcribe_deepgram(audio_bytes: bytes, mime_type: str = "audio/mp4") -> dict:
    url = (
        "https://api.deepgram.com/v1/listen"
        "?model=nova-3"
        "&language=multi"      # <-- code-switching support
        "&smart_format=true"
        "&punctuate=true"
    )
    # ... httpx POST с Authorization: Token {DEEPGRAM_API_KEY}
```

```python
# Fallback: Groq Whisper
async def transcribe_groq(audio_bytes: bytes, filename: str = "audio.m4a") -> dict:
    result = await _get_groq().audio.transcriptions.create(
        file=(filename, audio_bytes),
        model=settings.WHISPER_MODEL,  # whisper-large-v3-turbo
        language=None,  # auto-detect
    )
```

```python
# Orchestrated transcribe with auto-fallback
async def transcribe(audio_bytes: bytes, filename: str = "audio.m4a") -> dict:
    provider = getattr(settings, "STT_PROVIDER", "deepgram")

    if provider == "deepgram" and settings.DEEPGRAM_API_KEY:
        try:
            result = await transcribe_deepgram(audio_bytes, mime)
            result["fallback"] = False
            return result
        except Exception as e:
            print(f"[STT] Deepgram failed ({e}), falling back to Groq...")

    # Groq fallback
    result = await transcribe_groq(audio_bytes, filename)
    result["fallback"] = provider == "deepgram"
    return result
```

### 2. Orchestrator (`backend/app/agents/orchestrator.py`) — USES REAL STT

```python
from app.agents.stt import transcribe  # <-- реальный импорт, НЕ mock

async def run_pipeline(audio_bytes: bytes, filename: str = "audio.webm") -> PipelineResult:
    stt_result = await transcribe(audio_bytes, filename)  # <-- вызов реального STT
    # ...
```

### 3. WebSocket endpoint (`backend/app/api/routes/ws.py`) — USES REAL STT

```python
from app.agents.stt import transcribe  # <-- реальный импорт

@router.websocket("/ws/session")
async def websocket_session(websocket: WebSocket):
    # ...
    stt_result = await transcribe(audio_bytes, "audio.bin")  # <-- вызов реального STT
```

### 4. Config (`backend/app/core/config.py`) — CONFIGURED

```python
DEEPGRAM_API_KEY: Optional[str] = None
STT_PROVIDER: str = "deepgram"  # deepgram | groq
WHISPER_MODEL: str = "whisper-large-v3-turbo"
GROQ_API_KEY: Optional[str] = None
```

### 5. Tests — MOCK STT FOR ISOLATION

Тесты используют `unittest.mock.patch` для изоляции:

```python
# test_orchestrator.py
with patch("app.agents.orchestrator.transcribe", new_callable=AsyncMock) as mock_stt:
    mock_stt.return_value = {"text": "Hello world", ...}
```

```python
# test_ws_session.py
with patch("app.api.routes.ws.transcribe", new_callable=AsyncMock) as mock_stt:
    mock_stt.return_value = {"text": "test transcript", ...}
```

Это правильный подход: unit-тесты изолируют внешние зависимости, integration-тесты используют реальные сервисы.

## Evidence from Documentation

### CLAUDE.md подтверждает:
```
### Done
- STT agent (stt.py) — fully implemented with Deepgram primary + Groq fallback
```

### AI_PIPELINE.md подтверждает:
```
| Deepgram | Nova-3, language=multi | 2.56s | 6/6 | PRIMARY STT |
| Groq | Whisper large-v3-turbo | 0.67s | 3/6 | FALLBACK STT |
```

### PLAN-ws-session-001.md подтверждает:
```
| `backend/app/agents/stt.py` | READY | `transcribe(audio_bytes, filename)` -> dict |
```

## Feature Verification Checklist

| Requirement | Status | Evidence |
|-------------|--------|----------|
| Deepgram Nova-3 primary | DONE | `stt.py` line 30: `model=nova-3` |
| language=multi для code-switching | DONE | `stt.py` line 32: `language=multi` |
| Groq Whisper fallback | DONE | `stt.py` line 72-93: `transcribe_groq()` |
| Auto-fallback on Deepgram failure | DONE | `stt.py` line 117-127: try/except с fallback |
| Fallback flag in response | DONE | `stt.py` line 123, 130: `fallback: bool` |
| Orchestrator uses real STT | DONE | `orchestrator.py` line 16: import, line 60: call |
| WebSocket uses real STT | DONE | `ws.py` line 9: import, line 60: call |
| Settings for API keys | DONE | `config.py` lines 21-22 |

## Required Changes

**NONE**

Задача 2 полностью выполнена. STT интеграция готова к production использованию.

## Recommendations (Not Required, Future Improvements)

### 1. Integration Test with Real Audio

Добавить integration test с реальным аудиофайлом (можно skip в CI):

```python
# tests/test_stt_integration.py
@pytest.mark.integration
@pytest.mark.skipif(not os.getenv("DEEPGRAM_API_KEY"), reason="No API key")
async def test_real_deepgram_transcription():
    audio = Path("tests/fixtures/test_mixed_ru_en.webm").read_bytes()
    result = await transcribe(audio, "test.webm")
    assert result["text"]
    assert result["provider"] == "deepgram"
```

### 2. Structured Logging

Заменить `print()` на structlog для production monitoring:

```python
# Current (stt.py line 126)
print(f"[STT] Deepgram failed ({e}), falling back to Groq...")

# Better
logger.warning("deepgram_failed", error=str(e), fallback="groq")
```

### 3. Retry with Backoff for Transient Errors

Добавить retry для 429/5xx ошибок перед fallback:

```python
from tenacity import retry, stop_after_attempt, wait_exponential

@retry(stop=stop_after_attempt(2), wait=wait_exponential(min=0.5, max=2))
async def transcribe_deepgram(audio_bytes: bytes, mime_type: str) -> dict:
    # ...
```

## Test Strategy (For Verification)

Для подтверждения работоспособности текущей реализации:

```bash
# 1. Запустить unit тесты
cd C:\lingua-companion\backend
python -m pytest tests/test_orchestrator.py -v

# 2. Запустить WebSocket тесты
python -m pytest tests/test_ws_session.py -v

# 3. Manual test с реальным аудио (требует API keys в .env)
# Запустить сервер: make dev-api
# Тест через websocat: cat audio.webm | websocat ws://localhost:8001/ws/session
```

## Risk Flags

**NONE** — код уже в production-ready состоянии.

## Out of Scope

- Streaming transcription (VAD + partial results) — Phase 2
- Custom vocabulary/keywords для Deepgram — не требуется
- Azure Speech SDK integration — Phase 2 (pronunciation)

## Conclusion

Задача 2 "Replace mock STT with real Deepgram Nova-3" **уже выполнена**.

Файлы содержат полную production-ready реализацию:
- `backend/app/agents/stt.py` — Deepgram primary + Groq fallback
- `backend/app/agents/orchestrator.py` — использует реальный STT
- `backend/app/api/routes/ws.py` — использует реальный STT

Рекомендация: закрыть задачу и перейти к следующей.
