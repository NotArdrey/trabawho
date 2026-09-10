import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import Settings from "./Settings";

vi.mock("@/shared/components/DashboardNavigation", () => ({
  default: () => <nav aria-label="Dashboard" />,
}));

describe("Settings", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("exposes clear appearance choices and notification states", () => {
    const onThemeChange = vi.fn();

    render(<Settings themeMode="system" appTheme="light" onThemeChange={onThemeChange} />);

    expect(screen.getByRole("radio", { name: /device/i })).toHaveAttribute("aria-checked", "true");
    fireEvent.click(screen.getByRole("radio", { name: /^dark/i }));
    expect(onThemeChange).toHaveBeenCalledWith("dark");

    const emailSwitch = screen.getByRole("switch", { name: "Email notifications" });
    expect(emailSwitch).toHaveAttribute("aria-checked", "true");
    fireEvent.click(emailSwitch);
    expect(emailSwitch).toHaveAttribute("aria-checked", "false");
  });

  it("announces when preferences have been saved", async () => {
    vi.useFakeTimers();
    render(<Settings />);

    fireEvent.click(screen.getByRole("button", { name: /save preferences/i }));
    expect(screen.getByRole("button", { name: /saving/i })).toBeDisabled();

    await act(() => {
      vi.advanceTimersByTime(500);
      return Promise.resolve();
    });
    expect(screen.getByRole("status")).toHaveTextContent("Your preferences have been saved.");
  });
});
