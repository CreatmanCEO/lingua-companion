"use client";

import React from "react";
import { X, Clock, MessageSquare, BookOpen, AlertTriangle, Sparkles } from "lucide-react";

export interface SessionSummaryData {
  duration_min: number;
  message_count: number;
  new_words: string[];
  top_errors: { error: string; count: number }[];
  advice: string;
}

interface SessionSummaryProps {
  data: SessionSummaryData;
  onNewSession: () => void;
  onClose: () => void;
}

export function SessionSummary({ data, onNewSession, onClose }: SessionSummaryProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-surface border border-subtle rounded-2xl shadow-xl w-[90vw] max-w-md max-h-[85vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-subtle">
          <h2 className="text-primary font-semibold text-lg">Session Summary</h2>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-secondary hover:text-primary transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Stats row */}
          <div className="flex gap-3">
            <div className="flex-1 bg-void rounded-xl p-3 text-center">
              <Clock className="w-5 h-5 text-accent mx-auto mb-1" />
              <div className="text-primary font-bold text-xl">{data.duration_min}</div>
              <div className="text-muted text-size-xs">min</div>
            </div>
            <div className="flex-1 bg-void rounded-xl p-3 text-center">
              <MessageSquare className="w-5 h-5 text-accent mx-auto mb-1" />
              <div className="text-primary font-bold text-xl">{data.message_count}</div>
              <div className="text-muted text-size-xs">messages</div>
            </div>
          </div>

          {/* New words */}
          {data.new_words.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <BookOpen className="w-4 h-4 text-accent" />
                <span className="text-secondary text-size-sm font-medium">New Words</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {data.new_words.map((word) => (
                  <span
                    key={word}
                    className="bg-accent/10 text-accent text-size-sm px-2.5 py-1 rounded-lg font-medium"
                  >
                    {word}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Top errors */}
          {data.top_errors.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <AlertTriangle className="w-4 h-4 text-orange-400" />
                <span className="text-secondary text-size-sm font-medium">Common Errors</span>
              </div>
              <div className="space-y-1.5">
                {data.top_errors.map((err, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between bg-void rounded-lg px-3 py-2"
                  >
                    <span className="text-primary text-size-sm truncate mr-2">{err.error}</span>
                    <span className="text-muted text-size-xs flex-shrink-0">x{err.count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Advice */}
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <Sparkles className="w-4 h-4 text-accent" />
              <span className="text-secondary text-size-sm font-medium">Advice</span>
            </div>
            <p className="text-primary text-size-sm leading-relaxed bg-accent/5 rounded-xl p-3">
              {data.advice}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="p-4 border-t border-subtle flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 h-11 rounded-xl border border-subtle text-secondary text-size-sm font-medium hover:bg-void transition-colors"
          >
            Close
          </button>
          <button
            type="button"
            onClick={onNewSession}
            className="flex-1 h-11 rounded-xl bg-accent text-white text-size-sm font-medium hover:opacity-90 transition-opacity"
          >
            New Session
          </button>
        </div>
      </div>
    </div>
  );
}
