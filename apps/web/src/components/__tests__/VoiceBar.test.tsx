import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { VoiceBar } from "../VoiceBar";

describe("VoiceBar", () => {
  const defaultProps = {
    onSendText: vi.fn(),
    onSendAudio: vi.fn(),
    isProcessing: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Idle State (single row)", () => {
    it("should render text input and mic button", () => {
      render(<VoiceBar {...defaultProps} />);

      expect(screen.getByPlaceholderText("Type a message...")).toBeInTheDocument();
      expect(screen.getByLabelText("Hold to record")).toBeInTheDocument();
    });

    it("should show send button when text is entered, hiding mic", () => {
      render(<VoiceBar {...defaultProps} />);

      const input = screen.getByPlaceholderText("Type a message...");
      fireEvent.change(input, { target: { value: "Hello" } });

      expect(screen.getByLabelText("Send message")).toBeInTheDocument();
      expect(screen.queryByLabelText("Hold to record")).not.toBeInTheDocument();
    });

    it("should show mic button when text is cleared", () => {
      render(<VoiceBar {...defaultProps} />);

      const input = screen.getByPlaceholderText("Type a message...");
      fireEvent.change(input, { target: { value: "Hello" } });
      fireEvent.change(input, { target: { value: "" } });

      expect(screen.getByLabelText("Hold to record")).toBeInTheDocument();
      expect(screen.queryByLabelText("Send message")).not.toBeInTheDocument();
    });

    it("should call onSendText when clicking send button", () => {
      render(<VoiceBar {...defaultProps} />);

      const input = screen.getByPlaceholderText("Type a message...");
      fireEvent.change(input, { target: { value: "Hello world" } });

      fireEvent.click(screen.getByLabelText("Send message"));

      expect(defaultProps.onSendText).toHaveBeenCalledWith("Hello world");
    });

    it("should send text on Enter key press", () => {
      render(<VoiceBar {...defaultProps} />);

      const input = screen.getByPlaceholderText("Type a message...");
      fireEvent.change(input, { target: { value: "Test message" } });
      fireEvent.keyDown(input, { key: "Enter" });

      expect(defaultProps.onSendText).toHaveBeenCalledWith("Test message");
    });

    it("should not send empty text", () => {
      render(<VoiceBar {...defaultProps} />);

      // With no text, send button is not visible, mic is shown
      // But even if we somehow trigger, nothing should be sent
      expect(screen.queryByLabelText("Send message")).not.toBeInTheDocument();
      expect(defaultProps.onSendText).not.toHaveBeenCalled();
    });

    it("should not have mode toggle pills", () => {
      render(<VoiceBar {...defaultProps} />);

      expect(screen.queryByText(/🎤 Voice/)).not.toBeInTheDocument();
      expect(screen.queryByText(/⌨️ Text/)).not.toBeInTheDocument();
    });
  });

  describe("Processing State", () => {
    it("should render spinner when isProcessing is true", () => {
      render(<VoiceBar {...defaultProps} isProcessing={true} />);

      expect(screen.getByLabelText("Processing...")).toBeInTheDocument();
    });

    it("should render disabled text input when processing", () => {
      render(<VoiceBar {...defaultProps} isProcessing={true} />);

      const input = screen.getByPlaceholderText("Type a message...");
      expect(input).toBeDisabled();
    });

    it("should not render mic button when processing", () => {
      render(<VoiceBar {...defaultProps} isProcessing={true} />);

      expect(screen.queryByLabelText("Hold to record")).not.toBeInTheDocument();
    });
  });

  describe("Recording State", () => {
    it("should show stop button during recording", async () => {
      render(<VoiceBar {...defaultProps} />);

      const micButton = screen.getByLabelText("Hold to record");

      // Start recording
      fireEvent.pointerDown(micButton);

      await waitFor(() => {
        expect(screen.getByLabelText("Stop recording")).toBeInTheDocument();
      });
    });
  });
});
