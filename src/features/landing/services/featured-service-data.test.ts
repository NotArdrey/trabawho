import { beforeEach, describe, expect, it, vi } from "vitest";

import { fetchLandingServiceRows } from "./featured-service-data";

const { from, serviceResult, ratingResult } = vi.hoisted(() => ({
  from: vi.fn(), serviceResult: vi.fn(), ratingResult: vi.fn(),
}));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from } }));

beforeEach(() => {
  vi.clearAllMocks();
  const serviceQuery = {
    select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(), limit: serviceResult,
  };
  const ratingQuery = { select: vi.fn().mockReturnThis(), in: ratingResult };
  from.mockImplementation((table: string) => table === "services" ? serviceQuery : ratingQuery);
});

describe("public landing fetch", () => {
  it("joins each seller's aggregate to its own service", async () => {
    serviceResult.mockResolvedValue({ data: [
      { id: 102, title: "Chemical Making", seller_id: "jose", sellers: { display_name: "Jose" } },
      { id: 95, title: "Apartment Cleaning & Organization", seller_id: "maria", sellers: { display_name: "Maria" } },
    ], error: null });
    ratingResult.mockResolvedValue({ data: [
      { seller_id: "maria", avg_rating: 4.9, rating_count: 5 },
      { seller_id: "jose", avg_rating: 4.67, rating_count: 3 },
    ], error: null });
    const rows = await fetchLandingServiceRows();
    expect(rows).toEqual([
      expect.objectContaining({ id: 102, rating: 4.67, reviews_count: 3 }),
      expect.objectContaining({ id: 95, rating: 4.9, reviews_count: 5 }),
    ]);
    expect(serviceResult).toHaveBeenCalledWith(4);
    expect(ratingResult).toHaveBeenCalledWith("seller_id", ["jose", "maria"]);
  });

  it("keeps services visible when the optional rating query fails", async () => {
    serviceResult.mockResolvedValue({ data: [{ id: 1, seller_id: "jose", title: "Repair" }], error: null });
    ratingResult.mockResolvedValue({ data: null, error: { code: "42501" } });
    expect(await fetchLandingServiceRows()).toEqual([
      expect.objectContaining({ title: "Repair", rating: null, reviews_count: 0 }),
    ]);
  });

  it("reports a listing query failure instead of treating it as an empty database", async () => {
    serviceResult.mockResolvedValue({ data: null, error: { message: "Internal database details" } });
    await expect(fetchLandingServiceRows()).rejects.toThrow("Service listings could not be loaded.");
    expect(ratingResult).not.toHaveBeenCalled();
  });
});
