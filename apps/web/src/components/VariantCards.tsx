"use client";

import React, { useState, useCallback, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import type { VariantsResult } from "@/hooks/useVoiceSession";

/**
 * Стили вариантов
 */
export type VariantStyle =
  | "simple"
  | "professional"
  | "colloquial"
  | "slang"
  | "idiom";

/**
 * Конфигурация стилей из прототипа
 */
interface VariantConfig {
  name: string;
  color: string;
  bgColor: string;
  borderColor: string;
  subtitle: string;
}

const VARIANT_CONFIGS: Record<VariantStyle, VariantConfig> = {
  simple: {
    name: "Simple",
    color: "var(--c-simple)",
    bgColor: "rgba(50,215,75,0.1)",
    borderColor: "rgba(50,215,75,0.2)",
    subtitle: "Everyday conversation, all levels understand",
  },
  professional: {
    name: "Professional",
    color: "var(--c-professional)",
    bgColor: "rgba(10,132,255,0.1)",
    borderColor: "rgba(10,132,255,0.2)",
    subtitle: "Technical presentations, job interviews",
  },
  colloquial: {
    name: "Casual",
    color: "var(--c-colloquial)",
    bgColor: "rgba(255,159,10,0.1)",
    borderColor: "rgba(255,159,10,0.2)",
    subtitle: "Slack messages, team chats, stand-ups",
  },
  slang: {
    name: "Slang",
    color: "var(--c-slang)",
    bgColor: "rgba(255,55,95,0.1)",
    borderColor: "rgba(255,55,95,0.2)",
    subtitle: "Developer Twitter, after-hours chats",
  },
  idiom: {
    name: "Idiom",
    color: "var(--c-idiom)",
    bgColor: "rgba(191,90,242,0.1)",
    borderColor: "rgba(191,90,242,0.2)",
    subtitle: "Sounds native — use when confident",
  },
};

/**
 * Props для одной карточки
 */
interface VariantCardProps {
  style: VariantStyle;
  phrase: string;
  isSaved: boolean;
  onSave: () => void;
  onPlay: () => void;
  isPlaying: boolean;
}

/**
 * Компонент одной карточки варианта из прототипа
 */
function VariantCard({
  style,
  phrase,
  isSaved,
  onSave,
  onPlay,
  isPlaying,
}: VariantCardProps) {
  const config = VARIANT_CONFIGS[style];

  return (
    <div
      className="flex-shrink-0 w-[160px] rounded-xl p-3 transition-all active:scale-[0.97]"
      style={{
        background: "var(--bg-card)",
        border: `1px solid ${config.borderColor}`,
        boxShadow: "var(--shadow-card)",
        scrollSnapAlign: "start",
      }}
    >
      {/* Badge */}
      <div
        className="inline-flex items-center gap-[5px] px-2 py-[3px] rounded-full mb-[7px]"
        style={{
          background: config.bgColor,
          color: config.color,
          fontSize: "10px",
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.5px",
        }}
      >
        <span
          className="w-[6px] h-[6px] rounded-full flex-shrink-0"
          style={{ background: config.color }}
        />
        {config.name}
      </div>

      {/* Text */}
      <div
        className="text-primary leading-[1.5] mb-[7px]"
        style={{ fontSize: "12px", minHeight: "52px" }}
      >
        &ldquo;{phrase}&rdquo;
      </div>

      {/* Subtitle */}
      <div
        className="text-muted leading-[1.4] mb-[10px]"
        style={{ fontSize: "10px" }}
      >
        {config.subtitle}
      </div>

      {/* Actions */}
      <div className="flex gap-[5px]">
        {/* Play button */}
        <button
          type="button"
          onClick={onPlay}
          aria-label={isPlaying ? `Stop playing ${config.name}` : `Play ${config.name} variant`}
          className={cn(
            "flex-1 py-[5px] rounded-[7px] text-center transition-all active:scale-[0.93]",
            "border text-size-xs font-medium"
          )}
          style={{
            background: isPlaying ? config.bgColor : "var(--bg-elevated)",
            borderColor: isPlaying ? config.borderColor : "var(--bg-border)",
            color: isPlaying ? config.color : "var(--text-secondary)",
          }}
        >
          {isPlaying ? "⏸" : "▶"}
        </button>

        {/* Save button */}
        <button
          type="button"
          onClick={onSave}
          disabled={isSaved}
          aria-label={isSaved ? `${config.name} saved` : `Save ${config.name} variant`}
          className={cn(
            "flex-1 py-[5px] rounded-[7px] text-center transition-all active:scale-[0.93]",
            "border text-size-xs font-medium"
          )}
          style={{
            background: isSaved ? "rgba(50,215,75,0.08)" : "var(--accent-soft)",
            borderColor: isSaved ? "rgba(50,215,75,0.2)" : "var(--accent-soft)",
            color: isSaved ? "var(--success)" : "var(--accent)",
          }}
        >
          {isSaved ? "✓ Saved" : "+ Save"}
        </button>
      </div>
    </div>
  );
}

/**
 * Props для VariantCards
 */
interface VariantCardsProps {
  variants: VariantsResult;
  onSave?: (style: VariantStyle, phrase: string) => void;
  className?: string;
}

/**
 * VariantCards компонент (horizontal scroll) из прототипа
 *
 * CSS fix из прототипа:
 * - Outer wrapper: margin: 0 -16px; overflow: hidden;
 * - Scroll container: padding: 4px 16px 10px; overflow-x: auto; gap: 8px;
 * - Cards: scroll-snap-type: x mandatory; scroll-snap-align: start;
 */
export function VariantCards({
  variants,
  onSave,
  className,
}: VariantCardsProps) {
  const [savedStyles, setSavedStyles] = useState<Set<VariantStyle>>(new Set());
  const [playingStyle, setPlayingStyle] = useState<VariantStyle | null>(null);

  // Отменяем TTS при unmount
  useEffect(() => {
    return () => { window.speechSynthesis.cancel(); };
  }, []);
  const scrollRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);
  const startXRef = useRef(0);
  const scrollLeftRef = useRef(0);

  /**
   * Обработка сохранения
   */
  const handleSave = useCallback(
    (style: VariantStyle, phrase: string) => {
      setSavedStyles((prev) => new Set(prev).add(style));
      onSave?.(style, phrase);
    },
    [onSave]
  );

  /**
   * Обработка TTS проигрывания
   */
  const handlePlay = useCallback(
    (style: VariantStyle, phrase: string) => {
      if (playingStyle === style) {
        window.speechSynthesis.cancel();
        setPlayingStyle(null);
        return;
      }

      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(phrase);
      utterance.lang = "en-US";
      utterance.rate = 0.88;
      utterance.pitch = 1.0;
      utterance.onend = () => setPlayingStyle(null);
      utterance.onerror = () => setPlayingStyle(null);

      window.speechSynthesis.speak(utterance);
      setPlayingStyle(style);
    },
    [playingStyle]
  );

  /**
   * Drag-to-scroll на desktop
   */
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!scrollRef.current) return;
    isDraggingRef.current = true;
    startXRef.current = e.pageX - scrollRef.current.offsetLeft;
    scrollLeftRef.current = scrollRef.current.scrollLeft;
    scrollRef.current.style.cursor = "grabbing";
  }, []);

  const handleMouseUp = useCallback(() => {
    isDraggingRef.current = false;
    if (scrollRef.current) {
      scrollRef.current.style.cursor = "grab";
    }
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDraggingRef.current || !scrollRef.current) return;
    e.preventDefault();
    const x = e.pageX - scrollRef.current.offsetLeft;
    const walk = x - startXRef.current;
    scrollRef.current.scrollLeft = scrollLeftRef.current - walk;
  }, []);

  const handleMouseLeave = useCallback(() => {
    isDraggingRef.current = false;
    if (scrollRef.current) {
      scrollRef.current.style.cursor = "grab";
    }
  }, []);

  // Порядок вариантов
  const variantOrder: VariantStyle[] = [
    "simple",
    "professional",
    "colloquial",
    "slang",
    "idiom",
  ];

  return (
    <div className={cn("mb-3 animate-fade-slide-up", className)}>
      {/* Label */}
      <div
        className="text-muted px-[2px] mb-2"
        style={{
          fontSize: "10px",
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.6px",
        }}
      >
        5 Ways to say it
      </div>

      {/* Outer wrapper: edge-to-edge scroll */}
      <div className="mx-[-16px] overflow-hidden">
        {/* Scroll container */}
        <div
          ref={scrollRef}
          className="flex gap-2 px-4 py-1 pb-[10px] overflow-x-auto cursor-grab scrollbar-hide"
          style={{
            WebkitOverflowScrolling: "touch",
            scrollSnapType: "x mandatory",
          }}
          onMouseDown={handleMouseDown}
          onMouseUp={handleMouseUp}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        >
          {variantOrder.map((style) => (
            <VariantCard
              key={style}
              style={style}
              phrase={variants[style]}
              isSaved={savedStyles.has(style)}
              onSave={() => handleSave(style, variants[style])}
              onPlay={() => handlePlay(style, variants[style])}
              isPlaying={playingStyle === style}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
