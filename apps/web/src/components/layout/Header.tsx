"use client";

import React from "react";
import { MoreHorizontal } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";

/**
 * Props для Header
 */
interface HeaderProps {
  onMenuClick?: () => void;
}

/**
 * Logo mark component
 * Индиго квадрат с буквой L
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
 * Header компонент из прототипа
 *
 * Layout:
 * - [Logo mark] [App name]
 * - [Theme toggle] [Menu icon]
 */
export function Header({ onMenuClick }: HeaderProps) {
  return (
    <header className="bg-surface border-b border-subtle flex-shrink-0 relative z-10">
      {/* Padding top для Dynamic Island (на реальных устройствах) */}
      <div className="pt-[52px] px-5 pb-0">
        {/* Header top row */}
        <div className="flex items-center justify-between pb-3">
          {/* Logo section */}
          <div className="flex items-center">
            <LogoMark />
            <span
              className="ml-[10px] text-primary font-semibold"
              style={{ fontSize: "16px", letterSpacing: "-0.3px" }}
            >
              LinguaCompanion
            </span>
          </div>

          {/* Right buttons */}
          <div className="flex gap-2 items-center">
            <ThemeToggle />
            <button
              type="button"
              onClick={onMenuClick}
              className="w-[34px] h-[34px] rounded-[10px] bg-card border border-subtle flex items-center justify-center text-secondary hover:text-primary transition-all active:scale-[0.92]"
              aria-label="Menu"
              style={{ fontSize: "13px" }}
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
