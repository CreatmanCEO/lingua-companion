"use client";

import React, { useCallback, useEffect, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { apiGet } from "@/lib/api";

interface SessionRecord {
  session_date: string;
  message_count: number;
  error_count: number;
  duration_sec: number;
}

interface StatsData {
  streak: number;
  total_sessions: number;
  total_messages: number;
  total_duration_min: number;
  total_errors: number;
  phrases_saved: number;
  recent_sessions: SessionRecord[];
  error_breakdown?: Record<string, number>;
}

const EMPTY_STATS: StatsData = {
  streak: 0,
  total_sessions: 0,
  total_messages: 0,
  total_duration_min: 0,
  total_errors: 0,
  phrases_saved: 0,
  recent_sessions: [],
};

interface StatsScreenProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function StatsScreen({ open, onOpenChange }: StatsScreenProps) {
  const [stats, setStats] = useState<StatsData>(EMPTY_STATS);
  const [loading, setLoading] = useState(false);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiGet("/api/v1/stats");
      setStats(data);
    } catch {
      // Silently fail — show empty stats
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      fetchStats();
    }
  }, [open, fetchStats]);

  const maxMsgs = Math.max(
    1,
    ...stats.recent_sessions.map((s) => s.message_count)
  );

  // Format duration nicely
  const formatDuration = (minutes: number) => {
    if (minutes < 60) return `${minutes}m`;
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="bg-surface border-subtle w-[340px] p-0 overflow-y-auto">
        <SheetHeader className="px-4 pt-4 pb-2">
          <SheetTitle className="text-primary text-base font-semibold">
            Learning Progress
          </SheetTitle>
        </SheetHeader>

        <div className="px-4 pb-6">
          {loading ? (
            <div className="text-muted text-size-sm py-8 text-center">Loading...</div>
          ) : (
            <>
              {/* Streak with motivational text */}
              <div className="flex items-center gap-2 py-3 mb-3 border-b border-subtle">
                <span style={{ fontSize: "28px" }}>
                  {stats.streak > 0 ? "\uD83D\uDD25" : "\u2744\uFE0F"}
                </span>
                <div>
                  <div className="text-primary font-bold text-lg leading-tight">
                    {stats.streak} day{stats.streak !== 1 ? "s" : ""} streak
                  </div>
                  <div className="text-muted text-size-xs">
                    {stats.streak > 0
                      ? `\uD83D\uDD25 ${stats.streak} day streak! Don't break it!`
                      : stats.total_sessions > 0
                        ? "Start a new streak today!"
                        : "Start a streak today"}
                  </div>
                </div>
              </div>

              {/* Stats grid */}
              <div className="grid grid-cols-2 gap-2 mb-4">
                <StatCard label="Sessions" value={String(stats.total_sessions)} />
                <StatCard label="Messages" value={String(stats.total_messages)} />
                <StatCard
                  label="Practice Time"
                  value={formatDuration(stats.total_duration_min)}
                />
                <StatCard label="Phrases Saved" value={String(stats.phrases_saved)} />
              </div>

              {/* Activity chart — last 7 days */}
              {stats.recent_sessions.length > 0 && (
                <div className="mb-4">
                  <div className="text-secondary text-size-sm font-medium mb-2">
                    Recent Activity
                  </div>
                  <div className="flex items-end gap-1 h-20 bg-card rounded-lg p-2 border border-subtle">
                    {[...stats.recent_sessions].reverse().map((s) => (
                      <div
                        key={s.session_date}
                        className="flex-1 rounded-t transition-all"
                        style={{
                          height: `${Math.max(4, (s.message_count / maxMsgs) * 100)}%`,
                          background:
                            "linear-gradient(to top, var(--accent), rgba(94,92,230,0.6))",
                          minHeight: "3px",
                        }}
                        title={`${s.session_date}: ${s.message_count} messages`}
                      />
                    ))}
                  </div>
                  <div className="flex justify-between mt-1 text-muted" style={{ fontSize: "9px" }}>
                    {[...stats.recent_sessions]
                      .reverse()
                      .map((s) => (
                        <span key={s.session_date}>
                          {new Date(s.session_date).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                          })}
                        </span>
                      ))}
                  </div>
                </div>
              )}

              {/* Error stats */}
              {stats.total_errors > 0 && (
                <div>
                  <div className="text-secondary text-size-sm font-medium mb-2">
                    Errors Corrected
                  </div>
                  <div className="bg-card rounded-lg p-3 border border-subtle">
                    <div className="text-primary font-semibold text-lg">
                      {stats.total_errors}
                    </div>
                    <div className="text-muted text-size-xs">
                      total corrections across all sessions
                    </div>
                  </div>
                </div>
              )}

              {/* Error breakdown (P4) */}
              {stats.error_breakdown && Object.keys(stats.error_breakdown).length > 0 && (
                <div className="mb-4">
                  <div className="text-secondary text-size-sm font-medium mb-2">
                    Common Mistakes
                  </div>
                  <div className="bg-card rounded-lg border border-subtle divide-y divide-subtle">
                    {Object.entries(stats.error_breakdown)
                      .sort(([, a], [, b]) => b - a)
                      .map(([type, count]) => (
                        <div key={type} className="flex items-center justify-between px-3 py-2">
                          <span className="text-primary text-size-sm capitalize">{type.replace(/_/g, " ")}</span>
                          <span className="text-accent text-size-sm font-medium">{count}x</span>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* Empty state */}
              {stats.total_sessions === 0 && (
                <div className="text-center py-6">
                  <div style={{ fontSize: "32px", marginBottom: "8px" }}>
                    {"\uD83C\uDF31"}
                  </div>
                  <div className="text-secondary text-size-sm">
                    No sessions yet. Start chatting to build your stats!
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-card rounded-lg p-3 border border-subtle">
      <div className="text-primary font-semibold text-base leading-tight">
        {value}
      </div>
      <div className="text-muted text-size-xs mt-0.5">{label}</div>
    </div>
  );
}
