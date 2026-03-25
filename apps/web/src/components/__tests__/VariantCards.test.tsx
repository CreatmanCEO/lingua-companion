import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { VariantCards } from "../VariantCards";
import type { VariantsResult } from "@/hooks/useVoiceSession";

describe("VariantCards", () => {
  const mockVariants: VariantsResult = {
    simple: "I worked on the deployment pipeline",
    professional: "I've been optimizing our CI/CD pipeline infrastructure",
    colloquial: "Yeah, I was messing with the deployment stuff",
    slang: "Been hacking on the pipeline, you know",
    idiom: "I've been burning the midnight oil on our deployment",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render all 5 variant cards", () => {
    render(<VariantCards variants={mockVariants} />);

    expect(screen.getByText("Simple")).toBeInTheDocument();
    expect(screen.getByText("Professional")).toBeInTheDocument();
    expect(screen.getByText("Casual")).toBeInTheDocument(); // Changed from Colloquial
    expect(screen.getByText("Slang")).toBeInTheDocument();
    expect(screen.getByText("Idiom")).toBeInTheDocument();
  });

  it("should render variant phrases in quotes", () => {
    render(<VariantCards variants={mockVariants} />);

    // Phrases are wrapped in curly quotes (\u201C \u201D)
    expect(screen.getByText(`\u201C${mockVariants.simple}\u201D`)).toBeInTheDocument();
    expect(screen.getByText(`\u201C${mockVariants.professional}\u201D`)).toBeInTheDocument();
    expect(screen.getByText(`\u201C${mockVariants.colloquial}\u201D`)).toBeInTheDocument();
    expect(screen.getByText(`\u201C${mockVariants.slang}\u201D`)).toBeInTheDocument();
    expect(screen.getByText(`\u201C${mockVariants.idiom}\u201D`)).toBeInTheDocument();
  });

  it("should render play buttons for each card", () => {
    render(<VariantCards variants={mockVariants} />);

    const playButtons = screen.getAllByText("▶");
    expect(playButtons).toHaveLength(5);
  });

  it("should render save buttons for each card", () => {
    render(<VariantCards variants={mockVariants} />);

    const saveButtons = screen.getAllByText("+ Save");
    expect(saveButtons).toHaveLength(5);
  });

  it("should call onSave when save button is clicked", () => {
    const onSave = vi.fn();
    render(<VariantCards variants={mockVariants} onSave={onSave} />);

    const saveButtons = screen.getAllByText("+ Save");
    fireEvent.click(saveButtons[0]);

    expect(onSave).toHaveBeenCalledWith("simple", mockVariants.simple);
  });

  it("should change save button to saved after clicking", () => {
    render(<VariantCards variants={mockVariants} />);

    const saveButtons = screen.getAllByText("+ Save");
    fireEvent.click(saveButtons[0]);

    expect(screen.getByText("✓ Saved")).toBeInTheDocument();
  });

  it("should render context descriptions", () => {
    render(<VariantCards variants={mockVariants} />);

    // New descriptions from prototype
    expect(screen.getByText(/everyday conversation/i)).toBeInTheDocument();
    expect(screen.getByText(/technical presentations/i)).toBeInTheDocument();
    expect(screen.getByText(/slack messages/i)).toBeInTheDocument();
    expect(screen.getByText(/developer twitter/i)).toBeInTheDocument();
    expect(screen.getByText(/sounds native/i)).toBeInTheDocument();
  });

  it("should render 5 ways to say it label", () => {
    render(<VariantCards variants={mockVariants} />);

    expect(screen.getByText("5 Ways to say it")).toBeInTheDocument();
  });

  it("should have horizontal scroll container", () => {
    render(<VariantCards variants={mockVariants} />);

    // Карточки должны быть в flex контейнере
    const cardContainer = screen.getByText("Simple").closest("div");
    expect(cardContainer).toBeInTheDocument();
  });
});
