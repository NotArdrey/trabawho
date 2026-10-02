import { describe, expect, it } from "vitest";
import { getActiveAdBooster } from "./serviceBoost";

const now = Date.parse("2026-10-02T00:00:00Z");
const boost = { active: true, payment_verified: true, budget_php: 250,
  starts_at: "2026-10-01T00:00:00Z", ends_at: "2026-10-08T00:00:00Z", payment: { provider: "paymongo", status: "paid" } };
describe("paid service boosts", () => {
  it("recognizes verified paid campaigns only during their purchased window", () => {
    const service = { metadata: { ad_booster: boost } };
    expect(getActiveAdBooster(service, now).isBoosted).toBe(true);
    expect(getActiveAdBooster(service, Date.parse(boost.ends_at)).isBoosted).toBe(false);
    expect(getActiveAdBooster(service, Date.parse(boost.starts_at) - 1).isBoosted).toBe(false);
  });
  it.each([{ ...boost, payment_verified: false }, { ...boost, ends_at: null }, { ...boost, budget_php: 0 },
    { ...boost, payment: { provider: "demo", status: "demo-activated" } }])("rejects unfunded or unbounded metadata %j", (invalid) => {
    expect(getActiveAdBooster({ metadata: { ad_booster: invalid } }, now).isBoosted).toBe(false);
  });
});
