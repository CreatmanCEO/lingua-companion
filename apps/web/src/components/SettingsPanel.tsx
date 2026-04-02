"use client";

import React, { useCallback } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useSettingsStore, type TopicPreference, type Level } from "@/store/settingsStore";
import type { CompanionName } from "@/store/chatStore";
import type { VoiceKey } from "@/lib/edgeTts";
import { playTts } from "@/lib/edgeTts";

interface SettingsPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCompanionChange?: (name: CompanionName) => void;
}

const COMPANIONS: { key: CompanionName; label: string; desc: string }[] = [
  { key: "Alex", label: "Alex", desc: "Professional" },
  { key: "Sam", label: "Sam", desc: "Casual" },
  { key: "Morgan", label: "Morgan", desc: "Mentor" },
];

const VOICES: { key: VoiceKey; label: string }[] = [
  { key: "us-male", label: "US Male" },
  { key: "us-female", label: "US Female" },
  { key: "gb-male", label: "GB Male" },
  { key: "gb-female", label: "GB Female" },
];

const TOPICS: { key: TopicPreference; label: string }[] = [
  { key: "it", label: "IT only" },
  { key: "mixed", label: "Mixed (IT + casual)" },
  { key: "any", label: "Any topic" },
];

const LEVELS: Level[] = ["A2", "B1", "B2"];

function OptionButton({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1.5 rounded-lg text-size-sm font-medium transition-all border ${
        selected
          ? "bg-accent text-white border-accent"
          : "bg-card text-secondary border-subtle hover:border-accent/30"
      }`}
    >
      {children}
    </button>
  );
}

export function SettingsPanel({ open, onOpenChange, onCompanionChange }: SettingsPanelProps) {
  const {
    companion, voice, rate, topicPreference, level, theme,
    setCompanion, setVoice, setRate, setTopicPreference, setLevel, setTheme,
  } = useSettingsStore();

  const handleCompanionChange = useCallback(
    (name: CompanionName) => {
      setCompanion(name);
      onCompanionChange?.(name);
    },
    [setCompanion, onCompanionChange],
  );

  const handleTestVoice = useCallback(() => {
    playTts("Hello! How are you today?", voice, rate);
  }, [voice, rate]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="bg-surface border-subtle w-[320px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-primary">Settings</SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Companion */}
          <section>
            <h3 className="text-size-sm font-semibold text-primary mb-2">Companion</h3>
            <div className="flex flex-col gap-2">
              {COMPANIONS.map((c) => (
                <button
                  key={c.key}
                  type="button"
                  onClick={() => handleCompanionChange(c.key)}
                  className={`flex items-center gap-3 p-2.5 rounded-xl border transition-all ${
                    companion === c.key
                      ? "border-accent bg-accent/10"
                      : "border-subtle bg-card hover:border-accent/30"
                  }`}
                >
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-white text-size-sm font-bold"
                    style={{ background: "linear-gradient(135deg, #5E5CE6, #BF5AF2)" }}
                  >
                    {c.key[0]}
                  </div>
                  <div className="text-left">
                    <div className="text-size-sm font-medium text-primary">{c.label}</div>
                    <div className="text-size-xs text-muted">{c.desc}</div>
                  </div>
                </button>
              ))}
            </div>
          </section>

          {/* Voice */}
          <section>
            <h3 className="text-size-sm font-semibold text-primary mb-2">Voice</h3>
            <div className="flex flex-wrap gap-2">
              {VOICES.map((v) => (
                <OptionButton
                  key={v.key}
                  selected={voice === v.key}
                  onClick={() => setVoice(v.key)}
                >
                  {v.label}
                </OptionButton>
              ))}
            </div>
            <button
              type="button"
              onClick={handleTestVoice}
              className="mt-2 text-size-xs text-accent hover:text-accent/80 transition-colors"
            >
              Test voice
            </button>
          </section>

          {/* Speed */}
          <section>
            <h3 className="text-size-sm font-semibold text-primary mb-2">
              Speed: {rate}x
            </h3>
            <input
              type="range"
              min="0.8"
              max="1.2"
              step="0.1"
              value={rate}
              onChange={(e) => setRate(e.target.value)}
              className="w-full accent-accent"
            />
            <div className="flex justify-between text-size-xs text-muted mt-1">
              <span>0.8x</span>
              <span>1.2x</span>
            </div>
          </section>

          {/* Topics */}
          <section>
            <h3 className="text-size-sm font-semibold text-primary mb-2">Topics</h3>
            <div className="flex flex-col gap-1.5">
              {TOPICS.map((t) => (
                <OptionButton
                  key={t.key}
                  selected={topicPreference === t.key}
                  onClick={() => setTopicPreference(t.key)}
                >
                  {t.label}
                </OptionButton>
              ))}
            </div>
          </section>

          {/* Level */}
          <section>
            <h3 className="text-size-sm font-semibold text-primary mb-2">Level</h3>
            <div className="flex gap-2">
              {LEVELS.map((l) => (
                <OptionButton
                  key={l}
                  selected={level === l}
                  onClick={() => setLevel(l)}
                >
                  {l}
                </OptionButton>
              ))}
            </div>
          </section>

          {/* Theme */}
          <section>
            <h3 className="text-size-sm font-semibold text-primary mb-2">Theme</h3>
            <div className="flex gap-2">
              <OptionButton
                selected={theme === "dark"}
                onClick={() => setTheme("dark")}
              >
                Dark
              </OptionButton>
              <OptionButton
                selected={theme === "light"}
                onClick={() => setTheme("light")}
              >
                Light
              </OptionButton>
            </div>
          </section>
        </div>
      </SheetContent>
    </Sheet>
  );
}
