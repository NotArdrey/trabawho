import { describe, expect, it } from "vitest";
import { authIdentityFallback } from "./authIdentityFallback";
import { isAccountBlockedForLogin } from "@/shared/services/authService";
const loginBlock = isAccountBlockedForLogin as unknown as (profile: Record<string, unknown>) => string;
describe("profile-load fallback authorization", () => {
  it("blocks identity access when the profile cannot be loaded, even for confirmed email", () => {
    const profile = authIdentityFallback({ app_metadata: { verification_status: "APPROVED" }, email_confirmed_at: "2026-10-02" });
    expect(loginBlock(profile)).not.toBe(""); expect(profile.isAdmin).toBe(false);
  });
  it("keeps a server pending review blocked and defaults unknown authorization to pending", () => {
    expect(loginBlock(authIdentityFallback({ app_metadata: { verification_status: "PENDING_REVIEW" } }))).toMatch(/pending/i);
    expect(loginBlock(authIdentityFallback(null))).not.toBe("");
  });
});
