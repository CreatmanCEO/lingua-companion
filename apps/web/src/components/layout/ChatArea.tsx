"use client";

import React, { useEffect, useRef, useMemo, forwardRef } from "react";
import { UserBubble } from "@/components/UserBubble";
import { CompanionBubble } from "@/components/CompanionBubble";
import { ReconstructionBlock } from "@/components/ReconstructionBlock";
import { VariantCards } from "@/components/VariantCards";
import type { Message, CompanionName } from "@/store/chatStore";
import type { ReconstructionResult, VariantsResult } from "@/hooks/useVoiceSession";

/**
 * Props для ChatArea
 */
interface ChatAreaProps {
  messages: Message[];
  companionName: CompanionName;
  currentReconstruction: ReconstructionResult | null;
  currentVariants: VariantsResult | null;
  isAnalysing: boolean;
  isTyping?: boolean;
  streamingText?: string;
  onTranscribe?: (messageId: string) => void;
  onAnalyse?: (messageId: string) => void;
  onSaveVariant?: (style: string, phrase: string) => void;
}

/**
 * Date divider из прототипа
 */
function DateDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-[10px] my-1">
      <div className="flex-1 h-px bg-subtle" />
      <span className="text-size-xs text-muted whitespace-nowrap">{label}</span>
      <div className="flex-1 h-px bg-subtle" />
    </div>
  );
}

/**
 * AI Thinking indicator из прототипа
 */
function AIThinking({ companionName }: { companionName: string }) {
  return (
    <div className="flex items-center gap-2 py-2 animate-fade-slide-up">
      {/* Mini avatar */}
      <div
        className="w-6 h-6 rounded-full flex items-center justify-center overflow-hidden"
        style={{
          background: "linear-gradient(135deg, #5E5CE6, #BF5AF2)",
        }}
      >
        <svg viewBox="0 0 24 24" className="w-4 h-4" style={{ opacity: 0.7 }}>
          <circle cx="12" cy="9" r="4" fill="rgba(255,255,255,0.7)" />
          <ellipse cx="12" cy="22" rx="8" ry="5" fill="rgba(255,255,255,0.5)" />
        </svg>
      </div>

      <span className="text-size-xs text-muted">{companionName} is thinking</span>

      {/* AI dots */}
      <div className="flex gap-[3px]">
        <span
          className="w-[5px] h-[5px] rounded-full bg-accent animate-ai-dot"
          style={{ animationDelay: "0s" }}
        />
        <span
          className="w-[5px] h-[5px] rounded-full bg-accent animate-ai-dot"
          style={{ animationDelay: "0.2s" }}
        />
        <span
          className="w-[5px] h-[5px] rounded-full bg-accent animate-ai-dot"
          style={{ animationDelay: "0.4s" }}
        />
      </div>
    </div>
  );
}

/**
 * ChatArea компонент из прототипа
 *
 * - Scrollable area с custom scrollbar
 * - Date dividers
 * - Companion messages (слева)
 * - User messages (справа)
 * - Reconstruction + Variants после user message
 * - AI thinking indicator
 */
export const ChatArea = forwardRef<HTMLDivElement, ChatAreaProps>(function ChatArea({
  messages,
  companionName,
  currentReconstruction,
  currentVariants,
  isAnalysing,
  isTyping = false,
  streamingText = "",
  onTranscribe,
  onAnalyse,
  onSaveVariant,
}, ref) {
  const internalRef = useRef<HTMLDivElement>(null);
  const scrollRef = (ref as React.RefObject<HTMLDivElement | null>) || internalRef;
  const bottomRef = useRef<HTMLDivElement>(null);

  // Индекс последнего user message (для показа Reconstruction/Variants)
  const lastUserMessageIndex = useMemo(
    () => messages.findLastIndex((m) => m.sender === "user"),
    [messages]
  );

  // Автоскролл при новых сообщениях и streaming
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, currentReconstruction, currentVariants, isAnalysing, streamingText]);

  return (
    <div
      ref={scrollRef}
      className="flex-1 overflow-y-auto overflow-x-hidden px-4 py-4 bg-void"
      style={{
        scrollBehavior: "smooth",
      }}
    >
      {/* Custom scrollbar styles */}
      <style jsx>{`
        div::-webkit-scrollbar {
          width: 3px;
        }
        div::-webkit-scrollbar-thumb {
          background: var(--bg-border);
          border-radius: 3px;
        }
      `}</style>

      {/* Date divider */}
      <DateDivider label="Today" />

      {/* Empty state */}
      {messages.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center mb-4"
            style={{
              background: "linear-gradient(135deg, #5E5CE6 0%, #BF5AF2 100%)",
            }}
          >
            <span className="text-2xl font-medium text-white">
              {companionName[0]}
            </span>
          </div>
          <h2 className="text-size-lg font-medium text-primary mb-1">
            {companionName}
          </h2>
          <p className="text-secondary text-size-sm">
            Ready to practice. Hold mic to speak or type a message.
          </p>
        </div>
      )}

      {/* Messages */}
      {messages.map((message, index) => {
        const isLastUserMessage =
          message.sender === "user" && index === lastUserMessageIndex;

        return (
          <React.Fragment key={message.id}>
            {message.sender === "companion" ? (
              <CompanionBubble
                message={message}
                companionName={companionName}
              />
            ) : (
              <UserBubble
                message={message}
                onTranscribe={() => onTranscribe?.(message.id)}
                onAnalyse={() => onAnalyse?.(message.id)}
                isAnalysing={isAnalysing && isLastUserMessage}
              />
            )}

            {/* Показываем Reconstruction и Variants после последнего user message */}
            {isLastUserMessage && (
              <>
                {currentReconstruction && (
                  <ReconstructionBlock
                    original={message.text || currentReconstruction.original_intent}
                    corrected={currentReconstruction.corrected}
                    explanation={currentReconstruction.explanation}
                    errorType={currentReconstruction.error_type}
                  />
                )}

                {currentVariants && (
                  <VariantCards
                    variants={currentVariants}
                    onSave={(style, phrase) => onSaveVariant?.(style, phrase)}
                  />
                )}
              </>
            )}
          </React.Fragment>
        );
      })}

      {/* Streaming companion bubble */}
      {streamingText && (
        <CompanionBubble
          message={{
            id: "streaming",
            sender: "companion",
            contentType: "text",
            text: streamingText,
            timestamp: Date.now(),
          }}
          companionName={companionName}
          isStreaming
        />
      )}

      {/* AI thinking indicator */}
      {(isAnalysing || isTyping) && !streamingText && (
        <AIThinking companionName={companionName} />
      )}

      {/* Bottom anchor for auto-scroll */}
      <div ref={bottomRef} />
    </div>
  );
});
