import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useAudioRecorder } from "../useAudioRecorder";

describe("useAudioRecorder", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should initialize with default state", () => {
    const { result } = renderHook(() => useAudioRecorder());

    expect(result.current.isRecording).toBe(false);
    expect(result.current.audioLevel).toBe(0);
    expect(result.current.duration).toBe(0);
    expect(result.current.isSupported).toBe(true);
    expect(result.current.error).toBe(null);
  });

  it("should start recording when startRecording is called", async () => {
    const { result } = renderHook(() => useAudioRecorder());

    await act(async () => {
      await result.current.startRecording();
    });

    expect(result.current.isRecording).toBe(true);
    expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });
  });

  it("should stop recording and return blob", async () => {
    const { result } = renderHook(() => useAudioRecorder());

    await act(async () => {
      await result.current.startRecording();
    });

    // Advance time past MIN_RECORDING_MS (500ms)
    const originalNow = Date.now;
    const startTime = Date.now();
    Date.now = () => startTime + 600;

    let blob: Blob | null = null;
    await act(async () => {
      blob = await result.current.stopRecording();
    });

    Date.now = originalNow;

    expect(result.current.isRecording).toBe(false);
    expect(blob).toBeInstanceOf(Blob);
  });

  it("should return null for recordings shorter than 500ms", async () => {
    const { result } = renderHook(() => useAudioRecorder());

    // Capture the start time so elapsed is ~0ms
    const originalNow = Date.now;
    const fixedTime = Date.now();
    Date.now = () => fixedTime;

    await act(async () => {
      await result.current.startRecording();
    });

    let blob: Blob | null = null;
    await act(async () => {
      blob = await result.current.stopRecording();
    });

    Date.now = originalNow;

    expect(result.current.isRecording).toBe(false);
    expect(blob).toBeNull();
  });

  it("should cancel recording without returning blob", async () => {
    const { result } = renderHook(() => useAudioRecorder());

    await act(async () => {
      await result.current.startRecording();
    });

    expect(result.current.isRecording).toBe(true);

    act(() => {
      result.current.cancelRecording();
    });

    expect(result.current.isRecording).toBe(false);
  });

  it("should cleanup on unmount", async () => {
    const { result, unmount } = renderHook(() => useAudioRecorder());

    await act(async () => {
      await result.current.startRecording();
    });

    expect(result.current.isRecording).toBe(true);

    unmount();

    // После unmount не должно быть утечек памяти
    // (проверяется отсутствием ошибок)
  });

  it("should not start recording if already recording", async () => {
    const { result } = renderHook(() => useAudioRecorder());

    await act(async () => {
      await result.current.startRecording();
    });

    const getUserMediaCallCount = (navigator.mediaDevices.getUserMedia as ReturnType<typeof vi.fn>).mock.calls.length;

    await act(async () => {
      await result.current.startRecording();
    });

    // Не должно быть повторного вызова getUserMedia
    expect((navigator.mediaDevices.getUserMedia as ReturnType<typeof vi.fn>).mock.calls.length).toBe(getUserMediaCallCount);
  });
});
