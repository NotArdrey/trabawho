import { describe, expect, it } from "vitest";

import {
  canAccessPath,
  getMessageBookingId,
  homePathForRole,
  isKnownPath,
  isSafeReturnPath,
  pathForView,
  viewFromPathname,
} from "@/app/router/routes";

describe("application route policy", () => {
  it("maps legacy views to stable browser paths", () => {
    expect(pathForView("client-dashboard")).toBe("/dashboard");
    expect(viewFromPathname("/bookings")).toBe("my-bookings");
    expect(viewFromPathname("/worker/bookings")).toBe("worker-bookings");
    expect(viewFromPathname("/messages/booking-1")).toBe("chat");
    expect(getMessageBookingId("/messages/booking-1")).toBe("booking-1");
  });

  it("applies role-specific protected route access", () => {
    expect(canAccessPath("/admin", "admin")).toBe(true);
    expect(canAccessPath("/admin", "client")).toBe(false);
    expect(canAccessPath("/worker/dashboard", "worker")).toBe(true);
    expect(canAccessPath("/worker/dashboard", "client")).toBe(false);
    expect(canAccessPath("/worker/bookings", "worker")).toBe(true);
    expect(canAccessPath("/worker/bookings", "client")).toBe(false);
    expect(homePathForRole("admin")).toBe("/admin");
    expect(homePathForRole("worker")).toBe("/worker/dashboard");
    expect(homePathForRole("client")).toBe("/dashboard");
  });

  it("accepts only known internal return paths", () => {
    expect(isKnownPath("/settings/account")).toBe(true);
    expect(isSafeReturnPath("/bookings?filter=pending")).toBe(true);
    expect(isSafeReturnPath("//malicious.example")).toBe(false);
    expect(isSafeReturnPath("https://malicious.example")).toBe(false);
    expect(isSafeReturnPath("/unknown")).toBe(false);
  });
});
