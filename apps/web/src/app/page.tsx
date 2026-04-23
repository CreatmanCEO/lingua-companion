"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Header } from "@/components/layout/Header";
import { TabBar, type TabType } from "@/components/layout/TabBar";
import { ChatArea } from "@/components/layout/ChatArea";
import { useScrollDirection } from "@/hooks/useScrollDirection";
import { ScenarioScreen } from "@/components/layout/ScenarioScreen";
import { VoiceBar } from "@/components/VoiceBar";
import { SettingsPanel } from "@/components/SettingsPanel";
import { HintOverlay } from "@/components/HintOverlay";
import { PhraseLibrary } from "@/components/PhraseLibrary";
import { LoginScreen } from "@/components/LoginScreen";
import { SessionSummary, type SessionSummaryData } from "@/components/SessionSummary";
import { StatsScreen } from "@/components/StatsScreen";
import { useChatStore } from "@/store/chatStore";
import { useSettingsStore } from "@/store/settingsStore";
import { apiPost, apiGet } from "@/lib/api";
import { useVoiceSession } from "@/hooks/useVoiceSession";
import { supabase } from "@/lib/supabase";
import type { Session } from "@supabase/supabase-js";
import {
  getWelcomeMessage,
  getScenarioWelcomeMessage,
  getDemoReconstruction,
  getCompanionResponse,
} from "@/lib/demo";

/**
 * Главная страница приложения
 *
 * Layout из прототипа (mobile-first, 390x844 base):
 * - Header (compact: logo, companion name + status, settings gear)
 * - TabBar (Free Chat / Scenario)
 * - ChatArea / ScenarioScreen (flex-grow, scroll)
 * - VoiceBar (4 состояния: text, voice, recording, processing)
 */
export default function HomePage() {
  const [authSession, setAuthSession] = useState<Session | null | "loading">("loading");
  const [activeTab, setActiveTab] = useState<TabType>("free-chat");
  const [isTyping, setIsTyping] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [statsOpen, setStatsOpen] = useState(false);
  const [errorToast, setErrorToast] = useState<string | null>(null);
  const [showHints, setShowHints] = useState(() => {
    if (typeof window === "undefined") return false;
    return !localStorage.getItem("lc-hints-seen");
  });
  const [isOnboarding, setIsOnboarding] = useState(() => {
    if (typeof window === "undefined") return false;
    return !localStorage.getItem("lc-onboarded");
  });

  // Feature discovery tooltips
  const [showFeatureTips, setShowFeatureTips] = useState(false);
  const [featureTipStep, setFeatureTipStep] = useState(0);

  // P2: Inactivity auto-suggest
  const [sessionSummaryOffered, setSessionSummaryOffered] = useState(false);

  // Session summary state
  const [sessionStartTime] = useState(() => Date.now());
  const [summaryData, setSummaryData] = useState<SessionSummaryData | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [showEndConfirm, setShowEndConfirm] = useState(false);

  // Check Supabase auth session on mount
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setAuthSession(session);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthSession(session);
    });
    return () => subscription.unsubscribe();
  }, []);
  // L01: Guard against duplicate pending message fetches
  const pendingFetchedRef = useRef(false);

  const chatScrollRef = useRef<HTMLDivElement>(null);
  const scrollDirection = useScrollDirection(chatScrollRef);
  const headerHidden = scrollDirection === "down";

  // Auto-dismiss error toast after 5 seconds
  useEffect(() => {
    if (errorToast) {
      const timer = setTimeout(() => setErrorToast(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [errorToast]);

  // Settings store
  const { loadFromLocalStorage } = useSettingsStore();

  // Zustand store
  const {
    messages,
    activeCompanion,
    processingMessageId,
    addMessage,
    updateMessage,
    setProcessingMessageId,
    streamingCompanionText,
    appendStreamingText,
    clearStreamingText,
    activeScenario,
    startScenario,
    endScenario,
    clearMessages,
    loadPersistedMessages,
  } = useChatStore();

  // WebSocket session
  const {
    isConnected,
    isProcessing,
    connect,
    disconnect,
    sendAudio,
    sendConfig,
    sendText,
  } = useVoiceSession({
    onSttResult: (result) => {
      const state = useChatStore.getState();
      const msgId = state.processingMessageId;
      // Fall back to last user message if no processingMessageId
      const targetId = msgId || state.messages.filter((m) => m.sender === "user").pop()?.id;
      if (targetId) {
        updateMessage(targetId, {
          text: result.text,
          sttResult: result,
          isTranscribed: true,
        });
      }
    },
    onReconstructionResult: (result) => {
      const msgId = useChatStore.getState().processingMessageId;
      if (msgId) {
        updateMessage(msgId, { reconstruction: result, isAnalysed: true });
      }
    },
    onVariantsResult: (result) => {
      const msgId = useChatStore.getState().processingMessageId;
      if (msgId) {
        updateMessage(msgId, { variants: result });
      }
      // Don't clear processingMessageId here — each result renders independently.
      // Processing ends when companion_response arrives.
    },
    onCompanionToken: (event) => {
      // Streaming token — показываем typewriter
      setIsTyping(false);
      appendStreamingText(event.delta);
    },
    onCompanionResponse: (result) => {
      // Streaming done — заменяем streaming text на полное сообщение
      clearStreamingText();
      setProcessingMessageId(null);
      addMessage({
        sender: "companion",
        contentType: "text",
        text: result.text,
      });
    },
    onOnboardingComplete: (event) => {
      // Onboarding завершён — сохраняем, переключаем companion
      localStorage.setItem("lc-onboarded", "true");
      setIsOnboarding(false);
      const companion = (event.companion as "Alex" | "Sam" | "Morgan") || activeCompanion;
      if (event.companion) {
        useChatStore.getState().setActiveCompanion(companion);
        sendConfig(event.companion, null);
      }
      // Personal welcome from chosen companion
      const welcomeMessages: Record<string, string> = {
        Alex: "Hi! I'm Alex, your professional English practice partner. Let's work on your business communication skills. What did you work on today?",
        Sam: "Hey! I'm Sam, nice to meet ya! Let's just chat and have fun with English. So, what's up?",
        Morgan: "Hello! I'm Morgan, and I'll be your mentor. We'll work on your English step by step. Tell me, what would you like to improve most?",
      };
      addMessage({
        sender: "companion",
        contentType: "text",
        text: welcomeMessages[companion] || welcomeMessages.Alex,
      });
    },
    onError: (error) => {
      console.error("WebSocket error:", error);
      setErrorToast(error);
      setProcessingMessageId(null);
      setIsTyping(false);
      clearStreamingText();
    },
  });

  // P2: Auto-suggest session summary after 60 min inactivity
  useEffect(() => {
    if (messages.length < 5 || sessionSummaryOffered) return;

    const checkInactivity = setInterval(() => {
      const lastMsg = messages[messages.length - 1];
      if (!lastMsg) return;
      const elapsed = Date.now() - lastMsg.timestamp;
      if (elapsed > 60 * 60 * 1000) {
        addMessage({
          sender: "companion",
          contentType: "text",
          text: "We've been quiet for a while. Would you like to see your session summary? You can find it in the \u22EF menu \u2192 End Session.",
        });
        setSessionSummaryOffered(true);
      }
    }, 5 * 60 * 1000); // Check every 5 min

    return () => clearInterval(checkInactivity);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length, sessionSummaryOffered]);

  // P1: Feature discovery tooltips — show after first login
  useEffect(() => {
    if (authSession && authSession !== "loading" && !localStorage.getItem("lc-features-discovered")) {
      const timer = setTimeout(() => setShowFeatureTips(true), 3000);
      return () => clearTimeout(timer);
    }
  }, [authSession]);

  // Register Service Worker for push notifications
  useEffect(() => {
    if ("serviceWorker" in navigator && "PushManager" in window) {
      navigator.serviceWorker.register("/sw.js").catch(console.error);
    }
  }, []);

  // Fetch pending companion messages after auth (L01: fetch only once)
  useEffect(() => {
    if (!authSession || authSession === "loading" || pendingFetchedRef.current) return;
    pendingFetchedRef.current = true;
    apiGet("/api/v1/push/pending")
      .then((resp) => {
        if (resp.messages?.length) {
          for (const msg of resp.messages) {
            addMessage({ sender: "companion", contentType: "text", text: msg.text });
          }
        }
      })
      .catch(() => {
        // Silently ignore — pending messages are best-effort
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authSession]);

  // Загрузка настроек и сообщений из localStorage при монтировании
  useEffect(() => {
    loadFromLocalStorage();
    loadPersistedMessages();
  }, [loadFromLocalStorage, loadPersistedMessages]);

  // Подключение к WebSocket при монтировании (L02: only if not already connected)
  useEffect(() => {
    if (!isConnected) {
      connect();
    }
    return () => {
      disconnect();
    };
    // connect/disconnect are stable refs -- intentionally run only on mount/unmount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // L04: Track whether onboarding config was already sent to backend
  const onboardingSentRef = useRef(false);

  // Отправляем session_config при подключении и при смене companion/scenario
  useEffect(() => {
    if (isConnected) {
      const token = authSession && authSession !== "loading" ? authSession.access_token : undefined;
      // L04: Only request onboarding once, and only if localStorage says not onboarded
      const shouldOnboard = isOnboarding && !onboardingSentRef.current;
      if (shouldOnboard) {
        onboardingSentRef.current = true;
      }
      sendConfig(activeCompanion, activeScenario, {
        onboarding: shouldOnboard,
        ...(token ? { token } : {}),
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConnected, activeCompanion, activeScenario]);

  // Приветственное сообщение companion при первом рендере или смене сценария
  useEffect(() => {
    if (messages.length === 0) {
      const welcomeText = activeScenario
        ? getScenarioWelcomeMessage(activeCompanion, activeScenario)
        : getWelcomeMessage(activeCompanion);

      addMessage({
        sender: "companion",
        contentType: "text",
        text: welcomeText,
      });
    }
    // Only re-run when scenario changes, not when addMessage/messages change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeScenario]);

  /**
   * Обработка отправки текста
   */
  const handleSendText = useCallback(
    (text: string) => {
      // Блокируем отправку если ещё обрабатывается предыдущее
      if (isProcessing) return;

      const msgId = addMessage({
        sender: "user",
        contentType: "text",
        text,
      });
      setProcessingMessageId(msgId);

      if (isConnected) {
        // Отправляем текст на backend -- companion ответит через WS
        setIsTyping(true);
        sendText(text);
      } else {
        // Fallback: demo mode без backend
        setIsTyping(true);
        setProcessingMessageId(null);
        setTimeout(() => {
          setIsTyping(false);
          addMessage({
            sender: "companion",
            contentType: "text",
            text: getCompanionResponse(activeCompanion),
          });
        }, 1500);
      }
    },
    [addMessage, setProcessingMessageId, isConnected, isProcessing, sendText, activeCompanion]
  );

  /**
   * Обработка отправки аудио
   */
  const handleSendAudio = useCallback(
    (blob: Blob) => {
      if (isProcessing) return;

      const msgId = addMessage({
        sender: "user",
        contentType: "voice",
        text: "",
        audioBlob: blob,
        audioDuration: 0,
      });
      setProcessingMessageId(msgId);

      if (isConnected) {
        setIsTyping(true);
        sendAudio(blob);
      } else {
        // Demo mode без backend
        setIsTyping(true);
        setProcessingMessageId(null);
        setTimeout(() => {
          setIsTyping(false);
          addMessage({
            sender: "companion",
            contentType: "text",
            text: getCompanionResponse(activeCompanion),
          });
        }, 2000);
      }
    },
    [addMessage, setProcessingMessageId, isConnected, isProcessing, sendAudio, activeCompanion]
  );

  /**
   * Обработка транскрибирования
   */
  const handleTranscribe = useCallback(
    (messageId: string) => {
      const message = useChatStore.getState().messages.find((m) => m.id === messageId);
      if (message?.audioBlob && isConnected) {
        setProcessingMessageId(messageId);
        sendAudio(message.audioBlob);
      }
    },
    [isConnected, sendAudio, setProcessingMessageId]
  );

  /**
   * Обработка запроса анализа
   */
  const handleAnalyse = useCallback(
    (messageId: string) => {
      const message = useChatStore.getState().messages.find((m) => m.id === messageId);
      if (!message) return;

      setProcessingMessageId(messageId);

      if (message.contentType === "voice" && message.audioBlob && isConnected) {
        sendAudio(message.audioBlob);
      } else if (message.contentType === "text" && message.text) {
        // Demo заглушка для текстовых сообщений -- показывает git-diff стиль
        setTimeout(() => {
          const demoReconstructions = getDemoReconstruction(message.text);
          updateMessage(messageId, {
            reconstruction: demoReconstructions.reconstruction,
            variants: demoReconstructions.variants,
            isAnalysed: true,
          });
          setProcessingMessageId(null);
        }, 1500);
      }
    },
    [isConnected, sendAudio, setProcessingMessageId, updateMessage]
  );

  /**
   * Обработка сохранения варианта
   */
  const handleSaveVariant = useCallback((style: string, phrase: string) => {
    // Save phrase to backend library via API
    const isLoggedIn = authSession && authSession !== "loading" && typeof authSession === "object" && "user" in authSession;
    if (!isLoggedIn) {
      setErrorToast("Login to save phrases");
      return;
    }
    apiPost("/api/v1/phrases", { text: phrase, style }).catch(() => {
      setErrorToast("Failed to save phrase");
    });
  }, [authSession]);

  /**
   * End session: fetch summary from backend
   */
  const handleEndSession = useCallback(async () => {
    setShowEndConfirm(false);
    setSummaryLoading(true);

    const state = useChatStore.getState();
    const history = state.messages.map((m) => ({
      role: m.sender === "user" ? "user" : "assistant",
      content: m.text,
    }));
    const durationSeconds = Math.floor((Date.now() - sessionStartTime) / 1000);

    try {
      const data = await apiPost("/api/v1/session/summary", {
        history,
        error_history: [], // TODO: track errors in a future iteration
        duration_seconds: durationSeconds,
        phrases_saved: 0,
      });
      setSummaryData(data as SessionSummaryData);
    } catch {
      // Fallback summary if backend is unavailable
      const userMsgCount = state.messages.filter((m) => m.sender === "user").length;
      setSummaryData({
        duration_min: Math.floor(durationSeconds / 60),
        message_count: userMsgCount,
        new_words: [],
        top_errors: [],
        advice: "Great practice session! Keep going!",
      });
    } finally {
      setSummaryLoading(false);
    }
  }, [sessionStartTime]);

  /**
   * Start a new session: clear chat and reset timer
   */
  const handleNewSession = useCallback(() => {
    setSummaryData(null);
    clearMessages();
    addMessage({
      sender: "companion",
      contentType: "text",
      text: getWelcomeMessage(activeCompanion),
    });
  }, [clearMessages, addMessage, activeCompanion]);

  /**
   * Обработка выбора сценария
   */
  const handleSelectScenario = useCallback((scenarioId: string) => {
    startScenario(scenarioId);
    setActiveTab("free-chat"); // Переключаем на чат
  }, [startScenario]);

  // Auth loading state
  if (authSession === "loading") {
    return (
      <div className="flex items-center justify-center min-h-screen bg-void">
        <div className="text-muted text-size-sm">Loading...</div>
      </div>
    );
  }

  // Auth gate: show login screen if no session
  if (authSession === null) {
    return (
      <LoginScreen
        onSuccess={() => {
          // Re-check session after auth (onAuthStateChange will handle it)
          supabase.auth.getSession().then(({ data: { session } }) => {
            if (session) setAuthSession(session);
          });
        }}
      />
    );
  }

  return (
    <div className="flex flex-col h-screen bg-void">
      {/* Error Toast */}
      {errorToast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-red-500/90 text-white px-4 py-2 rounded-lg shadow-lg text-sm animate-fade-slide-up max-w-[90vw]">
          {errorToast}
          <button
            onClick={() => setErrorToast(null)}
            className="ml-2 opacity-70 hover:opacity-100"
            aria-label="Dismiss error"
          >
            ✕
          </button>
        </div>
      )}

      {/* Header + TabBar — auto-hide on scroll down */}
      <div
        className="flex-shrink-0 transition-transform duration-300 will-change-transform"
        style={{ transform: headerHidden ? "translateY(-100%)" : "translateY(0)" }}
      >
        <Header
          companionName={activeCompanion}
          isOnline={isConnected}
          isTyping={isTyping}
          onSettingsClick={() => setSettingsOpen(true)}
          onLibraryClick={() => setLibraryOpen(true)}
          onStatsClick={() => setStatsOpen(true)}
          onEndSession={() => setShowEndConfirm(true)}
          scenarioName={activeScenario?.name}
          scenario={activeScenario}
          onEndScenario={() => {
            endScenario();
            setProcessingMessageId(null);
            addMessage({
              sender: "companion",
              contentType: "text",
              text: getWelcomeMessage(activeCompanion),
            });
          }}
        />

        {/* Tab Bar */}
        <TabBar activeTab={activeTab} onTabChange={setActiveTab} />
      </div>

      {/* Main content area */}
      {activeTab === "free-chat" ? (
        <ChatArea
          ref={chatScrollRef}
          messages={messages}
          companionName={activeCompanion}
          processingMessageId={processingMessageId}
          isTyping={isTyping}
          streamingText={streamingCompanionText}
          onTranscribe={handleTranscribe}
          onAnalyse={handleAnalyse}
          onSaveVariant={handleSaveVariant}
        />
      ) : (
        <ScenarioScreen onSelectScenario={handleSelectScenario} />
      )}

      {/* Voice Bar */}
      <VoiceBar
        onSendText={handleSendText}
        onSendAudio={handleSendAudio}
        isProcessing={isProcessing}
      />

      {/* Hint Overlay — first-time onboarding */}
      {showHints && <HintOverlay onComplete={() => setShowHints(false)} />}

      {/* Phrase Library */}
      <PhraseLibrary
        open={libraryOpen}
        onOpenChange={setLibraryOpen}
      />

      {/* Stats Screen */}
      <StatsScreen
        open={statsOpen}
        onOpenChange={setStatsOpen}
      />

      {/* End Session Confirmation Dialog */}
      {showEndConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-surface border border-subtle rounded-2xl shadow-xl w-[85vw] max-w-sm p-6">
            <h3 className="text-primary font-semibold text-lg mb-2">End Session?</h3>
            <p className="text-secondary text-size-sm mb-5">
              End this session and see your learning summary?
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowEndConfirm(false)}
                className="flex-1 h-10 rounded-xl border border-subtle text-secondary text-size-sm font-medium hover:bg-void transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleEndSession}
                className="flex-1 h-10 rounded-xl bg-accent text-white text-size-sm font-medium hover:opacity-90 transition-opacity"
              >
                End Session
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Summary Loading Overlay */}
      {summaryLoading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-surface border border-subtle rounded-2xl shadow-xl p-6">
            <div className="text-primary text-size-sm">Generating summary...</div>
          </div>
        </div>
      )}

      {/* Session Summary Modal */}
      {summaryData && (
        <SessionSummary
          data={summaryData}
          onNewSession={handleNewSession}
          onClose={() => setSummaryData(null)}
        />
      )}

      {/* P1: Feature Discovery Tips */}
      {showFeatureTips && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-surface border border-subtle rounded-2xl shadow-xl w-full max-w-sm p-5 mb-4">
            <div className="text-primary font-semibold text-base mb-3">
              {featureTipStep === 0 && "Record voice or type"}
              {featureTipStep === 1 && "Translate any message"}
              {featureTipStep === 2 && "Save useful phrases"}
              {featureTipStep === 3 && "Track your progress"}
            </div>
            <div className="text-secondary text-size-sm mb-4">
              {featureTipStep === 0 && "Record voice or type \u2014 practice English naturally with your AI companion."}
              {featureTipStep === 1 && "Tap the RU button to translate any companion message to Russian."}
              {featureTipStep === 2 && "Save phrases you like \u2014 review them later with spaced repetition in the Phrase Library."}
              {featureTipStep === 3 && "Check your progress in the \u22EF menu \u2192 Stats & Progress."}
            </div>
            <div className="flex items-center justify-between">
              <div className="flex gap-1">
                {[0, 1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="w-2 h-2 rounded-full transition-colors"
                    style={{ backgroundColor: i === featureTipStep ? "var(--accent)" : "var(--text-muted)" }}
                  />
                ))}
              </div>
              <button
                type="button"
                onClick={() => {
                  if (featureTipStep < 3) {
                    setFeatureTipStep(featureTipStep + 1);
                  } else {
                    setShowFeatureTips(false);
                    localStorage.setItem("lc-features-discovered", "true");
                  }
                }}
                className="px-4 py-2 rounded-xl bg-accent text-white text-size-sm font-medium hover:opacity-90 transition-opacity"
              >
                {featureTipStep < 3 ? "Next" : "Got it!"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Settings Panel */}
      <SettingsPanel
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        onCompanionChange={(name) => {
          useChatStore.getState().setActiveCompanion(name);
        }}
        userEmail={authSession && typeof authSession === "object" && "user" in authSession ? authSession.user?.email : undefined}
        onLogout={async () => {
          await supabase.auth.signOut();
          setAuthSession(null);
          setSettingsOpen(false);
        }}
      />
    </div>
  );
}
