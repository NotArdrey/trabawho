import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import Settings from "./Settings";
import { loadNotificationPreferences, saveNotificationPreferences } from "../services/notificationPreferences";

vi.mock("../services/notificationPreferences", () => ({
  loadNotificationPreferences: vi.fn(), saveNotificationPreferences: vi.fn(),
}));

vi.mock("@/shared/components/DashboardNavigation", () => ({
  default: () => <nav aria-label="Dashboard" />,
}));

describe("Settings", () => {
  beforeEach(() => {
    vi.mocked(loadNotificationPreferences).mockResolvedValue({ emailEnabled: true, smsEnabled: false });
    vi.mocked(saveNotificationPreferences).mockResolvedValue();
  });

  it("exposes clear appearance choices and notification states", async () => {
    const onThemeChange = vi.fn();

    render(<Settings themeMode="system" appTheme="light" onThemeChange={onThemeChange} />);

    expect(screen.getByRole("radio", { name: /device/i })).toHaveAttribute("aria-checked", "true");
    fireEvent.click(screen.getByRole("radio", { name: /^dark/i }));
    expect(onThemeChange).toHaveBeenCalledWith("dark");

    const emailSwitch = screen.getByRole("switch", { name: "Email notifications" });
    await waitFor(() => expect(emailSwitch).toBeEnabled());
    expect(emailSwitch).toHaveAttribute("aria-checked", "true");
    fireEvent.click(emailSwitch);
    expect(emailSwitch).toHaveAttribute("aria-checked", "false");
  });

  it("announces when preferences have been saved", async () => {
    let finishSave: (() => void) | undefined;
    vi.mocked(saveNotificationPreferences).mockReturnValue(new Promise<void>((resolve) => { finishSave = resolve; }));
    render(<Settings />);

    await waitFor(() => expect(screen.getByRole("button", { name: /save preferences/i })).toBeEnabled());
    fireEvent.click(screen.getByRole("switch", { name: "Email notifications" }));
    fireEvent.click(screen.getByRole("button", { name: /save preferences/i }));
    expect(screen.getByRole("button", { name: /saving/i })).toBeDisabled();

    await act(async () => { finishSave?.(); await Promise.resolve(); });
    expect(saveNotificationPreferences).toHaveBeenCalledWith({ emailEnabled: false, smsEnabled: false });
    expect(screen.getByRole("status")).toHaveTextContent("Your preferences have been saved.");
  });

  it("preserves the selection and reports a failed save", async () => {
    vi.mocked(saveNotificationPreferences).mockRejectedValue(new Error('Server unavailable'));
    render(<Settings />);
    const toggle = screen.getByRole("switch", { name: "Email notifications" });
    await waitFor(() => expect(toggle).toBeEnabled());
    fireEvent.click(toggle);
    fireEvent.click(screen.getByRole("button", { name: /save preferences/i }));
    await screen.findByText('Notification preferences could not be saved. Try again.');
    expect(toggle).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByRole('status')).not.toHaveTextContent('Your preferences have been saved.');
  });
});
