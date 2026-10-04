import { render, screen } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";

import { getActiveReplacementSchedule } from "@/features/bookings/services/replacementSchedules";
import { BookingCardSchedule } from "./BookingCardSchedule";

vi.mock("@/features/bookings/services/replacementSchedules", () => ({ getActiveReplacementSchedule: vi.fn() }));
vi.mock("@/features/bookings/hooks/useBookingActivity", () => ({ useBookingActivity: vi.fn() }));

const props = { bookingId: "booking-1", checkReplacement: true, originalDate: "2026-09-02",
  originalTime: "8:08 AM–10:08 AM", paymentMethod: "paymongo-card", paymentReference: "pay-1" };

beforeEach(() => vi.clearAllMocks());

it("puts the accepted replacement in the primary booking date and time", async () => {
  vi.mocked(getActiveReplacementSchedule).mockResolvedValue({ bookingId: "booking-1", caseId: "case-1",
    status: "accepted", startAt: "2026-10-05T09:00:00+08:00", endAt: "2026-10-05T10:00:00+08:00" });
  render(<BookingCardSchedule {...props} />);
  expect(screen.getAllByText("Checking current visit…")).toHaveLength(2);
  expect(await screen.findByText("Oct 5, 2026")).toBeVisible();
  expect(screen.getByText("9:00 AM–10:00 AM PHT")).toBeVisible();
  expect(screen.queryByText("2026-09-02")).not.toBeInTheDocument();
});

it("retains the original appointment when there is no replacement", async () => {
  vi.mocked(getActiveReplacementSchedule).mockResolvedValue(null);
  render(<BookingCardSchedule {...props} />);
  expect(await screen.findByText("2026-09-02")).toBeVisible();
  expect(screen.getByText(props.originalTime)).toBeVisible();
});

it("does not present the old time as verified when the current visit cannot be checked", async () => {
  vi.mocked(getActiveReplacementSchedule).mockRejectedValue(new Error("Network unavailable"));
  render(<BookingCardSchedule {...props} />);
  expect(await screen.findByRole("alert")).toHaveTextContent(/current visit could not be checked/i);
});

it("labels a generated showcase reference as demo data, not a PayMongo payment", () => {
  vi.mocked(getActiveReplacementSchedule).mockResolvedValue(null);
  render(<BookingCardSchedule {...props} paymentReference="SHOWCASE-PAID-DE8D36F05202" />);
  expect(screen.getByText("Demo booking — no charge")).toBeVisible();
  expect(screen.getByText("Demo ID:")).toBeVisible();
  expect(screen.queryByText("PayMongo Card")).not.toBeInTheDocument();
});
