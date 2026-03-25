"use client";

import React from "react";
import { cn } from "@/lib/utils";

/**
 * Типы ошибок
 */
export type ErrorType = "grammar" | "vocabulary" | "code_switching" | "none";

/**
 * Props для ReconstructionBlock
 */
interface ReconstructionBlockProps {
  original: string;
  corrected: string;
  explanation: string | null;
  errorType: ErrorType;
  className?: string;
}

/**
 * ReconstructionBlock компонент
 *
 * Git-diff стиль из прототипа:
 * - Header: 💡 Reconstruction (warning color)
 * - Diff block:
 *   - minus row (red background, - sign)
 *   - plus row (green background, + sign)
 * - Grammar note (explanation)
 */
export function ReconstructionBlock({
  original,
  corrected,
  explanation,
  errorType,
  className,
}: ReconstructionBlockProps) {
  // Если нет ошибок и текст идентичен, показываем Perfect
  if (errorType === "none" && original === corrected) {
    return (
      <div
        className={cn(
          "bg-card border border-subtle rounded-xl p-3 mb-3 animate-fade-slide-up",
          className
        )}
      >
        <div className="flex items-center gap-[6px] text-success">
          <span>✨</span>
          <span className="font-medium text-size-sm">Perfect!</span>
        </div>
        <p className="text-secondary text-size-xs mt-2">
          Your phrase sounds natural. Keep it up!
        </p>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "bg-card border border-subtle rounded-xl overflow-hidden mb-3 animate-fade-slide-up",
        className
      )}
      style={{ boxShadow: "var(--shadow-card)" }}
    >
      {/* Header */}
      <div
        className="flex items-center gap-[6px] px-3 py-[10px]"
        style={{
          fontSize: "10px",
          fontWeight: 700,
          color: "var(--warning)",
          textTransform: "uppercase",
          letterSpacing: "0.6px",
        }}
      >
        <span>💡</span>
        <span>Reconstruction</span>
      </div>

      {/* Diff block */}
      <div className="font-mono text-size-xs rounded-lg overflow-hidden mx-3 mb-2">
        {/* Minus row */}
        <div
          className="flex gap-2 px-[10px] py-[6px] items-start"
          style={{
            background: "rgba(255,55,95,0.08)",
            borderLeft: "2px solid var(--c-slang)",
          }}
        >
          <span
            className="font-bold flex-shrink-0 w-[10px]"
            style={{ color: "var(--c-slang)" }}
          >
            −
          </span>
          <span className="text-primary leading-[1.45]">&ldquo;{original}&rdquo;</span>
        </div>

        {/* Plus row */}
        <div
          className="flex gap-2 px-[10px] py-[6px] items-start"
          style={{
            background: "rgba(50,215,75,0.08)",
            borderLeft: "2px solid var(--c-simple)",
          }}
        >
          <span
            className="font-bold flex-shrink-0 w-[10px]"
            style={{ color: "var(--c-simple)" }}
          >
            +
          </span>
          <span className="text-primary leading-[1.45]">&ldquo;{corrected}&rdquo;</span>
        </div>
      </div>

      {/* Grammar note */}
      {explanation && (
        <div
          className="text-size-xs text-secondary leading-[1.55] px-3 py-2 border-t border-subtle mx-3 mb-3"
          style={{ marginTop: "4px" }}
        >
          <span className="mr-1">💬</span>
          <FormatExplanation text={explanation} />
        </div>
      )}
    </div>
  );
}

/**
 * Безопасное форматирование explanation — выделение жирным текста в guillemet-кавычках.
 * Использует React-компоненты вместо dangerouslySetInnerHTML для защиты от XSS.
 */
function FormatExplanation({ text }: { text: string }) {
  const parts = text.split(/(«[^»]+»)/g);
  return (
    <span>
      {parts.map((part, i) =>
        part.startsWith("«") && part.endsWith("»") ? (
          <strong key={i}>{part}</strong>
        ) : (
          <React.Fragment key={i}>{part}</React.Fragment>
        )
      )}
    </span>
  );
}
