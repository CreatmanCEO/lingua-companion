"use client";

import React, { useState, useEffect } from "react";
import { Settings, BookOpen, LogOut, BarChart3, MoreHorizontal } from "lucide-react";
import type { CompanionName, ScenarioContext } from "@/store/chatStore";

/**
 * Props для compact Header
 */
interface HeaderProps {
  companionName: CompanionName;
  isOnline: boolean;
  isTyping?: boolean;
  onSettingsClick?: () => void;
  onLibraryClick?: () => void;
  onStatsClick?: () => void;
  onEndSession?: () => void;
  scenarioName?: string;
  scenario?: ScenarioContext | null;
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
  onLibraryClick,
  onStatsClick,
  onEndSession,
  scenarioName,
  scenario,
  onEndScenario,
}: HeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return;
    const close = () => setMenuOpen(false);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [menuOpen]);

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

          {/* Right: ⋯ dropdown menu + Settings gear */}
          <div className="flex items-center gap-1">
            {/* Dropdown menu (Stats, Library, End Session) */}
            <div className="relative">
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setMenuOpen(!menuOpen); }}
                className="w-9 h-9 rounded-[10px] flex items-center justify-center text-secondary hover:text-primary transition-all active:scale-[0.92]"
                aria-label="More options"
              >
                <MoreHorizontal className="w-[18px] h-[18px]" />
              </button>
              {menuOpen && (
                <div className="absolute right-0 top-full mt-1 bg-surface border border-subtle rounded-lg shadow-xl py-1 min-w-[180px] z-50">
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onStatsClick?.(); setMenuOpen(false); }}
                    className="w-full px-3 py-2 text-left text-sm text-secondary hover:bg-void flex items-center gap-2 transition-colors"
                  >
                    <BarChart3 className="w-4 h-4" /> Stats & Progress
                  </button>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onLibraryClick?.(); setMenuOpen(false); }}
                    className="w-full px-3 py-2 text-left text-sm text-secondary hover:bg-void flex items-center gap-2 transition-colors"
                  >
                    <BookOpen className="w-4 h-4" /> Phrase Library
                  </button>
                  {onEndSession && (
                    <>
                      <div className="border-t border-subtle my-1" />
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); onEndSession(); setMenuOpen(false); }}
                        className="w-full px-3 py-2 text-left text-sm text-red-400 hover:bg-void flex items-center gap-2 transition-colors"
                      >
                        <LogOut className="w-4 h-4" /> End Session
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
            {/* Settings gear — always visible */}
            <button
              type="button"
              onClick={onSettingsClick}
              className="w-9 h-9 rounded-[10px] flex items-center justify-center text-secondary hover:text-primary transition-all active:scale-[0.92]"
              aria-label="Settings"
            >
              <Settings className="w-[18px] h-[18px]" />
            </button>
          </div>
        </div>

        {/* Scenario bar (optional) — with role labels */}
        {scenarioName && (
          <div className="flex items-center justify-between pb-2 -mt-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-size-xs text-accent font-medium">
                {scenarioName}
              </span>
              {scenario?.userRole && (
                <span className="text-size-xs text-blue-400/60">
                  You: {scenario.userRole}
                </span>
              )}
              {scenario?.companionRole && (
                <span className="text-size-xs text-green-400/60">
                  {companionName}: {scenario.companionRole}
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={onEndScenario}
              className="text-size-xs text-muted hover:text-secondary transition-colors flex-shrink-0"
            >
              Exit
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
