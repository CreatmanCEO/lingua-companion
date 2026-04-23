"use client";

import React, { useState, useCallback, useEffect } from "react";
import type { Message, CompanionName } from "@/store/chatStore";
import { useChatStore } from "@/store/chatStore";
import { ActionPill } from "@/components/ui/ActionPill";
import { playTts, stopTts, getCompanionVoice } from "@/lib/edgeTts";
import { translateText } from "@/lib/translate";

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
 * OpenGraph data for rich link previews
 */
interface OgData {
  title: string;
  description: string;
  image: string;
  favicon: string;
  url: string;
}

/**
 * Extract first URL from text
 */
function extractUrl(text: string): string | null {
  const match = text.match(/https?:\/\/[^\s)]+/);
  return match ? match[0] : null;
}

/**
 * RichLinkCard — auto-fetched OpenGraph preview for URLs
 */
function RichLinkCard({ url }: { url: string }) {
  const [ogData, setOgData] = useState<OgData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8001";
    fetch(`${API_URL}/api/v1/opengraph?url=${encodeURIComponent(url)}`)
      .then((r) => r.json())
      .then((data) => setOgData(data))
      .catch(() => setOgData({ title: url, description: "", image: "", favicon: "", url }))
      .finally(() => setLoading(false));
  }, [url]);

  if (loading) {
    return (
      <div className="mt-2 rounded-lg border border-subtle p-2.5">
        <div className="text-muted text-size-xs">Loading preview...</div>
      </div>
    );
  }

  if (!ogData) return null;

  let hostname = url;
  try {
    hostname = new URL(url).hostname;
  } catch {
    // keep raw url as hostname
  }

  return (
    <a
      href={ogData.url}
      target="_blank"
      rel="noopener noreferrer"
      className="block mt-2 rounded-xl overflow-hidden border border-subtle bg-card transition-all hover:border-accent/20 hover:translate-y-[-1px] active:scale-[0.98]"
      style={{ boxShadow: "var(--shadow-card)" }}
    >
      {ogData.image && (
        <img
          src={ogData.image}
          alt=""
          className="w-full h-[88px] object-cover"
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = "none";
          }}
        />
      )}
      <div className="px-3 pt-[10px] pb-3">
        <div className="flex items-center gap-[5px] text-size-xs text-muted mb-1">
          {ogData.favicon && (
            <img src={ogData.favicon} alt="" className="w-[14px] h-[14px] rounded-sm" />
          )}
          <span>{hostname}</span>
        </div>
        <div
          className="text-primary font-semibold leading-[1.4] mb-1 line-clamp-2"
          style={{ fontSize: "13px" }}
        >
          {ogData.title}
        </div>
        {ogData.description && (
          <div
            className="text-secondary leading-[1.5] line-clamp-2"
            style={{ fontSize: "11px" }}
          >
            {ogData.description}
          </div>
        )}
        <div className="mt-2">
          <span className="text-accent font-medium" style={{ fontSize: "11px" }}>
            Open link &#8599;
          </span>
        </div>
      </div>
    </a>
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
  companionName,
  isStreaming = false,
  onListen,
}: CompanionBubbleProps) {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [showTranslation, setShowTranslation] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const translatedTexts = useChatStore((s) => s.translatedTexts);
  const setTranslation = useChatStore((s) => s.setTranslation);

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

    // Use companion-specific voice personality
    const voice = getCompanionVoice(companionName);
    playTts(message.text, voice)
      .finally(() => setIsSpeaking(false));
  }, [message.text, isSpeaking, onListen, companionName]);

  /**
   * Обработка перевода
   */
  const handleTranslate = useCallback(async () => {
    if (showTranslation) {
      setShowTranslation(false);
      return;
    }

    // Check cache first
    if (translatedTexts[message.id]) {
      setShowTranslation(true);
      return;
    }

    setIsTranslating(true);
    try {
      const translated = await translateText(message.text, "ru");
      setTranslation(message.id, translated);
      setShowTranslation(true);
    } finally {
      setIsTranslating(false);
    }
  }, [message.id, message.text, showTranslation, translatedTexts, setTranslation]);

  /**
   * Форматирование времени сообщения
   */
  const formattedTime = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(message.timestamp);

  // Extract URL from message text for rich link preview
  const detectedUrl = extractUrl(message.text);

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

          {/* Translation */}
          {showTranslation && translatedTexts[message.id] && (
            <p className="text-secondary text-size-sm leading-[1.5] mt-1 pt-1 border-t border-subtle italic">
              {translatedTexts[message.id]}
            </p>
          )}

          {/* Rich link card — auto-preview URLs in message */}
          {detectedUrl && !isStreaming && (
            <RichLinkCard url={detectedUrl} />
          )}

          {/* Actions — hidden during streaming */}
          {!isStreaming && (
            <div className="flex gap-[6px] mt-[10px] flex-wrap">
              <ActionPill onClick={handleListen} isPlaying={isSpeaking}>
                {isSpeaking ? "⏸ Playing" : "▶ Listen"}
              </ActionPill>
              <ActionPill onClick={handleTranslate} disabled={isTranslating}>
                {isTranslating ? "..." : showTranslation ? "EN" : "RU"}
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
