"use client";

import React, { useState, useCallback, useEffect } from "react";
import { cn } from "@/lib/utils";
import { useAudioRecorder } from "@/hooks/useAudioRecorder";

/**
 * Режим ввода
 */
export type InputMode = "text" | "voice";

/**
 * Props для VoiceBar
 */
interface VoiceBarProps {
  mode: InputMode;
  onModeChange: (mode: InputMode) => void;
  onSendText: (text: string) => void;
  onSendAudio: (blob: Blob) => void;
  isProcessing: boolean;
  processingTime?: number;
  companionName?: string;
  companionStyle?: string;
}

/**
 * Live waveform bars из прототипа
 */
const LIVE_BAR_HEIGHTS = [8, 16, 24, 20, 28, 18, 22, 12, 20, 14, 10, 18];

function LiveWaveform() {
  return (
    <div className="flex-1 flex items-center gap-[2px] h-8" aria-hidden="true">
      {LIVE_BAR_HEIGHTS.map((height, index) => (
        <div
          key={index}
          className="w-[3px] bg-accent rounded-sm animate-live-bar"
          style={{
            height: `${height}px`,
            animationDelay: `${index * 0.05}s`,
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
  const mins = String(Math.floor(seconds / 60)).padStart(2, "0");
  const secs = String(seconds % 60).padStart(2, "0");
  return `${mins}:${secs}`;
}

/**
 * VoiceBar компонент из прототипа
 *
 * 4 состояния:
 * 1. TEXT mode: [mode pills] + [text input] + [send button]
 * 2. VOICE mode: [mode pills] + [mic hint] + [large mic button]
 * 3. RECORDING: [rec dot] + [timer] + [live waveform] + [cancel hint] + [stop button]
 * 4. PROCESSING: [spinner] + [Processing speech...] + [progress bar]
 */
export function VoiceBar({
  mode,
  onModeChange,
  onSendText,
  onSendAudio,
  isProcessing,
  processingTime = 2.1,
  companionName = "Alex",
  companionStyle = "Professional",
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
   * Hold-to-record handlers
   */
  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      if (mode === "voice" && !isRecording && !isProcessing) {
        startRecording();
      }
    },
    [mode, isRecording, isProcessing, startRecording]
  );

  const handlePointerUp = useCallback(async () => {
    if (isRecording) {
      const blob = await stopRecording();
      if (blob) {
        onSendAudio(blob);
      }
    }
  }, [isRecording, stopRecording, onSendAudio]);

  const handlePointerLeave = useCallback((_e: React.PointerEvent) => {
    // Не отменяем запись при случайном уходе пальца — пользователь может
    // остановить через stop button. Это предотвращает потерю записи
    // при незначительном смещении пальца на мобильных.
  }, []);

  /**
   * Stop button click
   */
  const handleStopClick = useCallback(async () => {
    if (isRecording) {
      const blob = await stopRecording();
      if (blob) {
        onSendAudio(blob);
      }
    }
  }, [isRecording, stopRecording, onSendAudio]);

  // CSS keyframes для progress bar
  useEffect(() => {
    if (typeof document === "undefined") return;

    const existingStyle = document.getElementById("voicebar-keyframes");
    if (!existingStyle) {
      const style = document.createElement("style");
      style.id = "voicebar-keyframes";
      style.textContent = `
        @keyframes progFill {
          0% { width: 0%; }
          40% { width: 55%; }
          70% { width: 75%; }
          90% { width: 88%; }
          100% { width: 92%; }
        }
      `;
      document.head.appendChild(style);
    }
  }, []);

  // STATE: PROCESSING
  if (isProcessing) {
    return (
      <div className="flex-shrink-0 bg-voice-bar border-t border-subtle px-4 py-[10px] pb-7 relative z-10">
        <div className="flex flex-col gap-2">
          {/* Label row */}
          <div className="flex items-center gap-2 text-size-sm text-secondary">
            <div className="w-4 h-4 border-2 border-subtle border-t-accent rounded-full animate-spin" />
            <span>Processing speech...</span>
            <span className="ml-auto font-mono text-size-xs text-muted">
              ~{processingTime}s
            </span>
          </div>

          {/* Progress bar */}
          <div className="h-[2px] bg-subtle rounded-full overflow-hidden">
            <div
              className="h-full bg-accent rounded-full"
              style={{
                animation: `progFill ${processingTime}s ease-in-out forwards`,
              }}
            />
          </div>
        </div>
      </div>
    );
  }

  // STATE: RECORDING
  if (isRecording) {
    return (
      <div className="flex-shrink-0 bg-voice-bar border-t border-subtle px-4 py-[10px] pb-7 relative z-10">
        <div className="flex items-center gap-2">
          {/* Rec dot */}
          <div className="w-2 h-2 rounded-full bg-recording animate-blink flex-shrink-0" />

          {/* Timer */}
          <span className="font-mono text-size-sm font-medium text-recording min-w-[38px]">
            {formatDuration(duration)}
          </span>

          {/* Live waveform */}
          <LiveWaveform />

          {/* Cancel hint */}
          <span className="text-size-xs text-muted whitespace-nowrap flex-shrink-0">
            ← cancel
          </span>

          {/* Stop button */}
          <button
            type="button"
            onClick={handleStopClick}
            aria-label="Stop recording"
            className="w-[50px] h-[50px] rounded-full bg-recording flex-shrink-0 flex items-center justify-center animate-pulse-recording"
            style={{
              boxShadow: "0 0 0 4px rgba(255,59,48,0.15)",
            }}
          >
            <svg viewBox="0 0 24 24" className="w-5 h-5 fill-white">
              <rect x="6" y="6" width="12" height="12" rx="2" />
            </svg>
          </button>
        </div>
      </div>
    );
  }

  // STATE: IDLE (TEXT or VOICE)
  return (
    <div className="flex-shrink-0 bg-voice-bar border-t border-subtle px-4 py-[10px] pb-7 relative z-10">
      {/* Mode toggle row */}
      <div className="flex items-center justify-between mb-[10px]">
        {/* Mode pills */}
        <div className="flex gap-[3px] bg-card p-[3px] rounded-[10px] border border-subtle">
          <button
            type="button"
            onClick={() => onModeChange("text")}
            className={cn(
              "px-3 py-1 rounded-[7px] text-size-xs font-medium transition-all select-none",
              mode === "text"
                ? "bg-accent text-white"
                : "text-muted hover:text-secondary"
            )}
          >
            ⌨️ Text
          </button>
          <button
            type="button"
            onClick={() => onModeChange("voice")}
            className={cn(
              "px-3 py-1 rounded-[7px] text-size-xs font-medium transition-all select-none",
              mode === "voice"
                ? "bg-accent text-white"
                : "text-muted hover:text-secondary"
            )}
          >
            🎤 Voice
          </button>
        </div>

        {/* Companion label */}
        <span className="text-size-xs text-muted">
          {companionName} · {companionStyle}
        </span>
      </div>

      {mode === "text" ? (
        // TEXT STATE
        <div className="flex gap-2 items-center">
          <input
            type="text"
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            className={cn(
              "flex-1 bg-input border border-subtle rounded-full",
              "px-4 py-[10px] text-size-base text-primary",
              "placeholder:text-muted outline-none",
              "focus:border-accent transition-colors"
            )}
            style={{ fontFamily: "var(--font-ui)" }}
          />
          <button
            type="button"
            onClick={handleSendText}
            disabled={!textInput.trim()}
            className={cn(
              "w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0",
              "transition-all active:scale-[0.9] select-none",
              textInput.trim()
                ? "bg-accent hover:bg-accent-hover"
                : "bg-elevated cursor-not-allowed"
            )}
          >
            <svg viewBox="0 0 24 24" className="w-4 h-4 fill-white">
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
            </svg>
          </button>
        </div>
      ) : (
        // VOICE STATE
        <div className="flex flex-col items-center gap-1">
          <span className="text-size-xs text-muted">
            Hold to speak · release to send
          </span>
          <button
            type="button"
            onPointerDown={handlePointerDown}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerLeave}
            onPointerCancel={handlePointerLeave}
            className={cn(
              "w-[66px] h-[66px] rounded-full bg-accent",
              "flex items-center justify-center cursor-pointer relative",
              "transition-all select-none touch-none",
              "hover:shadow-[0_0_0_10px_rgba(94,92,230,0.12)]",
              "active:scale-[0.94] active:shadow-[0_0_0_14px_rgba(94,92,230,0.08)]"
            )}
            style={{ touchAction: "none" }}
          >
            <svg viewBox="0 0 24 24" className="w-7 h-7 fill-white pointer-events-none">
              <path d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}
