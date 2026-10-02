import { buildServiceUpdate, serviceDraftToProfileUpdate, serviceProfileToDraft, type ServiceRow } from "./serviceDraft";

const listing: ServiceRow = { id: 7, seller_id: "worker-1", slug: "repair", created_at: "", updated_at: "", active: true, category_id: null, currency: "PHP", title: "Repair", short_description: "Repair summary", description: "Detailed repair", base_price: 750, price_type: "fixed", duration_minutes: 45,
  metadata: { rate_basis: "per-week", booking_mode: "calendar-only", ad_booster: { active: true }, availability_template: { Mon: [] } },
};

describe("service edit mapping", () => {
  it("loads the selected listing's details instead of stale profile defaults", () => {
    expect(serviceProfileToDraft({ raw: listing, serviceType: "Old", fixedPrice: 10 })).toMatchObject({
      title: "Repair", shortDescription: "Repair summary", description: "Detailed repair", basePrice: 750, rateBasis: "per-week", durationMinutes: 45,
    });
  });

  it.each(["per-project", "per-hour", "per-day", "per-week", "per-month"])("round trips %s without changing its rate", (rateBasis) => {
    const draft = serviceProfileToDraft({ raw: { ...listing, metadata: { ...listing.metadata as object, rate_basis: rateBasis } } });
    const update = buildServiceUpdate(serviceDraftToProfileUpdate(draft), listing.metadata);
    expect(update).toMatchObject({ base_price: 750, duration_minutes: 45, metadata: { rate_basis: rateBasis, ad_booster: { active: true }, availability_template: { Mon: [] } } });
  });

  it.each(["custom", "package"] as const)("preserves %s pricing", (priceType) => {
    const draft = serviceProfileToDraft({ raw: { ...listing, price_type: priceType } });
    expect(buildServiceUpdate(serviceDraftToProfileUpdate(draft), listing.metadata)).toMatchObject({
      price_type: priceType, base_price: priceType === "custom" ? null : 750,
    });
  });

  it("clears an optional duration and rejects malformed prices", () => {
    const draft = { ...serviceProfileToDraft({ raw: listing }), durationMinutes: "" };
    expect(buildServiceUpdate(serviceDraftToProfileUpdate(draft), listing.metadata).duration_minutes).toBeNull();
    expect(() => buildServiceUpdate({ ...serviceDraftToProfileUpdate(draft), basePrice: "NaN" }, listing.metadata)).toThrow();
  });
});
