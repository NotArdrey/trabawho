import { beforeEach, describe, expect, it, vi } from "vitest";

import { fetchLandingServiceRows } from "./featured-service-data";

const { from, serviceResult, sellerResult, ratingResult } = vi.hoisted(() => ({
  from: vi.fn(), serviceResult: vi.fn(), sellerResult: vi.fn(), ratingResult: vi.fn(),
}));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from } }));

beforeEach(() => {
  vi.clearAllMocks();
  const serviceQuery = {
    select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(), range: serviceResult,
  };
  const ratingQuery = { select: vi.fn().mockReturnThis(), in: ratingResult };
  const sellerQuery = { select: vi.fn().mockReturnThis(), in: sellerResult };
  from.mockImplementation((table: string) => table === "services" ? serviceQuery
    : table === "sellers" ? sellerQuery : ratingQuery);
  sellerResult.mockResolvedValue({ data: [], error: null });
  ratingResult.mockResolvedValue({ data: [], error: null });
});

describe("public landing fetch", () => {
  it("joins each seller's aggregate to its own service", async () => {
    serviceResult.mockResolvedValue({ data: [
      { id: 102, title: "Chemical Making", seller_id: "jose" },
      { id: 95, title: "Apartment Cleaning & Organization", seller_id: "maria" },
    ], error: null });
    sellerResult.mockResolvedValue({ data: [
      { user_id: "jose", display_name: "Jose", profile_photo: "/jose.jpg", is_verified: true },
      { user_id: "maria", display_name: "Maria", profile_photo: "/maria.jpg", is_verified: true },
    ], error: null });
    ratingResult.mockResolvedValue({ data: [
      { seller_id: "maria", avg_rating: 4.9, rating_count: 5 },
      { seller_id: "jose", avg_rating: 4.67, rating_count: 3 },
    ], error: null });
    const rows = await fetchLandingServiceRows();
    expect(rows.map((row) => row.id)).toEqual([102, 95]);
    expect(rows[0]).toMatchObject({ rating: 4.67, reviews_count: 3,
      sellers: { profile_photo: "/jose.jpg", is_verified: true } });
    expect(rows[1]).toMatchObject({ rating: 4.9, reviews_count: 5,
      sellers: { profile_photo: "/maria.jpg", is_verified: true } });
    expect(ratingResult).toHaveBeenCalledWith("seller_id", ["jose", "maria"]);
  });

  it("shows only the newest service for each provider account", async () => {
    serviceResult.mockResolvedValue({ data: [
      { id: 12, seller_id: "jose", title: "New gig" },
      { id: 11, seller_id: "jose", title: "Older gig" },
      { id: 10, seller_id: "maria", title: "Cleaning" },
    ], error: null });
    const rows = await fetchLandingServiceRows();
    expect(rows.map((row) => row.id)).toEqual([12, 10]);
    expect(sellerResult).toHaveBeenCalledWith("user_id", ["jose", "maria"]);
  });

  it("continues past a full page of gigs from one provider", async () => {
    serviceResult
      .mockResolvedValueOnce({ data: Array.from({ length: 100 }, (_, index) => ({
        id: 200 - index, seller_id: "jose", title: `Gig ${index}`,
      })), error: null })
      .mockResolvedValueOnce({ data: [{ id: 100, seller_id: "maria", title: "Cleaning" }], error: null });
    const rows = await fetchLandingServiceRows();
    expect(rows.map((row) => row.id)).toEqual([200, 100]);
    expect(serviceResult).toHaveBeenCalledTimes(2);
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
    expect(sellerResult).not.toHaveBeenCalled();
  });

  it("does not request details when no provider has a visible active service", async () => {
    serviceResult.mockResolvedValue({ data: [], error: null });
    expect(await fetchLandingServiceRows()).toEqual([]);
    expect(sellerResult).not.toHaveBeenCalled();
  });

  it("reports a public provider query failure", async () => {
    serviceResult.mockResolvedValue({ data: [{ id: 1, seller_id: "jose", title: "Repair" }], error: null });
    sellerResult.mockResolvedValue({ data: null, error: { message: "unavailable" } });
    await expect(fetchLandingServiceRows()).rejects.toThrow("Provider details could not be loaded.");
  });
});
