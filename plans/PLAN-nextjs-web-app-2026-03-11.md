# Plan: Next.js 15 Web App (apps/web/)

Дата: 2026-03-11
Статус: DRAFT

## Цель

Создать Next.js 15 приложение с VoiceRecorder компонентом и WebSocket клиентом для /ws/session. Реализовать дизайн-систему "Engineering Dark" согласно docs/DESIGN_JOURNEY.md.

## Текущее состояние

### Что есть

- **Backend WebSocket API** готов: backend/app/api/routes/ws.py
  - Endpoint: /ws/session
  - Принимает: binary audio (webm/opus, m4a, mp3, wav)
  - Отдаёт JSON events: stt_result, reconstruction_result, variants_result, error
  - Защита от DoS: MAX_AUDIO_SIZE = 1MB
  
- **Agents реализованы:**
  - stt.py - Deepgram primary + Groq fallback
  - reconstruction.py - LLM grammar correction
  - phrase_variants.py - 5 stylistic variants
  
- **Monorepo структура:**
  - package.json с workspaces: apps/*, packages/*
  - turbo.json настроен
  - pnpm 9.0.0 + Node 20+

- **Дизайн-спецификация:**
  - docs/DESIGN_JOURNEY.md - полная спецификация
  - 4 состояния VoiceBar: text mode, voice mode, recording, processing
  - 5 variant стилей с цветами
  - CSS variables для dark/light themes

### Чего НЕТ (нужно создать)

- Директория apps/web/ - не инициализирована
- Директория packages/ - не инициализирована
- pnpm-workspace.yaml - отсутствует

## Шаги реализации

### Шаг 1: Инициализация pnpm workspace

**Файл:** C:\lingua-companion\pnpm-workspace.yaml

**Содержимое:**
```yaml
packages:
  - "apps/*"
  - "packages/*"
```

---

### Шаг 2: Инициализация Next.js 15 приложения

**Директория:** C:\lingua-companion\apps\web\

**Команда:**
```bash
cd C:\lingua-companion
pnpm create next-app@latest apps/web --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --no-turbopack
```

**Ручная конфигурация после создания:**
1. apps/web/package.json - изменить name на @lingua/web
2. apps/web/next.config.ts - настроить output: standalone
3. apps/web/.env.local.example с NEXT_PUBLIC_API_URL и NEXT_PUBLIC_WS_URL

---

### Шаг 3: Установка зависимостей

**Команды:**
```bash
cd C:\lingua-companion\apps\web
pnpm add clsx tailwind-merge class-variance-authority lucide-react zustand
pnpm add -D vitest @testing-library/react @vitejs/plugin-react jsdom
```

---

### Шаг 4: Настройка shadcn/ui

**Команды:**
```bash
cd C:\lingua-companion\apps\web
pnpm dlx shadcn@latest init
pnpm dlx shadcn@latest add button card toast sheet tabs scroll-area
```

---

### Шаг 5: Дизайн-система "Engineering Dark"

**Файлы:**

1. **apps/web/src/styles/tokens.css** - CSS variables из DESIGN_JOURNEY.md п.10:

Dark theme (default):
- --bg-void: #0C0C14
- --bg-surface: #12121F
- --bg-card: #1A1A2E
- --bg-elevated: #212135
- --bg-border: #2E2E4A
- --text-primary: #EEEEF5
- --text-secondary: #8080A8
- --text-muted: #46466A
- --accent: #5E5CE6
- --accent-soft: #5E5CE620
- --accent-hover: #7B7AFF
- --recording: #FF3B30
- --success: #32D74B
- --warning: #FF9F0A

5 variant colors:
- --c-simple: #32D74B (green)
- --c-professional: #0A84FF (blue)
- --c-colloquial: #FF9F0A (orange)
- --c-slang: #FF375F (pink-red)
- --c-idiom: #BF5AF2 (purple)

Light theme (.light class):
- --bg-void: #F5F5FA
- --bg-surface: #FFFFFF
- --bg-card: #F0F0F8
- --text-primary: #1C1C2E
- --accent: #4A48D4

2. **apps/web/tailwind.config.ts** - extend colors из CSS variables

3. **apps/web/src/lib/fonts.ts** - Geist fonts from Vercel

---

### Шаг 6: WebSocket клиент (hook)

**Файл:** apps/web/src/hooks/useVoiceSession.ts

**API:**
- isConnected: boolean
- isProcessing: boolean
- connect(): void
- disconnect(): void
- sendAudio(audioBlob: Blob): void

**Callbacks:**
- onSttResult(result: SttResult)
- onReconstructionResult(result: ReconstructionResult)
- onVariantsResult(result: VariantsResult)
- onError(error: string)

**Логика:**
- WebSocket to NEXT_PUBLIC_WS_URL/ws/session
- Reconnect on disconnect (max 3 attempts, exponential backoff)
- State: idle | connecting | connected | processing
- Binary send: ws.send(audioBlob)
- JSON parse incoming messages by type field

---

### Шаг 7: Audio Recording hook

**Файл:** apps/web/src/hooks/useAudioRecorder.ts

**API:**
- isRecording: boolean
- startRecording(): Promise<void>
- stopRecording(): Promise<Blob | null>
- cancelRecording(): void
- audioLevel: number (0-1 for visualization)

**Логика:**
- MediaRecorder API
- Format: audio/webm;codecs=opus (Chrome/Firefox), audio/mp4 (Safari fallback)
- AudioContext для уровня громкости (визуализация волны)
- Cleanup on unmount

---

### Шаг 8: Store (Zustand)

**Файл:** apps/web/src/store/chatStore.ts

**State:**
- messages: Message[]
- currentTranscript: string | null
- reconstruction: ReconstructionResult | null
- variants: VariantsResult | null
- isAnalysing: boolean

**Actions:**
- addMessage(msg: Message)
- setTranscript(text: string)
- setReconstruction(r: ReconstructionResult)
- setVariants(v: VariantsResult)
- clearAnalysis()

---

### Шаг 9: VoiceBar компонент

**Файл:** apps/web/src/components/VoiceBar.tsx

**4 состояния (из DESIGN_JOURNEY.md п.9):**

1. IDLE text mode:
   [Mic icon] [Text input...] [Send button]

2. IDLE voice mode:
   [Keyboard icon]  (large HOLD TO SPEAK button)

3. RECORDING (hold active):
   [red dot] 00:04 [waveform bars] [Cancel button]
   Кнопка пульсирует красным кольцом (CSS animation)

4. PROCESSING (после release):
   [spinner] Processing... [progress bar] ~2.1s

**Props:**
- mode: "text" | "voice"
- onModeChange(mode): void
- onSendText(text: string): void
- onSendAudio(blob: Blob): void
- isProcessing: boolean

**Критично:**
- Hold-to-record через onPointerDown / onPointerUp
- touch-action: none на кнопке (предотвращает scroll)
- Cancel через свайп влево или tap на cancel button

---

### Шаг 10: Message Bubbles

**Файлы:**
- apps/web/src/components/UserBubble.tsx
- apps/web/src/components/CompanionBubble.tsx

**UserBubble (voice message):**
- Waveform visualization (animated bars)
- Duration display (0:04)
- [Transcribe] button - показывает текст под волной
- [Analyse] button - триггерит ReconstructionBlock + VariantCards

**UserBubble (text message):**
- Text content
- [Analyse] button

**CompanionBubble:**
- Avatar 40px (круглый, placeholder SVG silhouette)
- Name (Alex / Sam / Morgan)
- Text content
- [Listen] button (TTS playback)

---

### Шаг 11: ReconstructionBlock

**Файл:** apps/web/src/components/ReconstructionBlock.tsx

**Layout (git-diff style):**

Header: lightbulb icon + "Reconstruction"

Section 1 - "You said:"
Original text in muted color

Section 2 - "More natural:"
Corrected text in primary color

Section 3 - "Note:" (если explanation \!= null)
Explanation text на русском языке

**Props:**
- original: string
- corrected: string
- explanation: string | null
- errorType: "grammar" | "vocabulary" | "code_switching" | "none"

---

### Шаг 12: VariantCards (horizontal scroll)

**Файл:** apps/web/src/components/VariantCards.tsx

**5 карточек с цветовой индикацией:**
1. Simple (green #32D74B) - "Basic, clear English"
2. Professional (blue #0A84FF) - "Formal, workplace-appropriate"
3. Colloquial (orange #FF9F0A) - "Natural native speaker tone"
4. Slang (pink-red #FF375F) - "Informal, contemporary"
5. Idiom (purple #BF5AF2) - "With English idiom"

**Каждая карточка содержит:**
- Color dot indicator
- Style name
- Phrase text
- Subtitle "When to use:" + description
- [Play] button (TTS)
- [+ Save] / [Saved] button

**CSS критично (из DESIGN_JOURNEY.md п.16):**
- Outer wrapper: margin: 0 -16px; overflow: hidden;
- Scroll container: padding: 4px 16px; overflow-x: auto; -webkit-overflow-scrolling: touch;
- Cards: flex-shrink: 0; width: 200px; gap: 12px;
- Drag-to-scroll на desktop через mousedown/mousemove

---

### Шаг 13: Chat Layout (страница)

**Файл:** apps/web/src/app/page.tsx

**Layout (mobile-first, 375px base):**

Header (sticky top, 48px):
- [hamburger menu]
- "LinguaCompanion" logo
- [theme toggle sun/moon]

Tab bar (под header):
- [Free Chat] [Scenario] tabs

Chat scroll area (flex-grow):
- Companion avatar + status indicator
- Message bubbles (companion left, user right)
- ReconstructionBlock (после [Analyse])
- VariantCards scroll (после [Analyse])

VoiceBar (sticky bottom, 72px):
- Input mode toggle
- Record button / text input

**Компоненты layout:**
- src/components/layout/Header.tsx
- src/components/layout/ChatArea.tsx
- src/components/layout/TabBar.tsx

---

### Шаг 14: TTS (Text-to-Speech)

**Файл:** apps/web/src/lib/tts.ts

**Функции:**
- speak(text: string, options?: TtsOptions): void
- stopSpeaking(): void
- getVoices(): SpeechSynthesisVoice[]
- isSpeaking(): boolean

**TtsOptions:**
- voice?: SpeechSynthesisVoice
- rate?: number (0.5 - 1.5, default 1.0)
- pitch?: number (0.5 - 2.0, default 1.0)

**Phase 1 реализация:**
- window.speechSynthesis (бесплатно, встроен в браузер)
- Voice selection: US/GB x Male/Female
- Fallback на первый доступный en-US голос

---

### Шаг 15: Theme Toggle

**Файл:** apps/web/src/components/ThemeToggle.tsx

**Логика:**
- localStorage key: "theme" = "light" | "dark"
- При mount: читаем localStorage, если нет - prefers-color-scheme
- Toggle добавляет/убирает .light класс на document.documentElement
- CSS transition 200ms на всех color variables
- Icon: Sun (light) / Moon (dark) из lucide-react

---

### Шаг 16: Types (shared package)

**Директория:** packages/types/

**Файлы:**
- packages/types/package.json (name: @lingua/types)
- packages/types/tsconfig.json
- packages/types/src/index.ts (re-exports)
- packages/types/src/api.ts (WebSocket event types)

**Types из backend/app/api/routes/ws.py:**

SttResult:
- text: string
- language: string
- provider: "deepgram" | "groq"
- latency_ms: number
- fallback: boolean

ReconstructionResult:
- corrected: string
- original_intent: string
- main_error: string | null
- error_type: "grammar" | "vocabulary" | "code_switching" | "none"
- explanation: string | null

VariantsResult:
- simple: string
- professional: string
- colloquial: string
- slang: string
- idiom: string

WebSocketEvent:
- type: "stt_result" | "reconstruction_result" | "variants_result" | "error"
- ...payload fields

---

### Шаг 17: Vitest конфигурация

**Файлы:**
- apps/web/vitest.config.ts
- apps/web/vitest.setup.ts

**vitest.config.ts:**
- plugins: [react()]
- test.environment: jsdom
- test.setupFiles: ./vitest.setup.ts
- test.globals: true

**vitest.setup.ts:**
- import @testing-library/jest-dom
- Mock для window.speechSynthesis
- Mock для MediaRecorder
- Mock для WebSocket

---

### Шаг 18: Unit тесты

**Файлы:**
- apps/web/src/hooks/__tests__/useAudioRecorder.test.ts
- apps/web/src/hooks/__tests__/useVoiceSession.test.ts
- apps/web/src/components/__tests__/VoiceBar.test.tsx
- apps/web/src/components/__tests__/VariantCards.test.tsx
- apps/web/src/components/__tests__/ReconstructionBlock.test.tsx

**Покрытие:**
- VoiceBar: все 4 состояния, mode toggle, pointer events
- useAudioRecorder: start/stop/cancel, cleanup
- useVoiceSession: connect/disconnect/sendAudio, event parsing
- VariantCards: render 5 cards, horizontal scroll, save action
- ReconstructionBlock: render with/without explanation

---

### Шаг 19: Docker конфигурация

**Файл:** apps/web/Dockerfile

Multi-stage build:
1. Builder stage: node:20-alpine, pnpm install, pnpm build
2. Runner stage: node:20-alpine, copy .next/standalone + static + public
3. EXPOSE 3000, CMD ["node", "server.js"]

**Требует:** next.config.ts с output: "standalone"

---

### Шаг 20: Makefile updates

**Файл:** C:\lingua-companion\Makefile

**Добавить targets:**
- dev-web: cd apps/web && pnpm dev
- test-web: cd apps/web && pnpm test
- build-web: cd apps/web && pnpm build
- lint-web: cd apps/web && pnpm lint

---

## Стратегия тестирования

1. **Unit тесты (Vitest):**
   - Hooks: useAudioRecorder, useVoiceSession
   - Components: VoiceBar, VariantCards, ReconstructionBlock
   - Utils: tts.ts, theme toggle

2. **Integration тесты:**
   - WebSocket mock для useVoiceSession (полный flow)
   - MediaRecorder mock для useAudioRecorder

3. **Manual тесты:**
   - Chrome DevTools: MediaRecorder permissions, WebSocket messages
   - Mobile: iOS Safari, Android Chrome
   - Theme toggle: dark/light persistence

## Зависимости между шагами

```
Шаг 1 (pnpm workspace)
   |
Шаг 2 (Next.js init)
   |
Шаг 3 (dependencies) --> Шаг 4 (shadcn/ui)
   |
Шаг 5 (design tokens)
   |
Шаги 6-8 (hooks + store) -- параллельно
   |
Шаги 9-12 (components) -- последовательно
   |
Шаг 13 (page layout)
   |
Шаги 14-15 (TTS + Theme)
   |
Шаги 16-18 (types + tests)
   |
Шаги 19-20 (Docker + Makefile)
```

## Риски

1. **MediaRecorder browser support:**
   - Safari iOS требует audio/mp4, не поддерживает webm
   - Решение: feature detection + fallback format selection

2. **WebSocket reconnection:**
   - Потеря соединения при смене сети (WiFi -> 4G)
   - Решение: exponential backoff (1s, 2s, 4s), max 3 retries, user notification

3. **Audio format compatibility:**
   - Backend STT ожидает определённые форматы
   - Решение: webm/opus primary (Chrome), mp4 fallback (Safari)

4. **CSS horizontal scroll на iOS:**
   - Safari имеет проблемы с overflow-x + touch
   - Решение: -webkit-overflow-scrolling: touch на scroll container

5. **TTS голоса отличаются:**
   - Разные браузеры = разные доступные голоса
   - Решение: fallback на первый доступный en-US/en-GB голос

6. **Hold-to-record UX:**
   - Случайный scroll вместо hold
   - Решение: touch-action: none, pointer-events handling

## Вне скоупа

- Onboarding flow (3 свайпа) - отдельная задача
- Scenario tab content - отдельная задача  
- Session Summary sheet - отдельная задача
- Phrase Library экран - отдельная задача
- Auth (NextAuth.js) - отдельная задача
- Companion avatars generation - отдельная задача
- Rich Link Card для новостей - отдельная задача
- Push notifications - Phase 2
- PWA manifest - Phase 2

## Файловая структура результата

```
C:\lingua-companion\
  pnpm-workspace.yaml          <-- NEW
  Makefile                     <-- UPDATE
  
  apps/web/                    <-- NEW DIRECTORY
    Dockerfile
    next.config.ts
    package.json
    tailwind.config.ts
    tsconfig.json
    vitest.config.ts
    vitest.setup.ts
    .env.local.example
    public/
      fonts/
    src/
      app/
        layout.tsx
        page.tsx
        globals.css
      components/
        ui/                    (shadcn)
        layout/
          Header.tsx
          ChatArea.tsx
          TabBar.tsx
        VoiceBar.tsx
        UserBubble.tsx
        CompanionBubble.tsx
        ReconstructionBlock.tsx
        VariantCards.tsx
        ThemeToggle.tsx
        __tests__/
      hooks/
        useAudioRecorder.ts
        useVoiceSession.ts
        __tests__/
      store/
        chatStore.ts
      lib/
        tts.ts
        fonts.ts
        utils.ts
      styles/
        tokens.css

  packages/types/              <-- NEW DIRECTORY
    package.json
    tsconfig.json
    src/
      index.ts
      api.ts
```

## Оценка времени

| Шаги | Описание | Время |
|------|----------|-------|
| 1-4 | pnpm workspace + Next.js init + deps + shadcn | 30 min |
| 5 | Design tokens (CSS variables + Tailwind config) | 20 min |
| 6-8 | Hooks (WebSocket, AudioRecorder) + Store | 45 min |
| 9-12 | Core components (VoiceBar, Bubbles, Cards) | 90 min |
| 13-15 | Page layout + TTS + Theme | 30 min |
| 16-18 | Shared types + Vitest setup + Tests | 45 min |
| 19-20 | Docker + Makefile | 15 min |
| **ИТОГО** | | **~4.5 часа** |

## Checklist перед началом

- [ ] Убедиться что pnpm 9.0.0+ установлен: `pnpm --version`
- [ ] Убедиться что Node 20+ установлен: `node --version`
- [ ] Сделать git checkpoint: `git add -A && git commit -m "checkpoint: before nextjs-web-app"`
- [ ] Backend запущен на localhost:8001 для интеграционного тестирования

