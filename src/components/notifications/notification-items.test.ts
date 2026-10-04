import { describe, expect, it } from "vitest";

import type { Database } from "@/integrations/supabase";
import { bookingNotification, caseNotification, messageNotification } from "./notification-items";

type Booking = Database["public"]["Tables"]["bookings"]["Row"];
type Conversation = Database["public"]["Tables"]["conversations"]["Row"];
type Message = Database["public"]["Tables"]["messages"]["Row"];
type CaseNotice = Database["public"]["Tables"]["booking_case_notifications"]["Row"];
type CaseMessage = Database["public"]["Tables"]["booking_case_messages"]["Row"];

describe("notification destinations", () => {
  it("filters booking notifications to the exact booking in the correct workspace", () => {
    const booking = { id: "booking-123", buyer_id: "client-1", seller_id: "provider-1",
      status: "confirmed", updated_at: "2026-10-04T01:00:00Z" } as Booking;
    expect(bookingNotification(booking, "client-1", new Set()).href)
      .toBe("/bookings?scope=purchases&q=booking-123");
    expect(bookingNotification(booking, "provider-1", new Set()).href)
      .toBe("/worker/bookings?scope=incoming&q=booking-123");
  });

  it("opens the message's actual conversation instead of a general inbox", () => {
    const conversation = { id: "conversation-1", booking_id: "booking-123",
      buyer_id: "client-1", seller_id: "provider-1" } as Conversation;
    const message = { id: "message-1", conversation_id: "conversation-1", body: "Hello",
      read_by: null, created_at: "2026-10-04T01:00:00Z" } as Message;
    expect(messageNotification(message, conversation, "client-1", new Set()).href)
      .toBe("/messages/booking-123?scope=purchases");
    expect(messageNotification(message, conversation, "provider-1", new Set()).href)
      .toBe("/messages/booking-123?scope=incoming");
  });

  it("opens the exact case conversation and uses server-owned read status", () => {
    const notice = { id: "notice-1", case_id: "case-123", message_id: "case-message-1",
      recipient_id: "client-1", read_at: null, created_at: "2026-10-04T01:00:00Z" } as CaseNotice;
    const message = { id: "case-message-1", author_role: "admin", body: "Support is reviewing your report." } as CaseMessage;
    const result = caseNotification(notice, message);
    expect(result.href).toBe("/support-cases?case=case-123#case-conversation");
    expect(result.caseId).toBe("case-123");
    expect(result.isRead).toBe(false);
    expect(caseNotification({ ...notice, read_at: "2026-10-04T02:00:00Z" }, message).isRead).toBe(true);
  });
});
