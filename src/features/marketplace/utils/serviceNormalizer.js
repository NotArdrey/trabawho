import { getProfilePhotoUrl } from '../../../shared/utils/profilePhoto';

const CORE_CATEGORIES = ['Tutor', 'Technician', 'Cleaner'];

export const normalizeRateBasis = (value) => {
  const raw = String(value || '').trim().toLowerCase().replace(/_/g, '-');
  if (raw === 'per-hour' || raw === 'hourly') return 'per-hour';
  if (raw === 'per-day' || raw === 'daily') return 'per-day';
  if (raw === 'per-week' || raw === 'weekly') return 'per-week';
  if (raw === 'per-month' || raw === 'monthly') return 'per-month';
  if (raw === 'per-project' || raw === 'project' || raw === 'package' || raw === 'fixed') return 'per-project';
  return '';
};

export const getDisplayServiceType = (provider = {}) => {
  const rawType = String(provider.serviceType || '').trim();
  if (rawType.toLowerCase() === 'others') {
    return String(provider.customServiceType || '').trim() || 'General Service';
  }

  return rawType || 'General Service';
};

export const getRateBasisFromService = (service = {}) => {
  const direct = normalizeRateBasis(service.rate_basis);
  if (direct) return direct;

  const meta = normalizeRateBasis(
    service.metadata?.rate_basis
    || service.metadata?.rateBasis
    || service.metadata?.billing_unit
  );
  if (meta) return meta;

  const priceType = normalizeRateBasis(service.price_type || service.priceType);
  if (priceType) return priceType;

  return service.duration_minutes ? 'per-project' : 'per-hour';
};

export const getPricingModelFromService = (service = {}) => {
  const model = String(
    service.metadata?.pricing_model
    || service.metadata?.pricingModel
    || service.pricing_model
    || ''
  ).trim().toLowerCase();

  return model === 'inquiry' ? 'inquiry' : 'fixed';
};

export const getBookingModeFromService = (service = {}, seller = {}) => {
  const mode = String(
    service.metadata?.booking_mode
    || seller.booking_mode
    || seller.search_meta?.booking_mode
    || 'with-slots'
  ).trim().toLowerCase();

  return mode === 'calendar-only' ? 'calendar-only' : 'with-slots';
};

export const getActiveAdBooster = (service = {}) => {
  const adBooster = service.metadata?.ad_booster || service.metadata?.adBooster || null;
  const boostEndsAt = adBooster?.ends_at || adBooster?.endsAt || null;
  const boostEndsTime = boostEndsAt ? new Date(boostEndsAt).getTime() : null;
  const hasValidEnd = boostEndsTime === null || Number.isFinite(boostEndsTime);
  const isBoosted = Boolean(adBooster?.active)
    && hasValidEnd
    && (boostEndsTime === null || boostEndsTime > Date.now());
  const boostBudget = Number(adBooster?.budget_php ?? adBooster?.budgetPhp ?? 0) || 0;

  return {
    adBooster,
    boostBudget,
    boostEndsAt,
    isBoosted,
  };
};

export const resolveProviderName = (service = {}, seller = {}, sellerProfile = {}) => {
  const sellerMeta = seller.search_meta || {};
  const sellerDisplayName = seller.display_name || sellerMeta.name || '';
  const currentUserName = sellerProfile.fullName || sellerProfile.full_name || '';
  const isOwnSellerRow = Boolean(seller.user_id && sellerProfile.userId && seller.user_id === sellerProfile.userId);

  if (isOwnSellerRow && currentUserName) return currentUserName;
  return sellerDisplayName || currentUserName || service.title || 'Service Provider';
};

export const resolveServiceTitle = (service = {}, seller = {}, sellerProfile = {}) => {
  const rawTitle = String(service.title || '').trim();
  const sellerMeta = seller.search_meta || {};
  const providerName = resolveProviderName(service, seller, sellerProfile);
  const serviceType = String(
    sellerMeta.service_type
    || service.metadata?.service_type
    || service.metadata?.serviceType
    || ''
  ).trim();
  const normalizedTitle = rawTitle.toLowerCase();
  const normalizedType = serviceType.toLowerCase();

  if (!rawTitle) return providerName;
  if (normalizedType && normalizedTitle === normalizedType) return providerName;
  if (CORE_CATEGORIES.some((chip) => chip.toLowerCase() === normalizedTitle)) return providerName;
  return rawTitle;
};

export const normalizeServiceRecord = (service = {}, sellerProfile = {}) => {
  const seller = service.sellers || service.seller || {};
  const sellerMeta = seller.search_meta || {};
  const rateBasis = getRateBasisFromService(service);
  const basePrice = service.base_price ?? service.basePrice ?? null;
  const pricingType = getPricingModelFromService(service);
  const bookingMode = getBookingModeFromService(service, seller);
  const serviceType = sellerMeta.service_type || service.metadata?.service_type || service.metadata?.serviceType || 'Service';
  const city = sellerMeta.location?.city || seller.city || '';
  const province = sellerMeta.location?.province || seller.province || '';
  const location = [city, province].filter(Boolean).join(', ');
  const isRequestBooking = pricingType === 'inquiry' || bookingMode === 'calendar-only';
  const boostState = getActiveAdBooster(service);

  return {
    id: service.id,
    name: resolveProviderName(service, seller, sellerProfile),
    title: resolveServiceTitle(service, seller, sellerProfile),
    serviceType,
    customServiceType: service.metadata?.custom_service_type || service.metadata?.customServiceType || '',
    description: service.description || service.short_description || seller.about || seller.tagline || 'Professional service available through TrabaWho.',
    rating: service.rating ?? seller.avg_rating ?? null,
    reviews: service.reviews_count || seller.rating_count || 0,
    photo: getProfilePhotoUrl(seller.profile_photo || seller.avatar_url),
    gallery: service.metadata?.gallery || service.metadata?.uploadedPhotos || [],
    experience: seller.years_experience || service.metadata?.experience_years || service.metadata?.experienceYears || 0,
    location,
    hourlyRate: rateBasis === 'per-hour' ? basePrice : null,
    dailyRate: rateBasis === 'per-day' ? basePrice : null,
    weeklyRate: rateBasis === 'per-week' ? basePrice : null,
    monthlyRate: rateBasis === 'per-month' ? basePrice : null,
    projectRate: rateBasis === 'per-project' ? basePrice : null,
    pricingType,
    actionType: isRequestBooking ? 'inquire' : 'book',
    bookingMode,
    rateBasis,
    adBooster: boostState.adBooster,
    boostBudget: boostState.boostBudget,
    boostEndsAt: boostState.boostEndsAt,
    isBoosted: boostState.isBoosted,
    rawService: service,
  };
};

export const createScheduleForProvider = (provider = {}) => {
  const defaultDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
  const isManual = provider.actionType === 'inquire' || provider.bookingMode === 'calendar-only';
  const dayBlocks = {};

  defaultDays.forEach((day) => {
    if (isManual) {
      dayBlocks[day] = [];
      return;
    }

    dayBlocks[day] = [];
  });

  return {
    manualScheduling: isManual,
    operatingDays: defaultDays,
    dayBlocks,
  };
};

export const buildWeeklyScheduleFromSlots = (slots = [], provider = {}) => {
  if (provider.actionType === 'inquire' || provider.bookingMode === 'calendar-only') {
    return createScheduleForProvider(provider);
  }

  const dayBlocks = {};
  const operatingDaysSet = new Set();

  slots.forEach((slot) => {
    const start = new Date(slot.start_ts);
    const end = new Date(slot.end_ts);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return;

    const dayKey = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][start.getDay()];
    const dateKey = start.toISOString().slice(0, 10);
    const startTime = start.toTimeString().slice(0, 5);
    const endTime = end.toTimeString().slice(0, 5);
    const bookedCount = Number(slot.metadata?.booked_count || slot.metadata?.bookedCount || 0);
    const capacity = slot.capacity || 1;
    const slotsLeft = slot.status === 'available'
      ? Math.max(0, capacity - bookedCount)
      : 0;
    const block = {
      id: slot.id,
      startTime,
      endTime,
      capacity,
      slotsLeft,
      rawSlot: slot,
    };

    operatingDaysSet.add(dayKey);
    [dayKey, dateKey].forEach((key) => {
      if (!dayBlocks[key]) dayBlocks[key] = [];
      dayBlocks[key].push({ ...block });
    });
  });

  if (operatingDaysSet.size === 0) return createScheduleForProvider(provider);

  return {
    manualScheduling: false,
    operatingDays: Array.from(operatingDaysSet),
    dayBlocks,
  };
};

export const getProviderQuoteAmount = (provider = {}) =>
  provider.hourlyRate
  || provider.dailyRate
  || provider.weeklyRate
  || provider.monthlyRate
  || provider.projectRate
  || 0;
