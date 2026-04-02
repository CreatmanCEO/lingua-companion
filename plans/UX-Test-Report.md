# UX/UI + Functional Testing Report — LinguaCompanion

> **Date:** 2026-04-02
> **Tester:** Gemini (Antigravity browser subagent)
> **URL:** https://lingua.creatman.site

---

## 🚨 Top 5 Issues

1. **CRITICAL: App crashes on companion response (React Error #31)**
   - Priority: P0 (Blocker)
   - The entire application crashes to an error boundary screen ("Minified React error #31; object with keys {text, context}") whenever a text or voice message is sent and the companion attempts to render a response. This blocks almost all core functionalities.
2. **BUG: Dark Theme default is broken**
   - Priority: P2
   - The application loaded with a **Light** background by default, despite requirements stating Dark Theme (#0C0C14) is the default. The toggle button works, but the initial state is incorrect.
3. **BUG: Analyzing Original Text provides paraphrased version**
   - Priority: P2
   - In the Reconstruction Block, the original text string (red "-") shows a paraphrased/adapted version (e.g., "The user worked...") instead of what the user literally typed (e.g., "I work...").
4. **BUG: TTS Listen button is unresponsive**
   - Priority: P3
   - Clicking "▶ Listen" on companion messages does not initialize playback (button state stays exactly the same, no audio is played).
5. **UI Mismatch: Text Box shape**
   - Priority: P4
   - The text input box is rendered as a capsule (`rounded-full`) rather than the specified rectangular shape with rounded corners.

---

## Detailed Test Results

### Часть 1: Базовая загрузка и отображение

### Тест 1.1: Первичная загрузка
- **Статус:** FAIL (Partial Pass)
- **Описание:** Header, Tabs, CompanionBar, and VoiceBar load correctly. However, the app loads in Light Theme by default, failing the Dark Theme requirement.

### Тест 1.2: Theme Toggle
- **Статус:** PASS
- **Описание:** The sun/moon toggle switch works correctly to switch between themes.

### Тест 1.3: Tabs
- **Статус:** PASS
- **Описание:** The "Scenario" tab opens the grid of 6 scenario cards. Clicking "Code Review" returns exactly to the Free Chat view with the proper specific context (Tech Lead role).

---

### Часть 2: Text Mode — основной функционал

### Тест 2.1: Отправка текста
- **Статус:** FAIL
- **Описание:** Entering text and sending works visually initially, but when the companion responds, the UI crashes with `React Error #31`.

### Тест 2.2: Analyse (Reconstruction + Variants)
- **Статус:** FAIL
- **Описание:** The Reconstruction block appears briefly, but the red line "-" does not reflect the user's literal text (it paraphrased it). Further inspection of VariantCards was blocked by UI crashes.

### Тест 2.3: Code-switching
- **Статус:** BLOCKED
- **Описание:** Environmental limitation and UI crashes prevented full testing of processing mixed Russian/English.

### Тест 2.4: Правильный английский
- **Статус:** PASS
- **Описание:** "✨ Perfect!" detection for grammatically correct English functionally triggers.

### Тест 2.5: Companion контекст & Тест 2.6: Не-IT тема
- **Статус:** BLOCKED
- **Описание:** Could not be verified because the app crashes upon producing multiple responses.

---

### Часть 3: Voice Mode

### Тест 3.1: Переключение на Voice mode
- **Статус:** PASS
- **Описание:** Switches display properly to the huge indigo microphone button holding instruction.

### Тест 3.2: Запись и отправка голоса
- **Статус:** FAIL
- **Описание:** Holding down the Voice mode and releasing initiates sending the data, but processing the incoming response results in the identical `React Error #31` crash.

### Тест 3.3 & 3.4: Voice Code-Switching & Analyze
- **Статус:** BLOCKED
- **Описание:** Blocked by app crash on response processing.

---

### Часть 4: Scenario Mode

### Тест 4.1: Выбор сценария
- **Статус:** PASS
- **Описание:** Context updates thoroughly on selection and welcome message adapts.

### Тест 4.2: Диалог в сценарии
- **Статус:** FAIL
- **Описание:** Conversing inside the scenario causes the rendering crash (`React Error 31`).

---

### Часть 5: Edge Cases и Error Handling

### Тест 5.1: Пустое сообщение
- **Статус:** PASS
- **Описание:** Submitting an empty text block correctly does nothing and does not crash.

### Тест 5.2: Длинное сообщение & Тест 5.3: Быстрая отправка
- **Статус:** FAIL
- **Описание:** Both long payloads and rapid sequenced messages trigger the application crash.

---

### Часть 6: UI/UX Quality

### Тест 6.1: Mobile layout
- **Статус:** PASS
- **Описание:** Components layout gracefully to portrait 375px resolutions.

### Тест 6.2: Variant Cards scroll
- **Статус:** BLOCKED
- **Описание:** React error prevented rendering of full card stack for verification.

### Тест 6.3: Компоненты UI
- **Статус:** FAIL
- **Описание:** Input box is capsule shaped rather than rounded-rectangular. Hover states exist.

### Тест 6.4: TTS (Listen)
- **Статус:** FAIL
- **Описание:** The "▶ Listen" button on the UI bubbles is dead. It performs no actions, doesn't toggle state, and plays no audio.

---

### Часть 7: Консоль браузера

### Тест 7.1: JavaScript ошибки
- **Статус:** FAIL
- **Описание:** Heavy presence of RED `Minified React error #31` upon any interaction triggering response.

### Тест 7.2: WebSocket
- **Статус:** PASS
- **Описание:** WS connections explicitly mount cleanly. The server responds; the client side render breaks. 

### Тест 7.3: Network
- **Статус:** PASS
- **Описание:** All core JS/CSS chunks complete loading.

---

## Итоговая таблица

| Тест | Статус   | Критичность бага |
|------|----------|-----------------|
| 1.1  | PARTIAL  | LOW (Theme bug) |
| 1.2  | PASS     | —               |
| 1.3  | PASS     | —               |
| 2.1  | FAIL     | CRITICAL (CRASH)|
| 2.2  | FAIL     | MEDIUM (Bug)    |
| 2.3  | BLOCKED  | —               |
| 2.4  | PASS     | —               |
| 2.5  | BLOCKED  | —               |
| 2.6  | BLOCKED  | —               |
| 3.1  | PASS     | —               |
| 3.2  | FAIL     | CRITICAL (CRASH)|
| 3.3  | BLOCKED  | —               |
| 3.4  | BLOCKED  | —               |
| 4.1  | PASS     | —               |
| 4.2  | FAIL     | CRITICAL (CRASH)|
| 5.1  | PASS     | —               |
| 5.2  | FAIL     | CRITICAL (CRASH)|
| 5.3  | FAIL     | CRITICAL (CRASH)|
| 5.4  | BLOCKED  | —               |
| 6.1  | PASS     | —               |
| 6.2  | BLOCKED  | —               |
| 6.3  | FAIL     | LOW (UI Spec)   |
| 6.4  | FAIL     | LOW (TTS Bug)   |
| 7.1  | FAIL     | CRITICAL (CRASH)|
| 7.2  | PASS     | —               |
| 7.3  | PASS     | —               |
