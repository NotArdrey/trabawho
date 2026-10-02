import type { Database, Json } from "@/integrations/supabase/database.types";
import type { NewServiceDraft } from "../components/CreateServiceModal";
import type { ServiceProfileDraft, ServiceProfileUpdate } from "../components/ProfileEditModal";

export type ServiceRow = Database["public"]["Tables"]["services"]["Row"];

export function serviceMetadata(value: Json | undefined): Record<string, Json | undefined> {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

export function serviceProfileToDraft(profile?: ServiceProfileDraft | null): NewServiceDraft {
  const row = profile?.raw;
  const metadata = serviceMetadata(row?.metadata);
  const rateBasis = (typeof metadata.rate_basis === "string" ? metadata.rate_basis : "") || profile?.rateBasis || ({ hourly: "per-hour", daily: "per-day", weekly: "per-week", monthly: "per-month" } as Record<string, string>)[profile?.pricingModel || ""] || "per-project";
  const isQuote = metadata.pricing_model === "inquiry" || row?.price_type === "custom" || profile?.pricingModel === "inquiry";
  const priceType = isQuote ? "inquiry" : row?.price_type || profile?.priceType || (profile?.pricingModel === "package" ? "package" : "fixed");
  const rates: Record<string, number | null | undefined> = { "per-hour": profile?.hourlyRate, "per-day": profile?.dailyRate, "per-week": profile?.weeklyRate, "per-month": profile?.monthlyRate };
  const description = row?.description ?? profile?.description ?? "";
  return {
    title: row?.title ?? profile?.serviceType ?? "",
    shortDescription: row?.short_description ?? profile?.shortDescription ?? description.slice(0, 160),
    description,
    basePrice: row?.base_price ?? profile?.basePrice ?? rates[rateBasis] ?? profile?.fixedPrice ?? "",
    priceType,
    rateBasis,
    durationMinutes: row?.duration_minutes ?? profile?.durationMinutes ?? "",
    bookingMode: isQuote ? "calendar-only" : (typeof metadata.booking_mode === "string" ? metadata.booking_mode : "") || profile?.bookingMode || "with-slots",
  };
}

export function serviceDraftToProfileUpdate(draft: NewServiceDraft): ServiceProfileUpdate {
  const quote = draft.priceType === "inquiry" || draft.priceType === "custom";
  const rate = quote ? null : Number(draft.basePrice);
  const rateModels: Record<string, ServiceProfileUpdate["pricingModel"]> = { "per-hour": "hourly", "per-day": "daily", "per-week": "weekly", "per-month": "monthly" };
  const pricingModel = quote ? "inquiry" : draft.priceType === "package" ? "package" : rateModels[draft.rateBasis] || "fixed";
  return {
    serviceType: draft.title.trim(), description: draft.description.trim() || draft.shortDescription.trim(),
    shortDescription: draft.shortDescription.trim(), durationMinutes: draft.durationMinutes,
    bookingMode: quote ? "calendar-only" : draft.bookingMode,
    priceType: draft.priceType, rateBasis: draft.rateBasis, basePrice: quote ? "" : Number(draft.basePrice), pricingModel,
    fixedPrice: pricingModel === "fixed" || pricingModel === "package" ? rate : null,
    hourlyRate: pricingModel === "hourly" ? rate : null, dailyRate: pricingModel === "daily" ? rate : null,
    weeklyRate: pricingModel === "weekly" ? rate : null, monthlyRate: pricingModel === "monthly" ? rate : null,
  };
}

export function buildServiceUpdate(profile: ServiceProfileUpdate, metadata: Json | undefined): Database["public"]["Tables"]["services"]["Update"] {
  const quote = profile.priceType === "inquiry" || profile.priceType === "custom";
  const price = Number(profile.basePrice);
  if (!profile.serviceType?.trim() || !profile.shortDescription?.trim() || (!quote && (!Number.isFinite(price) || price < 0))) throw new Error("Check service details and pricing.");
  const duration = profile.durationMinutes === "" || profile.durationMinutes === undefined ? null : Number(profile.durationMinutes);
  if (duration !== null && (!Number.isInteger(duration) || duration <= 0)) throw new Error("Enter a duration in whole minutes greater than zero.");
  return {
    title: profile.serviceType.trim(), short_description: profile.shortDescription.trim(), description: profile.description || profile.shortDescription.trim(),
    base_price: quote ? null : price,
    price_type: quote ? "custom" : profile.priceType === "package" ? "package" : profile.priceType === "hourly" ? "hourly" : "fixed",
    duration_minutes: duration,
    metadata: { ...serviceMetadata(metadata), rate_basis: profile.rateBasis || "per-project", booking_mode: quote ? "calendar-only" : profile.bookingMode || "with-slots", pricing_model: quote ? "inquiry" : "fixed" },
  };
}
