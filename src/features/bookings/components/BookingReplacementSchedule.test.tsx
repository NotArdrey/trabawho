import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, expect, it, vi } from "vitest";

import { getActiveReplacementSchedule } from "@/features/bookings/services/replacementSchedules";
import { BookingReplacementSchedule } from "./BookingReplacementSchedule";

vi.mock("@/features/bookings/services/replacementSchedules", () => ({ getActiveReplacementSchedule: vi.fn() }));
vi.mock("@/features/bookings/hooks/useBookingActivity", () => ({ useBookingActivity: vi.fn() }));

beforeEach(() => { vi.clearAllMocks(); });

it("shows the agreed replacement as the active appointment and preserves the original as history", async () => {
  vi.mocked(getActiveReplacementSchedule).mockResolvedValue({
    bookingId: "booking-1", caseId: "case-1", status: "accepted",
    startAt: "2026-10-10T08:00:00+08:00", endAt: "2026-10-10T09:00:00+08:00",
  });
  render(<MemoryRouter><BookingReplacementSchedule bookingId="booking-1" /></MemoryRouter>);
  expect(await screen.findByText("Confirmed replacement visit")).toBeVisible();
  expect(screen.getByText(/Saturday, October 10, 2026/)).toBeVisible();
  expect(screen.getByText(/This is the active appointment/)).toBeVisible();
  expect(screen.getByRole("link", { name: "View support case" })).toHaveAttribute("href", "/support-cases?case=case-1");
});

it("does not invent a replacement appointment when none was accepted", async () => {
  vi.mocked(getActiveReplacementSchedule).mockResolvedValue(null);
  render(<MemoryRouter><BookingReplacementSchedule bookingId="booking-1" /></MemoryRouter>);
  await waitFor(() => expect(getActiveReplacementSchedule).toHaveBeenCalledWith("booking-1"));
  expect(screen.queryByText("Confirmed replacement visit")).not.toBeInTheDocument();
});
