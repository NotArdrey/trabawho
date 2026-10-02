import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { getProfilePhotoUrl } from "@/shared/utils/profilePhoto";
import {
  createSellerService, fetchSellerProfile,
  fetchUserProfileBundle, syncWorkerSetup,
} from "@/shared/services/authService";
import type { SellerRow, ServiceRow, WorkerProfile, WorkerServiceInput } from "../types/worker-profile";

type RecordValue = Record<string, unknown>;
const record = (value: unknown): RecordValue => value && typeof value === "object" && !Array.isArray(value) ? value as RecordValue : {};
const text = (value: unknown) => typeof value === "string" ? value : "";

const normalizeRateBasis = (value: unknown) => {
  const raw = text(value).trim().toLowerCase().replace(/_/g, "-");
  if (raw === "per-hour" || raw === "hourly") return "per-hour";
  if (raw === "per-day" || raw === "daily") return "per-day";
  if (raw === "per-week" || raw === "weekly") return "per-week";
  if (raw === "per-month" || raw === "monthly") return "per-month";
  if (["per-project", "project", "package", "fixed", "custom"].includes(raw)) return "per-project";
  return "";
};

export const getPricingModelFromService = (service: unknown) => {
  const row = record(service), metadata = record(row.metadata);
  const model = text(metadata.pricing_model || metadata.pricingModel || row.pricing_model).trim().toLowerCase();
  return model === "inquiry" ? "inquiry" : "fixed";
};

export const getActiveAdBoosterFromService = (service: unknown = {}) => {
  const metadata = record(record(service).metadata);
  const adBooster = record(metadata.ad_booster || metadata.adBooster);
  const boostEndsAt = text(adBooster.ends_at || adBooster.endsAt) || null;
  const boostEndsTime = boostEndsAt ? new Date(boostEndsAt).getTime() : null;
  const isBoosted = Boolean(adBooster.active) && (boostEndsTime === null || Number.isFinite(boostEndsTime))
    && (boostEndsTime === null || boostEndsTime > Date.now());
  return { adBooster: Object.keys(adBooster).length ? adBooster : null,
    boostBudget: Number(adBooster.budget_php ?? adBooster.budgetPhp ?? 0) || 0, boostEndsAt, isBoosted };
};

export const mapSellerRowToUiProfile = (
  sellerRow: Partial<SellerRow> | null = null, workerProfile: WorkerProfile | null = null, fallbackProfile: WorkerProfile | null = null,
) => {
  const sellerMeta = record(sellerRow?.search_meta), location = record(sellerMeta.location);
  const sellerName = sellerRow?.display_name || text(sellerMeta.name) || workerProfile?.fullName || fallbackProfile?.fullName || "Service Provider";
  const serviceType = workerProfile?.serviceType || workerProfile?.customServiceType || sellerRow?.headline
    || text(sellerMeta.service_type) || fallbackProfile?.serviceType || "Service Type";
  const profilePhoto = getProfilePhotoUrl(workerProfile?.profilePhoto || workerProfile?.profile_photo || sellerRow?.profile_photo
    || sellerRow?.avatar_url || fallbackProfile?.profilePhoto || fallbackProfile?.profile_photo || "");
  return {
    fullName: sellerName, serviceType,
    description: workerProfile?.bio || sellerRow?.about || sellerRow?.tagline || fallbackProfile?.bio || "",
    pricingModel: workerProfile?.pricingModel || "fixed",
    fixedPrice: workerProfile?.fixedPrice ?? "", hourlyRate: workerProfile?.hourlyRate ?? "",
    dailyRate: workerProfile?.dailyRate ?? "", weeklyRate: workerProfile?.weeklyRate ?? "",
    monthlyRate: workerProfile?.monthlyRate ?? "", projectRate: workerProfile?.projectRate ?? "",
    rateBasis: workerProfile?.rateBasis || "per-project",
    bookingMode: workerProfile?.bookingMode || text(sellerMeta.booking_mode) || "with-slots",
    paymentAdvance: workerProfile?.paymentAdvance ?? fallbackProfile?.paymentAdvance ?? false,
    paymentAfterService: workerProfile?.paymentAfterService ?? fallbackProfile?.paymentAfterService ?? true,
    afterServicePaymentType: workerProfile?.afterServicePaymentType || fallbackProfile?.afterServicePaymentType || "both",
    gcashNumber: workerProfile?.gcashNumber ?? fallbackProfile?.gcashNumber ?? "",
    profilePhoto,
    location: {
      address: workerProfile?.address || text(location.address) || fallbackProfile?.location?.address || "",
      barangay: workerProfile?.barangay || text(location.barangay) || fallbackProfile?.location?.barangay || "",
      city: workerProfile?.city || text(location.city) || fallbackProfile?.location?.city || "",
      province: workerProfile?.province || text(location.province) || fallbackProfile?.location?.province || "",
    },
    raw: null,
  };
};

export const mapServiceRowToWorkerService = (service: ServiceRow, sellerRow: Partial<SellerRow> | null = null, fallbackProfile: WorkerProfile | null = null) => {
  const metadata = record(service.metadata), sellerMeta = record(sellerRow?.search_meta), location = record(sellerMeta.location);
  const rateBasis = normalizeRateBasis(metadata.rate_basis || service.price_type) || "per-project";
  const price = service.base_price || "";
  return {
    fullName: sellerRow?.display_name || text(sellerMeta.name) || fallbackProfile?.fullName || fallbackProfile?.full_name || service.title || "Service",
    profilePhoto: getProfilePhotoUrl(sellerRow?.profile_photo || sellerRow?.avatar_url || fallbackProfile?.profilePhoto || fallbackProfile?.profile_photo || ""),
    serviceType: service.title || text(metadata.service_type) || "Service",
    description: service.description || service.short_description || "", pricingModel: getPricingModelFromService(service),
    fixedPrice: price, rateBasis, hourlyRate: rateBasis === "per-hour" ? price : "", dailyRate: rateBasis === "per-day" ? price : "",
    weeklyRate: rateBasis === "per-week" ? price : "", monthlyRate: rateBasis === "per-month" ? price : "", projectRate: rateBasis === "per-project" ? price : "",
    // Preferences belong to the normalized worker profile, never the public seller row.
    paymentAdvance: fallbackProfile?.paymentAdvance ?? false,
    paymentAfterService: fallbackProfile?.paymentAfterService ?? true,
    afterServicePaymentType: fallbackProfile?.afterServicePaymentType || "both",
    gcashNumber: fallbackProfile?.gcashNumber ?? "",
    bookingMode: text(metadata.booking_mode) || text(sellerMeta.booking_mode) || "with-slots",
    ...getActiveAdBoosterFromService(service),
    location: { barangay: text(location.barangay), city: text(location.city), province: text(location.province) },
    raw: service,
  };
};

/** Realtime listing updates must not replace preferences from the current worker bundle. */
export function withWorkerPreferences<T extends WorkerProfile>(profile: T, workerProfile: WorkerProfile | null): T {
  if (!workerProfile) return profile;
  return { ...profile,
    paymentAdvance: workerProfile.paymentAdvance ?? profile.paymentAdvance,
    paymentAfterService: workerProfile.paymentAfterService ?? profile.paymentAfterService,
    afterServicePaymentType: workerProfile.afterServicePaymentType ?? profile.afterServicePaymentType,
    gcashNumber: workerProfile.gcashNumber ?? profile.gcashNumber,
  };
}

export const getAuthenticatedWorkUser = async () => {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  return data.user || null;
};

export const loadWorkerProfileServices = async ({ userId, fallbackProfile = null }: { userId?: string; fallbackProfile?: WorkerProfile | null } = {}) => {
  if (!userId) return { sellerData: null, workerProfileBundle: null, sellerDbServices: [], workerServices: [], sellerUiProfile: null, sellerId: null, sellerRatingAggregate: null };
  // The legacy auth boundary already normalizes these rows; keep its contract explicit.
  const [seller, workerBundle] = await Promise.all([
    fetchSellerProfile(userId) as Promise<SellerRow | null>,
    fetchUserProfileBundle(userId) as Promise<WorkerProfile | null>,
  ]);
  if (!seller) return { sellerData: null, workerProfileBundle: workerBundle, sellerDbServices: [], workerServices: [],
    sellerUiProfile: mapSellerRowToUiProfile(null, workerBundle, fallbackProfile), sellerId: userId, sellerRatingAggregate: null };
  const sellerId = seller.user_id || userId;
  const [serviceValues, ratingAggregateResult] = await Promise.all([
    supabase.from("services").select("*").eq("seller_id", sellerId).order("created_at", { ascending: false }),
    supabase.from("seller_rating_aggregates").select("avg_rating, rating_count").eq("seller_id", sellerId).maybeSingle(),
  ]);
  if (ratingAggregateResult.error && ratingAggregateResult.error.code !== "PGRST116") throw ratingAggregateResult.error;
  if (serviceValues.error) throw serviceValues.error;
  const services = serviceValues.data;
  const visibleServices = services.filter((service) => service.active && record(service.metadata).deleted_from_work !== true);
  const sellerUiProfile = mapSellerRowToUiProfile(seller, workerBundle, fallbackProfile);
  // Deleted listings remain in this count so legacy setup repair cannot recreate them.
  const retainedServices = services.filter((service) => service.active || record(service.metadata).deleted_from_work === true);
  return { sellerData: seller, workerProfileBundle: workerBundle, sellerDbServices: retainedServices,
    workerServices: visibleServices.map((service) => mapServiceRowToWorkerService(service, seller, sellerUiProfile)),
    sellerUiProfile, sellerId, sellerRatingAggregate: ratingAggregateResult.data || null };
};

export const createWorkerService = async ({ sellerId, serviceData, sellerData, fallbackProfile }: {
  sellerId: string; serviceData: WorkerServiceInput; sellerData?: Partial<SellerRow> | null; fallbackProfile?: WorkerProfile | null;
}) => {
  const created = await createSellerService(sellerId, serviceData) as ServiceRow;
  return { raw: created, mapped: mapServiceRowToWorkerService(created, sellerData, fallbackProfile) };
};

export const updateWorkerProfile = async ({ userId, profileData }: { userId: string; profileData: WorkerProfile }) => {
  if (!userId) throw new Error("Missing authenticated user.");
  return await syncWorkerSetup(userId, profileData) as WorkerProfile | null;
};

export const subscribeToWorkProfileChanges = ({ sellerId, onSellerChange, onServiceChange }: {
  sellerId: string | null;
  onSellerChange?: (payload: RealtimePostgresChangesPayload<SellerRow>) => void;
  onServiceChange?: (payload: RealtimePostgresChangesPayload<ServiceRow>) => void;
}) => {
  if (!sellerId) return () => {};
  const serviceChannel = supabase.channel(`seller-services-${sellerId}`)
    .on<ServiceRow>("postgres_changes", { event: "*", schema: "public", table: "services", filter: `seller_id=eq.${sellerId}` }, (payload) => onServiceChange?.(payload)).subscribe();
  const sellerChannel = supabase.channel(`seller-row-${sellerId}`)
    .on<SellerRow>("postgres_changes", { event: "*", schema: "public", table: "sellers", filter: `user_id=eq.${sellerId}` }, (payload) => onSellerChange?.(payload)).subscribe();
  return () => {
    void supabase.removeChannel(serviceChannel); void supabase.removeChannel(sellerChannel);
  };
};

export default { createWorkerService, getAuthenticatedWorkUser, getPricingModelFromService, loadWorkerProfileServices,
  mapSellerRowToUiProfile, mapServiceRowToWorkerService, subscribeToWorkProfileChanges, updateWorkerProfile };
