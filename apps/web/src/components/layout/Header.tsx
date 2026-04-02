"use client";

import React from "react";
import { Settings } from "lucide-react";
import type { CompanionName } from "@/store/chatStore";

/**
 * Props для compact Header
 */
interface HeaderProps {
  companionName: CompanionName;
  isOnline: boolean;
  isTyping?: boolean;
  onSettingsClick?: () => void;
  scenarioName?: string;
  onEndScenario?: () => void;
}

/**
 * Logo mark component
 */
function LogoMark() {
  return (
    <div
      className="w-7 h-7 rounded-lg flex items-center justify-center bg-accent"
      style={{ fontSize: "14px", fontWeight: 700, color: "white", letterSpacing: "-0.5px" }}
    >
      L
    </div>
  );
}

/**
 * Compact Header — single row h-12
 *
 * Layout: [Logo][AppName] [CompanionName + dot] [Gear]
 * Scenario mode: adds scenario name + exit below
 */
export function Header({
  companionName,
  isOnline,
  isTyping = false,
  onSettingsClick,
  scenarioName,
  onEndScenario,
}: HeaderProps) {
  return (
    <header className="bg-surface border-b border-subtle flex-shrink-0 relative z-10">
      <div className="pt-[env(safe-area-inset-top)] px-4">
        {/* Main row — h-12 */}
        <div className="flex items-center justify-between h-12">
          {/* Left: Logo + App name */}
          <div className="flex items-center gap-2">
            <LogoMark />
            <span
              className="text-primary font-semibold"
              style={{ fontSize: "15px", letterSpacing: "-0.3px" }}
            >
              LinguaCompanion
            </span>
          </div>

          {/* Center: Companion name + status dot */}
          <div className="flex items-center gap-1.5">
            <span className="text-secondary text-size-sm font-medium">
              {isTyping ? `${companionName}...` : companionName}
            </span>
            <span
              data-testid="online-dot"
              className="w-2 h-2 rounded-full"
              style={{
                backgroundColor: isOnline ? "var(--success)" : "var(--text-muted)",
              }}
            />
          </div>

          {/* Right: Settings gear */}
          <button
            type="button"
            onClick={onSettingsClick}
            className="w-9 h-9 rounded-[10px] flex items-center justify-center text-secondary hover:text-primary transition-all active:scale-[0.92]"
            aria-label="Settings"
          >
            <Settings className="w-[18px] h-[18px]" />
          </button>
        </div>

        {/* Scenario bar (optional) */}
        {scenarioName && (
          <div className="flex items-center justify-between pb-2 -mt-1">
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
    </header>
  );
}
