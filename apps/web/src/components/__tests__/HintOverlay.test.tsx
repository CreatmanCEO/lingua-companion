import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { HintOverlay } from "../HintOverlay";

describe("HintOverlay", () => {
  it("should render first step on mount", () => {
    render(<HintOverlay onComplete={() => {}} />);
    expect(screen.getByText("Settings")).toBeInTheDocument();
    expect(screen.getByText("Choose companion, voice and style")).toBeInTheDocument();
    expect(screen.getByText("1 / 4")).toBeInTheDocument();
  });

  it("should show Next button on first 3 steps", () => {
    render(<HintOverlay onComplete={() => {}} />);
    expect(screen.getByText("Next")).toBeInTheDocument();
  });

  it("should advance to next step on click", () => {
    render(<HintOverlay onComplete={() => {}} />);
    fireEvent.click(screen.getByText("Next"));
    expect(screen.getByText("Practice Modes")).toBeInTheDocument();
    expect(screen.getByText("2 / 4")).toBeInTheDocument();
  });

  it("should show Got it! on last step and call onComplete", () => {
    const onComplete = vi.fn();
    render(<HintOverlay onComplete={onComplete} />);

    // Click through all steps
    fireEvent.click(screen.getByText("Next")); // -> step 2
    fireEvent.click(screen.getByText("Next")); // -> step 3
    fireEvent.click(screen.getByText("Next")); // -> step 4

    expect(screen.getByText("Got it!")).toBeInTheDocument();
    expect(screen.getByText("Voice Input")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Got it!"));
    expect(onComplete).toHaveBeenCalledOnce();
  });
});
