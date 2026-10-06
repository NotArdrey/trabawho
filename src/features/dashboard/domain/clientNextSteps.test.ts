import { describe, expect, it } from "vitest";

import { buildClientBookingActions, getClientCaseProgress, type DashboardCase } from "./clientNextSteps";

const caseRecord = (overrides: Partial<DashboardCase> = {}): DashboardCase => ({
  id: "case-1", bookingId: "booking-1", service: "Home cleaning", status: "under_review",
  resolution: "reviewing", unreadCount: 0, updatedAt: "2026-10-06T10:00:00Z", ...overrides,
});

describe("client next steps", () => {
  it("shows genuine booking tasks first with exact booking links", () => {
    const actions = buildClientBookingActions([
      { id: "visit", serviceType: "Garden work", workerName: "Nina", status: "Payment Confirmed" },
      { id: "pay", serviceType: "Cleaning", workerName: "Mia", status: "Payment Pending", paymentStatus: "unpaid" },
      { id: "confirm", serviceType: "Painting", workerName: "Leo", status: "Service Delivered", deliveryStatus: "seller_claimed" },
      { id: "new-time", serviceType: "Repairs", status: "Reservation Expired" },
    ]);
    expect(actions.map((action) => action.title)).toEqual(["Review completed work", "Complete booking payment", "Choose a visit time"]);
    expect(actions[0].href).toBe("/bookings?scope=purchases&filter=all&q=confirm&focus=confirm");
  });

  it("does not ask the client to act on provider verification or refunded work", () => {
    expect(buildClientBookingActions([
      { id: "verification", status: "Payment Pending", paymentStatus: "pending_provider" },
      { id: "refund", status: "Completed Service", canRate: true, refundSimulated: true },
      { id: "past", status: "Cancelled", deliveryStatus: "seller_claimed" },
    ])).toEqual([]);
  });

  it("includes cash confirmation and an available rating", () => {
    expect(buildClientBookingActions([
      { id: "cash", status: "Active Service", cashCollectionStatus: "seller_claimed" },
      { id: "rating", status: "Completed Service", canRate: true },
    ]).map((action) => action.title)).toEqual(["Confirm cash payment", "Rate completed service"]);
  });

  it("prioritizes a requested client reply and links to the case conversation", () => {
    const progress = getClientCaseProgress([
      caseRecord({ id: "newer", unreadCount: 2, updatedAt: "2026-10-07T10:00:00Z" }),
      caseRecord({ id: "reply", resolution: "awaiting_client" }),
    ]);
    expect(progress).toMatchObject({ id: "reply", title: "Reply to support", attention: "reply", href: "/support-cases?case=reply#case-conversation" });
  });

  it("keeps passive open-case progress useful but omits confirmed replacement and closed cases", () => {
    expect(getClientCaseProgress([caseRecord({ resolution: "refund_pending" })])?.title).toBe("Refund review in progress");
    expect(getClientCaseProgress([caseRecord({ resolution: "replacement_accepted" }), caseRecord({ status: "closed" })])).toBeNull();
  });
});
