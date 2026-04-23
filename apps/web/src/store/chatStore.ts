"use client";

import { create } from "zustand";
import type { SttResult, ReconstructionResult, VariantsResult } from "@/hooks/useVoiceSession";

/**
 * Тип отправителя сообщения
 */
export type MessageSender = "user" | "companion";

/**
 * Тип контента сообщения
 */
export type MessageContentType = "text" | "voice";

/**
 * Интерфейс контекста сценария
 */
export interface ScenarioContext {
  id: string;
  name: string;
  description: string;
  companionRole: string;  // "скептичный PM", "tech lead", etc.
  userRole: string;       // "developer presenting feature", etc.
}

/**
 * Данные сценариев
 */
export const SCENARIO_CONTEXTS: Record<string, ScenarioContext> = {
  "daily-standup": {
    id: "daily-standup",
    name: "Daily Stand-up",
    description: "What did you do, what's blocked?",
    companionRole: "Scrum Master running the daily meeting",
    userRole: "Developer giving status update",
  },
  "code-review": {
    id: "code-review",
    name: "Code Review",
    description: "Discuss PRs with your tech lead",
    companionRole: "Tech Lead reviewing your pull request",
    userRole: "Developer defending code decisions",
  },
  "tech-demo": {
    id: "tech-demo",
    name: "Tech Demo",
    description: "Present a feature to stakeholders",
    companionRole: "Skeptical PM or stakeholder asking tough questions",
    userRole: "Developer presenting new feature",
  },
  "job-interview": {
    id: "job-interview",
    name: "Job Interview",
    description: "System design + behavioural",
    companionRole: "Senior engineer conducting technical interview",
    userRole: "Candidate answering system design questions",
  },
  "sprint-planning": {
    id: "sprint-planning",
    name: "Sprint Planning",
    description: "Estimate, discuss scope & blockers",
    companionRole: "Product Owner prioritizing backlog",
    userRole: "Developer estimating and discussing tasks",
  },
  "slack-message": {
    id: "slack-message",
    name: "Write a Slack Message",
    description: "Sound natural, not like Google Translate",
    companionRole: "Native English-speaking colleague",
    userRole: "Non-native developer writing async messages",
  },
};

/**
 * Интерфейс сообщения в чате
 */
export interface Message {
  id: string;
  sender: MessageSender;
  contentType: MessageContentType;
  text: string;
  audioBlob?: Blob; // Для voice сообщений
  audioDuration?: number; // Длительность аудио в секундах
  timestamp: number; // Unix ms — сериализуемый формат
  // Результаты анализа (заполняются по запросу)
  sttResult?: SttResult;
  reconstruction?: ReconstructionResult;
  variants?: VariantsResult;
  // Флаги состояния
  isTranscribed?: boolean;
  isAnalysed?: boolean;
}

/**
 * Имена доступных companions
 */
export type CompanionName = "Alex" | "Sam" | "Morgan";

/**
 * Интерфейс companion
 */
export interface Companion {
  name: CompanionName;
  style: "professional" | "casual" | "mentor";
  description: string;
}

/**
 * Доступные companions
 */
export const COMPANIONS: Record<CompanionName, Companion> = {
  Alex: {
    name: "Alex",
    style: "professional",
    description: "Clear, business-like, to the point",
  },
  Sam: {
    name: "Sam",
    style: "casual",
    description: "Friendly, with humor",
  },
  Morgan: {
    name: "Morgan",
    style: "mentor",
    description: "Patient, explains why",
  },
};

/**
 * Состояние чата
 */
interface ChatState {
  // Сообщения
  messages: Message[];

  // Per-message processing tracker (replaces global isAnalysing)
  processingMessageId: string | null;

  // Cached translations (message ID -> translated text)
  translatedTexts: Record<string, string>;

  // Companion
  activeCompanion: CompanionName;

  // Input mode
  inputMode: "text" | "voice";

  // Streaming
  streamingCompanionText: string;

  // Scenario
  activeScenario: ScenarioContext | null;

  // Actions
  addMessage: (message: Omit<Message, "id" | "timestamp">) => string;
  updateMessage: (id: string, updates: Partial<Message>) => void;
  setProcessingMessageId: (id: string | null) => void;
  setTranslation: (id: string, text: string) => void;
  setActiveCompanion: (name: CompanionName) => void;
  setInputMode: (mode: "text" | "voice") => void;
  appendStreamingText: (delta: string) => void;
  clearStreamingText: () => void;
  clearMessages: () => void;
  startScenario: (scenarioId: string) => void;
  endScenario: () => void;
  loadPersistedMessages: () => void;
}

/**
 * Максимальное количество сообщений в чате (защита от утечки памяти)
 */
const MAX_MESSAGES = 100;

/**
 * Максимальное количество сообщений для localStorage
 */
const MAX_PERSISTED_MESSAGES = 200;

/**
 * Генерация уникального ID
 */
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Persist messages to localStorage (strip audioBlob, limit count)
 */
function persistMessages(messages: Message[]) {
  try {
    const serializable = messages.slice(-MAX_PERSISTED_MESSAGES).map(m => ({
      ...m,
      audioBlob: undefined,
    }));
    localStorage.setItem("lc-messages", JSON.stringify(serializable));
  } catch {
    // localStorage full or unavailable
  }
}

/**
 * Load messages from localStorage
 */
function loadMessages(): Message[] {
  try {
    const raw = localStorage.getItem("lc-messages");
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

/**
 * Persist translations to localStorage
 */
function persistTranslations(translatedTexts: Record<string, string>) {
  try {
    localStorage.setItem("lc-translations", JSON.stringify(translatedTexts));
  } catch {
    // localStorage full or unavailable
  }
}

/**
 * Load translations from localStorage
 */
function loadTranslations(): Record<string, string> {
  try {
    const raw = localStorage.getItem("lc-translations");
    if (!raw) return {};
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

/**
 * Zustand store для управления состоянием чата
 */
export const useChatStore = create<ChatState>((set) => ({
  // Начальное состояние
  messages: [],
  processingMessageId: null,
  translatedTexts: {},
  activeCompanion: "Alex",
  inputMode: "voice",
  streamingCompanionText: "",
  activeScenario: null,

  // Actions
  addMessage: (message) => {
    const id = generateId();
    set((state) => {
      const newMessages = [
        ...state.messages,
        {
          ...message,
          id,
          timestamp: Date.now(),
        },
      ];
      // Ограничиваем количество сообщений, очищаем audioBlob у удаляемых
      if (newMessages.length > MAX_MESSAGES) {
        const removed = newMessages.splice(0, newMessages.length - MAX_MESSAGES);
        for (const msg of removed) {
          if (msg.audioBlob) msg.audioBlob = undefined;
        }
      }
      persistMessages(newMessages);
      return { messages: newMessages };
    });
    return id;
  },

  updateMessage: (id, updates) =>
    set((state) => {
      const newMessages = state.messages.map((msg) =>
        msg.id === id ? { ...msg, ...updates } : msg
      );
      persistMessages(newMessages);
      return { messages: newMessages };
    }),

  setProcessingMessageId: (id) =>
    set({ processingMessageId: id }),

  setTranslation: (id, text) =>
    set((state) => {
      const newTranslations = { ...state.translatedTexts, [id]: text };
      persistTranslations(newTranslations);
      return { translatedTexts: newTranslations };
    }),

  setActiveCompanion: (name) =>
    set({ activeCompanion: name }),

  setInputMode: (mode) =>
    set({ inputMode: mode }),

  appendStreamingText: (delta) =>
    set((state) => ({ streamingCompanionText: state.streamingCompanionText + delta })),

  clearStreamingText: () =>
    set({ streamingCompanionText: "" }),

  clearMessages: () => {
    try {
      localStorage.removeItem("lc-messages");
      localStorage.removeItem("lc-translations");
    } catch {
      // ignore
    }
    set({ messages: [], translatedTexts: {} });
  },

  startScenario: (scenarioId) =>
    set((state) => {
      const context = SCENARIO_CONTEXTS[scenarioId];
      if (!context) return state;
      try {
        localStorage.removeItem("lc-messages");
        localStorage.removeItem("lc-translations");
      } catch {
        // ignore
      }
      return {
        activeScenario: context,
        messages: [], // Очищаем историю
        translatedTexts: {},
      };
    }),

  endScenario: () =>
    set({
      activeScenario: null,
      // messages НЕ очищаем — сохраняем историю
    }),

  loadPersistedMessages: () =>
    set(() => {
      const messages = loadMessages();
      const translatedTexts = loadTranslations();
      if (messages.length === 0) return {};
      return { messages, translatedTexts };
    }),
}));
