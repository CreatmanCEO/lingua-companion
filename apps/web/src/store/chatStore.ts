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
}

/**
 * Максимальное количество сообщений в чате (защита от утечки памяти)
 */
const MAX_MESSAGES = 100;

/**
 * Генерация уникального ID
 */
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
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
      return { messages: newMessages };
    });
    return id;
  },

  updateMessage: (id, updates) =>
    set((state) => ({
      messages: state.messages.map((msg) =>
        msg.id === id ? { ...msg, ...updates } : msg
      ),
    })),

  setProcessingMessageId: (id) =>
    set({ processingMessageId: id }),

  setTranslation: (id, text) =>
    set((state) => ({
      translatedTexts: { ...state.translatedTexts, [id]: text },
    })),

  setActiveCompanion: (name) =>
    set({ activeCompanion: name }),

  setInputMode: (mode) =>
    set({ inputMode: mode }),

  appendStreamingText: (delta) =>
    set((state) => ({ streamingCompanionText: state.streamingCompanionText + delta })),

  clearStreamingText: () =>
    set({ streamingCompanionText: "" }),

  clearMessages: () =>
    set({ messages: [], translatedTexts: {} }),

  startScenario: (scenarioId) =>
    set((state) => {
      const context = SCENARIO_CONTEXTS[scenarioId];
      if (!context) return state;
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
}));
