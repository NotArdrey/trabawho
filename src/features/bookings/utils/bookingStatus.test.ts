import { describe, expect, it } from "vitest";
import { uiStatusFromDb } from "./bookingStatus";

describe("booking status", () => {
  it("keeps a cancelled visit cancelled during and after test refund review", () => {
    expect(uiStatusFromDb({ status: "cancelled", payment_status: "refund_pending", dispute_status: "open" })).toBe("Cancelled");
    expect(uiStatusFromDb({ status: "cancelled", payment_status: "refunded", dispute_status: "closed" },
      { ui_status: "Refund Simulated" })).toBe("Cancelled");
  });
});
