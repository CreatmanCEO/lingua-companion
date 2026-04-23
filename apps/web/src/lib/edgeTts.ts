/**
 * Edge-TTS client — LinguaCompanion
 *
 * Заменяет Web Speech API на серверный Edge-TTS.
 * Fallback: Web Speech API если сервер недоступен.
 */

/** Ключи голосов, соответствующие backend VOICES */
export type VoiceKey = "us-male" | "us-female" | "gb-male" | "gb-female";

/** Companion name → preferred TTS voice mapping */
export const COMPANION_VOICES: Record<string, VoiceKey> = {
  Alex: "us-male",
  Sam: "us-female",
  Morgan: "gb-male",
};

/** Get the voice for a companion (falls back to user's saved voice) */
export function getCompanionVoice(companionName?: string): VoiceKey {
  if (companionName && COMPANION_VOICES[companionName]) {
    return COMPANION_VOICES[companionName];
  }
  return getSavedVoice();
}

const TTS_ENDPOINT = `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8001"}/api/v1/tts`;

let currentAudio: HTMLAudioElement | null = null;

/** Получить сохранённый голос из localStorage */
export function getSavedVoice(): VoiceKey {
  if (typeof window === "undefined") return "us-male";
  return (localStorage.getItem("lc-voice") as VoiceKey) || "us-male";
}

/** Получить сохранённую скорость из localStorage */
export function getSavedRate(): string {
  if (typeof window === "undefined") return "1.0";
  return localStorage.getItem("lc-rate") || "1.0";
}

/**
 * Проигрывает текст через Edge-TTS backend.
 * Fallback на Web Speech API при ошибке.
 */
export async function playTts(text: string, voice?: VoiceKey, rate?: string): Promise<void> {
  stopTts();

  const selectedVoice = voice || getSavedVoice();
  const selectedRate = rate || getSavedRate();

  try {
    const resp = await fetch(TTS_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, voice: selectedVoice, rate: selectedRate }),
    });

    if (!resp.ok) throw new Error(`TTS error: ${resp.status}`);

    const blob = await resp.blob();
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    currentAudio = audio;

    return new Promise<void>((resolve, reject) => {
      audio.onended = () => {
        URL.revokeObjectURL(url);
        currentAudio = null;
        resolve();
      };
      audio.onerror = () => {
        URL.revokeObjectURL(url);
        currentAudio = null;
        reject(new Error("Audio playback failed"));
      };
      audio.play().catch(reject);
    });
  } catch {
    // Fallback: Web Speech API
    return new Promise<void>((resolve) => {
      if (typeof window === "undefined" || !window.speechSynthesis) {
        resolve();
        return;
      }
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "en-US";
      utterance.rate = parseFloat(selectedRate) || 1.0;
      utterance.onend = () => resolve();
      utterance.onerror = () => resolve();
      window.speechSynthesis.speak(utterance);
    });
  }
}

/** Останавливает текущее проигрывание */
export function stopTts(): void {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.src = "";
    currentAudio = null;
  }
  if (typeof window !== "undefined" && window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
}

/** Проверяет, идёт ли проигрывание */
export function isTtsPlaying(): boolean {
  if (currentAudio && !currentAudio.paused) return true;
  if (typeof window !== "undefined" && window.speechSynthesis?.speaking) return true;
  return false;
}
