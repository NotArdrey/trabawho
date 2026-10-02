import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { performBookingLifecycleAction } from "@/features/bookings/services/bookingLifecycle";
import { startBookingWork } from "@/features/bookings/services/bookingTransactions";
import { BookingTransactionActions } from "./BookingTransactionActions";

vi.mock("@/features/bookings/services/bookingLifecycle", () => ({ performBookingLifecycleAction: vi.fn() }));
vi.mock("@/features/bookings/services/bookingTransactions", () => ({
  startBookingWork: vi.fn(), deliverBookingWithEvidence: vi.fn(),
  openBookingSupportCase: vi.fn(), getBookingDeliveryEvidence: vi.fn(),
}));

const booking = {
  id: "booking-1", paymentStatus: "paid", scheduleStatus: "confirmed",
  deliveryStatus: "not_delivered", disputeStatus: "none", scheduleVersion: 2,
  appointmentStartAt: "2026-01-01T09:00:00Z", workStartedAt: null,
  raw: { booking: { status: "confirmed" } },
};

describe("BookingTransactionActions", () => {
  beforeEach(() => vi.clearAllMocks());

  it("blocks work controls while the balance is unpaid", () => {
    render(<BookingTransactionActions booking={{ ...booking, paymentStatus: "partially_paid" }} viewerRole="provider" onUpdated={vi.fn()} />);
    expect(screen.getByText(/waiting for client balance/i)).toBeVisible();
    expect(screen.queryByRole("button", { name: "Start work" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Submit delivery" })).not.toBeInTheDocument();
  });

  it("starts work once despite duplicate clicks and refreshes the booking", async () => {
    let finish: ((value: unknown) => void) | undefined;
    vi.mocked(startBookingWork).mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    const onUpdated = vi.fn();
    render(<BookingTransactionActions booking={booking} viewerRole="provider" onUpdated={onUpdated} />);
    const start = screen.getByRole("button", { name: "Start work" });
    fireEvent.click(start);
    fireEvent.click(start);
    expect(startBookingWork).toHaveBeenCalledTimes(1);
    expect(start).toBeDisabled();
    finish?.({ ...booking, workStartedAt: "2026-10-02T09:00:00Z" });
    await waitFor(() => expect(onUpdated).toHaveBeenCalledOnce());
  });

  it("shows completion only after delivery and a report option for the client", () => {
    const { rerender } = render(<BookingTransactionActions booking={booking} viewerRole="client" onUpdated={vi.fn()} />);
    expect(screen.queryByRole("button", { name: "Confirm completion" })).not.toBeInTheDocument();
    rerender(<BookingTransactionActions booking={{ ...booking, deliveryStatus: "seller_claimed" }} viewerRole="client" onUpdated={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Confirm completion" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Report a problem" })).toBeVisible();
    expect(screen.getByRole("button", { name: "View delivery proof" })).toBeVisible();
  });

  it("retries a failed completion without claiming success", async () => {
    vi.mocked(performBookingLifecycleAction).mockRejectedValueOnce(new Error("Network unavailable"))
      .mockResolvedValueOnce({ ...booking, deliveryStatus: "buyer_confirmed" });
    const onUpdated = vi.fn();
    render(<BookingTransactionActions booking={{ ...booking, deliveryStatus: "seller_claimed" }} viewerRole="client" onUpdated={onUpdated} />);
    fireEvent.click(screen.getByRole("button", { name: "Confirm completion" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Network unavailable");
    fireEvent.click(screen.getByRole("button", { name: "Confirm completion" }));
    await waitFor(() => expect(onUpdated).toHaveBeenCalledOnce());
  });
});
