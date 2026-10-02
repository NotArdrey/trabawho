import { getDisplayServiceType, type normalizeServiceRecord } from "./serviceNormalizer";

export type MarketplaceService = ReturnType<typeof normalizeServiceRecord>;
const record = (value: unknown): Record<string, unknown> => value !== null && typeof value === "object" ? value as Record<string, unknown> : {};
const text = (value: unknown) => typeof value === "string" ? value.trim() : "";

export function getMarketplaceCategory(service: MarketplaceService): string {
  const metadata = record(service.rawService.metadata);
  const seller = record(service.rawService.sellers || service.rawService.seller);
  const category = text(metadata.service_type || metadata.serviceType || record(seller.search_meta).service_type);
  if (!category) return "Other services";
  return category.toLowerCase() === "others"
    ? text(metadata.custom_service_type || metadata.customServiceType) || "Other services"
    : category;
}

export function matchesMarketplaceService(service: MarketplaceService, filters: { search: string; location: string; category: string; district: string }) {
  const haystack = [service.name, service.title, getDisplayServiceType(service), getMarketplaceCategory(service), service.description, service.location].join(" ").toLowerCase();
  return filters.search.trim().toLowerCase().split(/\s+/).every((word) => haystack.includes(word))
    && service.location.toLowerCase().includes(filters.location.trim().toLowerCase())
    && (filters.category === "All" || getMarketplaceCategory(service) === filters.category)
    && (filters.district === "All Districts" || service.location === filters.district);
}
