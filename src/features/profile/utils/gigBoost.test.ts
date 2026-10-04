import { afterEach, describe, expect, it, vi } from "vitest";
import { buildBoostDraft, calculateBoostTotal, parseBoostDailyRate } from "./gigBoost";

describe("gig boost settings", () => {
  afterEach(() => vi.unstubAllEnvs());
  it("adjusts the total with duration at the default daily rate", () => {
    vi.stubEnv("VITE_AD_BOOST_DAILY_RATE_PHP", "");
    expect(buildBoostDraft("12", "Cleaning", "3").amount).toBe(150);
    expect(buildBoostDraft("12", "Cleaning", "7").amount).toBe(350);
    expect(buildBoostDraft("12", "Cleaning", "14").amount).toBe(700);
  });
  it("uses a configured daily rate and exact centavos", () => {
    vi.stubEnv("VITE_AD_BOOST_DAILY_RATE_PHP", "50.25");
    expect(buildBoostDraft("12", "Cleaning", "7").amount).toBe(351.75);
    expect(calculateBoostTotal(3, 1.1)).toBe(3.3);
  });
  it.each(["0", "1", "7.5", "10", "31", "366", "1e2", "", "-1"])("rejects invalid duration %s", (days) => {
    expect(() => buildBoostDraft("12", "Cleaning", days)).toThrow();
  });
  it.each(["0", "-50", "NaN", "Infinity", "50.001", "1e2", "27397.27"])("rejects invalid configured pricing %s", (rate) => {
    expect(() => parseBoostDailyRate(rate)).toThrow(/pricing is unavailable/);
  });
  it("keeps the largest allowed total within the checkout limit", () => {
    expect(calculateBoostTotal(365, parseBoostDailyRate("27397.26"))).toBe(9999999.9);
  });
});
