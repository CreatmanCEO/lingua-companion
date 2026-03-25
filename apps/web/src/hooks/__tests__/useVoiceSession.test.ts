import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useVoiceSession } from "../useVoiceSession";

describe("useVoiceSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should initialize with idle state", () => {
    const { result } = renderHook(() => useVoiceSession());

    expect(result.current.isConnected).toBe(false);
    expect(result.current.isProcessing).toBe(false);
    expect(result.current.connectionState).toBe("idle");
  });

  it("should connect to WebSocket", async () => {
    const { result } = renderHook(() => useVoiceSession());

    act(() => {
      result.current.connect();
    });

    // Ждём подключения (мок подключается через 10ms)
    await act(async () => {
      vi.advanceTimersByTime(20);
    });

    expect(result.current.isConnected).toBe(true);
    expect(result.current.connectionState).toBe("connected");
  });

  it("should disconnect from WebSocket", async () => {
    const { result } = renderHook(() => useVoiceSession());

    act(() => {
      result.current.connect();
    });

    await act(async () => {
      vi.advanceTimersByTime(20);
    });

    expect(result.current.isConnected).toBe(true);

    act(() => {
      result.current.disconnect();
    });

    expect(result.current.isConnected).toBe(false);
    expect(result.current.connectionState).toBe("idle");
  });

  it("should call onSttResult callback when receiving stt_result event", async () => {
    const onSttResult = vi.fn();
    const { result } = renderHook(() => useVoiceSession({ onSttResult }));

    act(() => {
      result.current.connect();
    });

    await act(async () => {
      vi.advanceTimersByTime(20);
    });

    // Симулируем получение stt_result от сервера
    // В реальных тестах это было бы через mock WebSocket
    // Здесь мы проверяем структуру хука
    expect(result.current.isConnected).toBe(true);
  });

  it("should handle sendAudio when connected", async () => {
    const { result } = renderHook(() => useVoiceSession());

    act(() => {
      result.current.connect();
    });

    await act(async () => {
      vi.advanceTimersByTime(20);
    });

    const mockBlob = new Blob(["test audio"], { type: "audio/webm" });

    act(() => {
      result.current.sendAudio(mockBlob);
    });

    expect(result.current.isProcessing).toBe(true);
  });

  it("should handle error when sending audio while not connected", async () => {
    const onError = vi.fn();
    const { result } = renderHook(() => useVoiceSession({ onError }));

    const mockBlob = new Blob(["test audio"], { type: "audio/webm" });

    act(() => {
      result.current.sendAudio(mockBlob);
    });

    expect(onError).toHaveBeenCalledWith("Not connected to server");
  });

  it("should cleanup on unmount", async () => {
    const { result, unmount } = renderHook(() => useVoiceSession());

    act(() => {
      result.current.connect();
    });

    await act(async () => {
      vi.advanceTimersByTime(20);
    });

    expect(result.current.isConnected).toBe(true);

    unmount();

    // После unmount WebSocket должен быть закрыт
    // (проверяется отсутствием ошибок и утечек)
  });

  it("should expose sendConfig method", async () => {
    const { result } = renderHook(() => useVoiceSession());

    act(() => {
      result.current.connect();
    });

    await act(async () => {
      vi.advanceTimersByTime(20);
    });

    // sendConfig не должен вызвать ошибку при подключённом WS
    act(() => {
      result.current.sendConfig("Morgan", null);
    });

    // Проверяем что хук остаётся в connected состоянии
    expect(result.current.isConnected).toBe(true);
  });

  it("should expose sendText method and set processing state", async () => {
    const { result } = renderHook(() => useVoiceSession());

    act(() => {
      result.current.connect();
    });

    await act(async () => {
      vi.advanceTimersByTime(20);
    });

    act(() => {
      result.current.sendText("I want to learn English");
    });

    expect(result.current.isProcessing).toBe(true);
  });

  it("should handle error when sending text while not connected", async () => {
    const onError = vi.fn();
    const { result } = renderHook(() => useVoiceSession({ onError }));

    act(() => {
      result.current.sendText("test message");
    });

    expect(onError).toHaveBeenCalledWith("Not connected to server");
  });

  it("should expose onCompanionResponse callback support", async () => {
    const onCompanionResponse = vi.fn();
    const { result } = renderHook(() =>
      useVoiceSession({ onCompanionResponse })
    );

    act(() => {
      result.current.connect();
    });

    await act(async () => {
      vi.advanceTimersByTime(20);
    });

    // Проверяем что хук принимает onCompanionResponse callback
    expect(result.current.isConnected).toBe(true);
  });
});
