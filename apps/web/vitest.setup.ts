/**
 * Vitest setup file
 * Настройка глобальных моков для тестирования
 */

import "@testing-library/jest-dom";

// Mock для window.speechSynthesis
const mockSpeechSynthesis = {
  speak: vi.fn(),
  cancel: vi.fn(),
  pause: vi.fn(),
  resume: vi.fn(),
  getVoices: vi.fn(() => [
    {
      name: "Google US English",
      lang: "en-US",
      default: true,
      localService: false,
      voiceURI: "Google US English",
    },
    {
      name: "Google UK English Male",
      lang: "en-GB",
      default: false,
      localService: false,
      voiceURI: "Google UK English Male",
    },
  ]),
  speaking: false,
  pending: false,
  paused: false,
  onvoiceschanged: null,
};

Object.defineProperty(window, "speechSynthesis", {
  value: mockSpeechSynthesis,
  writable: true,
});

// Mock для SpeechSynthesisUtterance
class MockSpeechSynthesisUtterance {
  text: string;
  lang: string = "en-US";
  voice: SpeechSynthesisVoice | null = null;
  volume: number = 1;
  rate: number = 1;
  pitch: number = 1;
  onend: (() => void) | null = null;
  onerror: ((event: SpeechSynthesisErrorEvent) => void) | null = null;
  onstart: (() => void) | null = null;
  onpause: (() => void) | null = null;
  onresume: (() => void) | null = null;
  onboundary: (() => void) | null = null;
  onmark: (() => void) | null = null;

  constructor(text: string = "") {
    this.text = text;
  }
}

Object.defineProperty(window, "SpeechSynthesisUtterance", {
  value: MockSpeechSynthesisUtterance,
  writable: true,
});

// Mock для MediaRecorder
class MockMediaRecorder {
  state: "inactive" | "recording" | "paused" = "inactive";
  ondataavailable: ((event: BlobEvent) => void) | null = null;
  onstop: (() => void) | null = null;
  onerror: ((event: MediaRecorderErrorEvent) => void) | null = null;
  onstart: (() => void) | null = null;
  onpause: (() => void) | null = null;
  onresume: (() => void) | null = null;
  mimeType: string;
  stream: MediaStream;

  constructor(stream: MediaStream, options?: MediaRecorderOptions) {
    this.stream = stream;
    this.mimeType = options?.mimeType || "audio/webm";
  }

  static isTypeSupported(type: string): boolean {
    return type.startsWith("audio/webm") || type.startsWith("audio/mp4");
  }

  start(timeslice?: number): void {
    this.state = "recording";
    this.onstart?.();

    // Симулируем получение данных
    if (timeslice) {
      const blob = new Blob(["mock audio data"], { type: this.mimeType });
      const event = new Event("dataavailable") as BlobEvent;
      Object.defineProperty(event, "data", { value: blob });
      setTimeout(() => this.ondataavailable?.(event), 100);
    }
  }

  stop(): void {
    this.state = "inactive";
    // Финальный chunk
    const blob = new Blob(["mock audio data"], { type: this.mimeType });
    const event = new Event("dataavailable") as BlobEvent;
    Object.defineProperty(event, "data", { value: blob });
    this.ondataavailable?.(event);
    setTimeout(() => this.onstop?.(), 0);
  }

  pause(): void {
    this.state = "paused";
    this.onpause?.();
  }

  resume(): void {
    this.state = "recording";
    this.onresume?.();
  }
}

Object.defineProperty(window, "MediaRecorder", {
  value: MockMediaRecorder,
  writable: true,
});

// Mock для navigator.mediaDevices.getUserMedia
const mockMediaStream = {
  getTracks: () => [
    {
      kind: "audio",
      stop: vi.fn(),
      enabled: true,
    },
  ],
  getAudioTracks: () => [
    {
      kind: "audio",
      stop: vi.fn(),
      enabled: true,
    },
  ],
};

Object.defineProperty(navigator, "mediaDevices", {
  value: {
    getUserMedia: vi.fn(() => Promise.resolve(mockMediaStream)),
    enumerateDevices: vi.fn(() => Promise.resolve([])),
  },
  writable: true,
});

// Mock для AudioContext
class MockAudioContext {
  state: "running" | "suspended" | "closed" = "running";

  createMediaStreamSource(): MediaStreamAudioSourceNode {
    return {
      connect: vi.fn(),
      disconnect: vi.fn(),
    } as unknown as MediaStreamAudioSourceNode;
  }

  createAnalyser(): AnalyserNode {
    return {
      connect: vi.fn(),
      disconnect: vi.fn(),
      fftSize: 256,
      frequencyBinCount: 128,
      getByteFrequencyData: vi.fn((array: Uint8Array) => {
        // Заполняем случайными значениями для визуализации
        for (let i = 0; i < array.length; i++) {
          array[i] = Math.floor(Math.random() * 256);
        }
      }),
      getByteTimeDomainData: vi.fn(),
    } as unknown as AnalyserNode;
  }

  close(): Promise<void> {
    this.state = "closed";
    return Promise.resolve();
  }
}

Object.defineProperty(window, "AudioContext", {
  value: MockAudioContext,
  writable: true,
});

Object.defineProperty(window, "webkitAudioContext", {
  value: MockAudioContext,
  writable: true,
});

// Mock для WebSocket
class MockWebSocket {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;

  readonly CONNECTING = 0;
  readonly OPEN = 1;
  readonly CLOSING = 2;
  readonly CLOSED = 3;

  readyState: number = MockWebSocket.CONNECTING;
  url: string;
  onopen: ((event: Event) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;

  constructor(url: string) {
    this.url = url;
    // Симулируем успешное подключение
    setTimeout(() => {
      this.readyState = MockWebSocket.OPEN;
      this.onopen?.(new Event("open"));
    }, 10);
  }

  send(_data: unknown): void {
    if (this.readyState !== MockWebSocket.OPEN) {
      throw new Error("WebSocket is not open");
    }
    // Можно симулировать ответ сервера здесь
  }

  close(code: number = 1000, reason?: string): void {
    this.readyState = MockWebSocket.CLOSED;
    const event = new CloseEvent("close", { code, reason, wasClean: true });
    this.onclose?.(event);
  }
}

Object.defineProperty(window, "WebSocket", {
  value: MockWebSocket,
  writable: true,
});

// Подавляем console.error в тестах для чистого вывода
// Раскомментируй для отладки:
// vi.spyOn(console, 'error').mockImplementation(() => {});
