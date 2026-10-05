import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { BookingQuote } from "@/features/bookings/types/booking-transactions";
import { BookingQuoteCard } from "./BookingQuoteCard";

const quote: BookingQuote = {
  id: "quote-1", booking_id: "booking-1", version: 2, amount: 950, currency: "PHP",
  scope_summary: "Garden cleanup", proposed_start_ts: "2099-10-06T02:00:00Z",
  proposed_end_ts: "2099-10-06T03:00:00Z", expires_at: "2099-10-05T02:00:00Z",
  response_note: null, status: "proposed",
};

describe("BookingQuoteCard", () => {
  it("shows all three client responses and the estimated payment breakdown", async () => {
    const user = userEvent.setup();
    const onAccept = vi.fn(); const onRequestChanges = vi.fn(); const onDecline = vi.fn();
    render(<BookingQuoteCard quote={quote} canRespond onAccept={onAccept} onRequestChanges={onRequestChanges} onDecline={onDecline} />);
    expect(screen.getByText("PHP 950.00")).toBeVisible();
    expect(screen.getByText("PHP 76.00")).toBeVisible();
    await user.click(screen.getByRole("button", { name: /Accept and continue to payment/ }));
    await user.click(screen.getByRole("button", { name: /Request changes/ }));
    await user.click(screen.getByRole("button", { name: /Decline quote/ }));
    expect(onAccept).toHaveBeenCalledOnce(); expect(onRequestChanges).toHaveBeenCalledOnce(); expect(onDecline).toHaveBeenCalledOnce();
  });

  it("does not offer actions for an expired or superseded quote", () => {
    const { rerender } = render(<BookingQuoteCard quote={{ ...quote, expires_at: "2000-01-01T00:00:00Z" }} canRespond />);
    expect(screen.getByText(/This offer can no longer be used/)).toBeVisible();
    expect(screen.queryByRole("button", { name: /Accept and continue/ })).not.toBeInTheDocument();
    rerender(<BookingQuoteCard quote={{ ...quote, status: "superseded" }} canRespond />);
    expect(screen.queryByRole("button", { name: /Accept and continue/ })).not.toBeInTheDocument();
  });
});
