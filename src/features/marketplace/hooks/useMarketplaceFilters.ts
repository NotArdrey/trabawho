import { useMemo } from "react";
import { getActiveAdBooster } from "@/shared/utils/serviceBoost";
import { getMarketplaceCategory, matchesMarketplaceService, type MarketplaceService } from "../utils/marketplaceFilters";
import { compareMarketplaceServices } from "../utils/marketplaceRanking";

export function useMarketplaceFilters(services: MarketplaceService[], filters: { search: string; location: string; category: string; district: string; sort: string }, now: number) {
  const categoryFilters = useMemo(() => {
    const counts = new Map<string, number>();
    for (const service of services) {
      const category = getMarketplaceCategory(service);
      counts.set(category, (counts.get(category) || 0) + 1);
    }
    return [{ label: "All", count: services.length }, ...[...counts].sort(([a], [b]) => a.localeCompare(b)).map(([label, count]) => ({ label, count }))];
  }, [services]);
  const districts = useMemo(() => ["All Districts", ...[...new Set(services.map((service) => service.location).filter(Boolean))].sort((a, b) => a.localeCompare(b))], [services]);
  const { search, location, category, district, sort } = filters;
  const filteredServices = useMemo(() => services
    .filter((service) => matchesMarketplaceService(service, { search, location, category, district }))
    .map((service) => ({ ...service, ...getActiveAdBooster(service.rawService, now) }))
    .sort((a, b) => compareMarketplaceServices(a, b, sort, now)), [services, search, location, category, district, sort, now]);
  return { categoryFilters, districts, filteredServices };
}
