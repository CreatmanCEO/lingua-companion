"use client";

import React, { useState, useCallback, useEffect } from "react";
import type { Message, CompanionName } from "@/store/chatStore";
import { ActionPill } from "@/components/ui/ActionPill";
import { playTts, stopTts } from "@/lib/edgeTts";

/**
 * Props для CompanionBubble
 */
interface CompanionBubbleProps {
  message: Message;
  companionName: CompanionName;
  isStreaming?: boolean;
  onListen?: (text: string) => void;
}

/**
 * Avatar small из прототипа (30px с silhouette)
 */
function AvatarSmall() {
  return (
    <div
      className="w-[30px] h-[30px] rounded-full flex items-center justify-center flex-shrink-0 mt-[2px] overflow-hidden relative"
      style={{
        background: "linear-gradient(135deg, #5E5CE6, #BF5AF2)",
      }}
    >
      <svg
        viewBox="0 0 30 30"
        className="w-full h-full absolute inset-0"
        style={{ opacity: 0.7 }}
      >
        <circle cx="15" cy="11" r="5" fill="rgba(255,255,255,0.7)" />
        <ellipse cx="15" cy="28" rx="10" ry="7" fill="rgba(255,255,255,0.5)" />
      </svg>
    </div>
  );
}

/**
 * Rich Link Card из прототипа
 */
interface RichCardProps {
  title: string;
  description: string;
  source: string;
  emoji?: string;
  readTime?: string;
  onClick?: () => void;
}

function RichCard({
  title,
  description,
  source,
  emoji = "⚙️",
  readTime = "4 min read",
  onClick,
}: RichCardProps) {
  return (
    <div
      className="mt-2 rounded-xl overflow-hidden border border-subtle bg-card cursor-pointer transition-all hover:border-accent/20 hover:translate-y-[-1px] active:scale-[0.98]"
      style={{ boxShadow: "var(--shadow-card)" }}
      onClick={onClick}
    >
      {/* Image area */}
      <div
        className="w-full h-[88px] flex items-center justify-center relative overflow-hidden"
        style={{
          background: "linear-gradient(135deg, #1a1a3a 0%, #2a1a4a 50%, #1a2a4a 100%)",
          fontSize: "32px",
        }}
      >
        {emoji}
        <div
          className="absolute inset-0"
          style={{
            background: "linear-gradient(to bottom, transparent 40%, rgba(0,0,0,0.35))",
          }}
        />
      </div>

      {/* Body */}
      <div className="px-3 pt-[10px] pb-3">
        {/* Source */}
        <div className="flex items-center gap-[5px] text-size-xs text-muted mb-1">
          <div
            className="w-[14px] h-[14px] rounded-[3px] bg-accent-soft flex items-center justify-center"
            style={{ fontSize: "8px", fontWeight: 700, color: "var(--accent)" }}
          >
            {source[0]?.toUpperCase()}
          </div>
          <span>{source}</span>
        </div>

        {/* Title */}
        <div
          className="text-primary font-semibold leading-[1.4] mb-1"
          style={{ fontSize: "13px" }}
        >
          {title}
        </div>

        {/* Description */}
        <div
          className="text-secondary leading-[1.5] line-clamp-2"
          style={{ fontSize: "11px" }}
        >
          {description}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between mt-2">
          <span className="text-accent font-medium" style={{ fontSize: "11px" }}>
            Read article ↗
          </span>
          <span className="text-muted" style={{ fontSize: "10px" }}>
            {readTime}
          </span>
        </div>
      </div>
    </div>
  );
}

/**
 * CompanionBubble компонент из прототипа
 *
 * Layout:
 * - Avatar small (30px, gradient, silhouette)
 * - Bubble (bg-comp-bubble, border, rounded-[4px 18px 18px 18px])
 * - Text content
 * - Rich card (optional)
 * - [▶ Listen] button
 * - Timestamp
 */
export function CompanionBubble({
  message,
  companionName: _companionName,
  isStreaming = false,
  onListen,
}: CompanionBubbleProps) {
  const [isSpeaking, setIsSpeaking] = useState(false);

  // Отменяем TTS при unmount
  useEffect(() => {
    return () => { stopTts(); };
  }, []);

  /**
   * Обработка TTS через Edge-TTS
   */
  const handleListen = useCallback(() => {
    if (isSpeaking) {
      stopTts();
      setIsSpeaking(false);
      return;
    }

    setIsSpeaking(true);
    onListen?.(message.text);

    playTts(message.text)
      .finally(() => setIsSpeaking(false));
  }, [message.text, isSpeaking, onListen]);

  /**
   * Форматирование времени сообщения
   */
  const formattedTime = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(message.timestamp);

  // Check if message has rich card data (can be extended later)
  const hasRichCard = message.text.includes("Saw this") || message.text.includes("article");

  return (
    <div className="flex gap-[10px] items-start mb-3 animate-fade-slide-up">
      {/* Avatar */}
      <AvatarSmall />

      {/* Content */}
      <div className="max-w-[268px]">
        {/* Bubble */}
        <div
          className="bg-comp-bubble border border-subtle px-[14px] py-[10px]"
          style={{
            borderRadius: "4px 18px 18px 18px",
            boxShadow: "var(--shadow-card)",
          }}
        >
          {/* Text */}
          <p className="text-primary text-size-base leading-[1.55]">
            {message.text}
            {isStreaming && (
              <span className="inline-block w-[2px] h-[1em] bg-accent ml-0.5 animate-pulse align-middle" />
            )}
          </p>

          {/* Rich card (demo - показываем для первого сообщения) */}
          {hasRichCard && (
            <RichCard
              emoji="⚙️"
              source="github.blog"
              title="Rust overtakes Go in backend benchmarks — Netflix case study"
              description="Netflix's infra team migrated 40 services to Rust with zero downtime and 3× throughput gains."
              readTime="4 min read"
              onClick={() => console.log("Opening article...")}
            />
          )}

          {/* Actions — hidden during streaming */}
          {!isStreaming && (
            <div className="flex gap-[6px] mt-[10px] flex-wrap">
              <ActionPill onClick={handleListen} isPlaying={isSpeaking}>
                {isSpeaking ? "⏸ Playing" : "▶ Listen"}
              </ActionPill>
            </div>
          )}
        </div>

        {/* Timestamp */}
        <div className="text-size-xs text-muted mt-1 pl-[40px]">
          {formattedTime}
        </div>
      </div>
    </div>
  );
}
