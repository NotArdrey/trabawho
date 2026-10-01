import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ReservationStatus } from "./ReservationStatus";

describe("ReservationStatus", () => {
  afterEach(() => vi.useRealTimers());

  it("shows a server-backed countdown for an active hold", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-01T10:00:00Z"));
    render(<ReservationStatus scheduleStatus="held" expiresAt="2026-10-01T10:15:00Z" />);
    expect(screen.getByText("15:00")).toBeVisible();
    expect(screen.getByText(/Complete checkout by/i)).toBeVisible();
  });

  it("explains recovery and offers reselection after expiry", async () => {
    const onChooseAnotherTime = vi.fn();
    const user = userEvent.setup();
    render(<ReservationStatus scheduleStatus="expired" onChooseAnotherTime={onChooseAnotherTime} />);
    expect(screen.getByText(/request and quote are saved/i)).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Choose another time" }));
    expect(onChooseAnotherTime).toHaveBeenCalledOnce();
  });

  it("blocks payment language for a schedule that has already passed", () => {
    render(<ReservationStatus scheduleStatus="passed" onChooseAnotherTime={vi.fn()} />);
    expect(screen.getByRole("heading", { name: "Scheduled time has passed" })).toBeVisible();
    expect(screen.getByText(/Payment is unavailable for a past appointment/i)).toBeVisible();
    expect(screen.getByRole("button", { name: "Choose another time" })).toBeVisible();
  });
});
