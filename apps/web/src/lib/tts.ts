/**
 * TTS (Text-to-Speech) модуль
 *
 * Phase 1 реализация: window.speechSynthesis (бесплатно, встроен в браузер)
 * Phase 2: подключение Google Neural2 по флагу TTS_PROVIDER=google
 */

/**
 * Опции TTS
 */
export interface TtsOptions {
  voice?: SpeechSynthesisVoice;
  rate?: number;   // 0.5 - 1.5, default 1.0
  pitch?: number;  // 0.5 - 2.0, default 1.0
  volume?: number; // 0 - 1, default 1.0
}

/**
 * Предпочтительный тип голоса
 */
export interface VoicePreference {
  accent: "us" | "gb";
  gender: "male" | "female";
}

/**
 * Проверка доступности TTS
 */
export function isTtsSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

/**
 * Получение всех доступных голосов
 */
export function getVoices(): SpeechSynthesisVoice[] {
  if (!isTtsSupported()) return [];
  return window.speechSynthesis.getVoices();
}

/**
 * Получение голоса по предпочтениям
 */
export function getPreferredVoice(preference: VoicePreference): SpeechSynthesisVoice | null {
  const voices = getVoices();
  if (voices.length === 0) return null;

  const langPrefix = preference.accent === "us" ? "en-US" : "en-GB";

  // Пытаемся найти Google голос с нужными параметрами
  const googleVoice = voices.find((voice) => {
    const matchesLang = voice.lang.startsWith(langPrefix);
    const matchesGender =
      (preference.gender === "male" && voice.name.toLowerCase().includes("male")) ||
      (preference.gender === "female" && voice.name.toLowerCase().includes("female"));
    const isGoogle = voice.name.includes("Google");

    return matchesLang && matchesGender && isGoogle;
  });

  if (googleVoice) return googleVoice;

  // Fallback: любой голос с нужным языком
  const langVoice = voices.find((voice) => voice.lang.startsWith(langPrefix));
  if (langVoice) return langVoice;

  // Fallback: первый английский голос
  const englishVoice = voices.find((voice) => voice.lang.startsWith("en"));
  if (englishVoice) return englishVoice;

  // Последний fallback: первый доступный голос
  return voices[0] || null;
}

/**
 * Проигрывание текста через TTS
 *
 * @param text - Текст для проигрывания
 * @param options - Опции TTS (голос, скорость, тон)
 * @returns Promise, который резолвится когда проигрывание завершено
 */
export function speak(text: string, options: TtsOptions = {}): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!isTtsSupported()) {
      reject(new Error("TTS is not supported in this browser"));
      return;
    }

    // Отменяем предыдущее проигрывание
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);

    // Применяем опции
    if (options.voice) {
      utterance.voice = options.voice;
    } else {
      // Используем дефолтный US English голос
      const defaultVoice = getPreferredVoice({ accent: "us", gender: "male" });
      if (defaultVoice) {
        utterance.voice = defaultVoice;
      }
    }

    utterance.rate = options.rate ?? 1.0;
    utterance.pitch = options.pitch ?? 1.0;
    utterance.volume = options.volume ?? 1.0;

    // Обработчики событий
    utterance.onend = () => resolve();
    utterance.onerror = (event) => reject(new Error(event.error));

    // Запуск проигрывания
    window.speechSynthesis.speak(utterance);
  });
}

/**
 * Остановка текущего проигрывания
 */
export function stopSpeaking(): void {
  if (isTtsSupported()) {
    window.speechSynthesis.cancel();
  }
}

/**
 * Проверка, идёт ли проигрывание
 */
export function isSpeaking(): boolean {
  if (!isTtsSupported()) return false;
  return window.speechSynthesis.speaking;
}

/**
 * Пауза проигрывания
 */
export function pauseSpeaking(): void {
  if (isTtsSupported()) {
    window.speechSynthesis.pause();
  }
}

/**
 * Возобновление проигрывания
 */
export function resumeSpeaking(): void {
  if (isTtsSupported()) {
    window.speechSynthesis.resume();
  }
}

/**
 * Загрузка голосов (некоторые браузеры загружают их асинхронно)
 */
export function loadVoices(): Promise<SpeechSynthesisVoice[]> {
  return new Promise((resolve) => {
    if (!isTtsSupported()) {
      resolve([]);
      return;
    }

    const voices = window.speechSynthesis.getVoices();
    if (voices.length > 0) {
      resolve(voices);
      return;
    }

    // Некоторые браузеры загружают голоса асинхронно
    window.speechSynthesis.onvoiceschanged = () => {
      resolve(window.speechSynthesis.getVoices());
    };

    // Timeout на случай если событие не сработает
    setTimeout(() => {
      resolve(window.speechSynthesis.getVoices());
    }, 1000);
  });
}
