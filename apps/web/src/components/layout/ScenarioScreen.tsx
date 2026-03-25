"use client";

import React, { useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Scenario data
 */
interface Scenario {
  id: string;
  emoji: string;
  name: string;
  description: string;
  level: "B1" | "B2";
}

const SCENARIOS: Scenario[] = [
  {
    id: "daily-standup",
    emoji: "☀️",
    name: "Daily Stand-up",
    description: "What did you do, what's blocked?",
    level: "B1",
  },
  {
    id: "code-review",
    emoji: "🔍",
    name: "Code Review",
    description: "Discuss PRs with your tech lead",
    level: "B1",
  },
  {
    id: "tech-demo",
    emoji: "📊",
    name: "Tech Demo",
    description: "Present a feature to stakeholders",
    level: "B2",
  },
  {
    id: "job-interview",
    emoji: "💼",
    name: "Job Interview",
    description: "System design + behavioural",
    level: "B2",
  },
  {
    id: "sprint-planning",
    emoji: "📋",
    name: "Sprint Planning",
    description: "Estimate, discuss scope & blockers",
    level: "B1",
  },
  {
    id: "slack-message",
    emoji: "💬",
    name: "Write a Slack Message",
    description: "Sound natural, not like Google Translate",
    level: "B1",
  },
];

/**
 * Props для ScenarioScreen
 */
interface ScenarioScreenProps {
  onSelectScenario?: (scenarioId: string) => void;
}

/**
 * Level badge
 */
function LevelBadge({ level }: { level: "B1" | "B2" }) {
  return (
    <span
      className={cn(
        "px-2 py-[2px] rounded-full text-size-xs font-bold uppercase tracking-wide",
        level === "B1"
          ? "bg-c-professional/10 text-c-professional"
          : "bg-c-colloquial/10 text-c-colloquial"
      )}
    >
      {level}
    </span>
  );
}

/**
 * Scenario card
 */
function ScenarioCard({
  scenario,
  onClick,
  isLoading,
}: {
  scenario: Scenario;
  onClick: () => void;
  isLoading?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isLoading}
      className={cn(
        "flex items-center gap-3 w-full px-4 py-[14px] rounded-xl",
        "bg-card border border-subtle mb-2",
        "text-left transition-all",
        "hover:border-accent/20 active:scale-[0.98]",
        isLoading && "opacity-60 cursor-wait"
      )}
      style={{ boxShadow: "var(--shadow-card)" }}
    >
      {/* Icon */}
      <span className="text-[22px] w-10 text-center flex-shrink-0">
        {scenario.emoji}
      </span>

      {/* Info */}
      <div className="flex-1">
        <div className="text-size-base font-semibold text-primary">
          {scenario.name}
        </div>
        <div className="text-size-xs text-secondary mt-[2px]">
          {scenario.description}
        </div>
      </div>

      {/* Level or Loading indicator */}
      {isLoading ? (
        <div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      ) : (
        <LevelBadge level={scenario.level} />
      )}
    </button>
  );
}

/**
 * ScenarioScreen компонент из прототипа
 *
 * Список из 6 сценариев с эмодзи, названием, описанием и level badge
 */
export function ScenarioScreen({ onSelectScenario }: ScenarioScreenProps) {
  const [loadingScenario, setLoadingScenario] = useState<string | null>(null);

  const handleSelectScenario = (scenarioId: string) => {
    setLoadingScenario(scenarioId);
    onSelectScenario?.(scenarioId);
    // Loading state будет сброшен при переключении таба
  };

  return (
    <div className="flex-1 overflow-y-auto px-4 py-4 bg-void">
      {/* Title */}
      <div
        className="text-secondary font-semibold uppercase tracking-wide mb-3"
        style={{ fontSize: "13px", letterSpacing: "0.5px" }}
      >
        Choose a scenario
      </div>

      {/* Scenario cards */}
      {SCENARIOS.map((scenario) => (
        <ScenarioCard
          key={scenario.id}
          scenario={scenario}
          isLoading={loadingScenario === scenario.id}
          onClick={() => handleSelectScenario(scenario.id)}
        />
      ))}
    </div>
  );
}
