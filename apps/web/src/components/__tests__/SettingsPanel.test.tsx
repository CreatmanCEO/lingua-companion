import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SettingsPanel } from "../SettingsPanel";
import { useSettingsStore } from "@/store/settingsStore";

vi.mock("@/lib/edgeTts", () => ({
  playTts: vi.fn(() => Promise.resolve()),
  stopTts: vi.fn(),
  getSavedVoice: vi.fn(() => "us-male"),
  getSavedRate: vi.fn(() => "1.0"),
}));

describe("SettingsPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useSettingsStore.setState({
      companion: "Alex",
      voice: "us-male",
      rate: "1.0",
      topicPreference: "mixed",
      level: "B1",
      theme: "dark",
    });
  });

  it("should render Settings title when open", () => {
    render(<SettingsPanel open onOpenChange={() => {}} />);
    expect(screen.getByText("Settings")).toBeInTheDocument();
  });

  it("should render all 3 companion options", () => {
    render(<SettingsPanel open onOpenChange={() => {}} />);
    expect(screen.getByText("Alex")).toBeInTheDocument();
    expect(screen.getByText("Sam")).toBeInTheDocument();
    expect(screen.getByText("Morgan")).toBeInTheDocument();
  });

  it("should render voice options", () => {
    render(<SettingsPanel open onOpenChange={() => {}} />);
    expect(screen.getByText("US Male")).toBeInTheDocument();
    expect(screen.getByText("GB Female")).toBeInTheDocument();
  });

  it("should render level options", () => {
    render(<SettingsPanel open onOpenChange={() => {}} />);
    expect(screen.getByText("A2")).toBeInTheDocument();
    expect(screen.getByText("B1")).toBeInTheDocument();
    expect(screen.getByText("B2")).toBeInTheDocument();
  });

  it("should call onCompanionChange when companion selected", () => {
    const onChange = vi.fn();
    render(
      <SettingsPanel open onOpenChange={() => {}} onCompanionChange={onChange} />
    );
    fireEvent.click(screen.getByText("Sam"));
    expect(onChange).toHaveBeenCalledWith("Sam");
  });

  it("should have test voice button", () => {
    render(<SettingsPanel open onOpenChange={() => {}} />);
    expect(screen.getByText("Test voice")).toBeInTheDocument();
  });
});
