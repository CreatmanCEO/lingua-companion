"use client";

import React, { useCallback, useEffect, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { apiGet, apiPost, apiDelete } from "@/lib/api";

interface SavedPhrase {
  id: number;
  text: string;
  style: string | null;
  context: string | null;
  translation: string | null;
  ease_factor: number;
  interval_days: number;
  repetitions: number;
  next_review: string;
  created_at: string;
}

type TabMode = "all" | "due";

const STYLE_COLORS: Record<string, { color: string; bg: string }> = {
  simple: { color: "var(--c-simple)", bg: "rgba(50,215,75,0.1)" },
  professional: { color: "var(--c-professional)", bg: "rgba(10,132,255,0.1)" },
  colloquial: { color: "var(--c-colloquial)", bg: "rgba(255,159,10,0.1)" },
  slang: { color: "var(--c-slang)", bg: "rgba(255,55,95,0.1)" },
  idiom: { color: "var(--c-idiom)", bg: "rgba(191,90,242,0.1)" },
};

interface PhraseLibraryProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PhraseLibrary({ open, onOpenChange }: PhraseLibraryProps) {
  const [tab, setTab] = useState<TabMode>("all");
  const [phrases, setPhrases] = useState<SavedPhrase[]>([]);
  const [loading, setLoading] = useState(false);
  const [reviewingPhrase, setReviewingPhrase] = useState<SavedPhrase | null>(null);
  const [reviewFeedback, setReviewFeedback] = useState<string | null>(null);

  const fetchPhrases = useCallback(async () => {
    setLoading(true);
    try {
      const endpoint = tab === "due" ? "/api/v1/phrases/due" : "/api/v1/phrases";
      const data = await apiGet(endpoint);
      setPhrases(data.phrases || []);
    } catch {
      setPhrases([]);
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => {
    if (open) {
      fetchPhrases();
    }
  }, [open, fetchPhrases]);

  const handleDelete = useCallback(async (id: number) => {
    try {
      await apiDelete(`/api/v1/phrases/${id}`);
      setPhrases((prev) => prev.filter((p) => p.id !== id));
    } catch {
      // ignore
    }
  }, []);

  const handleReview = useCallback(async (phraseId: number, quality: number) => {
    try {
      const result = await apiPost(`/api/v1/phrases/${phraseId}/review`, { quality });
      setReviewFeedback(
        quality >= 3
          ? `Next review in ${result.interval_days} day${result.interval_days !== 1 ? "s" : ""}`
          : "Reset — will review again tomorrow"
      );
      // Remove from due list or update in all list
      setPhrases((prev) => prev.filter((p) => p.id !== phraseId));
      setTimeout(() => {
        setReviewingPhrase(null);
        setReviewFeedback(null);
      }, 1500);
    } catch {
      setReviewFeedback("Review failed");
      setTimeout(() => setReviewFeedback(null), 2000);
    }
  }, []);

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      const now = new Date();
      const diffMs = d.getTime() - now.getTime();
      const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
      if (diffDays <= 0) return "Due now";
      if (diffDays === 1) return "Tomorrow";
      return `In ${diffDays} days`;
    } catch {
      return "";
    }
  };

  // Review mode overlay
  if (reviewingPhrase) {
    const sc = STYLE_COLORS[reviewingPhrase.style || ""] || { color: "var(--text-primary)", bg: "var(--bg-card)" };
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="bg-surface border-subtle w-full sm:w-[400px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="text-primary">Review</SheetTitle>
          </SheetHeader>

          <div className="mt-8 flex flex-col items-center gap-6 px-4">
            {/* Style badge */}
            {reviewingPhrase.style && (
              <span
                className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-size-xs font-bold uppercase"
                style={{ background: sc.bg, color: sc.color }}
              >
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: sc.color }} />
                {reviewingPhrase.style}
              </span>
            )}

            {/* Phrase text */}
            <div className="text-primary text-center text-lg font-medium leading-relaxed">
              &ldquo;{reviewingPhrase.text}&rdquo;
            </div>

            {/* Translation (hidden initially, tap to reveal) */}
            <TranslationReveal translation={reviewingPhrase.translation} />

            {/* Feedback after review */}
            {reviewFeedback ? (
              <div className="text-accent text-size-sm font-medium animate-fade-slide-up">
                {reviewFeedback}
              </div>
            ) : (
              <>
                <div className="text-muted text-size-sm mt-4">How well do you remember?</div>
                <div className="flex gap-3 w-full">
                  <button
                    type="button"
                    onClick={() => handleReview(reviewingPhrase.id, 1)}
                    className="flex-1 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 font-medium text-size-sm transition-all active:scale-[0.95]"
                  >
                    Forgot
                  </button>
                  <button
                    type="button"
                    onClick={() => handleReview(reviewingPhrase.id, 3)}
                    className="flex-1 py-3 rounded-xl bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 font-medium text-size-sm transition-all active:scale-[0.95]"
                  >
                    Hard
                  </button>
                  <button
                    type="button"
                    onClick={() => handleReview(reviewingPhrase.id, 5)}
                    className="flex-1 py-3 rounded-xl bg-green-500/10 border border-green-500/20 text-green-400 font-medium text-size-sm transition-all active:scale-[0.95]"
                  >
                    Easy
                  </button>
                </div>
              </>
            )}

            <button
              type="button"
              onClick={() => { setReviewingPhrase(null); setReviewFeedback(null); }}
              className="text-muted text-size-xs hover:text-secondary transition-colors mt-2"
            >
              Back to list
            </button>
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="bg-surface border-subtle w-full sm:w-[400px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-primary">Phrase Library</SheetTitle>
        </SheetHeader>

        {/* Tabs */}
        <div className="flex gap-2 mt-4 mb-4">
          <button
            type="button"
            onClick={() => setTab("all")}
            className={`px-3 py-1.5 rounded-lg text-size-sm font-medium transition-all border ${
              tab === "all"
                ? "bg-accent text-white border-accent"
                : "bg-card text-secondary border-subtle hover:border-accent/30"
            }`}
          >
            All phrases
          </button>
          <button
            type="button"
            onClick={() => setTab("due")}
            className={`px-3 py-1.5 rounded-lg text-size-sm font-medium transition-all border ${
              tab === "due"
                ? "bg-accent text-white border-accent"
                : "bg-card text-secondary border-subtle hover:border-accent/30"
            }`}
          >
            Due for review
          </button>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-muted text-size-sm">Loading...</div>
          </div>
        ) : phrases.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-2">
            <div className="text-muted text-size-sm">
              {tab === "due" ? "No phrases due for review" : "No saved phrases yet"}
            </div>
            <div className="text-muted text-size-xs">
              {tab === "all" ? "Save phrases from variant cards to build your library" : "Come back later!"}
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {phrases.map((phrase) => {
              const sc = STYLE_COLORS[phrase.style || ""] || { color: "var(--text-primary)", bg: "var(--bg-card)" };
              return (
                <div
                  key={phrase.id}
                  className="relative rounded-xl p-3 border border-subtle bg-card transition-all"
                >
                  {/* Delete button */}
                  <button
                    type="button"
                    onClick={() => handleDelete(phrase.id)}
                    className="absolute top-2 right-2 w-6 h-6 flex items-center justify-center rounded-md text-muted hover:text-red-400 hover:bg-red-500/10 transition-all text-size-xs"
                    aria-label="Delete phrase"
                  >
                    x
                  </button>

                  {/* Style badge */}
                  {phrase.style && (
                    <span
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full mb-2 text-size-xs font-bold uppercase"
                      style={{ background: sc.bg, color: sc.color, fontSize: "9px", letterSpacing: "0.5px" }}
                    >
                      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: sc.color }} />
                      {phrase.style}
                    </span>
                  )}

                  {/* Phrase text */}
                  <div className="text-primary text-size-sm leading-relaxed pr-6 mb-1">
                    &ldquo;{phrase.text}&rdquo;
                  </div>

                  {/* Translation */}
                  {phrase.translation && (
                    <div className="text-muted text-size-xs italic mb-1">
                      {phrase.translation}
                    </div>
                  )}

                  {/* Footer: next review + review button */}
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-muted text-size-xs">
                      {formatDate(phrase.next_review)}
                    </span>
                    {tab === "due" && (
                      <button
                        type="button"
                        onClick={() => setReviewingPhrase(phrase)}
                        className="px-2.5 py-1 rounded-lg text-size-xs font-medium bg-accent/10 text-accent border border-accent/20 hover:bg-accent/20 transition-all"
                      >
                        Review
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

/**
 * Translation reveal component — tap to show
 */
function TranslationReveal({ translation }: { translation: string | null }) {
  const [revealed, setRevealed] = useState(false);

  if (!translation) return null;

  return (
    <button
      type="button"
      onClick={() => setRevealed(true)}
      className="text-muted text-size-sm transition-all"
    >
      {revealed ? (
        <span className="italic">{translation}</span>
      ) : (
        <span className="border-b border-dashed border-muted">Tap to see translation</span>
      )}
    </button>
  );
}
