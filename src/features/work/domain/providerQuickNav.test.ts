import { describe, expect, it } from "vitest";
import { providerActionPath, providerBookingPath } from "./providerQuickNav";

describe("provider quick navigation", () => {
  it("opens and highlights the exact conversation for an unread message", () => {
    expect(providerActionPath({ id: "message", priority: 3, title: "Unread client message", detail: "Hello", conversationId: "chat 1", destination: "messages" }))
      .toBe("/messages/chat%201?scope=incoming&focus=conversation");
  });
  it("isolates a booking even when its status is outside the Scheduled tab", () => {
    expect(providerBookingPath("expired-1")).toBe("/worker/bookings?scope=incoming&filter=all&q=expired-1&focus=expired-1");
    expect(providerActionPath({ id: "alert", priority: 5, title: "Active booking update", detail: "Reservation Expired", bookingId: "expired-1", destination: "bookings" }))
      .toBe("/worker/bookings?scope=incoming&filter=all&q=expired-1&focus=expired-1");
  });

  it("opens the correct payment review section and keeps the booking reference", () => {
    expect(providerActionPath({ id: "refund", priority: 1, title: "Review refund request", detail: "Client", bookingId: "booking 2", destination: "work", workSection: "refunds" }))
      .toBe("/work?section=refunds&booking=booking+2");
  });
});
