"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Конфигурация рекордера
 */
interface AudioRecorderConfig {
  // Интервал обновления уровня громкости (мс)
  audioLevelUpdateInterval?: number;
}

/**
 * Возвращаемый интерфейс хука
 */
interface UseAudioRecorderReturn {
  isRecording: boolean;
  audioLevel: number; // 0-1 для визуализации
  duration: number; // секунды записи
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<Blob | null>;
  cancelRecording: () => void;
  isSupported: boolean;
  error: string | null;
}

/**
 * Определение поддерживаемого MIME типа
 * Safari не поддерживает webm, используем mp4
 */
function getSupportedMimeType(): string {
  const types = [
    "audio/webm;codecs=opus", // Chrome, Firefox, Edge
    "audio/webm",             // Fallback webm
    "audio/mp4",              // Safari iOS
    "audio/ogg;codecs=opus",  // Firefox fallback
  ];

  for (const type of types) {
    if (MediaRecorder.isTypeSupported(type)) {
      return type;
    }
  }

  // Если ничего не поддерживается, вернём дефолт
  return "audio/webm";
}

/**
 * Hook для записи аудио через MediaRecorder API
 *
 * @param config - Конфигурация рекордера
 * @returns Объект с методами управления записью
 */
export function useAudioRecorder(
  config: AudioRecorderConfig = {}
): UseAudioRecorderReturn {
  const { audioLevelUpdateInterval = 50 } = config;

  const [isRecording, setIsRecording] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isSupported, setIsSupported] = useState(true);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startTimeRef = useRef<number>(0);
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const levelIntervalRef = useRef<NodeJS.Timeout | null>(null);

  /**
   * Проверка поддержки браузером
   */
  useEffect(() => {
    const supported =
      typeof window !== "undefined" &&
      "MediaRecorder" in window &&
      "getUserMedia" in navigator.mediaDevices;

    setIsSupported(supported);

    if (!supported) {
      setError("Audio recording is not supported in this browser");
    }
  }, []);

  /**
   * Очистка ресурсов
   */
  const cleanup = useCallback(() => {
    // Остановка интервалов
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }
    if (levelIntervalRef.current) {
      clearInterval(levelIntervalRef.current);
      levelIntervalRef.current = null;
    }

    // Остановка потока
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    // Закрытие AudioContext
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }

    analyserRef.current = null;
    mediaRecorderRef.current = null;
    chunksRef.current = [];
    setAudioLevel(0);
    setDuration(0);
  }, []);

  /**
   * Обновление уровня громкости для визуализации
   */
  const updateAudioLevel = useCallback(() => {
    if (!analyserRef.current) return;

    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteFrequencyData(dataArray);

    // Вычисляем средний уровень
    const sum = dataArray.reduce((a, b) => a + b, 0);
    const average = sum / dataArray.length;
    const normalized = Math.min(average / 128, 1); // Нормализуем к 0-1

    setAudioLevel(normalized);
  }, []);

  /**
   * Начало записи
   */
  const startRecording = useCallback(async () => {
    if (!isSupported) {
      setError("Audio recording is not supported");
      return;
    }

    if (isRecording) {
      return;
    }

    setError(null);
    chunksRef.current = [];

    try {
      // Запрос доступа к микрофону
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      streamRef.current = stream;

      // Создание AudioContext для анализа уровня
      const audioContext = new (window.AudioContext || (window as typeof window & { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      audioContextRef.current = audioContext;

      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      // Создание MediaRecorder
      const mimeType = getSupportedMimeType();
      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onerror = () => {
        setError("Recording error occurred");
        cleanup();
        setIsRecording(false);
      };

      // Запуск записи
      mediaRecorder.start(100); // Chunk каждые 100ms
      startTimeRef.current = Date.now();
      setIsRecording(true);

      // Интервал обновления длительности
      durationIntervalRef.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
        setDuration(elapsed);
      }, 1000);

      // Интервал обновления уровня громкости
      levelIntervalRef.current = setInterval(
        updateAudioLevel,
        audioLevelUpdateInterval
      );
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to access microphone";

      if (errorMessage.includes("Permission denied") || errorMessage.includes("NotAllowedError")) {
        setError("Microphone access denied. Please allow microphone access.");
      } else {
        setError(errorMessage);
      }

      cleanup();
    }
  }, [isSupported, isRecording, cleanup, updateAudioLevel, audioLevelUpdateInterval]);

  /**
   * Остановка записи и возврат Blob
   */
  const stopRecording = useCallback(async (): Promise<Blob | null> => {
    if (!mediaRecorderRef.current || !isRecording) {
      return null;
    }

    return new Promise((resolve) => {
      const mediaRecorder = mediaRecorderRef.current!;

      mediaRecorder.onstop = () => {
        const mimeType = getSupportedMimeType();
        const blob = new Blob(chunksRef.current, { type: mimeType });
        cleanup();
        setIsRecording(false);
        resolve(blob);
      };

      mediaRecorder.stop();
    });
  }, [isRecording, cleanup]);

  /**
   * Отмена записи без сохранения
   */
  const cancelRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
    }
    cleanup();
    setIsRecording(false);
  }, [isRecording, cleanup]);

  /**
   * Cleanup при unmount
   */
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  return {
    isRecording,
    audioLevel,
    duration,
    startRecording,
    stopRecording,
    cancelRecording,
    isSupported,
    error,
  };
}
