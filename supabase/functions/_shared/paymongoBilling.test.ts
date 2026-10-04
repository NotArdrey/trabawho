import { describe, expect, it } from "vitest";
import { paymongoBilling } from "./paymongoBilling";

describe("PayMongo checkout billing prefill", () => {
  it("uses recorded payer details without inventing card data", () => {
    expect(paymongoBilling({ full_name: "  Test Customer  ", email: " test@example.com ", phone_number: "09171234567",
      address: "12 Main Street", barangay: "San Roque", city: "Balaoan", province: "La Union" }))
      .toEqual({ name: "Test Customer", email: "test@example.com", phone: "09171234567",
        address: { country: "PH", line1: "12 Main Street", line2: "San Roque", city: "Balaoan", state: "La Union" } });
  });

  it("omits missing or malformed details", () => {
    expect(paymongoBilling({ full_name: " ", email: "not-an-email", phone_number: null })).toBeUndefined();
    expect(paymongoBilling(null)).toBeUndefined();
  });
});
