"use client";

import React, { useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import { useAudioRecorder } from "@/hooks/useAudioRecorder";

/**
 * Режим ввода (kept for backward compat, but no longer toggled)
 */
export type InputMode = "text" | "voice";

/**
 * Props для VoiceBar
 */
interface VoiceBarProps {
  onSendText: (text: string) => void;
  onSendAudio: (blob: Blob) => void;
  isProcessing: boolean;
  /** Optional unused props kept for backward compat */
  mode?: InputMode;
  onModeChange?: (mode: InputMode) => void;
  processingTime?: number;
  companionName?: string;
  companionStyle?: string;
}

/**
 * Compact live waveform (6 bars instead of 12)
 */
const LIVE_BAR_HEIGHTS = [8, 20, 28, 18, 24, 12];

function LiveWaveform() {
  return (
    <div className="flex-1 flex items-center gap-[3px] h-6" aria-hidden="true">
      {LIVE_BAR_HEIGHTS.map((height, index) => (
        <div
          key={index}
          className="w-[3px] bg-accent rounded-sm animate-live-bar"
          style={{
            height: `${height}px`,
            animationDelay: `${index * 0.07}s`,
          }}
        />
      ))}
    </div>
  );
}

/**
 * Форматирование времени записи
 */
function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${String(secs).padStart(2, "0")}`;
}

/**
 * VoiceBar — Telegram-style single-row input bar
 *
 * 3 states:
 * 1. IDLE: [text input] + [mic/send button]
 * 2. RECORDING: [red dot + timer] + [waveform] + [stop button]
 * 3. PROCESSING: [text input disabled] + [spinner] + [send disabled]
 */
export function VoiceBar({
  onSendText,
  onSendAudio,
  isProcessing,
}: VoiceBarProps) {
  const [textInput, setTextInput] = useState("");

  const {
    isRecording,
    duration,
    startRecording,
    stopRecording,
    cancelRecording: _cancelRecording,
  } = useAudioRecorder();

  /**
   * Отправка текста
   */
  const handleSendText = useCallback(() => {
    const trimmed = textInput.trim();
    if (trimmed) {
      onSendText(trimmed);
      setTextInput("");
    }
  }, [textInput, onSendText]);

  /**
   * Enter для отправки
   */
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSendText();
      }
    },
    [handleSendText]
  );

  /**
   * Hold-to-record: pointer down starts recording
   */
  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      if (!isRecording && !isProcessing) {
        startRecording();
      }
    },
    [isRecording, isProcessing, startRecording]
  );

  /**
   * Hold-to-record: pointer up stops and sends
   */
  const handlePointerUp = useCallback(async () => {
    if (isRecording) {
      const blob = await stopRecording();
      if (blob) {
        onSendAudio(blob);
      }
    }
  }, [isRecording, stopRecording, onSendAudio]);

  const handlePointerLeave = useCallback((_e: React.PointerEvent) => {
    // Don't cancel on pointer leave — user can stop via stop button.
    // Prevents accidental recording loss on mobile finger drift.
  }, []);

  /**
   * Stop button click (recording state)
   */
  const handleStopClick = useCallback(async () => {
    if (isRecording) {
      const blob = await stopRecording();
      if (blob) {
        onSendAudio(blob);
      }
    }
  }, [isRecording, stopRecording, onSendAudio]);

  const hasText = textInput.trim().length > 0;

  // STATE: RECORDING
  if (isRecording) {
    return (
      <div className="flex-shrink-0 bg-voice-bar border-t border-recording/30 px-3 py-[6px] pb-7 relative z-10">
        <div className="flex items-center gap-2 h-9">
          {/* Rec dot + timer */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <div className="w-2 h-2 rounded-full bg-recording animate-blink" />
            <span className="font-mono text-sm font-medium text-recording min-w-[32px]">
              {formatDuration(duration)}
            </span>
          </div>

          {/* Live waveform */}
          <LiveWaveform />

          {/* Stop button — 36x36 */}
          <button
            type="button"
            onClick={handleStopClick}
            aria-label="Stop recording"
            className="w-9 h-9 rounded-full bg-recording flex-shrink-0 flex items-center justify-center active:scale-[0.92] transition-transform"
          >
            <svg viewBox="0 0 24 24" className="w-4 h-4 fill-white">
              <rect x="6" y="6" width="12" height="12" rx="2" />
            </svg>
          </button>
        </div>
      </div>
    );
  }

  // STATE: IDLE or PROCESSING (single row)
  return (
    <div className="flex-shrink-0 bg-voice-bar border-t border-subtle px-3 py-[6px] pb-7 relative z-10">
      <div className="flex items-center gap-2 h-9">
        {/* Text input */}
        <input
          type="text"
          value={textInput}
          onChange={(e) => setTextInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message..."
          disabled={isProcessing}
          className={cn(
            "flex-1 bg-input border border-subtle rounded-full",
            "px-3 py-1.5 text-sm text-primary h-9",
            "placeholder:text-muted outline-none",
            "focus:border-accent transition-colors",
            isProcessing && "opacity-50 cursor-not-allowed"
          )}
          style={{ fontFamily: "var(--font-ui)" }}
        />

        {/* Right button: mic / spinner / send */}
        {isProcessing ? (
          /* Spinner while processing */
          <div
            className="w-9 h-9 rounded-full bg-elevated flex items-center justify-center flex-shrink-0"
            aria-label="Processing..."
          >
            <div className="w-5 h-5 border-2 border-subtle border-t-accent rounded-full animate-spin" />
          </div>
        ) : hasText ? (
          /* Send button when text is entered */
          <button
            type="button"
            onClick={handleSendText}
            aria-label="Send message"
            className={cn(
              "w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0",
              "bg-accent hover:bg-accent-hover transition-all active:scale-[0.9] select-none"
            )}
          >
            <svg viewBox="0 0 24 24" className="w-4 h-4 fill-white">
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
            </svg>
          </button>
        ) : (
          /* Mic button — hold to record */
          <button
            type="button"
            onPointerDown={handlePointerDown}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerLeave}
            onPointerCancel={handlePointerLeave}
            aria-label="Hold to record"
            className={cn(
              "w-9 h-9 rounded-full bg-accent",
              "flex items-center justify-center flex-shrink-0",
              "cursor-pointer select-none touch-none",
              "transition-all",
              "hover:shadow-[0_0_0_6px_rgba(94,92,230,0.12)]",
              "active:scale-[0.92] active:shadow-[0_0_0_8px_rgba(94,92,230,0.08)]"
            )}
            style={{ touchAction: "none" }}
          >
            <svg viewBox="0 0 24 24" className="w-4 h-4 fill-white pointer-events-none">
              <path d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}
