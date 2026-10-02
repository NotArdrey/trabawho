import { activityTrend, analyticsWindow } from "./adminAnalytics";

describe("admin analytics periods", () => {
  const now = new Date("2026-10-03T18:30:00Z");
  it("uses Philippine midnight across UTC day boundaries", () => {
    expect(analyticsWindow(7, now)).toEqual({ start: "2026-09-27T16:00:00.000Z", end: now.toISOString() });
  });
  it("groups registrations and reviews by Philippine date and excludes future records", () => {
    const trend = activityTrend(7, [{ created_at: "2026-10-03T16:05:00Z" }, { created_at: "2026-10-03T19:00:00Z" }], [{ created_at: "2026-10-03T15:59:00Z" }], now);
    expect(trend.at(-1)).toEqual({ date: "2026-10-04", accounts: 1, reviews: 0 });
    expect(trend.at(-2)).toEqual({ date: "2026-10-03", accounts: 0, reviews: 1 });
    expect(trend).toHaveLength(7);
  });
});
