import { describe, expect, it } from "vitest";
import { compareMarketplaceServices } from "./marketplaceRanking";

const now = Date.parse("2026-10-02T00:00:00Z");
const ad = { projectRate: 800, rating: 3, reviews: 1, rawService: { created_at: "2026-01-01", metadata: { ad_booster: {
  active: true, payment_verified: true, budget_php: 250, starts_at: "2026-10-01", ends_at: "2026-10-08",
  payment: { provider: "paymongo", status: "paid" },
} } } };
const organic = { projectRate: 100, rating: 5, reviews: 10, rawService: { created_at: "2026-09-01" } };
describe("marketplace ad ranking", () => {
  it("prioritizes paid ads in recommendations", () => expect(compareMarketplaceServices(ad, organic, "recommended", now)).toBeLessThan(0));
  it.each(["price-low", "rating", "newest"])("respects explicit %s sorting", (mode) => expect(compareMarketplaceServices(ad, organic, mode, now)).toBeGreaterThan(0));
  it("stops prioritizing at expiry without a refresh", () => expect(compareMarketplaceServices(ad, organic, "recommended", Date.parse("2026-10-08"))).toBeGreaterThan(0));
  it("places custom and quote-only pricing after listed prices", () => {
    expect(compareMarketplaceServices({}, organic, "price-low")).toBeGreaterThan(0);
    expect(compareMarketplaceServices({ projectRate: 1, pricingType: "inquiry" }, organic, "price-low")).toBeGreaterThan(0);
    expect(compareMarketplaceServices({ projectRate: 0 }, organic, "price-low")).toBeGreaterThan(0);
  });
});
