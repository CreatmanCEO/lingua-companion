"use client";

import { create } from "zustand";
import type { CompanionName } from "@/store/chatStore";
import type { VoiceKey } from "@/lib/edgeTts";

export type TopicPreference = "it" | "mixed" | "any";
export type Level = "A2" | "B1" | "B2";
export type Theme = "dark" | "light";

interface SettingsState {
  companion: CompanionName;
  voice: VoiceKey;
  rate: string;
  topicPreference: TopicPreference;
  level: Level;
  theme: Theme;

  setCompanion: (c: CompanionName) => void;
  setVoice: (v: VoiceKey) => void;
  setRate: (r: string) => void;
  setTopicPreference: (t: TopicPreference) => void;
  setLevel: (l: Level) => void;
  setTheme: (t: Theme) => void;
  loadFromLocalStorage: () => void;
}

function ls(key: string, fallback: string): string {
  if (typeof window === "undefined") return fallback;
  return localStorage.getItem(key) || fallback;
}

function lsSet(key: string, value: string): void {
  if (typeof window !== "undefined") {
    localStorage.setItem(key, value);
  }
}

export const useSettingsStore = create<SettingsState>((set) => ({
  companion: "Alex",
  voice: "us-male",
  rate: "1.0",
  topicPreference: "mixed",
  level: "B1",
  theme: "dark",

  setCompanion: (c) => {
    lsSet("lc-companion", c);
    set({ companion: c });
  },
  setVoice: (v) => {
    lsSet("lc-voice", v);
    set({ voice: v });
  },
  setRate: (r) => {
    lsSet("lc-rate", r);
    set({ rate: r });
  },
  setTopicPreference: (t) => {
    lsSet("lc-topic", t);
    set({ topicPreference: t });
  },
  setLevel: (l) => {
    lsSet("lc-level", l);
    set({ level: l });
  },
  setTheme: (t) => {
    lsSet("lc-theme", t);
    set({ theme: t });
  },
  loadFromLocalStorage: () => {
    set({
      companion: ls("lc-companion", "Alex") as CompanionName,
      voice: ls("lc-voice", "us-male") as VoiceKey,
      rate: ls("lc-rate", "1.0"),
      topicPreference: ls("lc-topic", "mixed") as TopicPreference,
      level: ls("lc-level", "B1") as Level,
      theme: ls("lc-theme", "dark") as Theme,
    });
  },
}));
