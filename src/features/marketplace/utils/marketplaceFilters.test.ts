import { describe, expect, it } from "vitest";
import { normalizeServiceRecord } from "./serviceNormalizer";
import { getMarketplaceCategory, matchesMarketplaceService } from "./marketplaceFilters";

const service = normalizeServiceRecord({ title: "Leaking pipe repair", metadata: { service_type: "Technician" }, sellers: { display_name: "Ana Santos", city: "Malolos", province: "Bulacan" } });
describe("marketplace filter meaning", () => {
  it("uses the saved category rather than the gig title", () => {
    expect(getMarketplaceCategory(service)).toBe("Technician");
    expect(getMarketplaceCategory(normalizeServiceRecord({ title: "A gig without a category" }))).toBe("Other services");
    expect(getMarketplaceCategory(normalizeServiceRecord({ metadata: { service_type: "Others", custom_service_type: "Gardener" } }))).toBe("Gardener");
  });
  it("combines words, category, and location independently", () => {
    const filters = { search: "  Santos pipe  ", category: "Technician", location: "bulacan", district: "All Districts" };
    expect(matchesMarketplaceService(service, filters)).toBe(true);
    expect(matchesMarketplaceService(service, { ...filters, location: "Manila" })).toBe(false);
    expect(matchesMarketplaceService(service, { ...filters, category: "Cleaner" })).toBe(false);
    expect(matchesMarketplaceService(service, { ...filters, district: "Manila" })).toBe(false);
  });
});
