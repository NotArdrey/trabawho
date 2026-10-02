import { getActiveAdBooster } from "@/shared/utils/serviceBoost";

interface RankableService {
  rawService?: { metadata?: unknown; created_at?: string | null };
  rating?: number;
  reviews?: number;
  hourlyRate?: number;
  dailyRate?: number;
  weeklyRate?: number;
  monthlyRate?: number;
  projectRate?: number;
}

export function compareMarketplaceServices(a: RankableService, b: RankableService, mode: string, now = Date.now()) {
  const quote = (item: RankableService) => item.hourlyRate || item.dailyRate || item.weeklyRate || item.monthlyRate || item.projectRate || 0;
  if (mode === "price-low") return quote(a) - quote(b);
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
