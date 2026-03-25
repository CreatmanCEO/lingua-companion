import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { VoiceBar } from "../VoiceBar";

describe("VoiceBar", () => {
  const defaultProps = {
    mode: "voice" as const,
    onModeChange: vi.fn(),
    onSendText: vi.fn(),
    onSendAudio: vi.fn(),
    isProcessing: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Idle Text Mode", () => {
    it("should render text input and send button in text mode", () => {
      render(<VoiceBar {...defaultProps} mode="text" />);

      expect(screen.getByPlaceholderText("Type a message...")).toBeInTheDocument();
      // Send button - найдём по структуре (SVG внутри button)
      const sendButtons = screen.getAllByRole("button");
      expect(sendButtons.length).toBeGreaterThan(0);
    });

    it("should render voice mode pill", () => {
      render(<VoiceBar {...defaultProps} mode="text" />);

      expect(screen.getByText(/🎤 Voice/)).toBeInTheDocument();
    });

    it("should call onModeChange when clicking voice pill", () => {
      render(<VoiceBar {...defaultProps} mode="text" />);

      fireEvent.click(screen.getByText(/🎤 Voice/));

      expect(defaultProps.onModeChange).toHaveBeenCalledWith("voice");
    });

    it("should call onSendText when sending text", () => {
      render(<VoiceBar {...defaultProps} mode="text" />);

      const input = screen.getByPlaceholderText("Type a message...");
      fireEvent.change(input, { target: { value: "Hello world" } });

      // Находим send button (последняя кнопка в text mode)
      const buttons = screen.getAllByRole("button");
      const sendButton = buttons[buttons.length - 1];
      fireEvent.click(sendButton);

      expect(defaultProps.onSendText).toHaveBeenCalledWith("Hello world");
    });

    it("should send text on Enter key press", () => {
      render(<VoiceBar {...defaultProps} mode="text" />);

      const input = screen.getByPlaceholderText("Type a message...");
      fireEvent.change(input, { target: { value: "Test message" } });
      fireEvent.keyDown(input, { key: "Enter" });

      expect(defaultProps.onSendText).toHaveBeenCalledWith("Test message");
    });

    it("should not send empty text", () => {
      render(<VoiceBar {...defaultProps} mode="text" />);

      // Находим send button (последняя кнопка в text mode)
      const buttons = screen.getAllByRole("button");
      const sendButton = buttons[buttons.length - 1];
      fireEvent.click(sendButton);

      expect(defaultProps.onSendText).not.toHaveBeenCalled();
    });
  });

  describe("Idle Voice Mode", () => {
    it("should render hold-to-speak hint in voice mode", () => {
      render(<VoiceBar {...defaultProps} mode="voice" />);

      expect(screen.getByText(/Hold to speak/)).toBeInTheDocument();
    });

    it("should render text mode pill", () => {
      render(<VoiceBar {...defaultProps} mode="voice" />);

      expect(screen.getByText(/⌨️ Text/)).toBeInTheDocument();
    });

    it("should call onModeChange when clicking text pill", () => {
      render(<VoiceBar {...defaultProps} mode="voice" />);

      fireEvent.click(screen.getByText(/⌨️ Text/));

      expect(defaultProps.onModeChange).toHaveBeenCalledWith("text");
    });
  });

  describe("Processing State", () => {
    it("should render processing indicator when isProcessing is true", () => {
      render(<VoiceBar {...defaultProps} isProcessing={true} />);

      expect(screen.getByText(/processing/i)).toBeInTheDocument();
    });

    it("should not render input controls when processing", () => {
      render(<VoiceBar {...defaultProps} isProcessing={true} />);

      expect(screen.queryByText(/Hold to speak/)).not.toBeInTheDocument();
      expect(screen.queryByPlaceholderText("Type a message...")).not.toBeInTheDocument();
    });
  });

  describe("Recording State", () => {
    it("should show cancel hint during recording", async () => {
      render(<VoiceBar {...defaultProps} mode="voice" />);

      // Найдём mic button (большая кнопка с микрофоном)
      const buttons = screen.getAllByRole("button");
      const micButton = buttons[buttons.length - 1]; // Последняя кнопка - mic

      // Начинаем запись
      fireEvent.pointerDown(micButton);

      await waitFor(() => {
        expect(screen.getByText(/cancel/i)).toBeInTheDocument();
      });
    });
  });
});
