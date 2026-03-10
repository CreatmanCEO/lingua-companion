# LinguaCompanion — Стартовый промпт для Claude Code

Используй этот промпт при каждом новом старте Claude Code в репозитории.

---

## ПРОМПТ

```
Ты работаешь над проектом LinguaCompanion AI.

Начни с чтения CLAUDE.md — там всё что тебе нужно знать о проекте.
Затем прочитай docs/AI_PIPELINE.md — там спека всего AI пайплайна включая
результаты spike-тестов и почему Deepgram является primary STT.

После того как прочитал — коротко подтверди:
1. Кто primary STT и почему (одно предложение)
2. Какие агенты работают параллельно и зачем
3. Как переключить LLM провайдера без изменения кода

Затем скажи что готов к задаче и жди инструкций.

Не начинай писать код до получения задачи.
```

---

## Первая задача после старта

После того как Claude Code подтвердил понимание архитектуры, 
можно давать первую реальную задачу. Рекомендованный порядок:

### Шаг 1 — FastAPI WebSocket endpoint
```
Задача: реализовать WebSocket endpoint /ws/session в backend/app/api/routes/

Используй planner агента для создания плана.
Endpoint должен:
- принимать binary audio chunks от клиента
- передавать в STT Agent (backend/app/agents/stt.py — уже написан)
- возвращать JSON stream: { type: "transcript" | "correction" | "variants" | "response" }
- обрабатывать disconnect gracefully

После плана — жди подтверждения перед кодом.
```

### Шаг 2 — Reconstruction + Phrase Variants параллельно
```
Задача: в orchestrator.py реализовать параллельный запуск
reconstruction и phrase_variants через asyncio.gather()
после получения transcript от STT Agent.
```

### Шаг 3 — Next.js voice UI
```
Задача: создать компонент apps/web/src/components/chat/VoiceRecorder.tsx
Использует MediaRecorder API, отправляет audio chunks через WebSocket.
Показывает: кнопка записи → waveform → транскрипт → correction + 5 вариантов.
```

---

## Правила для сессий Claude Code

1. **Начало сессии**: всегда стартовый промпт выше
2. **При смене задачи**: /clear (не /compact)
3. **При 60-70% контекста**: /compact — Claude Code сам напишет саммари
4. **Коммиты**: после каждой завершённой фичи, через code-reviewer агента
5. **Тесты**: обязательно после каждого изменения (`make test`)

## Чего НЕ делать

- Не давай Claude Code несколько несвязанных задач одновременно
- Не проси переписывать рабочий код "чтобы было лучше"
- Не игнорируй когда Claude Code говорит "нужен план"
- Не пропускай тесты "сейчас некогда"
