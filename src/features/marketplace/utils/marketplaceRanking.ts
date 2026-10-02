import { getActiveAdBooster } from "@/shared/utils/serviceBoost";

interface RankableService {
  rawService?: { metadata?: unknown; created_at?: string | null };
  rating?: number | null;
  reviews?: number;
  hourlyRate?: number | null;
  dailyRate?: number | null;
  weeklyRate?: number | null;
  monthlyRate?: number | null;
  projectRate?: number | null;
  pricingType?: string;
}

export function compareMarketplaceServices(a: RankableService, b: RankableService, mode: string, now = Date.now()) {
  const quote = (item: RankableService) => item.pricingType === "inquiry" ? null
    : [item.hourlyRate, item.dailyRate, item.weeklyRate, item.monthlyRate, item.projectRate].find((rate) => typeof rate === "number" && Number.isFinite(rate) && rate > 0) ?? null;
  if (mode === "price-low") {
    const first = quote(a);
    const second = quote(b);
    if (first === null || second === null) return first === second ? 0 : first === null ? 1 : -1;
    return first - second;
  }
  if (mode === "rating") return (b.rating || 0) - (a.rating || 0);
  if (mode === "newest") return Date.parse(b.rawService?.created_at || "1970-01-01") - Date.parse(a.rawService?.created_at || "1970-01-01");
  const first = getActiveAdBooster(a.rawService, now);
  const second = getActiveAdBooster(b.rawService, now);
  if (first.isBoosted !== second.isBoosted) return first.isBoosted ? -1 : 1;
  if (first.isBoosted && second.isBoosted) {
    const budget = second.boostBudget - first.boostBudget;
    if (budget) return budget;
    const starts = Date.parse(String(second.adBooster?.starts_at)) - Date.parse(String(first.adBooster?.starts_at));
    if (starts) return starts;
  }
  return (b.reviews || 0) - (a.reviews || 0);
}
