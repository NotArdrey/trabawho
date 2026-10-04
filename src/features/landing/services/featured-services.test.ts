import { beforeEach, describe, expect, it, vi } from "vitest";

import { fetchFeaturedServices } from "./featured-services";

const { fetchServices } = vi.hoisted(() => ({ fetchServices: vi.fn() }));
vi.mock("./featured-service-data", () => ({ fetchLandingServiceRows: fetchServices }));

beforeEach(() => fetchServices.mockReset());

describe("landing listing facts", () => {
  it("separates service photos, provider ratings, and booking capability", async () => {
    fetchServices.mockResolvedValue([{
      id: 1, title: "Chemical Making", base_price: 23123,
      metadata: { service_type: "Others", custom_service_type: "Manufacturing",
        rate_basis: "per-project", booking_mode: "with-slots", gallery: ["/work.jpg"] },
      rating: 4.7, reviews_count: 3,
      sellers: { display_name: "Jose Ramos", profile_photo: "/portrait.jpg", is_verified: true },
    }]);
    expect(await fetchFeaturedServices()).toEqual([expect.objectContaining({
      title: "Chemical Making", serviceType: "Chemical Making", providerName: "Jose Ramos",
      photoUrl: "/work.jpg", providerPhotoUrl: "/portrait.jpg", priceLabel: "\u20b123,123/project",
      rating: 4.7, reviewCount: 3, availabilityLabel: "Check booking times", isVerified: true,
    })]);
  });

  it("does not turn normalization defaults into listing facts", async () => {
    fetchServices.mockResolvedValue([{ id: 2, title: "Cleaning", base_price: 900,
      rating: 4.9, sellers: { profile_photo: "/default-profile.svg" } }]);
    expect(await fetchFeaturedServices()).toEqual([expect.objectContaining({
      title: "Cleaning", providerName: "Service provider", serviceType: "Cleaning",
      photoUrl: undefined, providerPhotoUrl: undefined, rating: undefined,
      availabilityLabel: undefined, priceLabel: "\u20b1900", isVerified: false,
    })]);
  });

  it("uses the current gig title instead of stale listing or provider labels", async () => {
    fetchServices.mockResolvedValue([{ id: 4, title: "Appliance Repair",
      metadata: { service_type: "Old gig title" },
      sellers: { display_name: "Jose", search_meta: { service_type: "Unrelated profile label" } } }]);
    expect((await fetchFeaturedServices())[0]).toMatchObject({
      title: "Appliance Repair", serviceType: "Appliance Repair", providerName: "Jose",
    });
  });

  it("uses inquiry pricing and scheduling instead of a fixed quote or availability promise", async () => {
    fetchServices.mockResolvedValue([{ id: 3, base_price: 400,
      metadata: { pricing_model: "inquiry", booking_mode: "with-slots" } }]);
    expect((await fetchFeaturedServices())[0]).toMatchObject({
      priceLabel: "Price on request", availabilityLabel: "Schedule by request",
    });
  });
});
