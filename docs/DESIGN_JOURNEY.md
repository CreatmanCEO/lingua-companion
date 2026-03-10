# LinguaCompanion — Design Journey Map

> Единственный источник истины по дизайну. Читать целиком перед любой работой с UI.
> Версия: v2.0 | Дата: 2026-03-11

---

## 1. Конкурентный анализ: Gliglish

Единственный достойный конкурент с похожей идеей.

**Что у них хорошо:**
- Ноль friction при входе — нет регистрации, сразу говоришь
- Аватары создают ощущение живого собеседника
- Режимы Teacher / Role-play — понятное разделение
- Транскрипт диалога прямо в интерфейсе
- Регулируемая скорость речи

**Их слабости = наши преимущества:**

| Слабость Gliglish | Наш ответ |
|---|---|
| Не понимает RU/EN code-switching | Deepgram Nova-3 — 6/6 на смешанной речи ✅ |
| Один "правильный" ответ после фразы | 5 вариантов по стилю параллельно |
| Нет IT-контекста (ресторан, аэропорт) | Топики из Perplexity News + HN, IT-словарь |
| Поверхностный feedback ("ты ошибся") | Reconstruction: git-diff подача — "вот как лучше" |
| Нет памяти между сессиями | pgvector RAG — помнит прогресс, слабые места |
| Только сценарии, нет свободного чата | **Два полноценных режима: Scenario + Free Chat** |
| Нет toggle voice↔text | Quick toggle в каждой реплике |
| Companion не инициирует | Companion пишет первым, делится новостями |
| Без rich-контента | Карточки новостей с превью прямо в чате |

**Вывод:** Gliglish — для всех. Мы — инструмент разработчика.
Как Warp vs обычный Terminal. Нишево, но точно в цель.

---

## 2. Целевой пользователь

**Никита, 28 лет, Backend-разработчик, Москва**
- Читает английскую документацию без словаря
- В Zoom "замерзает" — знает слова, но не говорит
- В Slack пишет по-английски, но звучит как Google Translate
- Инструменты: VS Code, Telegram, Linear, GitHub
- Телефон использует больше ноутбука в течение дня
- Хочет говорить **как коллега**, а не как учебник

---

## 3. Два режима приложения

Два полноценных таба, не переключатель внутри одного экрана.

### Таб A: Scenario (структурированный)
Companion играет роль в конкретном сценарии. Пользователь знает контекст.

Сценарии Phase 1:
- Daily Stand-up
- Code Review с тимлидом
- Tech Demo для клиента
- Job Interview — System Design
- Retro / Planning meeting
- Slack message — написать по-человечески

### Таб B: Free Chat (свободный)
Симуляция живого общения. Нет сценария — как переписка с умным другом-носителем.

Ключевые UX-решения Free Chat:
- Пользователь выбирает: отвечать **голосом** или **текстом** — toggle в шапке
- На каждом голосовом сообщении пользователя: кнопка **[📝 Transcribe]**
- На каждом сообщении companion: кнопка **[▶ Listen]** (TTS)
- **Companion сам инициирует** — пишет первым, делится новостью, задаёт вопрос
- Новости от companion: **rich link card** с превью (заголовок, описание, favicon, фото)
- Reconstruction и Variants — **по запросу** (кнопка "Analyse" под своей репликой)

---

## 4. Companion — личность, аватар, голос

### Три companion на выбор (онбординг + настройки)

| # | Имя | Стиль | Характер | Голос (Web Speech API) |
|---|---|---|---|---|
| 1 | **Alex** | Professional | Чёткий, деловой, по делу. "That's a valid point, but consider..." | en-US Male (Google US English) |
| 2 | **Sam** | Casual | Дружелюбный, с юмором. "Ha, I've been there 😄 Try saying it like this..." | en-GB Male (Google UK English) |
| 3 | **Morgan** | Mentor | Терпеливый, объясняет почему. "Great try! Here's the reason natives say it differently..." | en-US Female (Google US English) |

### Аватар
- Реалистичные фото, сгенерированные через библиотеки (Stable Diffusion / Midjourney API)
- **Не 3D, не мультяшные** — как фото реального человека в Telegram
- Размеры: 40px круглый в чате, 80px в настройках, 120px в Companion Picker
- Нейтральный фон, естественное освещение, дружелюбное выражение лица

### Промпты для генерации аватаров

```
Alex (Professional Male):
"Portrait photo of a 32-year-old man, professional look, 
slight smile, clean-shaven, dark hair, casual business attire, 
neutral light gray background, natural studio lighting, 
photorealistic, high quality, 512x512"

Sam (Casual, Gender-neutral):
"Portrait photo of a 26-year-old person, friendly casual look, 
warm smile, colorful casual clothing, modern style, 
soft gradient background, natural lighting, 
photorealistic, approachable, 512x512"

Morgan (Mentor Female):
"Portrait photo of a 38-year-old woman, wise and warm expression, 
natural makeup, professional casual attire, 
soft neutral background, confident posture, 
photorealistic, high quality, 512x512"
```

### Выбор голоса
В онбординге (шаг 3) и в Settings → Companion:
```
[Мужской] [Женский]
[🇺🇸 American] [🇬🇧 British]
```
4 варианта = 4 комбинации. Применяется через Web Speech API `SpeechSynthesisVoice`.
В Settings можно прослушать preview — кнопка [▶ Test voice].

---

## 5. TTS — архитектура

### Phase 1: Бесплатно + дёшево

```
По умолчанию: Web Speech API (window.speechSynthesis)
  ├── Встроен в Chrome, Safari, Firefox, Edge
  ├── Стоимость: $0
  ├── Скорость: настраивается 0.5x – 1.5x
  └── Голоса: системные (en-US, en-GB, male/female)

Premium (по флагу USE_GOOGLE_TTS=true):
  └── Google Neural2: ~$4 / 1M символов
      Использовать только для платных пользователей Phase 2
```

### Реализация на фронте

```typescript
// Вызывается при нажатии [▶ Listen] на сообщении companion
const speak = (text: string, voice: SpeechSynthesisVoice) => {
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.voice = voice;
  utterance.rate = userSettings.ttsSpeed; // 0.5 – 1.5
  window.speechSynthesis.speak(utterance);
};
```

### Env var (уже есть в стеке)
`GOOGLE_TTS_API_KEY` — подключается по флагу `TTS_PROVIDER=google|browser`

---

## 6. News Feed — Companion инициирует разговор

### Источник: Perplexity News API + RSS fallback

Companion сам пишет пользователю — как коллега скидывает ссылку в Telegram.

```
Companion: "Hey! Saw this and thought of you 👇"
[Rich Link Card]
```

### Rich Link Card — компонент

```
┌────────────────────────────────────────┐
│ [favicon] techcrunch.com               │
│                                        │
│ [превью фото — если есть]              │
│                                        │
│ **Rust overtakes Go in backend...**    │
│ Netflix's infrastructure team shares   │
│ how they migrated 40 services to Rust  │
│ with zero downtime. Key insights:...   │
│                                        │
│ [Read article ↗]          2 min read  │
└────────────────────────────────────────┘
```

Данные карточки:
- `url` — оригинальная ссылка
- `title` — заголовок
- `description` — 2–3 предложения
- `image` — og:image (опционально)
- `favicon` — через Google Favicon API
- `source` — домен источника
- `read_time` — расчётное время чтения

### Откуда берутся новости

**Приоритет 1: Perplexity News** (через Celery task каждые 4h)
```
Запрос: "Latest news about [user's tech stack] in English, past 24h"
Персонализация: зависит от профиля пользователя (Backend/Frontend/DevOps)
```

**Приоритет 2: RSS фолбэк** (если Perplexity недоступен)
```python
IT_RSS_FEEDS = [
    "https://hnrss.org/frontpage",          # Hacker News
    "https://feeds.feedburner.com/ThePragEngineer",
    "https://github.blog/feed/",
    "https://devblogs.microsoft.com/feed/",
]
```

**Логика подачи:**
- 1–2 новости в день (не спамить)
- Companion подаёт через 5–10 минут после начала сессии
- Всегда заканчивает вопросом: "What do you think about this?"
- Это запускает естественный разговор на актуальную тему

### Celery Task (backend)

```python
# backend/app/agents/topic_discovery.py
@celery.task
def fetch_daily_topics(user_id: str):
    """Fetch personalized IT news every 4 hours via Perplexity + RSS fallback"""
    profile = get_user_profile(user_id)
    topics = perplexity_search(profile.tech_stack, limit=3)
    if not topics:
        topics = rss_fallback(IT_RSS_FEEDS, limit=3)
    store_topics(user_id, topics)
```

---

## 7. User Journey Map

### Сценарий A: Первое открытие (мобильный)

```
Никита слышит от коллеги → открывает lingua.creatman.site на телефоне
     │
     ▼ ЭКРАН 1: Landing
     "Talk English like a pro developer"
     [Continue with Google]
     Время на экране: < 5 сек
     │
     ▼ ЭКРАН 2: Onboarding (3 свайпа)
     Свайп 1: Уровень [A2] [B1] [B2] [C1]
     Свайп 2: Сфера [Backend] [Frontend] [DevOps] [Product]
     Свайп 3: Выбери companion → 3 аватара + имя + preview голоса
     Эмоция: "быстро, не грузят"
     │
     ▼ ЭКРАН 3: Free Chat — первый раз
     Hint overlay: "Hold mic to speak · Tap to type"
     Companion пишет первым: "Hey Nikita! Ready to practice? 
     What did you work on today?" + [▶ Listen]
     Эмоция: "это как Telegram, только умнее"
     │
     ▼ Никита говорит (RU/EN mix):
     "I работал сегодня над нашим deployment pipeline"
     │
     ▼ < 3.5 сек — ответ:
     Транскрипт его слов (в bubble)
     Companion отвечает текстом + [▶ Listen]
     Кнопка [Analyse] под его репликой (не навязывать)
     │
     ▼ Он нажимает [Analyse]:
     Reconstruction diff появляется
     5 карточек вариантов (horizontal scroll)
     Эмоция: "О. Оно реально работает"
```

### Сценарий B: Утренняя сессия (Free Chat, неделя 2)

```
До stand-up, 5 минут, телефон в руке
     │
     ▼ Companion уже написал (push notification):
     "Morning! Here's something for you 👇"
     [Rich Link Card: "GitHub Copilot now supports Rust refactoring"]
     "What do you think? Are you using Copilot at work?"
     │
     ▼ Toggle: [🎤 Voice] — держит кнопку
     Говорит по-русски с английскими словами
     │
     ▼ Companion отвечает, разговор идёт
     Несколько реплик → живое общение
     Эмоция: как переписка с умным коллегой из Лондона
```

### Сценарий C: Подготовка к demo (Scenario таб)

```
Завтра demo для иностранного клиента
     │
     ▼ Scenario → "Tech Demo"
     Companion: Alex (Professional)
     Играет роль скептичного PM
     │
     ▼ Role-play: Никита презентует фичу
     Получает objection handling фразы
     После реплик нажимает [Analyse] выборочно
     │
     ▼ Session Summary:
     Сохраняет 3 фразы в "Pre-demo phrases"
```

---

## 8. Инвентарь всех экранов и компонентов

### Основные экраны (Phase 1)

| # | Экран | Описание |
|---|---|---|
| 1 | **Landing / Auth** | Лаконичный hero + Google OAuth |
| 2 | **Onboarding Wizard** | 3 свайпа: уровень → сфера → companion |
| 3 | **Free Chat** | Основной экран, таб A |
| 4 | **Scenario** | Выбор сценария + сессия, таб B |
| 5 | **Session End Summary** | Итоги сессии |
| 6 | **Phrase Library** | Сохранённые фразы + поиск |
| 7 | **Stats / Progress** | Аналитика: fluency, vocab, speed |
| 8 | **Settings** | Companion, голос, тема, уровень |

### Компоненты чата

**Сообщение пользователя — voice:**
```
┌────────────────────────────────┐
│  ▁▂▄▇▅▂▁  0:04                │
│  [📝 Transcribe]  [Analyse]   │
└────────────────────────────────┘
После Transcribe: текст разворачивается под волной
После Analyse: Reconstruction block + Variant Cards
```

**Сообщение пользователя — text:**
```
┌────────────────────────────────┐
│  I worked on deployment today  │
│                   [Analyse]   │
└────────────────────────────────┘
```

**Сообщение companion:**
```
┌──────────────────────────────────────┐
│ [аватар 40px]  Alex                  │
│                                      │
│ That sounds challenging! Did you     │
│ manage to fix the pipeline issue?    │
│                                      │
│ [▶ Listen]                          │
└──────────────────────────────────────┘
```

**Сообщение companion с Rich Link Card:**
```
┌──────────────────────────────────────┐
│ [аватар]  Alex                       │
│                                      │
│ Hey, saw this and thought of you 👇  │
│                                      │
│ ┌──────────────────────────────────┐ │
│ │ [G] github.blog                  │ │
│ │ [превью фото]                    │ │
│ │ **Copilot gets Rust support**    │ │
│ │ The new refactoring tools...     │ │
│ │ [Read ↗]          · 3 min read  │ │
│ └──────────────────────────────────┘ │
│                                      │
│ What do you think? Using it at work? │
│ [▶ Listen]                          │
└──────────────────────────────────────┘
```

**Reconstruction Block (после [Analyse]):**
```
┌──────────────────────────────────────┐
│ 💡 Reconstruction                    │
│                                      │
│ You said:                            │
│ "I работал над deployment pipeline"  │
│                                      │
│ More natural:                        │
│ "I've been working on our           │
│  deployment pipeline"               │
│                                      │
│ Note: present perfect sounds more    │
│ natural for ongoing work (RU: работал│
│ над чем-то = have been working)      │
└──────────────────────────────────────┘
```

**Variant Cards (horizontal scroll, 5 карточек):**
```
[🟢 Simple] [🔵 Pro] [🟡 Casual] [🔴 Slang] [🟣 Idiom]
   →  →  →  (horizontal scroll)

Каждая карточка:
┌────────────────────────┐
│ 🔵 Professional        │
│                        │
│ "I've been optimizing  │
│  our CI/CD pipeline"   │
│                        │
│ [▶] [💾 Save]          │
└────────────────────────┘
```

### Bottom Sheets / Popups

| Компонент | Триггер | Содержимое |
|---|---|---|
| **Topic Picker Sheet** | Tap на заголовке сценария | Список тем, персонализированные через Perplexity |
| **Variant Detail Sheet** | Tap на карточке варианта | Фраза, объяснение стиля (на русском), [▶ Listen] + [💾 Save] |
| **Grammar Tooltip** | Tap на подсвеченном слове в Reconstruction | Краткое правило на русском, 2–3 строки |
| **Companion Picker Sheet** | Settings → Change companion | 3 аватара, имя, стиль, [▶ Test voice] |
| **Voice Settings Sheet** | Settings → Voice | Выбор акцента (US/GB × Male/Female), скорость |
| **Session Pause Menu** | Свайп вниз или кнопка ··· | Continue / End session / Save all phrases |
| **Phrase Save Toast** | Tap [💾 Save] на варианте | "Saved to Library · View →" |
| **Session Summary Sheet** | Конец сессии или End | Stats card + топ-фразы + рекомендация на завтра |
| **Onboarding Hint Overlay** | Первый вход | Полупрозрачный, tap anywhere to dismiss |
| **News Article Viewer** | Tap [Read ↗] на Rich Card | In-app webview или открыть в браузере |

---

## 9. Voice Input Bar — механика

Самый важный компонент. Три состояния:

```
IDLE — text mode:
┌──────────────────────────────────────┐
│ [🎤]  Type a message...    [voice ↑] │
└──────────────────────────────────────┘

IDLE — voice mode:
┌──────────────────────────────────────┐
│ [⌨️ text]    ●  HOLD TO SPEAK        │
│               (большая кнопка)       │
└──────────────────────────────────────┘

RECORDING (hold active):
┌──────────────────────────────────────┐
│  ● 00:04  ▁▂▄▇▅▃▁▂▄▇  [← cancel]   │
│  (кнопка пульсирует красным кольцом) │
└──────────────────────────────────────┘

PROCESSING (после release):
┌──────────────────────────────────────┐
│  ◌  Processing...                    │
│  ░░░░░░░░░░░░░░░░  ~2.1s            │
└──────────────────────────────────────┘
```

---

## 10. Дизайн-система: "Engineering Dark"

### Тёмная тема (основная)

```css
/* Фоны — синевато-чёрные, не просто серые */
--bg-void:        #0C0C14;   /* основной фон */
--bg-surface:     #12121F;   /* панели, header */
--bg-card:        #1A1A2E;   /* карточки, bubbles */
--bg-elevated:    #212135;   /* hover, active */
--bg-border:      #2E2E4A;   /* разделители */

/* Текст */
--text-primary:   #EEEEF5;   /* основной */
--text-secondary: #8080A8;   /* метки, timestamp */
--text-muted:     #46466A;   /* placeholder */

/* Единственный акцент */
--accent:         #5E5CE6;   /* индиго */
--accent-soft:    #5E5CE620; /* фоны акцентных элементов */
--accent-hover:   #7B7AFF;   /* hover */

/* Состояния */
--recording:      #FF3B30;   /* красная точка записи */
--success:        #32D74B;
--warning:        #FF9F0A;

/* Цвета 5 вариантов фраз */
--c-simple:       #32D74B;   /* зелёный */
--c-professional: #0A84FF;   /* синий */
--c-colloquial:   #FF9F0A;   /* оранжевый */
--c-slang:        #FF375F;   /* розово-красный */
--c-idiom:        #BF5AF2;   /* фиолетовый */
```

### Светлая тема (toggle ☀️/🌙)

```css
/* Молочно-тёплая, не слепит — как Linear Light */
--bg-void:        #F5F5FA;
--bg-surface:     #FFFFFF;
--bg-card:        #F0F0F8;
--bg-elevated:    #E8E8F5;
--bg-border:      #D8D8E8;

--text-primary:   #1C1C2E;   /* тёмно-синий, не чёрный */
--text-secondary: #606080;
--text-muted:     #A0A0C0;

--accent:         #4A48D4;   /* чуть темнее для контраста */
--accent-soft:    #4A48D415;
--accent-hover:   #6361EE;

/* Состояния — те же цвета */
/* Варианты фраз — те же цвета */
```

Переключатель: иконка ☀️/🌙 в правом верхнем углу.
Сохраняется: `localStorage.setItem('theme', 'light'|'dark')`.
Переключение мгновенное через CSS-переменные на `:root`.

### Типографика

```css
/* Шрифты */
--font-ui:    'Geist', sans-serif;        /* весь UI */
--font-mono:  'Geist Mono', monospace;    /* транскрипты, diff */

/* Подключение: https://vercel.com/font (бесплатно) */

/* Размеры */
--text-xs:    11px;   /* timestamp, метки */
--text-sm:    13px;   /* secondary text, кнопки */
--text-base:  15px;   /* сообщения, основной текст */
--text-lg:    18px;   /* имя companion, заголовки блоков */
--text-xl:    22px;   /* заголовки экранов */
```

### Радиусы и стиль

```css
--radius-sm:      6px;    /* кнопки, инпуты */
--radius-md:      8px;    /* карточки вариантов */
--radius-lg:      12px;   /* bottom sheets, панели */
--radius-bubble:  18px;   /* chat bubbles */
--radius-full:    50%;    /* кнопка микрофона, аватар */

/* Тени: только в light mode */
--shadow-card: 0 1px 3px rgba(0,0,0,0.08), 0 4px 12px rgba(0,0,0,0.04);
/* В dark mode: тени заменяются border через --bg-border */
```

---

## 11. Mobile-First Layout

**Основной**: 375px (iPhone 14 mini). **Десктоп**: адаптируется.

```
МОБИЛЬНЫЙ (375px):

┌────────────────────────┐  ← 375px
│ [≡] LinguaCompanion ☀️│  ← header 48px, sticky
│ [Free Chat] [Scenario] │  ← tab bar под header
├────────────────────────┤
│                        │
│  [аватар] Alex 🟢      │  ← companion status
│                        │
│ ┌──────────────────┐   │
│ │ companion bubble │   │
│ │ [▶ Listen]       │   │
│ └──────────────────┘   │
│                        │  ← chat scroll area
│   ┌────────────────┐   │
│   │ Rich Link Card │   │
│   │ [превью]       │   │
│   │ [Read ↗]       │   │
│   └────────────────┘   │
│                        │
│   ┌──────────────┐     │
│   │ user bubble  │     │
│   │ [Analyse]    │     │
│   └──────────────┘     │
│                        │
│ ┌──────────────────────┐│  ← Reconstruction
│ │ 💡 was → better      ││     (after Analyse)
│ └──────────────────────┘│
│                        │
│ [🟢][🔵][🟡][🔴][🟣] →│  ← Variant Cards scroll
│                        │
├────────────────────────┤
│  [⌨️]  (● HOLD MIC)    │  ← Voice Bar 72px, sticky
└────────────────────────┘

ДЕСКТОП (1280px+):

┌──────────┬─────────────────────────┐
│ Sidebar  │  Chat (как мобильный,   │
│ 240px    │  но шире)               │
│          │                         │
│ Sessions │                         │
│ ──────   │                         │
│ Stats    │                         │
│ ──────   │                         │
│ Library  │                         │
└──────────┴─────────────────────────┘
```

---

## 12. Tech Stack — обновления

| Изменение | Детали |
|---|---|
| **TTS Phase 1** | `window.speechSynthesis` (бесплатно) → Google Neural2 (по флагу) |
| **TTS голос** | 4 варианта: US/GB × Male/Female, выбор в онбординге и settings |
| **Free Chat mode** | Новый WebSocket endpoint `/ws/free-chat` |
| **Companion-initiated messages** | Celery task → хранит топики → companion пишет первым |
| **Rich Link Card** | Компонент на фронте: OpenGraph парсинг на бэке, кеш в Redis |
| **News source** | Perplexity News API + RSS fallback (HN, GitHub Blog) |
| **Theme toggle** | CSS переменные + localStorage, без перезагрузки |
| **PWA** | `manifest.json`, `viewport meta`, iOS splash screen — mobile webapp |
| **Companion avatars** | Генерация через SD/Midjourney с промптами выше, хранение в S3/Supabase Storage |

### Новые env vars

```
TTS_PROVIDER=browser              # browser | google
PERPLEXITY_API_KEY=               # для news feed
NEWS_FETCH_INTERVAL_HOURS=4       # как часто обновлять
COMPANION_INITIATE_DELAY_MIN=5    # через сколько минут companion пишет первым
```

---

## 13. Анимации и микровзаимодействия

**Критичные (реализовать в Phase 1):**
- Кнопка mic: пульсирует красным кольцом при записи (CSS keyframes)
- Аудиоволна при записи: анимированные bars (CSS, не canvas)
- Processing: skeleton loader или progress bar с плавным заполнением
- Variant Cards: slide-in снизу при появлении (staggered delay)
- Theme toggle: плавный переход 200ms (CSS transition на variables)
- Chat bubble: fade-in + slide-up при появлении нового сообщения

**Вторичные (Phase 2):**
- Companion "печатает": animated dots перед ответом
- Rich Card: parallax при scroll
- Session Summary: числа считаются анимированно

---

## 14. Доступность (a11y)

- `prefers-color-scheme` — автоматический выбор темы при первом входе
- Все интерактивные элементы: min 44×44px touch target
- Кнопка микрофона: min 64×64px (главный action)
- ARIA labels на всех icon-only кнопках
- `prefers-reduced-motion` — отключает анимации для чувствительных пользователей

---

## 15. Что НЕ делаем (явные запреты)

- ❌ Gamification: streak, XP, badges, leaderboards — это не Duolingo
- ❌ Фиолетовые AI-градиенты на тёмном фоне — банально
- ❌ 3D аватары — тяжело, выглядит дёшево
- ❌ Красный цвет для ошибок — не критикуем, а улучшаем
- ❌ Обязательный tutorial при входе — только hint overlay
- ❌ Десктоп-first layout — мобильный всегда приоритет
- ❌ Автоматический Reconstruction после каждой реплики — только по [Analyse]
- ❌ Автоматические Variant Cards в Free Chat — только по запросу

