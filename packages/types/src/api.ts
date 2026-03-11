/**
 * WebSocket API типы для backend/app/api/routes/ws.py
 */

/**
 * Результат STT (Speech-to-Text)
 */
export interface SttResult {
  type: "stt_result";
  text: string;
  language: string;
  provider: "deepgram" | "groq";
  latency_ms: number;
  fallback: boolean;
}

/**
 * Типы ошибок в речи
 */
export type ErrorType = "grammar" | "vocabulary" | "code_switching" | "none";

/**
 * Результат реконструкции фразы
 */
export interface ReconstructionResult {
  type: "reconstruction_result";
  corrected: string;
  original_intent: string;
  main_error: string | null;
  error_type: ErrorType;
  explanation: string | null;
}

/**
 * Результат генерации вариантов фраз
 */
export interface VariantsResult {
  type: "variants_result";
  simple: string;
  professional: string;
  colloquial: string;
  slang: string;
  idiom: string;
}

/**
 * Событие ошибки
 */
export interface ErrorEvent {
  type: "error";
  message: string;
}

/**
 * Все типы WebSocket событий
 */
export type WebSocketEvent =
  | SttResult
  | ReconstructionResult
  | VariantsResult
  | ErrorEvent;

/**
 * Типы событий WebSocket
 */
export type WebSocketEventType = WebSocketEvent["type"];

/**
 * Стили вариантов фраз
 */
export type VariantStyle =
  | "simple"
  | "professional"
  | "colloquial"
  | "slang"
  | "idiom";

/**
 * Сообщение в чате
 */
export interface ChatMessage {
  id: string;
  sender: "user" | "companion";
  contentType: "text" | "voice";
  text: string;
  audioUrl?: string;
  audioDuration?: number;
  timestamp: string;
  sttResult?: Omit<SttResult, "type">;
  reconstruction?: Omit<ReconstructionResult, "type">;
  variants?: Omit<VariantsResult, "type">;
}

/**
 * Companion профиль
 */
export interface CompanionProfile {
  id: string;
  name: "Alex" | "Sam" | "Morgan";
  style: "professional" | "casual" | "mentor";
  voice: {
    accent: "us" | "gb";
    gender: "male" | "female";
  };
}

/**
 * User settings
 */
export interface UserSettings {
  companionId: string;
  theme: "light" | "dark";
  ttsSpeed: number; // 0.5 - 1.5
  level: "A2" | "B1" | "B2" | "C1";
  role: "backend" | "frontend" | "devops" | "product";
}
