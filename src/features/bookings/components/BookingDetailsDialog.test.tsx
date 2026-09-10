import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { BookingDetailsDialog } from "./BookingDetailsDialog";

const booking = {
  id: "booking-1",
  serviceType: "Garden cleanup",
  workerName: "Ramon Torres",
  selectedSlot: { date: "2026-09-28", timeBlock: { startTime: "21:00", endTime: "22:00" } },
  paymentMethod: "gcash-advance",
  quoteAmount: 950,
  transactionFeeAmount: 47.5,
  totalChargedAmount: 997.5,
  paymentReference: "GCASH-1234",
  deliveryStatus: "not_delivered",
};

describe("BookingDetailsDialog", () => {
  it("organizes details into meaningful categories", () => {
    render(<BookingDetailsDialog booking={booking} isProviderView={false} statusLabel="Payment Pending" onClose={vi.fn()} onMessage={vi.fn()} />);

    expect(screen.getByRole("heading", { name: "Schedule" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Payment" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Confirmation progress" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Payment reference" })).toBeVisible();
    expect(screen.getByText("Monday, September 28, 2026")).toBeVisible();
    expect(screen.getByText("PHP 997.50")).toBeVisible();
  });

  it("opens the booking conversation", async () => {
    const user = userEvent.setup();
    const onMessage = vi.fn();
    render(<BookingDetailsDialog booking={booking} isProviderView={false} statusLabel="Payment Pending" onClose={vi.fn()} onMessage={onMessage} />);

    await user.click(screen.getByRole("button", { name: "Message provider" }));
    expect(onMessage).toHaveBeenCalledWith("booking-1");
  });
});
