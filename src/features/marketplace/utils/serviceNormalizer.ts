import { getActiveAdBooster } from "@/shared/utils/serviceBoost";
import { getProfilePhotoUrl } from "@/shared/utils/profilePhoto";
import { philippineDateKey } from "@/shared/domain/clientBookingDate";
export { getActiveAdBooster } from "@/shared/utils/serviceBoost";

type RecordValue = Record<string, unknown>;
const record = (value: unknown): RecordValue => value !== null && typeof value === "object" && !Array.isArray(value) ? value as RecordValue : {};
const text = (value: unknown) => typeof value === "string" ? value.trim() : "";
const number = (value: unknown) => value === null || value === undefined || value === "" || !Number.isFinite(Number(value)) ? null : Number(value);
const CORE_CATEGORIES = ["Tutor", "Technician", "Cleaner"];

export function normalizeRateBasis(value: unknown) {
  const raw = text(value).toLowerCase().replace(/_/g, "-");
  if (["per-hour", "hourly"].includes(raw)) return "per-hour";
  if (["per-day", "daily"].includes(raw)) return "per-day";
  if (["per-week", "weekly"].includes(raw)) return "per-week";
  if (["per-month", "monthly"].includes(raw)) return "per-month";
  if (["per-project", "project", "package", "fixed"].includes(raw)) return "per-project";
  return "";
}

export function getDisplayServiceType(value: unknown = {}) {
  const provider = record(value);
  const raw = text(provider.serviceType);
  return raw.toLowerCase() === "others" ? text(provider.customServiceType) || "General Service" : raw || "General Service";
}

export function getRateBasisFromService(value: unknown = {}) {
  const service = record(value);
  const meta = record(service.metadata);
  return normalizeRateBasis(service.rate_basis)
    || normalizeRateBasis(meta.rate_basis || meta.rateBasis || meta.billing_unit)
    || normalizeRateBasis(service.price_type || service.priceType)
    || (service.duration_minutes ? "per-project" : "per-hour");
}

export function getPricingModelFromService(value: unknown = {}) {
  const service = record(value);
  const meta = record(service.metadata);
  const model = text(meta.pricing_model || meta.pricingModel || service.pricing_model).toLowerCase();
  return model === "inquiry" ? "inquiry" : "fixed";
}

export function getBookingModeFromService(value: unknown = {}, sellerValue: unknown = {}) {
  const service = record(value);
  const seller = record(sellerValue);
  const mode = text(record(service.metadata).booking_mode || seller.booking_mode || record(seller.search_meta).booking_mode || "with-slots").toLowerCase();
  return mode === "calendar-only" ? "calendar-only" : "with-slots";
}

export function resolveProviderName(value: unknown = {}, sellerValue: unknown = {}, profileValue: unknown = {}) {
  const service = record(value);
  const seller = record(sellerValue);
  const profile = record(profileValue);
  const name = text(profile.fullName || profile.full_name);
  if (seller.user_id && profile.userId && seller.user_id === profile.userId && name) return name;
  return text(seller.display_name || record(seller.search_meta).name) || name || text(service.title) || "Service Provider";
}

export function resolveServiceTitle(value: unknown = {}, sellerValue: unknown = {}, profileValue: unknown = {}) {
  const service = record(value);
  const seller = record(sellerValue);
  const meta = record(service.metadata);
  const title = text(service.title);
  const type = text(meta.service_type || meta.serviceType || record(seller.search_meta).service_type);
  const providerName = resolveProviderName(service, seller, profileValue);
  if (!title || title.toLowerCase() === type.toLowerCase() || CORE_CATEGORIES.some((category) => category.toLowerCase() === title.toLowerCase())) return providerName;
  return title;
}

export function normalizeServiceRecord(value: unknown = {}, profileValue: unknown = {}) {
  const service = record(value);
  const seller = record(service.sellers || service.seller);
  const sellerMeta = record(seller.search_meta);
  const meta = record(service.metadata);
  const rateBasis = getRateBasisFromService(service);
  const basePrice = number(service.base_price ?? service.basePrice);
  const pricingType = getPricingModelFromService(service);
  const bookingMode = getBookingModeFromService(service, seller);
  // Each gig owns its title; the provider category is only a legacy fallback.
  const serviceType = text(service.title) || text(meta.service_type || meta.serviceType) || text(sellerMeta.service_type) || "Service";
  const location = record(sellerMeta.location);
  const isRequestBooking = pricingType === "inquiry" || bookingMode === "calendar-only";
  const boost = getActiveAdBooster(service);
  return {
    id: service.id,
    name: resolveProviderName(service, seller, profileValue),
    title: resolveServiceTitle(service, seller, profileValue),
    serviceType,
    customServiceType: text(meta.custom_service_type || meta.customServiceType),
    description: text(service.description || service.short_description || seller.about || seller.tagline) || "Professional service available through TrabaWho.",
    rating: number(service.rating ?? seller.avg_rating),
    reviews: number(service.reviews_count || seller.rating_count) || 0,
    photo: getProfilePhotoUrl(text(seller.profile_photo || seller.avatar_url)),
    gallery: Array.isArray(meta.gallery) ? meta.gallery : Array.isArray(meta.uploadedPhotos) ? meta.uploadedPhotos : [],
    experience: number(seller.years_experience || meta.experience_years || meta.experienceYears) || 0,
    location: [text(location.city || seller.city), text(location.province || seller.province)].filter(Boolean).join(", "),
    hourlyRate: rateBasis === "per-hour" ? basePrice : null,
    dailyRate: rateBasis === "per-day" ? basePrice : null,
    weeklyRate: rateBasis === "per-week" ? basePrice : null,
    monthlyRate: rateBasis === "per-month" ? basePrice : null,
    projectRate: rateBasis === "per-project" ? basePrice : null,
    pricingType,
    actionType: isRequestBooking ? "inquire" : "book",
    bookingMode,
    rateBasis,
    ...boost,
    rawService: service,
  };
}

interface ScheduleBlock {
  id: unknown;
  startTime: string;
  endTime: string;
  capacity: number;
  slotsLeft: number;
  rawSlot: RecordValue;
}
export function createScheduleForProvider(value: unknown = {}) {
  const provider = record(value);
  const operatingDays = ["Mon", "Tue", "Wed", "Thu", "Fri"];
  const dayBlocks: Record<string, ScheduleBlock[]> = Object.fromEntries(operatingDays.map((day) => [day, []]));
  return { manualScheduling: provider.actionType === "inquire" || provider.bookingMode === "calendar-only", operatingDays, dayBlocks };
}

export function buildWeeklyScheduleFromSlots(values: unknown[] = [], value: unknown = {}) {
  const provider = record(value);
  if (provider.actionType === "inquire" || provider.bookingMode === "calendar-only") return createScheduleForProvider(provider);
  const dayBlocks: Record<string, ScheduleBlock[]> = {};
  const days = new Set<string>();
  const seenWindows = new Set<string>();
  const timeInManila = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Manila", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  const dayInManila = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Manila", weekday: "short" });
  for (const value of values) {
    const slot = record(value);
    const start = new Date(text(slot.start_ts));
    const end = new Date(text(slot.end_ts));
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) continue;
    const windowKey = `${text(slot.service_id)}:${start.getTime()}:${end.getTime()}`;
    if (seenWindows.has(windowKey)) continue;
    seenWindows.add(windowKey);
    const dateKey = philippineDateKey(start);
    if (!dateKey) continue;
    const day = dayInManila.format(start);
    const meta = record(slot.metadata);
    const booked = number(meta.booked_count || meta.bookedCount) || 0;
    const capacity = number(slot.capacity) || 1;
    const block = { id: slot.id, startTime: timeInManila.format(start), endTime: timeInManila.format(end),
      capacity, slotsLeft: slot.status === "available" ? Math.max(0, capacity - booked) : 0, rawSlot: slot };
    days.add(day);
    // A published slot belongs to its exact Philippine date. Weekday buckets
    // made a later Wednesday's slot look bookable on an earlier Wednesday.
    (dayBlocks[dateKey] ??= []).push(block);
  }
  return { manualScheduling: false, operatingDays: [...days], dayBlocks };
}

export function getProviderQuoteAmount(value: unknown = {}) {
  const provider = record(value);
  return number(provider.hourlyRate || provider.dailyRate || provider.weeklyRate || provider.monthlyRate || provider.projectRate) || 0;
}
