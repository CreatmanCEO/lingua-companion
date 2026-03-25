"use client";

import React, { useEffect, useState } from "react";
import type { CompanionName } from "@/store/chatStore";

/**
 * Props для CompanionBar
 */
interface CompanionBarProps {
  companionName: CompanionName;
  companionStyle?: string;
  isTyping?: boolean;
  isOnline?: boolean;
  sessionStartTime?: Date;
  scenarioName?: string;  // Название активного сценария
  onEndScenario?: () => void;  // Кнопка выхода из сценария
}

/**
 * Компонент аватара companion
 * Градиентный фон с silhouette placeholder
 */
function Avatar() {
  return (
    <div className="relative w-[38px] h-[38px] flex-shrink-0">
      <div
        className="w-full h-full rounded-full flex items-center justify-center overflow-hidden border-2 border-subtle"
        style={{
          background: "linear-gradient(135deg, #5E5CE6 0%, #BF5AF2 100%)",
        }}
      >
        {/* SVG silhouette placeholder */}
        <svg
          viewBox="0 0 40 40"
          className="w-full h-full"
          style={{ opacity: 0.7 }}
        >
          <circle cx="20" cy="16" r="7" fill="rgba(255,255,255,0.7)" />
          <ellipse cx="20" cy="38" rx="13" ry="10" fill="rgba(255,255,255,0.5)" />
        </svg>
      </div>
      {/* Online dot */}
      <div
        className="absolute bottom-[1px] right-[1px] w-[10px] h-[10px] rounded-full border-2 border-surface"
        style={{ backgroundColor: "var(--success)", zIndex: 2 }}
      />
    </div>
  );
}

/**
 * Typing dots animation
 */
function TypingDots() {
  return (
    <span className="inline-flex gap-[2px] items-center">
      <span
        className="w-1 h-1 rounded-full bg-accent animate-typing-dot"
        style={{ animationDelay: "0s" }}
      />
      <span
        className="w-1 h-1 rounded-full bg-accent animate-typing-dot"
        style={{ animationDelay: "0.2s" }}
      />
      <span
        className="w-1 h-1 rounded-full bg-accent animate-typing-dot"
        style={{ animationDelay: "0.4s" }}
      />
    </span>
  );
}

/**
 * Session timer
 */
function SessionTimer({ startTime }: { startTime: Date }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const updateTimer = () => {
      const diff = Math.floor((Date.now() - startTime.getTime()) / 1000);
      setElapsed(diff);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [startTime]);

  const minutes = String(Math.floor(elapsed / 60)).padStart(2, "0");
  const seconds = String(elapsed % 60).padStart(2, "0");

  return (
    <div className="font-mono text-size-xs text-muted bg-card px-2 py-[3px] rounded-md border border-subtle">
      {minutes}:{seconds}
    </div>
  );
}

/**
 * CompanionBar компонент
 *
 * Layout из прототипа:
 * - Avatar (38px, gradient, silhouette, online dot)
 * - Companion info (name + status)
 * - Session timer (mm:ss)
 */
export function CompanionBar({
  companionName,
  companionStyle = "Professional",
  isTyping = false,
  isOnline = true,
  sessionStartTime,
  scenarioName,
  onEndScenario,
}: CompanionBarProps) {
  const [startTime] = useState(() => sessionStartTime || new Date());

  return (
    <div className="flex items-center gap-[10px] px-5 py-[10px] bg-surface border-b border-subtle flex-shrink-0">
      {/* Avatar */}
      <Avatar />

      {/* Companion info */}
      <div className="flex-1">
        <div className="text-size-sm font-semibold text-primary tracking-tight">
          {companionName}
        </div>
        <div className="text-size-xs text-secondary flex items-center gap-1">
          {isTyping ? (
            <>
              <TypingDots />
              <span className="ml-1">typing...</span>
            </>
          ) : (
            <span>
              {companionStyle} {isOnline ? "· Online" : "· Offline"}
            </span>
          )}
        </div>

        {/* Scenario indicator */}
        {scenarioName && (
          <div className="flex items-center gap-2 mt-1">
            <span className="text-size-xs text-accent font-medium">
              {scenarioName}
            </span>
            <button
              type="button"
              onClick={onEndScenario}
              className="text-size-xs text-muted hover:text-secondary transition-colors"
            >
              Exit
            </button>
          </div>
        )}
      </div>

      {/* Session timer */}
      <SessionTimer startTime={startTime} />
    </div>
  );
}
