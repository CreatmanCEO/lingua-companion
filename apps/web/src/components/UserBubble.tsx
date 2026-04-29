"use client";

import React, { useState, useCallback } from "react";
import type { Message } from "@/store/chatStore";
import { ActionPill } from "@/components/ui/ActionPill";
import { cn } from "@/lib/utils";

/**
 * Props для UserBubble
 */
interface UserBubbleProps {
  message: Message;
  onTranscribe?: () => void;
  onToggleReconstruction?: () => void;
  onToggleVariants?: () => void;
}

/**
 * Форматирование длительности аудио
 */
function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

/**
 * Voice waveform bars из прототипа
 * 14 bars с разной высотой
 */
const WAVEFORM_HEIGHTS = [6, 12, 18, 22, 14, 20, 16, 10, 18, 8, 14, 20, 12, 7];

function VoiceWaveform() {
  return (
    <div className="flex items-center gap-[2.5px] h-[26px]">
      {WAVEFORM_HEIGHTS.map((height, index) => (
        <div
          key={index}
          className="w-[3px] rounded-sm bg-accent"
          style={{ height: `${height}px` }}
        />
      ))}
    </div>
  );
}

/**
 * UserBubble компонент из прототипа
 *
 * Два варианта:
 * 1. Voice message: Waveform bars + duration + [📝 Transcribe] + [Analyse]
 * 2. Text message: Text content + [Analyse]
 *
 * Bubble: bg-user-bubble, border, rounded-[18px 4px 18px 18px]
 */
export function UserBubble({
  message,
  onTranscribe,
  onToggleReconstruction,
  onToggleVariants,
}: UserBubbleProps) {
  const [showTranscript, setShowTranscript] = useState(message.isTranscribed || false);

  const isVoiceMessage = message.contentType === "voice";

  /**
   * Обработка транскрибирования
   */
  const handleTranscribe = useCallback(() => {
    setShowTranscript((prev) => !prev);
    if (!showTranscript) {
      onTranscribe?.();
    }
  }, [onTranscribe, showTranscript]);

  /**
   * Форматирование времени сообщения
   */
  const formattedTime = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(message.timestamp);

  return (
    <div className="flex justify-end mb-3 animate-fade-slide-up">
      <div className="flex flex-col items-end">
        {isVoiceMessage ? (
          // Voice bubble
          <div
            className="bg-user-bubble border border-subtle px-[14px] py-[10px] max-w-[280px]"
            style={{ borderRadius: "18px 4px 18px 18px" }}
          >
            {/* Waveform */}
            <VoiceWaveform />

            {/* Duration */}
            <div className="flex justify-between items-center mt-[5px]">
              <span className="font-mono text-size-xs text-muted">
                {formatDuration(message.audioDuration || 0)}
              </span>
            </div>

            {/* Transcript block */}
            {showTranscript && message.text && (
              <div
                className="mt-2 px-[10px] py-2 bg-void rounded-lg border border-subtle text-size-xs text-secondary italic animate-fade-slide-up"
              >
                &ldquo;{message.text}&rdquo;
              </div>
            )}

            {/* Action buttons */}
            <div className="flex gap-[6px] mt-2 flex-wrap">
              <ActionPill onClick={handleTranscribe}>
                📝 {showTranscript ? "Hide" : "Transcribe"}
              </ActionPill>
            </div>

            {/* Toggle buttons for reconstruction/variants */}
            {(message.reconstruction || message.variants) && (
              <div className="flex items-center gap-1 mt-1">
                {message.reconstruction && (
                  <button
                    onClick={onToggleReconstruction}
                    title="Grammar"
                    className={cn(
                      "flex items-center justify-center w-6 h-6 rounded-lg text-xs transition-colors",
                      message.showReconstruction
                        ? "bg-green-500/20 text-green-400"
                        : "bg-white/5 text-white/30 hover:text-white/50"
                    )}
                  >
                    <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-current"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/></svg>
                  </button>
                )}
                {message.variants && (
                  <button
                    onClick={onToggleVariants}
                    title="Variants"
                    className={cn(
                      "flex items-center justify-center w-6 h-6 rounded-lg text-xs transition-colors",
                      message.showVariants
                        ? "bg-blue-500/20 text-blue-400"
                        : "bg-white/5 text-white/30 hover:text-white/50"
                    )}
                  >
                    <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-current"><path d="M4 6h16v2H4V6zm0 5h16v2H4v-2zm0 5h16v2H4v-2z"/></svg>
                  </button>
                )}
              </div>
            )}
          </div>
        ) : (
          // Text bubble
          <div
            className="bg-user-bubble border border-subtle px-[14px] py-[10px] max-w-[280px]"
            style={{ borderRadius: "18px 4px 18px 18px" }}
          >
            <p className="text-primary text-size-base leading-[1.55]">
              {message.text}
            </p>

            {/* Toggle buttons for reconstruction/variants */}
            {(message.reconstruction || message.variants) && (
              <div className="flex items-center gap-1 mt-2">
                {message.reconstruction && (
                  <button
                    onClick={onToggleReconstruction}
                    title="Grammar"
                    className={cn(
                      "flex items-center justify-center w-6 h-6 rounded-lg text-xs transition-colors",
                      message.showReconstruction
                        ? "bg-green-500/20 text-green-400"
                        : "bg-white/5 text-white/30 hover:text-white/50"
                    )}
                  >
                    <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-current"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/></svg>
                  </button>
                )}
                {message.variants && (
                  <button
                    onClick={onToggleVariants}
                    title="Variants"
                    className={cn(
                      "flex items-center justify-center w-6 h-6 rounded-lg text-xs transition-colors",
                      message.showVariants
                        ? "bg-blue-500/20 text-blue-400"
                        : "bg-white/5 text-white/30 hover:text-white/50"
                    )}
                  >
                    <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-current"><path d="M4 6h16v2H4V6zm0 5h16v2H4v-2zm0 5h16v2H4v-2z"/></svg>
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Timestamp */}
        <div className="text-size-xs text-muted mt-1 pr-1">
          {formattedTime}
        </div>
      </div>
    </div>
  );
}
