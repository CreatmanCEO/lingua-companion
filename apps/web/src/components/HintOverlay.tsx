"use client";

import React, { useState, useCallback } from "react";

interface HintStep {
  target: string;
  title: string;
  description: string;
}

const HINT_STEPS: HintStep[] = [
  {
    target: "settings",
    title: "Settings",
    description: "Choose companion, voice and style",
  },
  {
    target: "tabs",
    title: "Practice Modes",
    description: "Practice freely or pick a scenario",
  },
  {
    target: "analyse",
    title: "Analyse",
    description: "Get corrections and 5 style variants",
  },
  {
    target: "mic",
    title: "Voice Input",
    description: "Hold mic to speak or switch to text",
  },
];

interface HintOverlayProps {
  onComplete: () => void;
}

export function HintOverlay({ onComplete }: HintOverlayProps) {
  const [step, setStep] = useState(0);

  const handleNext = useCallback(() => {
    if (step < HINT_STEPS.length - 1) {
      setStep(step + 1);
    } else {
      if (typeof window !== "undefined") {
        localStorage.setItem("lc-hints-seen", "true");
      }
      onComplete();
    }
  }, [step, onComplete]);

  const current = HINT_STEPS[step];
  const isLast = step === HINT_STEPS.length - 1;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      data-testid="hint-overlay"
    >
      <div
        className="bg-surface border border-subtle rounded-2xl p-6 mx-6 max-w-[320px] w-full shadow-lg animate-fade-slide-up"
      >
        {/* Step indicator */}
        <div className="flex gap-1.5 mb-4">
          {HINT_STEPS.map((_, i) => (
            <div
              key={i}
              className={`h-1 flex-1 rounded-full transition-colors ${
                i <= step ? "bg-accent" : "bg-subtle"
              }`}
            />
          ))}
        </div>

        {/* Icon */}
        <div className="text-3xl mb-3">
          {step === 0 && "⚙️"}
          {step === 1 && "💬"}
          {step === 2 && "🔍"}
          {step === 3 && "🎤"}
        </div>

        {/* Title */}
        <h3 className="text-primary text-size-lg font-semibold mb-1">
          {current.title}
        </h3>

        {/* Description */}
        <p className="text-secondary text-size-sm mb-6">
          {current.description}
        </p>

        {/* Button */}
        <button
          type="button"
          onClick={handleNext}
          className="w-full py-2.5 rounded-xl bg-accent text-white font-medium text-size-sm transition-all active:scale-[0.97] hover:opacity-90"
        >
          {isLast ? "Got it!" : "Next"}
        </button>

        {/* Step counter */}
        <div className="text-center text-size-xs text-muted mt-3">
          {step + 1} / {HINT_STEPS.length}
        </div>
      </div>
    </div>
  );
}
