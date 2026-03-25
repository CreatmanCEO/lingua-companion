# Plan: Code Review Fixes -- Frontend apps/web/

Дата: 2026-03-25
Статус: DRAFT

## Цель

Устранить 3 критических бага, 8 предупреждений и 8 улучшений, найденных при code review фронтенда.

## Текущее состояние

Фронтенд функционирует в demo-режиме. WebSocket подключение, чат, голосовой ввод, reconstruction + variants -- все работает. Тесты: 5 файлов в apps/web/src/*/__tests__/.

---

## CRITICAL

### C1. XSS через dangerouslySetInnerHTML в ReconstructionBlock

**Файл:** apps/web/src/components/ReconstructionBlock.tsx, строка 126
**Проблема:** Функция formatExplanation (строка 136) делает regex replace: текст в guillemet-кавычках оборачивается в HTML-тег strong, результат вставляется через dangerouslySetInnerHTML. Данные explanation приходят от backend (LLM-ответ). Если LLM вернет строку со script-тегом или img onerror -- XSS.

**Вариант A (рекомендуемый):** Заменить на React-компоненты. formatExplanation возвращает ReactNode[] вместо строки:
- Разбить текст по regex через String.split() с capturing group
- Каждый фрагмент в guillemet-кавычках обернуть в React.createElement("strong"), остальные -- текстом
- Убрать dangerouslySetInnerHTML, использовать {formatExplanation(explanation)}

**Вариант B:** Санитизировать через DOMPurify. Добавить dompurify в зависимости.

**Усилия:** small (вариант A -- 15 строк кода)
**Риск если не исправить:** HIGH -- XSS-атака через prompt injection в LLM

---

### C2. Race condition: pendingResultsRef не сбрасывается при reconnect

**Файл:** apps/web/src/hooks/useVoiceSession.ts
**Проблема:** При reconnect (ws.onopen, строка 145) сбрасывается только reconnectAttemptsRef. Старые pendingResultsRef могут привести к некорректному state.

**Решение:** Добавить сброс pendingResultsRef в:
1. ws.onopen handler (после строки 148)
2. connectInternal перед созданием нового WebSocket (после строки 138)

**Усилия:** trivial (2 строки)
**Риск если не исправить:** HIGH

---

### C3. Нет таймаута на processing state

**Файл:** apps/web/src/hooks/useVoiceSession.ts
**Проблема:** Если backend не отвечает, state остается processing навсегда.

**Решение:** Добавить processingTimeoutRef:
1. В sendAudio -- setTimeout 15000ms
2. В callback -- сброс state + onError
3. В onmessage -- clearTimeout
4. В cleanup useEffect -- clearTimeout

**Усилия:** small (15-20 строк)
**Риск если не исправить:** HIGH -- мертвый UI

---

## WARNING

### W1. Неограниченный рост messages[] + Blob в памяти

**Файл:** apps/web/src/store/chatStore.ts
**Решение:** MAX_MESSAGES = 100, slice при превышении, обнулять audioBlob на удаляемых.
**Усилия:** small | **Риск:** medium

### W2. Blob в store -- не сериализуется

**Файл:** apps/web/src/store/chatStore.ts, Message строка 83
**Решение:** Хранить аудио отдельно в Map<messageId, Blob>.
**Усилия:** medium | **Риск:** medium

### W3. 190 строк demo-логики в page.tsx

**Файл:** apps/web/src/app/page.tsx, строки 299-492
**Решение:** Вынести в apps/web/src/lib/demo.ts.
**Усилия:** small | **Риск:** low

### W4. TTS не отменяется при unmount

**Файлы:** CompanionBubble.tsx, VariantCards.tsx
**Решение:** useEffect cleanup: window.speechSynthesis.cancel()
**Усилия:** trivial | **Риск:** medium

### W5. handleTranscribe/handleAnalyse зависят от messages

**Файл:** apps/web/src/app/page.tsx, строки 176-211
**Решение:** useChatStore.getState().messages.find() вместо messages.find()
**Усилия:** trivial | **Риск:** low

### W6. Дублирование ActionPill

**Файлы:** CompanionBubble.tsx (42-67), UserBubble.tsx (49-77)
**Решение:** Создать apps/web/src/components/ui/ActionPill.tsx
**Усилия:** small | **Риск:** low

### W7. eslint-disable без пояснения

**Файл:** page.tsx, строки 93, 109
**Решение:** Добавить комментарии-пояснения.
**Усилия:** trivial | **Риск:** low

### W8. onPointerLeave слишком агрессивна

**Файл:** VoiceBar.tsx, строки 132-136
**Решение:** Порог расстояния ~80px или debounce 300ms.
**Усилия:** small | **Риск:** medium

---

## SUGGESTION

### S1. Rich card хардкод в CompanionBubble
CompanionBubble.tsx строка 205. Добавить richCard? в Message.
**Усилия:** small | **Риск:** low

### S2. Неиспользуемый lib/tts.ts
180 строк не импортируются. Рефакторить компоненты на @/lib/tts. Решит W4.
**Усилия:** small | **Риск:** low

### S3. a11y -- отсутствуют aria-labels
VoiceBar, CompanionBubble, UserBubble, VariantCards. Добавить aria-label.
**Усилия:** trivial | **Риск:** low

### S4. viewport запрещает zoom
layout.tsx строки 15-16. Убрать maximumScale/userScalable. CSS touch-action: manipulation.
**Усилия:** trivial | **Риск:** low

### S5. CSS selector * -- осторожность
globals.css строки 92-93. Добавить комментарий-предупреждение.
**Усилия:** trivial | **Риск:** low

### S6. Тесты WS handling
useVoiceSession.test.ts. Добавить тесты onmessage, reconnect, timeout с mock WS.
**Усилия:** medium | **Риск:** medium

### S7. Нет Error Boundary
Создать apps/web/src/app/error.tsx (Next.js 15).
**Усилия:** small | **Риск:** medium

### S8. Date в store
chatStore.ts строка 85. timestamp: number вместо Date. Форматировать при рендере.
**Усилия:** small | **Риск:** low

---

## Порядок реализации

| # | ID | Описание | Усилия | Зависимости |
|---|-----|----------|--------|-------------|
| 1 | C1 | XSS fix | small | нет |
| 2 | C2 | pendingResultsRef reset | trivial | нет |
| 3 | C3 | processing timeout | small | нет |
| 4 | W4 | TTS cleanup | trivial | нет |
| 5 | W7 | eslint комментарии | trivial | нет |
| 6 | S4 | viewport zoom | trivial | нет |
| 7 | S3 | aria-labels | trivial | нет |
| 8 | W5 | getState() замена | trivial | нет |
| 9 | W6 | ActionPill extraction | small | нет |
| 10 | W3 | demo.ts extraction | small | нет |
| 11 | S2 | tts.ts integration | small | W4 |
| 12 | W8 | pointer threshold | small | нет |
| 13 | W1 | message limit | small | нет |
| 14 | S1 | richCard в Message | small | нет |
| 15 | S8 | timestamp number | small | нет |
| 16 | W2 | Blob extraction | medium | W1 |
| 17 | S7 | Error Boundary | small | нет |
| 18 | S6 | WS тесты | medium | C2, C3 |
| 19 | S5 | комментарий CSS | trivial | нет |

## Стратегия тестирования

- После C1: обновить ReconstructionBlock.test.tsx -- тест с XSS payload
- После C2+C3: добавить тесты в useVoiceSession.test.ts -- reconnect + timeout
- После W6: добавить ActionPill.test.tsx
- S6 -- полноценные WS тесты (отдельная задача)

## Риски

1. C1 вариант A может сломать верстку -- нужен визуальный тест
2. W2 (Blob extraction) -- наибольший scope
3. S8 (Date -> number) -- может сломать существующие тесты

## Вне скоупа

- Замена window.speechSynthesis на Google Neural2 TTS (Phase 2)
- Persist middleware для Zustand (отдельная задача)
- Backend-side sanitization (отдельная задача)
- Performance profiling (React DevTools)
