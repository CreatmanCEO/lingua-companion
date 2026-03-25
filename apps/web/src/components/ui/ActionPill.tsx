"use client";

import React from "react";
import { cn } from "@/lib/utils";

interface ActionPillProps {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: "default" | "accent";
  disabled?: boolean;
  isPlaying?: boolean;
}

export function ActionPill({
  children,
  onClick,
  variant = "default",
  disabled = false,
  isPlaying = false,
}: ActionPillProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "inline-flex items-center gap-1 px-[10px] py-1 rounded-full",
        "text-size-xs font-medium transition-all active:scale-[0.94] select-none",
        isPlaying
          ? "text-success border-success/20 bg-success/10 border"
          : variant === "accent"
            ? "bg-accent-soft border border-accent/20 text-accent"
            : "bg-elevated border border-subtle text-secondary hover:text-primary",
        disabled && "opacity-50 cursor-wait"
      )}
    >
      {children}
    </button>
  );
}
