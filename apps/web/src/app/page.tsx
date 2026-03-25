"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Header } from "@/components/layout/Header";
import { TabBar, type TabType } from "@/components/layout/TabBar";
import { CompanionBar } from "@/components/layout/CompanionBar";
import { ChatArea } from "@/components/layout/ChatArea";
import { ScenarioScreen } from "@/components/layout/ScenarioScreen";
import { VoiceBar, type InputMode } from "@/components/VoiceBar";
import { useChatStore } from "@/store/chatStore";
import { useVoiceSession } from "@/hooks/useVoiceSession";
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
 * - Header (с logo mark, app name, theme toggle, menu)
 * - TabBar (Free Chat / Scenario)
 * - CompanionBar (avatar, name, status, timer) - только для Free Chat
 * - ChatArea / ScenarioScreen (flex-grow, scroll)
 * - VoiceBar (4 состояния: text, voice, recording, processing)
 */
export default function HomePage() {
  const [activeTab, setActiveTab] = useState<TabType>("free-chat");
  const [isTyping, setIsTyping] = useState(false);

  // Zustand store
  const {
    messages,
    inputMode,
    activeCompanion,
    currentReconstruction,
    currentVariants,
    isAnalysing,
    addMessage,
    updateMessage,
    setTranscript,
    setReconstruction,
    setVariants,
    setIsAnalysing,
    clearAnalysis,
    setInputMode,
    activeScenario,
    startScenario,
    endScenario,
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
      const currentMessages = useChatStore.getState().messages;
      const lastUserMessage = currentMessages.filter((m) => m.sender === "user").pop();
      if (lastUserMessage) {
        updateMessage(lastUserMessage.id, {
          text: result.text,
          sttResult: result,
          isTranscribed: true,
        });
      }
      setTranscript(result.text);
    },
    onReconstructionResult: (result) => {
      setReconstruction(result);
    },
    onVariantsResult: (result) => {
      setVariants(result);
      setIsAnalysing(false);
    },
    onCompanionResponse: (result) => {
      // Companion ответил -- убираем typing и добавляем сообщение
      setIsTyping(false);
      addMessage({
        sender: "companion",
        contentType: "text",
        text: result.text,
      });
    },
    onError: (error) => {
      console.error("WebSocket error:", error);
      setIsAnalysing(false);
      setIsTyping(false);
    },
  });

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
      sendConfig(activeCompanion, activeScenario);
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
      clearAnalysis();

      addMessage({
        sender: "user",
        contentType: "text",
        text,
      });

      if (isConnected) {
        // Отправляем текст на backend -- companion ответит через WS
        setIsTyping(true);
        sendText(text);
      } else {
        // Fallback: demo mode без backend
        setIsTyping(true);
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
    [addMessage, clearAnalysis, isConnected, sendText, activeCompanion]
  );

  /**
   * Обработка отправки аудио
   */
  const handleSendAudio = useCallback(
    (blob: Blob) => {
      clearAnalysis();

      addMessage({
        sender: "user",
        contentType: "voice",
        text: "",
        audioBlob: blob,
        audioDuration: 0,
      });

      if (isConnected) {
        setIsAnalysing(true);
        setIsTyping(true);
        sendAudio(blob);
      } else {
        // Demo mode без backend
        setIsTyping(true);
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
    [addMessage, clearAnalysis, isConnected, sendAudio, setIsAnalysing, activeCompanion]
  );

  /**
   * Обработка транскрибирования
   */
  const handleTranscribe = useCallback(
    (messageId: string) => {
      const message = useChatStore.getState().messages.find((m) => m.id === messageId);
      if (message?.audioBlob && isConnected) {
        setIsAnalysing(true);
        sendAudio(message.audioBlob);
      }
    },
    [isConnected, sendAudio, setIsAnalysing]
  );

  /**
   * Обработка запроса анализа
   */
  const handleAnalyse = useCallback(
    (messageId: string) => {
      const message = useChatStore.getState().messages.find((m) => m.id === messageId);
      if (!message) return;

      setIsAnalysing(true);
      clearAnalysis();

      if (message.contentType === "voice" && message.audioBlob && isConnected) {
        sendAudio(message.audioBlob);
      } else if (message.contentType === "text" && message.text) {
        // Demo заглушка для текстовых сообщений -- показывает git-diff стиль
        setTimeout(() => {
          const demoReconstructions = getDemoReconstruction(message.text);
          setReconstruction(demoReconstructions.reconstruction);
          setVariants(demoReconstructions.variants);
          setIsAnalysing(false);
        }, 1500);
      }
    },
    [isConnected, sendAudio, clearAnalysis, setIsAnalysing, setReconstruction, setVariants]
  );

  /**
   * Обработка сохранения варианта
   */
  const handleSaveVariant = useCallback((style: string, phrase: string) => {
    console.log("Saved variant:", style, phrase);
    // TODO: сохранить в Phrase Library
  }, []);

  /**
   * Обработка переключения режима ввода
   */
  const handleModeChange = useCallback(
    (mode: InputMode) => {
      setInputMode(mode);
    },
    [setInputMode]
  );

  /**
   * Обработка выбора сценария
   */
  const handleSelectScenario = useCallback((scenarioId: string) => {
    startScenario(scenarioId);
    setActiveTab("free-chat"); // Переключаем на чат
  }, [startScenario]);

  return (
    <div className="flex flex-col h-screen bg-void">
      {/* Header */}
      <Header onMenuClick={() => console.log("Menu clicked")} />

      {/* Tab Bar (внутри header) */}
      <TabBar activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Companion Bar - только для Free Chat */}
      {activeTab === "free-chat" && (
        <CompanionBar
          companionName={activeCompanion}
          companionStyle={activeScenario ? activeScenario.companionRole : "Professional"}
          isTyping={isTyping}
          isOnline={isConnected}
          scenarioName={activeScenario?.name}
          onEndScenario={() => {
            endScenario();
            // Показать Free Chat приветствие
            clearAnalysis();
            addMessage({
              sender: "companion",
              contentType: "text",
              text: getWelcomeMessage(activeCompanion),
            });
          }}
        />
      )}

      {/* Main content area */}
      {activeTab === "free-chat" ? (
        <ChatArea
          messages={messages}
          companionName={activeCompanion}
          currentReconstruction={currentReconstruction}
          currentVariants={currentVariants}
          isAnalysing={isAnalysing}
          isTyping={isTyping}
          onTranscribe={handleTranscribe}
          onAnalyse={handleAnalyse}
          onSaveVariant={handleSaveVariant}
        />
      ) : (
        <ScenarioScreen onSelectScenario={handleSelectScenario} />
      )}

      {/* Voice Bar */}
      <VoiceBar
        mode={inputMode}
        onModeChange={handleModeChange}
        onSendText={handleSendText}
        onSendAudio={handleSendAudio}
        isProcessing={isProcessing}
        companionName={activeCompanion}
        companionStyle="Professional"
      />
    </div>
  );
}
