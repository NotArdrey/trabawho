import { getProviderQuoteAmount, normalizeServiceRecord } from "@/features/marketplace";
import { hasUploadedProfilePhoto } from "@/shared/utils/profilePhoto";

import { fetchLandingServiceRows } from "./featured-service-data";

import type { LandingFeaturedService } from "../types";

type UnknownRecord = Record<string, unknown>;

const asRecord = (value: unknown): UnknownRecord =>
  value !== null && typeof value === "object" ? (value as UnknownRecord) : {};

const asText = (value: unknown): string | undefined =>
  typeof value === "string" && value.trim() ? value.trim() : undefined;

const asFiniteNumber = (value: unknown): number | undefined => {
  if (value === null || value === undefined || value === "") return undefined;
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
};

const rateSuffixes: Record<string, string> = {
  "per-hour": "hour",
  "per-day": "day",
  "per-week": "week",
  "per-month": "month",
  "per-project": "project",
  hourly: "hour",
  daily: "day",
  weekly: "week",
  monthly: "month",
  project: "project",
  package: "project",
  fixed: "project",
};

function getPriceLabel(provider: UnknownRecord): string | undefined {
  if (provider.pricingType === "inquiry") return "Price on request";

  const amount = asFiniteNumber(getProviderQuoteAmount(provider));
  if (!amount || amount <= 0) return undefined;

  const rawService = asRecord(provider.rawService);
  const metadata = asRecord(rawService.metadata);
  const basis = asText(rawService.rate_basis) || asText(metadata.rate_basis)
    || asText(metadata.rateBasis) || asText(metadata.billing_unit)
    || asText(rawService.price_type) || asText(rawService.priceType);
  const suffix = basis ? rateSuffixes[basis.toLowerCase().replace(/_/g, "-")] : undefined;
  return `\u20b1${amount.toLocaleString("en-PH", { maximumFractionDigits: 2 })}${suffix ? `/${suffix}` : ""}`;
}

function toFeaturedService(row: unknown): LandingFeaturedService {
  const provider = asRecord(normalizeServiceRecord(asRecord(row)));
  const rawService = asRecord(provider.rawService);
  const seller = asRecord(rawService.sellers ?? rawService.seller);
  const metadata = asRecord(rawService.metadata);
  const sellerMetadata = asRecord(seller.search_meta);
  const rating = asFiniteNumber(provider.rating);
  const reviewCount = asFiniteNumber(provider.reviews);
  // service_type is a legacy gig title, not a category. The current gig owns its label.
  const serviceType = asText(rawService.title) || asText(metadata.service_type)
    || asText(metadata.serviceType) || "Local service";
  const gallery = Array.isArray(provider.gallery) ? provider.gallery : [];
  const providerPhoto = asText(provider.photo);
  const bookingMode = asText(metadata.booking_mode) || asText(seller.booking_mode)
    || asText(sellerMetadata.booking_mode);

  return {
    id: String(provider.id),
    title: asText(rawService.title) || serviceType,
    providerName: asText(seller.display_name) || asText(sellerMetadata.name) || "Service provider",
    serviceType,
    location: asText(provider.location),
    photoUrl: gallery.map(asText).find((photo) => photo !== undefined),
    providerPhotoUrl: hasUploadedProfilePhoto(providerPhoto) ? providerPhoto : undefined,
    rating: rating && rating > 0 && rating <= 5 && reviewCount && reviewCount > 0 ? rating : undefined,
    reviewCount: reviewCount && reviewCount > 0 ? reviewCount : undefined,
    priceLabel: getPriceLabel(provider),
    isVerified: seller.is_verified === true,
    availabilityLabel:
      provider.pricingType === "inquiry" || bookingMode === "calendar-only"
        ? "Schedule by request"
        : bookingMode === "with-slots" ? "Check booking times" : undefined,
  };
}

export async function fetchFeaturedServices(): Promise<LandingFeaturedService[]> {
  const rows: unknown = await fetchLandingServiceRows();
  if (!Array.isArray(rows)) return [];

  return rows.slice(0, 4).map(toFeaturedService);
}
