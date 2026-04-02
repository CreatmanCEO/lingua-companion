"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Результат STT (Speech-to-Text)
 */
export interface SttResult {
  text: string;
  language: string;
  provider: "deepgram" | "groq";
  latency_ms: number;
  fallback: boolean;
}

/**
 * Результат реконструкции фразы
 */
export interface ReconstructionResult {
  corrected: string;
  original_intent: string;
  main_error: string | null;
  error_type: "grammar" | "vocabulary" | "code_switching" | "none";
  explanation: string | null;
}

/**
 * Один вариант фразы с контекстом
 */
export interface VariantItem {
  text: string;
  context: string;
}

/**
 * Результат генерации вариантов фраз.
 * Backend возвращает {text, context} для каждого стиля.
 * Для backward compat поддерживаем и plain string.
 */
export interface VariantsResult {
  simple: string | VariantItem;
  professional: string | VariantItem;
  colloquial: string | VariantItem;
  slang: string | VariantItem;
  idiom: string | VariantItem;
}

/**
 * Результат ответа companion агента
 */
export interface CompanionResult {
  text: string;
  companion: string;
}

/**
 * Типы событий WebSocket
 */
type WebSocketEventType =
  | "stt_result"
  | "reconstruction_result"
  | "variants_result"
  | "companion_token"
  | "companion_response"
  | "onboarding_complete"
  | "error";

/**
 * Состояния подключения
 */
type ConnectionState = "idle" | "connecting" | "connected" | "processing";

/**
 * Callbacks для обработки событий
 */
/**
 * Companion token event (streaming)
 */
export interface CompanionTokenEvent {
  delta: string;
  companion: string;
}

/**
 * Callbacks для обработки событий
 */
/**
 * Onboarding complete event
 */
export interface OnboardingCompleteEvent {
  data: Record<string, string>;
  companion: string;
}

/**
 * Callbacks для обработки событий
 */
interface VoiceSessionCallbacks {
  onSttResult?: (result: SttResult) => void;
  onReconstructionResult?: (result: ReconstructionResult) => void;
  onVariantsResult?: (result: VariantsResult) => void;
  onCompanionToken?: (event: CompanionTokenEvent) => void;
  onCompanionResponse?: (result: CompanionResult) => void;
  onOnboardingComplete?: (event: OnboardingCompleteEvent) => void;
  onError?: (error: string) => void;
}

/**
 * Конфигурация хука
 */
interface VoiceSessionConfig {
  wsUrl?: string;
  maxReconnectAttempts?: number;
  reconnectBaseDelay?: number;
}

/**
 * Возвращаемый интерфейс хука
 */
interface UseVoiceSessionReturn {
  isConnected: boolean;
  isProcessing: boolean;
  connectionState: ConnectionState;
  connect: () => void;
  disconnect: () => void;
  sendAudio: (audioBlob: Blob) => void;
  sendConfig: (companion: string, scenario: object | null) => void;
  sendText: (text: string) => void;
}

/** Начальное состояние pending-результатов */
const PENDING_INITIAL = { reconstruction: false, variants: false, companion: false };

/**
 * Hook для управления WebSocket сессией голосового ввода
 *
 * @param callbacks - Callbacks для обработки событий от сервера
 * @param config - Конфигурация подключения
 * @returns Объект с методами управления сессией
 */
export function useVoiceSession(
  callbacks: VoiceSessionCallbacks = {},
  config: VoiceSessionConfig = {}
): UseVoiceSessionReturn {
  const {
    wsUrl = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8001",
    maxReconnectAttempts = 3,
    reconnectBaseDelay = 1000,
  } = config;

  const [connectionState, setConnectionState] = useState<ConnectionState>("idle");
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const processingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const scheduleReconnectRef = useRef<(() => void) | null>(null);
  const callbacksRef = useRef(callbacks);

  // Отслеживание полученных результатов для завершения processing
  // Backend отправляет reconstruction, variants и companion параллельно
  // Нужно дождаться ВСЕХ ТРЁХ событий перед завершением processing
  const pendingResultsRef = useRef<{
    reconstruction: boolean;
    variants: boolean;
    companion: boolean;
  }>({ ...PENDING_INITIAL });

  // Обновляем ref при изменении callbacks
  useEffect(() => {
    callbacksRef.current = callbacks;
  }, [callbacks]);

  /**
   * Очистка таймера реконнекта
   */
  const clearReconnectTimeout = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
  }, []);

  /**
   * Очистка таймера processing (защита от бесконечного спиннера)
   */
  const clearProcessingTimeout = useCallback(() => {
    if (processingTimeoutRef.current) {
      clearTimeout(processingTimeoutRef.current);
      processingTimeoutRef.current = null;
    }
  }, []);

  /**
   * Проверка: все ожидаемые результаты получены -- завершаем processing
   */
  const checkAllPendingDone = useCallback(() => {
    const p = pendingResultsRef.current;
    if (p.reconstruction && p.variants && p.companion) {
      clearProcessingTimeout();
      setConnectionState("connected");
      pendingResultsRef.current = { ...PENDING_INITIAL };
    }
  }, [clearProcessingTimeout]);

  /**
   * Внутренняя функция подключения
   */
  const connectInternal = useCallback(() => {
    // Закрываем существующее подключение
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    // Сбрасываем pending результаты от предыдущей сессии
    pendingResultsRef.current = { ...PENDING_INITIAL };
    setConnectionState("connecting");

    const ws = new WebSocket(`${wsUrl}/ws/session`);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log("[useVoiceSession] Connected");
      setConnectionState("connected");
      reconnectAttemptsRef.current = 0;
      pendingResultsRef.current = { ...PENDING_INITIAL };
    };

    ws.onclose = (event) => {
      console.log(`[useVoiceSession] Disconnected (code: ${event.code})`);
      wsRef.current = null;

      if (event.code !== 1000) {
        // Неожиданный разрыв -- пробуем переподключиться
        scheduleReconnectRef.current?.();
      } else {
        setConnectionState("idle");
      }
    };

    ws.onerror = (error) => {
      console.error("[useVoiceSession] WebSocket error:", error);
      callbacksRef.current.onError?.("WebSocket connection error");
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        const eventType = data.type as WebSocketEventType;

        switch (eventType) {
          case "stt_result":
            // После STT продолжаем ждать reconstruction, variants и companion
            callbacksRef.current.onSttResult?.(data as SttResult);
            break;

          case "reconstruction_result":
            pendingResultsRef.current.reconstruction = true;
            callbacksRef.current.onReconstructionResult?.(data as ReconstructionResult);
            checkAllPendingDone();
            break;

          case "variants_result":
            pendingResultsRef.current.variants = true;
            callbacksRef.current.onVariantsResult?.(data as VariantsResult);
            checkAllPendingDone();
            break;

          case "companion_token":
            callbacksRef.current.onCompanionToken?.(data as CompanionTokenEvent);
            break;

          case "companion_response":
            pendingResultsRef.current.companion = true;
            callbacksRef.current.onCompanionResponse?.(data as CompanionResult);
            checkAllPendingDone();
            break;

          case "onboarding_complete":
            // Onboarding done — не влияет на pending (onboarding не использует pipeline)
            callbacksRef.current.onOnboardingComplete?.(data as OnboardingCompleteEvent);
            setConnectionState("connected");
            break;

          case "error":
            clearProcessingTimeout();
            setConnectionState("connected");
            pendingResultsRef.current = { ...PENDING_INITIAL };
            callbacksRef.current.onError?.(data.message || "Unknown error");
            break;

          default:
            console.warn("[useVoiceSession] Unknown event type:", eventType);
        }
      } catch (err) {
        console.error("[useVoiceSession] Failed to parse message:", err);
        callbacksRef.current.onError?.("Failed to parse server response");
      }
    };
  }, [wsUrl, clearProcessingTimeout, checkAllPendingDone]);

  /**
   * Попытка переподключения с exponential backoff
   * Используется при неожиданном разрыве соединения
   */
  const scheduleReconnect = useCallback(() => {
    if (reconnectAttemptsRef.current >= maxReconnectAttempts) {
      console.warn("[useVoiceSession] Max reconnect attempts reached");
      setConnectionState("idle");
      callbacksRef.current.onError?.("Connection lost. Please try again.");
      return;
    }

    const delay = reconnectBaseDelay * Math.pow(2, reconnectAttemptsRef.current);
    console.log(
      `[useVoiceSession] Reconnecting in ${delay}ms (attempt ${reconnectAttemptsRef.current + 1}/${maxReconnectAttempts})`
    );

    reconnectTimeoutRef.current = setTimeout(() => {
      reconnectAttemptsRef.current++;
      connectInternal();
    }, delay);
  }, [maxReconnectAttempts, reconnectBaseDelay, connectInternal]);

  // Обновляем ref для доступа из onclose без circular dependency
  useEffect(() => {
    scheduleReconnectRef.current = scheduleReconnect;
  }, [scheduleReconnect]);

  /**
   * Публичная функция подключения
   */
  const connect = useCallback(() => {
    clearReconnectTimeout();
    reconnectAttemptsRef.current = 0;
    connectInternal();
  }, [connectInternal, clearReconnectTimeout]);

  /**
   * Отключение от WebSocket
   */
  const disconnect = useCallback(() => {
    clearReconnectTimeout();
    reconnectAttemptsRef.current = maxReconnectAttempts; // Предотвращаем реконнект

    if (wsRef.current) {
      wsRef.current.close(1000, "User disconnect");
      wsRef.current = null;
    }

    setConnectionState("idle");
  }, [clearReconnectTimeout, maxReconnectAttempts]);

  /**
   * Отправка аудио на сервер
   */
  const sendAudio = useCallback((audioBlob: Blob) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      console.error("[useVoiceSession] WebSocket not connected");
      callbacksRef.current.onError?.("Not connected to server");
      return;
    }

    // Сбрасываем флаги ожидания для нового запроса
    clearProcessingTimeout();
    pendingResultsRef.current = { ...PENDING_INITIAL };
    setConnectionState("processing");
    wsRef.current.send(audioBlob);

    // Таймаут 15s -- защита от бесконечного спиннера если backend не ответит
    processingTimeoutRef.current = setTimeout(() => {
      console.warn("[useVoiceSession] Processing timeout (15s)");
      pendingResultsRef.current = { ...PENDING_INITIAL };
      setConnectionState("connected");
      callbacksRef.current.onError?.("Processing timed out. Please try again.");
    }, 15000);
  }, [clearProcessingTimeout]);

  /**
   * Отправка конфигурации сессии (companion, scenario) на сервер
   */
  const sendConfig = useCallback((companion: string, scenario: object | null, extra?: Record<string, unknown>) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      return;
    }

    wsRef.current.send(JSON.stringify({
      type: "session_config",
      companion,
      scenario,
      ...extra,
    }));
  }, []);

  /**
   * Отправка текстового сообщения на сервер (без STT)
   */
  const sendText = useCallback((text: string) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      console.error("[useVoiceSession] WebSocket not connected");
      callbacksRef.current.onError?.("Not connected to server");
      return;
    }

    // Сбрасываем флаги для нового запроса
    clearProcessingTimeout();
    pendingResultsRef.current = { ...PENDING_INITIAL };
    setConnectionState("processing");

    wsRef.current.send(JSON.stringify({
      type: "text_message",
      text,
    }));

    // Таймаут 15s
    processingTimeoutRef.current = setTimeout(() => {
      console.warn("[useVoiceSession] Processing timeout (15s)");
      pendingResultsRef.current = { ...PENDING_INITIAL };
      setConnectionState("connected");
      callbacksRef.current.onError?.("Processing timed out. Please try again.");
    }, 15000);
  }, [clearProcessingTimeout]);

  /**
   * Cleanup при unmount
   */
  useEffect(() => {
    return () => {
      clearReconnectTimeout();
      clearProcessingTimeout();
      if (wsRef.current) {
        wsRef.current.close(1000, "Component unmount");
        wsRef.current = null;
      }
    };
  }, [clearReconnectTimeout, clearProcessingTimeout]);

  return {
    isConnected: connectionState === "connected" || connectionState === "processing",
    isProcessing: connectionState === "processing",
    connectionState,
    connect,
    disconnect,
    sendAudio,
    sendConfig,
    sendText,
  };
}
