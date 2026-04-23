"use client";

import React, { useCallback, useEffect, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useSettingsStore, type TopicPreference, type Level } from "@/store/settingsStore";
import type { CompanionName } from "@/store/chatStore";
import type { VoiceKey } from "@/lib/edgeTts";
import { playTts } from "@/lib/edgeTts";
import { apiPost } from "@/lib/api";

interface SettingsPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCompanionChange?: (name: CompanionName) => void;
  userEmail?: string | null;
  onLogout?: () => void;
}

const COMPANIONS: { key: CompanionName; label: string; desc: string }[] = [
  { key: "Alex", label: "Alex", desc: "Professional" },
  { key: "Sam", label: "Sam", desc: "Casual" },
  { key: "Morgan", label: "Morgan", desc: "Mentor" },
];

const VOICES: { key: VoiceKey; label: string }[] = [
  { key: "us-male", label: "US Male" },
  { key: "us-female", label: "US Female" },
  { key: "gb-male", label: "GB Male" },
  { key: "gb-female", label: "GB Female" },
];

const TOPICS: { key: TopicPreference; label: string }[] = [
  { key: "it", label: "IT only" },
  { key: "mixed", label: "Mixed (IT + casual)" },
  { key: "any", label: "Any topic" },
];

const LEVELS: Level[] = ["A2", "B1", "B2"];

function OptionButton({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1.5 rounded-lg text-size-sm font-medium transition-all border ${
        selected
          ? "bg-accent text-white border-accent"
          : "bg-card text-secondary border-subtle hover:border-accent/30"
      }`}
    >
      {children}
    </button>
  );
}

export function SettingsPanel({ open, onOpenChange, onCompanionChange, userEmail, onLogout }: SettingsPanelProps) {
  const {
    companion, voice, rate, topicPreference, level, theme,
    setCompanion, setVoice, setRate, setTopicPreference, setLevel, setTheme,
  } = useSettingsStore();

  // Push notification state
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [notificationsLoading, setNotificationsLoading] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      setNotificationsEnabled(Notification.permission === "granted");
    }
  }, []);

  const handleToggleNotifications = useCallback(async () => {
    if (notificationsLoading) return;
    setNotificationsLoading(true);
    try {
      if (notificationsEnabled) {
        // Cannot programmatically revoke — just update UI state
        setNotificationsEnabled(false);
        setNotificationsLoading(false);
        return;
      }
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setNotificationsLoading(false);
        return;
      }
      const registration = await navigator.serviceWorker.ready;
      const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapidPublicKey) {
        console.warn("VAPID public key not configured");
        setNotificationsEnabled(true);
        setNotificationsLoading(false);
        return;
      }
      // Convert VAPID key to Uint8Array
      const urlBase64ToUint8Array = (base64String: string) => {
        const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
        const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
        const rawData = window.atob(base64);
        return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
      };
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
      });
      const subJson = subscription.toJSON();
      await apiPost("/api/v1/push/subscribe", {
        endpoint: subJson.endpoint,
        keys: subJson.keys,
      });
      setNotificationsEnabled(true);
    } catch (err) {
      console.error("Failed to enable notifications:", err);
    } finally {
      setNotificationsLoading(false);
    }
  }, [notificationsEnabled, notificationsLoading]);

  const handleCompanionChange = useCallback(
    (name: CompanionName) => {
      setCompanion(name);
      onCompanionChange?.(name);
    },
    [setCompanion, onCompanionChange],
  );

  const handleTestVoice = useCallback(() => {
    playTts("Hello! How are you today?", voice, rate);
  }, [voice, rate]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="bg-surface border-subtle w-[320px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-primary">Settings</SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Companion */}
          <section>
            <h3 className="text-size-sm font-semibold text-primary mb-2">Companion</h3>
            <div className="flex flex-col gap-2">
              {COMPANIONS.map((c) => (
                <button
                  key={c.key}
                  type="button"
                  onClick={() => handleCompanionChange(c.key)}
                  className={`flex items-center gap-3 p-2.5 rounded-xl border transition-all ${
                    companion === c.key
                      ? "border-accent bg-accent/10"
                      : "border-subtle bg-card hover:border-accent/30"
                  }`}
                >
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-white text-size-sm font-bold"
                    style={{ background: "linear-gradient(135deg, #5E5CE6, #BF5AF2)" }}
                  >
                    {c.key[0]}
                  </div>
                  <div className="text-left">
                    <div className="text-size-sm font-medium text-primary">{c.label}</div>
                    <div className="text-size-xs text-muted">{c.desc}</div>
                  </div>
                </button>
              ))}
            </div>
          </section>

          {/* Voice */}
          <section>
            <h3 className="text-size-sm font-semibold text-primary mb-2">Voice</h3>
            <div className="flex flex-wrap gap-2">
              {VOICES.map((v) => (
                <OptionButton
                  key={v.key}
                  selected={voice === v.key}
                  onClick={() => setVoice(v.key)}
                >
                  {v.label}
                </OptionButton>
              ))}
            </div>
            <button
              type="button"
              onClick={handleTestVoice}
              className="mt-2 text-size-xs text-accent hover:text-accent/80 transition-colors"
            >
              Test voice
            </button>
          </section>

          {/* Speed */}
          <section>
            <h3 className="text-size-sm font-semibold text-primary mb-2">
              Speed: {rate}x
            </h3>
            <input
              type="range"
              min="0.8"
              max="1.2"
              step="0.1"
              value={rate}
              onChange={(e) => setRate(e.target.value)}
              className="w-full accent-accent"
            />
            <div className="flex justify-between text-size-xs text-muted mt-1">
              <span>0.8x</span>
              <span>1.2x</span>
            </div>
          </section>

          {/* Topics */}
          <section>
            <h3 className="text-size-sm font-semibold text-primary mb-2">Topics</h3>
            <div className="flex flex-col gap-1.5">
              {TOPICS.map((t) => (
                <OptionButton
                  key={t.key}
                  selected={topicPreference === t.key}
                  onClick={() => setTopicPreference(t.key)}
                >
                  {t.label}
                </OptionButton>
              ))}
            </div>
          </section>

          {/* Level */}
          <section>
            <h3 className="text-size-sm font-semibold text-primary mb-2">Level</h3>
            <div className="flex gap-2">
              {LEVELS.map((l) => (
                <OptionButton
                  key={l}
                  selected={level === l}
                  onClick={() => setLevel(l)}
                >
                  {l}
                </OptionButton>
              ))}
            </div>
          </section>

          {/* Theme */}
          <section>
            <h3 className="text-size-sm font-semibold text-primary mb-2">Theme</h3>
            <div className="flex gap-2">
              <OptionButton
                selected={theme === "dark"}
                onClick={() => setTheme("dark")}
              >
                Dark
              </OptionButton>
              <OptionButton
                selected={theme === "light"}
                onClick={() => setTheme("light")}
              >
                Light
              </OptionButton>
            </div>
          </section>

          {/* Notifications */}
          {"Notification" in (typeof window !== "undefined" ? window : {}) && (
            <section>
              <h3 className="text-size-sm font-semibold text-primary mb-2">Notifications</h3>
              <button
                type="button"
                onClick={handleToggleNotifications}
                disabled={notificationsLoading}
                className={`flex items-center gap-3 w-full p-2.5 rounded-xl border transition-all ${
                  notificationsEnabled
                    ? "border-accent bg-accent/10"
                    : "border-subtle bg-card hover:border-accent/30"
                } ${notificationsLoading ? "opacity-50" : ""}`}
              >
                <div className={`w-10 h-5 rounded-full relative transition-colors ${
                  notificationsEnabled ? "bg-accent" : "bg-muted/30"
                }`}>
                  <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                    notificationsEnabled ? "left-[22px]" : "left-0.5"
                  }`} />
                </div>
                <span className="text-size-sm text-primary">
                  {notificationsLoading ? "Enabling..." : notificationsEnabled ? "Enabled" : "Enable push notifications"}
                </span>
              </button>
            </section>
          )}

          {/* Account */}
          {onLogout && (
            <section className="pt-4 border-t border-subtle">
              <h3 className="text-size-sm font-semibold text-primary mb-2">Account</h3>
              {userEmail && (
                <p className="text-size-xs text-muted mb-2 truncate">{userEmail}</p>
              )}
              <button
                type="button"
                onClick={onLogout}
                className="px-3 py-1.5 rounded-lg text-size-sm font-medium bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-colors"
              >
                Log out
              </button>
            </section>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
