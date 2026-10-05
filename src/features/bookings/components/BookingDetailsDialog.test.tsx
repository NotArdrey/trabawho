import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { getActiveReplacementSchedule } from "@/features/bookings/services/replacementSchedules";
import { BookingDetailsDialog } from "./BookingDetailsDialog";

vi.mock("@/features/bookings/services/replacementSchedules", () => ({ getActiveReplacementSchedule: vi.fn() }));
vi.mock("@/features/bookings/hooks/useBookingActivity", () => ({ useBookingActivity: vi.fn() }));

const booking = {
  id: "booking-1",
  serviceType: "Garden cleanup",
  workerName: "Ramon Torres",
  selectedSlot: { date: "2026-09-28", timeBlock: { startTime: "21:00", endTime: "22:00" } },
  paymentMethod: "gcash-advance",
  paymentStatus: "pending_provider",
  quoteAmount: 950,
  transactionFeeAmount: 47.5,
  totalChargedAmount: 997.5,
  paymentReference: "GCASH-1234",
  deliveryStatus: "not_delivered",
};

describe("BookingDetailsDialog", () => {
  it("organizes details into meaningful categories", () => {
    render(<BookingDetailsDialog booking={{ ...booking, createdAt: "2026-10-05T05:07:00Z" }} isProviderView={false} statusLabel="Payment Pending" onClose={vi.fn()} onMessage={vi.fn()} />);

    expect(screen.getByRole("heading", { name: "Appointment" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Payment" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Service progress" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Payment reference" })).toBeVisible();
    expect(screen.getByText("Monday, September 28, 2026")).toBeVisible();
    expect(screen.getByText("Visit date")).toBeVisible();
    expect(screen.getByText("Visit time")).toBeVisible();
    expect(screen.getByText(/Oct 5, 2026.*1:07 PM PHT/)).toBeVisible();
    expect(screen.getByText("PHP 997.50")).toBeVisible();
    expect(screen.getByRole("heading", { name: "Deposit required to confirm" })).toBeVisible();
  });

  it("shows the same original booking timestamp to the provider", () => {
    render(<BookingDetailsDialog booking={{ ...booking, createdAt: "2026-10-05T05:07:00Z" }} isProviderView statusLabel="Payment Pending" onClose={vi.fn()} onMessage={vi.fn()} />);
    expect(screen.getByText(/Oct 5, 2026.*1:07 PM PHT/)).toBeVisible();
    expect(screen.getByText("Visit date")).toBeVisible();
  });

  it("does not present the creation date as a visit when no time is scheduled", () => {
    render(<BookingDetailsDialog booking={{ ...booking, selectedSlot: undefined, requestDate: "2026-10-05",
      createdAt: "2026-10-05T05:07:00Z" }} isProviderView={false} statusLabel="Payment Pending"
      onClose={vi.fn()} onMessage={vi.fn()} />);
    expect(screen.getByText("Booked on")).toBeVisible();
    expect(screen.getByText("Not scheduled yet")).toBeVisible();
  });

  it("opens the booking conversation", async () => {
    const user = userEvent.setup();
    const onMessage = vi.fn();
    render(<BookingDetailsDialog booking={booking} isProviderView={false} statusLabel="Payment Pending" onClose={vi.fn()} onMessage={onMessage} />);

    await user.click(screen.getByRole("button", { name: "Message provider" }));
    expect(onMessage).toHaveBeenCalledWith("booking-1");
  });

  it("keeps the client role clear and places payment last", async () => {
    const user = userEvent.setup();
    const onPay = vi.fn();
    render(<BookingDetailsDialog booking={{ ...booking, paymentMethod: "paymongo-card" }} isProviderView={false} statusLabel="Payment Pending" onClose={vi.fn()} onMessage={vi.fn()} onPay={onPay} />);

    expect(screen.getByText("Card via PayMongo")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Message client" })).not.toBeInTheDocument();
    const message = screen.getByRole("button", { name: "Message provider" });
    const pay = screen.getByRole("button", { name: "Pay now" });
    expect(message.compareDocumentPosition(pay) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    await user.click(pay);
    expect(onPay).toHaveBeenCalledWith("booking-1");
  });

  it("does not describe a showcase booking as a PayMongo charge", () => {
    render(<BookingDetailsDialog booking={{ ...booking, paymentMethod: "paymongo-card", paymentStatus: "paid",
      paymentReference: "SHOWCASE-PAID-DE8D36F05202" }} isProviderView={false} statusLabel="Confirmed" onClose={vi.fn()} onMessage={vi.fn()} />);
    expect(screen.getByText("Demo booking — no charge")).toBeVisible();
    expect(screen.getByText("Illustrative total")).toBeVisible();
    expect(screen.getByRole("heading", { name: "Demo booking reference" })).toBeVisible();
    expect(screen.queryByText("Card via PayMongo")).not.toBeInTheDocument();
  });

  it("keeps a genuine PayMongo payment ID distinct from a demo reference", () => {
    render(<BookingDetailsDialog booking={{ ...booking, paymentMethod: "paymongo-card", paymentReference: "pay_test123" }}
      isProviderView={false} statusLabel="Confirmed" onClose={vi.fn()} onMessage={vi.fn()} />);
    expect(screen.getByRole("heading", { name: "PayMongo payment ID" })).toBeVisible();
    expect(screen.getByText("Card via PayMongo")).toBeVisible();
  });

  it("keeps test-mode disclosure in cancelled booking details without repeating simulation labels", () => {
    render(<BookingDetailsDialog booking={{ ...booking, status: "Cancelled", paymentStatus: "refunded", refundSimulated: true }}
      isProviderView={false} statusLabel="Cancelled" onClose={vi.fn()} onMessage={vi.fn()} />);
    expect(screen.getByRole("heading", { name: "Visit cancelled; refund review complete" })).toBeVisible();
    expect(screen.getByText(/PayMongo did not return money/)).toBeVisible();
    expect(screen.queryByText(/simulat/i)).not.toBeInTheDocument();
  });

  it("distinguishes the agreed replacement from the original booking appointment", async () => {
    vi.mocked(getActiveReplacementSchedule).mockResolvedValue({ bookingId: "booking-1", caseId: "case-1",
      status: "accepted", startAt: "2026-10-05T09:00:00+08:00", endAt: "2026-10-05T10:00:00+08:00" });
    render(<MemoryRouter><BookingDetailsDialog booking={{ ...booking, disputeStatus: "open" }}
      isProviderView={false} statusLabel="Dispute Open" onClose={vi.fn()} onMessage={vi.fn()} /></MemoryRouter>);
    expect(await screen.findByRole("heading", { name: "Original booking appointment" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Replacement visit confirmed" })).toBeVisible();
    expect(screen.getByText(/case stays open until replacement work is completed/)).toBeVisible();
  });
});
