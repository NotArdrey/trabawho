import { getProviderQuoteAmount, normalizeServiceRecord } from "@/features/marketplace";
import { fetchAllActiveServices } from "@/shared/services/authService";

import type { LandingFeaturedService } from "../types";

type UnknownRecord = Record<string, unknown>;

const asRecord = (value: unknown): UnknownRecord =>
  value !== null && typeof value === "object" ? (value as UnknownRecord) : {};

const asText = (value: unknown): string | undefined =>
  typeof value === "string" && value.trim() ? value.trim() : undefined;

const asFiniteNumber = (value: unknown): number | undefined => {
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
};

const rateSuffixes: Record<string, string> = {
  "per-hour": "hour",
  "per-day": "day",
  "per-week": "week",
  "per-month": "month",
  "per-project": "project",
};

function getPriceLabel(provider: UnknownRecord): string | undefined {
  if (provider.pricingType === "inquiry") return "Price on request";

  const amount = asFiniteNumber(getProviderQuoteAmount(provider));
  if (!amount || amount <= 0) return undefined;

  const suffix = rateSuffixes[String(provider.rateBasis)] || "service";
  return `From \u20b1${amount.toLocaleString("en-PH")}/${suffix}`;
}

function toFeaturedService(row: unknown): LandingFeaturedService {
  const provider = asRecord(normalizeServiceRecord(asRecord(row)));
  const rawService = asRecord(provider.rawService);
  const seller = asRecord(rawService.sellers ?? rawService.seller);
  const rating = asFiniteNumber(provider.rating);
  const reviewCount = asFiniteNumber(provider.reviews);
  const bookingMode = asText(provider.bookingMode);
  const serviceType = asText(provider.serviceType) || "Local service";

  return {
    id: String(provider.id),
    title: asText(provider.title) || serviceType,
    providerName: asText(provider.name) || "Service provider",
    serviceType,
    location: asText(provider.location),
    photoUrl: asText(provider.photo),
    rating: rating && rating > 0 ? rating : undefined,
    reviewCount: reviewCount && reviewCount > 0 ? reviewCount : undefined,
    priceLabel: getPriceLabel(provider),
    isVerified: seller.is_verified === true,
    availabilityLabel:
      bookingMode === "with-slots" ? "Schedule available" : "Request a schedule",
  };
}

export async function fetchFeaturedServices(): Promise<LandingFeaturedService[]> {
  const rows: unknown = await fetchAllActiveServices(8);
  if (!Array.isArray(rows)) return [];

  return rows.slice(0, 4).map(toFeaturedService);
}
