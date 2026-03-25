import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ReconstructionBlock } from "../ReconstructionBlock";

describe("ReconstructionBlock", () => {
  const defaultProps = {
    original: "I работал над deployment pipeline",
    corrected: "I've been working on our deployment pipeline",
    explanation: "Present perfect sounds more natural for ongoing work",
    errorType: "grammar" as const,
  };

  it("should render header with Reconstruction text", () => {
    render(<ReconstructionBlock {...defaultProps} />);

    expect(screen.getByText("Reconstruction")).toBeInTheDocument();
  });

  it("should render original text in diff block", () => {
    render(<ReconstructionBlock {...defaultProps} />);

    // В git-diff стиле оригинал показывается в кавычках
    expect(screen.getByText(`\u201C${defaultProps.original}\u201D`)).toBeInTheDocument();
  });

  it("should render corrected text in diff block", () => {
    render(<ReconstructionBlock {...defaultProps} />);

    // В git-diff стиле исправленный текст показывается в кавычках
    expect(screen.getByText(`\u201C${defaultProps.corrected}\u201D`)).toBeInTheDocument();
  });

  it("should render minus and plus signs for diff", () => {
    render(<ReconstructionBlock {...defaultProps} />);

    expect(screen.getByText("−")).toBeInTheDocument();
    expect(screen.getByText("+")).toBeInTheDocument();
  });

  it("should render explanation when provided", () => {
    render(<ReconstructionBlock {...defaultProps} />);

    expect(screen.getByText(defaultProps.explanation!)).toBeInTheDocument();
  });

  it("should not render explanation section when null", () => {
    render(<ReconstructionBlock {...defaultProps} explanation={null} />);

    // When explanation is null, the chat emoji section should not exist
    // Only the lightbulb 💡 in header should be present
    expect(screen.getByText("💡")).toBeInTheDocument();
    // Chat emoji appears only when explanation exists
    expect(screen.queryByText("💬")).not.toBeInTheDocument();
  });

  it("should render perfect message when errorType is none and texts are equal", () => {
    render(
      <ReconstructionBlock
        original="Hello world"
        corrected="Hello world"
        explanation={null}
        errorType="none"
      />
    );

    expect(screen.getByText("Perfect!")).toBeInTheDocument();
    expect(screen.getByText(/sounds natural/i)).toBeInTheDocument();
  });

  it("should still show reconstruction when errorType is none but texts differ", () => {
    render(
      <ReconstructionBlock
        original="Hello world"
        corrected="Hello, world!"
        explanation="Added comma for natural punctuation"
        errorType="none"
      />
    );

    expect(screen.getByText(`\u201CHello world\u201D`)).toBeInTheDocument();
    expect(screen.getByText(`\u201CHello, world!\u201D`)).toBeInTheDocument();
  });

  it("should apply custom className", () => {
    const { container } = render(
      <ReconstructionBlock {...defaultProps} className="custom-class" />
    );

    expect(container.firstChild).toHaveClass("custom-class");
  });

  it("should render lightbulb emoji in header", () => {
    render(<ReconstructionBlock {...defaultProps} />);

    expect(screen.getByText("💡")).toBeInTheDocument();
  });

  it("should render chat emoji in explanation", () => {
    render(<ReconstructionBlock {...defaultProps} />);

    // 💬 appears before explanation text
    expect(screen.getAllByText("💬").length).toBeGreaterThan(0);
  });
});
