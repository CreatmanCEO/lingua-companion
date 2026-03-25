"use client";

import React from "react";
import { cn } from "@/lib/utils";

/**
 * Типы табов
 */
export type TabType = "free-chat" | "scenario";

/**
 * Props для TabBar
 */
interface TabBarProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
}

/**
 * TabBar компонент из прототипа
 *
 * Два таба с эмодзи:
 * - 💬 Free Chat
 * - 🎭 Scenario
 *
 * Active: text-accent + border-bottom 2px accent
 */
export function TabBar({ activeTab, onTabChange }: TabBarProps) {
  const tabs: { id: TabType; label: string; emoji: string }[] = [
    { id: "free-chat", label: "Free Chat", emoji: "💬" },
    { id: "scenario", label: "Scenario", emoji: "🎭" },
  ];

  return (
    <div className="bg-surface border-b border-subtle flex-shrink-0">
      <div className="flex">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => onTabChange(tab.id)}
            className={cn(
              "flex-1 py-[10px] text-center transition-all select-none",
              "border-b-2",
              activeTab === tab.id
                ? "text-accent border-accent"
                : "text-muted border-transparent hover:text-secondary"
            )}
            style={{ fontSize: "13px", fontWeight: 500 }}
          >
            {tab.emoji} {tab.label}
          </button>
        ))}
      </div>
    </div>
  );
}
