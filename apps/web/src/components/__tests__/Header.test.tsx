import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Header } from "../layout/Header";

describe("Header (compact)", () => {
  it("should render app name", () => {
    render(<Header companionName="Alex" isOnline />);
    expect(screen.getByText("LinguaCompanion")).toBeInTheDocument();
  });

  it("should render companion name", () => {
    render(<Header companionName="Sam" isOnline />);
    expect(screen.getByText("Sam")).toBeInTheDocument();
  });

  it("should show online indicator when isOnline=true", () => {
    render(<Header companionName="Alex" isOnline />);
    const dot = screen.getByTestId("online-dot");
    expect(dot).toBeInTheDocument();
  });

  it("should call onSettingsClick when gear is clicked", () => {
    const onClick = vi.fn();
    render(<Header companionName="Alex" isOnline onSettingsClick={onClick} />);
    const gear = screen.getByLabelText("Settings");
    fireEvent.click(gear);
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("should show scenario name and exit button", () => {
    const onEnd = vi.fn();
    render(
      <Header
        companionName="Alex"
        isOnline
        scenarioName="Code Review"
        onEndScenario={onEnd}
      />
    );
    expect(screen.getByText("Code Review")).toBeInTheDocument();
    const exitBtn = screen.getByText("Exit");
    fireEvent.click(exitBtn);
    expect(onEnd).toHaveBeenCalledOnce();
  });
});
