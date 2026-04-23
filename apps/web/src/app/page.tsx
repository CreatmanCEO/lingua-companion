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
import { useChatStore } from "@/store/chatStore";
import { useSettingsStore } from "@/store/settingsStore";
import { apiPost } from "@/lib/api";
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
  const [errorToast, setErrorToast] = useState<string | null>(null);
  const [showHints, setShowHints] = useState(() => {
    if (typeof window === "undefined") return false;
    return !localStorage.getItem("lc-hints-seen");
  });
  const [isOnboarding, setIsOnboarding] = useState(() => {
    if (typeof window === "undefined") return false;
    return !localStorage.getItem("lc-onboarded");
  });

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
      if (event.companion) {
        useChatStore.getState().setActiveCompanion(event.companion as "Alex" | "Sam" | "Morgan");
        sendConfig(event.companion, null);
      }
      addMessage({
        sender: "companion",
        contentType: "text",
        text: getWelcomeMessage(
          (event.companion as "Alex" | "Sam" | "Morgan") || activeCompanion,
        ),
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

  // Загрузка настроек и сообщений из localStorage при монтировании
  useEffect(() => {
    loadFromLocalStorage();
    loadPersistedMessages();
  }, [loadFromLocalStorage, loadPersistedMessages]);

  // Подключение к WebSocket при монтировании
  useEffect(() => {
    connect();
    return () => {
      disconnect();
    };
    // connect/disconnect are stable refs -- intentionally run only on mount/unmount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Отправляем session_config при подключении и при смене companion/scenario
  useEffect(() => {
    if (isConnected) {
      const token = authSession && authSession !== "loading" ? authSession.access_token : undefined;
      sendConfig(activeCompanion, activeScenario, {
        onboarding: isOnboarding,
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
          // Re-check session (onAuthStateChange will handle it,
          // but for "skip auth" demo mode we set null -> allow through)
          supabase.auth.getSession().then(({ data: { session } }) => {
            // If still no session (demo skip), use a sentinel to bypass
            setAuthSession(session ?? ("demo" as unknown as Session));
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
          scenarioName={activeScenario?.name}
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
