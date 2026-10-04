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
    expect(viewFromPathname("/support-cases")).toBe("support-cases");
    expect(viewFromPathname("/admin/support-cases/ef8283c5-8f25-4560-b76a-4b229f4e85a8")).toBe("admin-dashboard");
    expect(pathForView("support-cases")).toBe("/support-cases");
    expect(viewFromPathname("/messages/booking-1")).toBe("chat");
    expect(getMessageBookingId("/messages/booking-1")).toBe("booking-1");
  });

  it("applies role-specific protected route access", () => {
    expect(canAccessPath("/admin", "admin")).toBe(true);
    expect(canAccessPath("/admin", "client")).toBe(false);
    expect(canAccessPath("/admin/support-cases/ef8283c5-8f25-4560-b76a-4b229f4e85a8", "admin")).toBe(true);
    expect(canAccessPath("/admin/support-cases/ef8283c5-8f25-4560-b76a-4b229f4e85a8", "client")).toBe(false);
    expect(canAccessPath("/worker/dashboard", "worker")).toBe(true);
    expect(canAccessPath("/worker/dashboard", "client")).toBe(false);
    expect(canAccessPath("/worker/bookings", "worker")).toBe(true);
    expect(canAccessPath("/worker/bookings", "client")).toBe(false);
    expect(canAccessPath("/support-cases", "client")).toBe(true);
    expect(canAccessPath("/support-cases", "worker")).toBe(true);
    expect(homePathForRole("admin")).toBe("/admin");
    expect(homePathForRole("worker")).toBe("/worker/dashboard");
    expect(homePathForRole("client")).toBe("/dashboard");
  });

  it("keeps Client and Worker activities on separate accounts", () => {
    for (const path of ['/dashboard', '/bookings']) {
      expect(canAccessPath(path, 'worker')).toBe(false);
      expect(canAccessPath(path, 'client')).toBe(true);
    }
    for (const path of ['/worker/dashboard', '/worker/bookings', '/work', '/seller/onboarding']) {
      expect(canAccessPath(path, 'worker')).toBe(true);
      expect(canAccessPath(path, 'client')).toBe(false);
    }
    expect(canAccessPath('/admin', 'worker')).toBe(false);
  });

  it("accepts only known internal return paths", () => {
    expect(isKnownPath("/settings/account")).toBe(true);
    expect(isSafeReturnPath("/bookings?filter=pending")).toBe(true);
    expect(isSafeReturnPath("//malicious.example")).toBe(false);
    expect(isSafeReturnPath("https://malicious.example")).toBe(false);
    expect(isSafeReturnPath("/unknown")).toBe(false);
  });
});
