import { supabase } from './supabaseClient';
import {
  getRegistrationFormLogSnapshot,
  logRegistrationDebug,
} from './registrationLogger';
import { DEFAULT_PROFILE_PHOTO_URL, getProfilePhotoUrl } from '../utils/profilePhoto';

const PROFILE_PHOTO_BUCKET = 'profile-photos';
const PORTFOLIO_BUCKET = 'portfolio';

const buildDefaultProfileImageUrl = () => DEFAULT_PROFILE_PHOTO_URL;

const getCleanString = (value) => {
  if (typeof value !== 'string') return '';
  return value.trim();
};

const normalizeEmail = (value) => getCleanString(value).toLowerCase();

const getNullableString = (value) => {
  const cleanValue = getCleanString(value);
  return cleanValue.length > 0 ? cleanValue : null;
};

const getNullableNumber = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const parsedValue = Number(value);
  return Number.isFinite(parsedValue) ? parsedValue : null;
};

const splitNameParts = (value = '') => {
  const parts = getCleanString(value).split(/\s+/).filter(Boolean);

  if (parts.length === 0) {
    return { firstName: '', middleName: '', lastName: '' };
  }

  if (parts.length === 1) {
    return { firstName: parts[0], middleName: '', lastName: '' };
  }

  if (parts.length === 2) {
    return { firstName: parts[0], middleName: '', lastName: parts[1] };
  }

  return {
    firstName: parts[0],
    middleName: parts.slice(1, -1).join(' '),
    lastName: parts[parts.length - 1],
  };
};

const buildDisplayName = ({ firstName = '', middleName = '', lastName = '' } = {}) =>
  [firstName, middleName, lastName].map(getCleanString).filter(Boolean).join(' ').trim();

const readNameField = (source = {}, keys = []) => {
  for (const key of keys) {
    const value = source?.[key];
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }
  }
  return '';
};

const resolveNameParts = (source = {}, metadata = {}, existingProfile = null) => {
  const explicitFirst = readNameField(source, ['firstName', 'first_name']) || readNameField(metadata, ['first_name']);
  const explicitMiddle = readNameField(source, ['middleName', 'middle_name']) || readNameField(metadata, ['middle_name']);
  const explicitLast = readNameField(source, ['lastName', 'last_name']) || readNameField(metadata, ['last_name']);

  if (explicitFirst || explicitMiddle || explicitLast) {
    return {
      firstName: explicitFirst,
      middleName: explicitMiddle,
      lastName: explicitLast,
    };
  }

  const fallbackName = readNameField(source, ['fullName', 'name'])
    || readNameField(metadata, ['full_name', 'name'])
    || readNameField(existingProfile || {}, ['full_name']);

  return splitNameParts(fallbackName);
};

const VALID_ROLES = ['client', 'worker', 'admin'];
const ROLE_ALIASES = {
  workers: 'worker',
  seller: 'worker',
  sellers: 'worker',
};

const getNormalizedRole = (value, fallback = 'client') => {
  const candidate = getCleanString(value).toLowerCase();
  if (ROLE_ALIASES[candidate]) return ROLE_ALIASES[candidate];
  if (VALID_ROLES.includes(candidate)) return candidate;
  return fallback;
};

const ALLOWED_SERVICE_PRICE_TYPES = ['fixed', 'hourly', 'custom', 'package'];

const normalizeServicePriceType = (value) => {
  const raw = getCleanString(value).toLowerCase();
  if (ALLOWED_SERVICE_PRICE_TYPES.includes(raw)) return raw;
  // UI "inquiry" is represented as SQL-safe "custom" + metadata.pricing_model='inquiry'.
  if (raw === 'inquiry') return 'custom';
  return 'fixed';
};

const getServicePricingModel = (serviceData = {}) => {
  const raw = getCleanString(serviceData.priceType || serviceData.pricingModel || '').toLowerCase();
  return raw === 'inquiry' ? 'inquiry' : 'fixed';
};

const toReadableDatabaseSetupError = (error) => {
  const message = String(error?.message || '');
  
  console.error('🔴 REAL SUPABASE ERROR:', message, error); // ADD THIS LINE
  // Network/connectivity issues
  if (/Failed to fetch|network|unable to reach|refused to connect/i.test(message)) {
    return new Error(
      'Network error: Unable to connect to Supabase. Verify your internet connection and that the Supabase project is online. '
      + 'Check environment variables: REACT_APP_SUPABASE_URL and REACT_APP_SUPABASE_ANON_KEY must be set in .env.local'
    );
  }
  
  // Table not found errors
  if (/Could not find the table|relation.*does not exist|table.*not found/i.test(message)) {
    return new Error(
      'Database setup incomplete: One or more required tables are missing. '
      + 'Run the complete SQL schema from supabase/COMPLETE_SCHEMA_CONSOLIDATED.sql in the Supabase SQL Editor. '
      + 'Tables needed: profiles, worker_profiles, sellers, services, service_slots, bookings, conversations, messages, reviews'
    );
  }
  
  // Permission/RLS errors
  if (/permission denied|row level security|RLS policy/i.test(message)) {
    return new Error(
      'Permission denied: Row-level security (RLS) policies are blocking this operation. '
      + 'Ensure you are logged in and that the RLS policies are correctly configured in the Supabase SQL Editor. '
      + 'All tables should have RLS enabled with policies that check auth.uid().'
    );
  }
  
  return error;
};

const getTimestamp = () => new Date().toISOString();

const buildMetadataFromProfileFields = (fields = {}) => {
  const metadata = {};

  if (fields.firstName !== undefined) metadata.first_name = fields.firstName;
  if (fields.middleName !== undefined) metadata.middle_name = fields.middleName;
  if (fields.lastName !== undefined) metadata.last_name = fields.lastName;
  if (fields.fullName !== undefined) metadata.full_name = fields.fullName;
  if (metadata.full_name === undefined && (metadata.first_name || metadata.middle_name || metadata.last_name)) {
    metadata.full_name = buildDisplayName({
      firstName: metadata.first_name,
      middleName: metadata.middle_name,
      lastName: metadata.last_name,
    });
  }
  if (fields.phoneNumber !== undefined) metadata.phone_number = fields.phoneNumber;
  if (fields.profilePhoto !== undefined) metadata.profile_photo = fields.profilePhoto;
  if (fields.bio !== undefined) metadata.bio = fields.bio;
  if (fields.province !== undefined) metadata.province = fields.province;
  if (fields.city !== undefined) metadata.city = fields.city;
  if (fields.barangay !== undefined) metadata.barangay = fields.barangay;
  if (fields.address !== undefined) metadata.address = fields.address;

  return metadata;
};

const buildLocationPayload = (source = {}) => ({
  province: getNullableString(source.province),
  city: getNullableString(source.city),
  barangay: getNullableString(source.barangay),
  address: getNullableString(source.address),
});

const buildProfilePayload = (user, source = {}, existingProfile = null) => {
  const metadata = user?.user_metadata || {};
  const location = buildLocationPayload({
    province: source.province ?? metadata.province ?? existingProfile?.province,
    city: source.city ?? metadata.city ?? existingProfile?.city,
    barangay: source.barangay ?? metadata.barangay ?? existingProfile?.barangay,
    address: source.address ?? metadata.address ?? existingProfile?.address,
  });
  const nameParts = resolveNameParts(source, metadata, existingProfile);
  const fullName = buildDisplayName(nameParts) || readNameField(source, ['fullName', 'name']) || readNameField(metadata, ['full_name', 'name']) || user.email?.split('@')[0] || 'TrabaWho User';
  const resolvedRole = getNormalizedRole(
    source.role
      || metadata.role
      || existingProfile?.role
      || (source.isWorker ?? metadata.is_worker ?? existingProfile?.is_worker ? 'worker' : 'client'),
    'client'
  );

  return {
    user_id: user.id,
    first_name: getNullableString(nameParts.firstName),
    middle_name: getNullableString(nameParts.middleName),
    last_name: getNullableString(nameParts.lastName),
    full_name: getNullableString(fullName) || 'TrabaWho User',
    email: user.email,
    phone_number: getNullableString(source.phoneNumber ?? metadata.phone_number ?? existingProfile?.phone_number),
    profile_photo: getProfilePhotoUrl(
      getNullableString(source.profilePhoto ?? metadata.profile_photo ?? existingProfile?.profile_photo)
        || buildDefaultProfileImageUrl(user.id)
    ),
    bio: getNullableString(source.bio ?? metadata.bio ?? existingProfile?.bio),
    province: location.province,
    city: location.city,
    barangay: location.barangay,
    address: location.address,
    is_client: true,
    is_worker: Boolean(source.isWorker ?? metadata.is_worker ?? existingProfile?.is_worker ?? false),
    role: resolvedRole,
    updated_at: getTimestamp(),
  };
};

const buildWorkerProfilePayload = (userId, source = {}) => ({
  user_id: userId,
  service_type: getNullableString(source.serviceType),
  custom_service_type: getNullableString(source.customServiceType),
  bio: getNullableString(source.bio),
  pricing_model: source.pricingModel || 'fixed',
  fixed_price: getNullableNumber(source.fixedPrice),
  hourly_rate: getNullableNumber(source.hourlyRate),
  daily_rate: getNullableNumber(source.dailyRate),
  weekly_rate: getNullableNumber(source.weeklyRate),
  monthly_rate: getNullableNumber(source.monthlyRate),
  booking_mode: source.bookingMode || 'with-slots',
  rate_basis: source.rateBasis || 'per-hour',
  payment_advance: Boolean(source.paymentAdvance),
  payment_after_service: source.paymentAfterService !== false,
  after_service_payment_type: source.afterServicePaymentType || 'both',
  gcash_number: getNullableString(source.gcashNumber),
  qr_file_name: getNullableString(source.qrFileName),
  verification_status: source.verificationStatus || 'pending',
  updated_at: getTimestamp(),
});

const ensureWorkerProfileBaseRow = async (userId, source = {}) => {
  const { data: existingProfile, error: existingProfileError } = await supabase
    .from('profiles')
    .select('full_name, email')
    .eq('user_id', userId)
    .maybeSingle();

  if (existingProfileError && existingProfileError.code !== 'PGRST116') throw toReadableDatabaseSetupError(existingProfileError);

  const existingFullName = getNullableString(existingProfile?.full_name);
  const existingEmail = getNullableString(existingProfile?.email);

  if (existingFullName && existingEmail) {
    return;
  }

  let resolvedEmail = existingEmail || normalizeEmail(source.email || '');
  if (!resolvedEmail) {
    const { data: userData, error: authUserError } = await supabase.auth.getUser();
    if (authUserError) throw authUserError;
    resolvedEmail = normalizeEmail(userData?.user?.email || '');
  }

  if (!resolvedEmail) {
    throw new Error('Unable to complete seller setup because the account email is missing. Please log out and log back in, then try again.');
  }

  const resolvedFullName =
    existingFullName
    || buildDisplayName(resolveNameParts(source, {}, { full_name: existingFullName }))
    || getNullableString(source.fullName || source.name)
    || resolvedEmail.split('@')[0]
    || 'TrabaWho User';

  const nameParts = resolveNameParts(source, {}, { full_name: existingFullName });

  const profilePayload = {
    user_id: userId,
    first_name: getNullableString(nameParts.firstName),
    middle_name: getNullableString(nameParts.middleName),
    last_name: getNullableString(nameParts.lastName),
    full_name: resolvedFullName,
    email: resolvedEmail,
    is_client: true,
    is_worker: true,
    role: 'worker',
    updated_at: getTimestamp(),
  };

  // If profile exists, update it; otherwise insert it
  if (existingProfile) {
    const { error: updateError } = await supabase
      .from('profiles')
      .update(profilePayload)
      .eq('user_id', userId);

    if (updateError) throw toReadableDatabaseSetupError(updateError);
  } else {
    const { error: insertError } = await supabase
      .from('profiles')
      .insert([profilePayload]);

    if (insertError) throw toReadableDatabaseSetupError(insertError);
  }
};

const mapLocation = (profileRow) => ({
  province: profileRow?.province || '',
  city: profileRow?.city || '',
  barangay: profileRow?.barangay || '',
  address: profileRow?.address || '',
});

const mapAppProfile = (profileRow = null, workerRow = null) => {
  if (!profileRow && !workerRow) return null;

  const location = mapLocation(profileRow);

  const resolvedRole = getNormalizedRole(
    profileRow?.role || (profileRow?.is_worker || workerRow ? 'worker' : 'client'),
    'client'
  );
  const hasExplicitProfileRole = Boolean(profileRow?.role);
  const resolvedIsWorker =
    resolvedRole === 'worker'
    || (!hasExplicitProfileRole && (Boolean(profileRow?.is_worker) || Boolean(workerRow)));
  const workerProfileRow = resolvedIsWorker ? workerRow : null;

  return {
    userId: profileRow?.user_id || workerRow?.user_id || null,
    firstName: profileRow?.first_name || splitNameParts(profileRow?.full_name || '').firstName,
    middleName: profileRow?.middle_name || splitNameParts(profileRow?.full_name || '').middleName,
    lastName: profileRow?.last_name || splitNameParts(profileRow?.full_name || '').lastName,
    fullName: buildDisplayName({
      firstName: profileRow?.first_name || splitNameParts(profileRow?.full_name || '').firstName,
      middleName: profileRow?.middle_name || splitNameParts(profileRow?.full_name || '').middleName,
      lastName: profileRow?.last_name || splitNameParts(profileRow?.full_name || '').lastName,
    }) || profileRow?.full_name || '',
    email: profileRow?.email || '',
    phoneNumber: profileRow?.phone_number || '',
    profilePhoto: getProfilePhotoUrl(profileRow?.profile_photo || buildDefaultProfileImageUrl()),
    bio: profileRow?.bio || '',
    province: location.province,
    city: location.city,
    barangay: location.barangay,
    address: location.address,
    location,
    isClient: profileRow?.is_client !== false,
    isWorker: resolvedIsWorker,
    role: resolvedRole,
    isAdmin: resolvedRole === 'admin',
    accountStatus: profileRow?.account_status || 'active',
    disabledReason: profileRow?.disabled_reason || '',
    suspendedReason: profileRow?.suspended_reason || '',
    suspendedUntil: profileRow?.suspended_until || null,
    disabledAt: profileRow?.disabled_at || null,
    suspendedAt: profileRow?.suspended_at || null,
    identityRequired: Boolean(profileRow?.identity_required),
    identityRole: profileRow?.identity_role || '',
    identityVerificationStatus: profileRow?.verification_status || '',
    isVerified: Boolean(profileRow?.is_verified),
    diditSessionId: profileRow?.didit_session_id || '',
    idDocumentExpiry: profileRow?.id_document_expiry || null,
    idVerifiedAt: profileRow?.id_verified_at || null,
    serviceType: workerProfileRow?.service_type || '',
    customServiceType: workerProfileRow?.custom_service_type || '',
    pricingModel: workerProfileRow?.pricing_model || 'fixed',
    fixedPrice: workerProfileRow?.fixed_price ?? '',
    hourlyRate: workerProfileRow?.hourly_rate ?? '',
    dailyRate: workerProfileRow?.daily_rate ?? '',
    weeklyRate: workerProfileRow?.weekly_rate ?? '',
    monthlyRate: workerProfileRow?.monthly_rate ?? '',
    bookingMode: workerProfileRow?.booking_mode || 'with-slots',
    rateBasis: workerProfileRow?.rate_basis || 'per-hour',
    paymentAdvance: workerProfileRow?.payment_advance ?? false,
    paymentAfterService: workerProfileRow?.payment_after_service ?? true,
    afterServicePaymentType: workerProfileRow?.after_service_payment_type || 'both',
    gcashNumber: workerProfileRow?.gcash_number || '',
    qrFileName: workerProfileRow?.qr_file_name || '',
    verificationStatus: workerProfileRow?.verification_status || 'pending',
    workerUpdatedAt: workerProfileRow?.updated_at || null,
    profileUpdatedAt: profileRow?.updated_at || null,
  };
};

const reactivateExpiredSuspensionIfNeeded = async (userId, profileRow = null) => {
  if (!userId || !profileRow) return profileRow;

  const accountStatus = getCleanString(profileRow.account_status || 'active').toLowerCase() || 'active';
  const suspendedUntil = profileRow.suspended_until || null;
  if (accountStatus !== 'suspended' || !suspendedUntil) return profileRow;

  const suspendedUntilDate = new Date(suspendedUntil);
  if (Number.isNaN(suspendedUntilDate.getTime()) || suspendedUntilDate.getTime() > Date.now()) {
    return profileRow;
  }

  const { error } = await supabase
    .from('profiles')
    .update({
      account_status: 'active',
      suspended_reason: null,
      suspended_until: null,
      suspended_at: null,
      updated_at: getTimestamp(),
    })
    .eq('user_id', userId);

  if (error) throw toReadableDatabaseSetupError(error);

  return {
    ...profileRow,
    account_status: 'active',
    suspended_reason: null,
    suspended_until: null,
    suspended_at: null,
  };
};

export const fetchUserProfileBundle = async (userId) => {
  if (!userId) return null;

  const { data: profileRow, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (profileError) throw toReadableDatabaseSetupError(profileError);

  const normalizedProfileRow = await reactivateExpiredSuspensionIfNeeded(userId, profileRow);

  const { data: workerRow, error: workerError } = await supabase
    .from('worker_profiles')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (workerError) throw toReadableDatabaseSetupError(workerError);

  return mapAppProfile(normalizedProfileRow, workerRow);
};

export const upsertClientProfile = async (user, source = {}) => {
  if (!user?.id) throw new Error('Missing authenticated user.');

  logRegistrationDebug('client_profile:upsert_started', {
    userId: user.id,
    form: getRegistrationFormLogSnapshot(source),
  });

  const { data: existingProfile, error: existingError } = await supabase
    .from('profiles')
    .select('is_worker, role, full_name, phone_number, profile_photo, bio, province, city, barangay, address')
    .eq('user_id', user.id)
    .maybeSingle();

  if (existingError && existingError.code !== 'PGRST116') throw toReadableDatabaseSetupError(existingError);

  const payload = buildProfilePayload(user, source, existingProfile);
  logRegistrationDebug('client_profile:payload_built', {
    userId: user.id,
    mode: existingProfile?.full_name || existingProfile?.email ? 'update' : 'insert',
    payload,
  });

  // If profile exists, use UPDATE; otherwise use INSERT
  if (existingProfile?.full_name || existingProfile?.email) {
    // Profile already exists (created by trigger or previous signup), so UPDATE
    const { error: updateError } = await supabase
      .from('profiles')
      .update(payload)
      .eq('user_id', user.id);

    if (updateError) throw toReadableDatabaseSetupError(updateError);
    logRegistrationDebug('client_profile:updated', { userId: user.id });
  } else {
    // Profile doesn't exist, INSERT it
    const { error: insertError } = await supabase
      .from('profiles')
      .insert([payload]);

    if (insertError) throw toReadableDatabaseSetupError(insertError);
    logRegistrationDebug('client_profile:inserted', { userId: user.id });
  }

  const profile = await fetchUserProfileBundle(user.id);
  logRegistrationDebug('client_profile:upsert_finished', {
    userId: user.id,
    profile,
  });
  return profile;
};

export const updateUserProfileFields = async (user, fields = {}) => {
  if (!user?.id) throw new Error('Missing authenticated user.');

  const currentProfile = await fetchUserProfileBundle(user.id);
  const resolvedEmail = normalizeEmail(
    currentProfile?.email
    || user.email
    || user.user_metadata?.email
    || user.user_metadata?.public_email
    || ''
  );

  if (!resolvedEmail) {
    throw new Error('Unable to save profile because the account email is missing. Please log out and log back in, then try again.');
  }

  const mergedLocation = buildLocationPayload({
    province: fields.province ?? currentProfile?.province,
    city: fields.city ?? currentProfile?.city,
    barangay: fields.barangay ?? currentProfile?.barangay,
    address: fields.address ?? currentProfile?.address,
  });

  const payload = {
    user_id: user.id,
    first_name: getNullableString(fields.firstName ?? currentProfile?.firstName),
    middle_name: getNullableString(fields.middleName ?? currentProfile?.middleName),
    last_name: getNullableString(fields.lastName ?? currentProfile?.lastName),
    full_name: getNullableString(
      fields.fullName
      ?? buildDisplayName({
        firstName: fields.firstName ?? currentProfile?.firstName,
        middleName: fields.middleName ?? currentProfile?.middleName,
        lastName: fields.lastName ?? currentProfile?.lastName,
      })
      ?? currentProfile?.fullName
      ?? user.user_metadata?.full_name
      ?? user.user_metadata?.name
    ),
    email: resolvedEmail,
    phone_number: getNullableString(fields.phoneNumber ?? currentProfile?.phoneNumber),
    profile_photo: getNullableString(fields.profilePhoto ?? currentProfile?.profilePhoto),
    bio: getNullableString(fields.bio ?? currentProfile?.bio),
    province: mergedLocation.province,
    city: mergedLocation.city,
    barangay: mergedLocation.barangay,
    address: mergedLocation.address,
    is_client: currentProfile?.isClient !== false,
    is_worker: Boolean(currentProfile?.isWorker),
    role: currentProfile?.role || 'client',
    updated_at: getTimestamp(),
  };

  // Profile exists (we just fetched it), so UPDATE it
  const { error } = await supabase
    .from('profiles')
    .update(payload)
    .eq('user_id', user.id);

  if (error) throw toReadableDatabaseSetupError(error);

  const { error: authUpdateError } = await supabase.auth.updateUser({
    data: buildMetadataFromProfileFields(fields),
  });

  if (authUpdateError) throw authUpdateError;

  return fetchUserProfileBundle(user.id);
};

const normalizeAdminAccountRow = (row = {}) => {
  const accountStatus = getCleanString(row.account_status || 'active').toLowerCase() || 'active';
  const suspendedUntil = row.suspended_until || null;
  const suspendedUntilDate = suspendedUntil ? new Date(suspendedUntil) : null;
  const isSuspensionExpired = suspendedUntilDate && !Number.isNaN(suspendedUntilDate.getTime()) && suspendedUntilDate.getTime() <= Date.now();

  return {
    id: row.user_id,
    name: row.full_name || [row.first_name, row.middle_name, row.last_name].filter(Boolean).join(' ').trim() || 'Unnamed account',
    email: row.email || '',
    role: row.role || 'client',
    status: accountStatus,
    disabledReason: row.disabled_reason || '',
    suspendedReason: row.suspended_reason || '',
    suspendedUntil,
    suspendedUntilExpired: Boolean(isSuspensionExpired),
    disabledAt: row.disabled_at || null,
    suspendedAt: row.suspended_at || null,
    updatedAt: row.updated_at || null,
    createdAt: row.created_at || null,
  };
};

export const fetchAdminAccounts = async () => {
  const { data, error } = await supabase
    .from('profiles')
    .select('user_id, first_name, middle_name, last_name, full_name, email, role, account_status, disabled_reason, suspended_reason, suspended_until, disabled_at, suspended_at, updated_at, created_at')
    .order('updated_at', { ascending: false });

  if (error) throw toReadableDatabaseSetupError(error);

  const expiredSuspensions = (data || []).filter((row) => {
    const accountStatus = getCleanString(row.account_status || 'active').toLowerCase() || 'active';
    if (accountStatus !== 'suspended' || !row.suspended_until) return false;
    const suspendedUntilDate = new Date(row.suspended_until);
    return !Number.isNaN(suspendedUntilDate.getTime()) && suspendedUntilDate.getTime() <= Date.now();
  });

  if (expiredSuspensions.length > 0) {
    await Promise.all(expiredSuspensions.map(async (row) => {
      const { error: reactivateError } = await supabase
        .from('profiles')
        .update({
          account_status: 'active',
          suspended_reason: null,
          suspended_until: null,
          suspended_at: null,
          updated_at: getTimestamp(),
        })
        .eq('user_id', row.user_id);

      if (reactivateError) throw toReadableDatabaseSetupError(reactivateError);
    }));

    const { data: refreshedData, error: refreshError } = await supabase
      .from('profiles')
      .select('user_id, first_name, middle_name, last_name, full_name, email, role, account_status, disabled_reason, suspended_reason, suspended_until, disabled_at, suspended_at, updated_at, created_at')
      .order('updated_at', { ascending: false });

    if (refreshError) throw toReadableDatabaseSetupError(refreshError);

    return (refreshedData || []).map(normalizeAdminAccountRow);
  }

  return (data || []).map(normalizeAdminAccountRow);
};

export const updateAdminAccountRole = async ({ userId, role }) => {
  if (!userId) throw new Error('Missing account id.');

  const normalizedRole = getNormalizedRole(role, 'client');
  if (normalizedRole !== 'client' && normalizedRole !== 'admin') {
    throw new Error('Only client and admin roles can be set from account management right now.');
  }

  const { error } = await supabase
    .from('profiles')
    .update({
      role: normalizedRole,
      updated_at: getTimestamp(),
    })
    .eq('user_id', userId);

  if (error) throw toReadableDatabaseSetupError(error);

  return true;
};

export const updateAdminAccountStatus = async ({ userId, status, reason = '', durationMinutes = null }) => {
  if (!userId) throw new Error('Missing account id.');

  const normalizedStatus = getCleanString(status).toLowerCase();
  if (!['active', 'disabled', 'suspended'].includes(normalizedStatus)) {
    throw new Error('Invalid account status.');
  }

  const payload = {
    account_status: normalizedStatus,
    disabled_reason: null,
    suspended_reason: null,
    suspended_until: null,
    disabled_at: null,
    suspended_at: null,
    updated_at: getTimestamp(),
  };

  if (normalizedStatus === 'disabled') {
    payload.disabled_reason = getNullableString(reason) || 'Disabled by admin';
    payload.disabled_at = getTimestamp();
  }

  if (normalizedStatus === 'suspended') {
    const duration = Number(durationMinutes);
    if (!Number.isFinite(duration) || duration <= 0) {
      throw new Error('Please enter a valid suspension duration in minutes.');
    }

    const suspendedUntil = new Date(Date.now() + duration * 60 * 1000).toISOString();
    payload.suspended_reason = getNullableString(reason) || 'Suspended by admin';
    payload.suspended_until = suspendedUntil;
    payload.suspended_at = getTimestamp();
  }

  const { error } = await supabase
    .from('profiles')
    .update(payload)
    .eq('user_id', userId);

  if (error) throw toReadableDatabaseSetupError(error);

  return true;
};

export const isAccountBlockedForLogin = (profile = null) => {
  const status = getCleanString(profile?.accountStatus || profile?.account_status || 'active').toLowerCase();
  if (status === 'disabled') {
    return 'Your account has been disabled by an administrator. Please contact support to restore access.';
  }

  if (status === 'suspended') {
    const suspendedUntil = profile?.suspendedUntil || profile?.suspended_until || null;
    if (suspendedUntil) {
      const suspendedUntilDate = new Date(suspendedUntil);
      if (!Number.isNaN(suspendedUntilDate.getTime()) && suspendedUntilDate.getTime() > Date.now()) {
        return `Your account is suspended until ${suspendedUntilDate.toLocaleString()}. Please try again later.`;
      }
    }
    return 'Your account is currently suspended. Please try again later or contact support.';
  }

  const identityRequired = Boolean(profile?.identityRequired ?? profile?.identity_required ?? false);
  if (identityRequired) {
    const identityStatus = getCleanString(
      profile?.identityVerificationStatus
      || profile?.verification_status
      || 'PENDING'
    ).replace(/[\s-]+/g, '_').toUpperCase();
    const isIdentityVerified = Boolean(profile?.isVerified ?? profile?.is_verified ?? false);
    const expiryValue = profile?.idDocumentExpiry || profile?.id_document_expiry || null;

    if (expiryValue) {
      const expiryDate = new Date(`${String(expiryValue).slice(0, 10)}T23:59:59`);
      if (!Number.isNaN(expiryDate.getTime()) && expiryDate.getTime() < Date.now()) {
        return 'Your verified ID document has expired. Please complete identity verification again before logging in.';
      }
    }

    if (identityStatus === 'PENDING_REVIEW') {
      return 'Your identity review is still pending. We will email you when the review is approved.';
    }

    if (['DECLINED', 'ABANDONED', 'EXPIRED'].includes(identityStatus)) {
      return 'Identity verification was not completed. Please restart verified registration before logging in.';
    }

    if (identityStatus !== 'APPROVED') {
      return 'Identity verification is still required before login access is allowed.';
    }

    if (!isIdentityVerified) {
      return 'Please confirm your email before logging in.';
    }
  }

  return '';
};

export const updateUserPassword = async ({ email, currentPassword, newPassword }) => {
  const normalizedEmail = normalizeEmail(email);
  const cleanCurrentPassword = typeof currentPassword === 'string' ? currentPassword : '';
  const cleanNewPassword = typeof newPassword === 'string' ? newPassword : '';

  if (!normalizedEmail) throw new Error('Missing account email.');
  if (!cleanCurrentPassword || !cleanNewPassword) throw new Error('Please complete all password fields.');

  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: normalizedEmail,
    password: cleanCurrentPassword,
  });

  if (signInError) {
    throw new Error('Current password is incorrect.');
  }

  const { error: passwordError } = await supabase.auth.updateUser({
    password: cleanNewPassword,
  });

  if (passwordError) throw passwordError;

  return true;
};

export const upsertWorkerProfile = async (userId, source = {}) => {
  if (!userId) throw new Error('Missing authenticated user.');

  await ensureWorkerProfileBaseRow(userId, source);

  const payload = buildWorkerProfilePayload(userId, source);
  const { error: workerError } = await supabase
    .from('worker_profiles')
    .upsert(payload, { onConflict: 'user_id' });

  if (workerError) throw toReadableDatabaseSetupError(workerError);

  const { data: currentProfileRole, error: currentRoleError } = await supabase
    .from('profiles')
    .select('role')
    .eq('user_id', userId)
    .maybeSingle();

  if (currentRoleError) throw toReadableDatabaseSetupError(currentRoleError);

  const nextRole = getNormalizedRole(currentProfileRole?.role, 'client') === 'admin' ? 'admin' : 'worker';

  const { error: profileError } = await supabase
    .from('profiles')
    .update({
      is_worker: true,
      role: nextRole,
      updated_at: getTimestamp(),
    })
    .eq('user_id', userId);

  if (profileError) throw toReadableDatabaseSetupError(profileError);

  return fetchUserProfileBundle(userId);
};

export const signInWithEmail = async ({ email, password }) => {
  const normalizedEmail = normalizeEmail(email);
  const cleanPassword = typeof password === 'string' ? password : '';

  const { data, error } = await supabase.auth.signInWithPassword({
    email: normalizedEmail,
    password: cleanPassword,
  });

  if (error) {
    const message = String(error?.message || '');
    if (/email not confirmed/i.test(message)) {
      throw new Error('Email not verified yet. Please verify your email first, then log in.');
    }
    if (/invalid login credentials/i.test(message)) {
      throw new Error('Invalid login credentials. Check your email/password. If you just signed up, verify your email first.');
    }
    throw error;
  }

  return data.session?.user || data.user || null;
};

export const signUpWithEmail = async (formData = {}) => {
  const normalizedEmail = normalizeEmail(formData.email);
  const cleanPassword = typeof formData.password === 'string' ? formData.password : '';

  logRegistrationDebug('email_signup:start', {
    form: getRegistrationFormLogSnapshot({ ...formData, email: normalizedEmail }),
  });

  const { data, error } = await supabase.auth.signUp({
    email: normalizedEmail,
    password: cleanPassword,
    options: {
      data: {
        first_name: formData.firstName || '',
        middle_name: formData.middleName || '',
        last_name: formData.lastName || '',
        full_name: buildDisplayName({
          firstName: formData.firstName,
          middleName: formData.middleName,
          lastName: formData.lastName,
        }) || formData.name || '',
        phone_number: formData.phoneNumber || '',
        province: formData.province || '',
        city: formData.city || '',
        barangay: formData.barangay || '',
        address: formData.address || '',
        bio: formData.bio || '',
        profile_photo: getProfilePhotoUrl(formData.profilePhoto),
        is_client: true,
        is_worker: false,
        role: 'client',
      },
    },
  });

  if (error) {
    logRegistrationDebug('email_signup:error', {
      message: error.message,
      error,
    }, 'error');
    throw error;
  }

  logRegistrationDebug('email_signup:supabase_response', {
    userId: data.user?.id || data.session?.user?.id || null,
    hasUser: Boolean(data.user),
    hasSession: Boolean(data.session),
    requiresEmailVerification: !data.session?.user,
  });

  if (!data.session?.user) {
    logRegistrationDebug('email_signup:verification_required', {
      userId: data.user?.id || null,
    });
    return {
      user: data.user || null,
      profile: null,
      requiresEmailVerification: true,
    };
  }

  const profile = await upsertClientProfile(data.session.user, formData);
  logRegistrationDebug('email_signup:finished', {
    userId: data.session.user.id,
    profile,
  });
  return {
    user: data.session.user,
    profile,
    requiresEmailVerification: false,
  };
};

export const signOutUser = async () => {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
};

export const resendSignupVerificationEmail = async (email) => {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) {
    throw new Error('Please enter your email address first.');
  }

  const { error } = await supabase.auth.resend({
    type: 'signup',
    email: normalizedEmail,
  });

  if (error) throw error;
};

export const sendPasswordResetEmail = async (email) => {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) {
    throw new Error('Please enter your email address.');
  }

  const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
    redirectTo: typeof window !== 'undefined' ? window.location.origin : undefined,
  });

  if (error) throw error;
};

export const syncAuthenticatedUserProfile = async (user, source = {}) => {
  if (!user?.id) throw new Error('Missing authenticated user.');

  const existingProfile = await fetchUserProfileBundle(user.id);
  const hasSourceUpdates = Object.keys(source || {}).length > 0;

  if (existingProfile && !hasSourceUpdates) {
    return existingProfile;
  }

  const profile = await upsertClientProfile(user, source);
  return profile;
};

// ============================================================================
// SELLER MANAGEMENT FUNCTIONS
// ============================================================================

// ============================================================================
// SIMPLIFIED SELLER PAYLOAD BUILDER
// ============================================================================
// Purpose: Take onboarding form data and write it directly to sellers table.
// Ensures fullName → display_name, bio → tagline/about, matching the manual SQL.
// ============================================================================

const buildSellerPayload = (userId, onboardingData = {}, existingSeller = null) => {
  // Extract directly from onboarding form (or fall back to existing seller)
  const displayName = getNullableString(
    onboardingData.fullName
    || onboardingData.full_name
    || existingSeller?.display_name
    || ''
  );

  const bio = getNullableString(onboardingData.bio || existingSeller?.about || '');
  const serviceType = getNullableString(
    onboardingData.serviceType
    || onboardingData.customServiceType
    || existingSeller?.search_meta?.service_type
    || ''
  );

  const city = getNullableString(onboardingData.city || existingSeller?.search_meta?.location?.city || '');
  const province = getNullableString(onboardingData.province || existingSeller?.search_meta?.location?.province || '');
  const bookingMode = getCleanString(onboardingData.bookingMode || existingSeller?.search_meta?.booking_mode || '');
  const profilePhoto = getProfilePhotoUrl(getNullableString(
    onboardingData.profilePhoto
    || onboardingData.profile_photo
    || existingSeller?.profile_photo
    || existingSeller?.avatar_url
    || ''
  ) || buildDefaultProfileImageUrl(userId));

  return {
    user_id: userId,
    display_name: displayName,
    headline: getNullableString(serviceType) || 'Service Provider',
    tagline: bio, // bio → tagline (direct mapping)
    about: bio, // bio → about (direct mapping)
    is_verified: Boolean(existingSeller?.is_verified ?? false),
    verification_status: 'pending',
    response_time_minutes: 1440,
    languages: ['en'],
    default_currency: 'PHP',
    business_hours: null,
    profile_photo: profilePhoto,
    avatar_url: profilePhoto,
    search_meta: {
      name: displayName, // display_name → search_meta.name
      service_type: serviceType,
      bio, // bio → search_meta.bio
      booking_mode: bookingMode || null,
      location: {
        city,
        province,
      },
    },
    updated_at: getTimestamp(),
  };
};

export const createOrUpdateSeller = async (userId, source = {}) => {
  if (!userId) throw new Error('Missing user ID for seller account.');

  const { data: existingSeller, error: existingSellerError } = await supabase
    .from('sellers')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (existingSellerError && existingSellerError.code !== 'PGRST116') {
    throw toReadableDatabaseSetupError(existingSellerError);
  }

  const payload = buildSellerPayload(userId, source, existingSeller || null);
  const { data: sellerData, error: upsertError } = await supabase
    .from('sellers')
    .upsert(payload, { onConflict: 'user_id' })
    .select('*')
    .maybeSingle();

  if (upsertError) throw toReadableDatabaseSetupError(upsertError);

  return sellerData;
};

export const fetchSellerProfile = async (userId) => {
  if (!userId) return null;

  const { data, error } = await supabase
    .from('sellers')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error && error.code !== 'PGRST116') {
    throw toReadableDatabaseSetupError(error);
  }

  return data || null;
};

export const fetchSellerServices = async (sellerId) => {
  if (!sellerId) return [];

  const { data, error } = await supabase
    .from('services')
    .select('*')
    .eq('seller_id', sellerId)
    .eq('active', true)
    .order('created_at', { ascending: false });

  if (error && error.code !== 'PGRST116') {
    throw toReadableDatabaseSetupError(error);
  }

  return data || [];
};

export const updateServiceAdBoost = async ({ serviceId, boost }) => {
  if (!serviceId) throw new Error('Choose a service to boost.');

  const { data: currentService, error: fetchError } = await supabase
    .from('services')
    .select('metadata')
    .eq('id', serviceId)
    .maybeSingle();

  if (fetchError && fetchError.code !== 'PGRST116') {
    throw toReadableDatabaseSetupError(fetchError);
  }

  const currentBoost = currentService?.metadata?.ad_booster || currentService?.metadata?.adBooster || null;
  const currentBoostEndsAt = currentBoost?.ends_at || currentBoost?.endsAt || null;
  const currentBoostEndsTime = currentBoostEndsAt ? new Date(currentBoostEndsAt).getTime() : null;
  const hasValidCurrentBoostEnd = currentBoostEndsTime === null || Number.isFinite(currentBoostEndsTime);
  const isCurrentlyBoosted = Boolean(currentBoost?.active)
    && hasValidCurrentBoostEnd
    && (currentBoostEndsTime === null || currentBoostEndsTime > Date.now());

  if (boost?.active !== false && isCurrentlyBoosted) {
    const activeUntil = currentBoostEndsAt ? new Date(currentBoostEndsAt).toLocaleDateString() : 'manually stopped';
    throw new Error(`This gig is already boosted until ${activeUntil}.`);
  }

  const nextMetadata = {
    ...(currentService?.metadata || {}),
    ad_booster: {
      ...(boost || {}),
      updated_at: getTimestamp(),
    },
  };

  const { data, error } = await supabase
    .from('services')
    .update({
      metadata: nextMetadata,
      updated_at: getTimestamp(),
    })
    .eq('id', serviceId)
    .select('*')
    .maybeSingle();

  if (error) throw toReadableDatabaseSetupError(error);
  return data;
};

export const fetchAllActiveServices = async (limit = 50) => {
  const { data, error } = await supabase
    .from('services')
    // include related seller row so UI can render provider details
    .select('*, sellers(*)')
    .eq('active', true)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error && error.code !== 'PGRST116') {
    throw toReadableDatabaseSetupError(error);
  }

  const rows = data || [];
  const sellerIds = [...new Set(rows.map((row) => row.seller_id).filter(Boolean))];

  if (sellerIds.length === 0) return rows;

  const { data: aggregates, error: aggregateError } = await supabase
    .from('seller_rating_aggregates')
    .select('seller_id, avg_rating, rating_count')
    .in('seller_id', sellerIds);

  if (aggregateError && aggregateError.code !== 'PGRST116') {
    throw toReadableDatabaseSetupError(aggregateError);
  }

  const aggregatesBySeller = Object.fromEntries((aggregates || []).map((row) => [row.seller_id, row]));

  return rows.map((row) => {
    const aggregate = aggregatesBySeller[row.seller_id] || {};
    const sellerPhoto = getProfilePhotoUrl(row.sellers?.profile_photo || row.sellers?.avatar_url || buildDefaultProfileImageUrl(row.seller_id));

    return {
      ...row,
      rating: aggregate.avg_rating ?? row.rating ?? null,
      reviews_count: aggregate.rating_count ?? row.reviews_count ?? 0,
      sellers: row.sellers
        ? {
            ...row.sellers,
            avg_rating: aggregate.avg_rating ?? row.sellers.avg_rating ?? null,
            rating_count: aggregate.rating_count ?? row.sellers.rating_count ?? 0,
            profile_photo: sellerPhoto,
            avatar_url: sellerPhoto,
          }
        : row.sellers,
    };
  });
};

export const fetchServiceWithSeller = async (serviceId) => {
  if (!serviceId) return null;

  const { data, error } = await supabase
    .from('services')
    .select('*, sellers(*)')
    .eq('id', serviceId)
    .maybeSingle();

  if (error && error.code !== 'PGRST116') {
    throw toReadableDatabaseSetupError(error);
  }

  return data || null;
};

export const createSellerService = async (sellerId, serviceData = {}) => {
  if (!sellerId) throw new Error('Missing seller ID.');

  const sqlPriceType = normalizeServicePriceType(serviceData.priceType);
  const pricingModel = getServicePricingModel(serviceData);
  const mergedMetadata = {
    ...(serviceData.metadata || {}),
    pricing_model: pricingModel,
  };

  const payload = {
    seller_id: sellerId,
    title: getNullableString(serviceData.title) || 'Untitled Service',
    slug: getNullableString(serviceData.slug) || `service-${Date.now()}`,
    description: getNullableString(serviceData.description),
    short_description: getNullableString(serviceData.shortDescription),
    price_type: sqlPriceType,
    base_price: getNullableNumber(serviceData.basePrice),
    currency: getCleanString(serviceData.currency) || 'PHP',
    duration_minutes: getNullableNumber(serviceData.durationMinutes),
    active: true,
    metadata: mergedMetadata,
  };

  const { data, error } = await supabase
    .from('services')
    .insert([payload])
    .select('*')
    .single();

  if (error) throw toReadableDatabaseSetupError(error);

  return data;
};

const buildDefaultServiceFromOnboarding = (source = {}) => {
  const serviceLabel = getNullableString(source.serviceType || source.customServiceType) || 'Service';
  const serviceTitle = getNullableString(source.fullName || source.full_name) || serviceLabel;
  const bookingMode = getNullableString(source.bookingMode) || 'with-slots';
  const rateBasis = getCleanString(source.rateBasis) || 'per-project';
  const pricingModel = getServicePricingModel(source);
  const basePrice =
    getNullableNumber(source.fixedPrice)
    || getNullableNumber(source.hourlyRate)
    || getNullableNumber(source.dailyRate)
    || getNullableNumber(source.weeklyRate)
    || getNullableNumber(source.monthlyRate)
    || getNullableNumber(source.projectRate)
    || null;

  return {
    title: serviceTitle,
    slug: `default-${serviceTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now()}`,
    shortDescription: getNullableString(source.bio) || serviceLabel,
    description: getNullableString(source.bio) || serviceLabel,
    priceType: pricingModel === 'inquiry' ? 'custom' : 'fixed',
    basePrice,
    currency: 'PHP',
    durationMinutes: null,
    metadata: {
      pricing_model: pricingModel,
      booking_mode: bookingMode,
      rate_basis: rateBasis,
    },
  };
};

export const syncWorkerSetup = async (userId, source = {}) => {
  if (!userId) throw new Error('Missing user ID for worker setup.');

  // ============================================================================
  // STEP 1: Update profiles table (basic account info)
  // ============================================================================
  const profilePayload = {
    user_id: userId,
    full_name: getNullableString(source.fullName || source.full_name) || 'Service Provider',
    is_worker: true,
    role: 'worker',
    updated_at: getTimestamp(),
  };

  const { error: profileError } = await supabase
    .from('profiles')
    .update(profilePayload)
    .eq('user_id', userId);

  if (profileError) throw toReadableDatabaseSetupError(profileError);

  // ============================================================================
  // STEP 2: Update worker_profiles table (worker-specific details)
  // ============================================================================
  const workerPayload = buildWorkerProfilePayload(userId, source);
  const { error: workerError } = await supabase
    .from('worker_profiles')
    .upsert(workerPayload, { onConflict: 'user_id' });

  if (workerError) throw toReadableDatabaseSetupError(workerError);

  // ============================================================================
  // STEP 3: Update sellers table (public seller profile)
  // ============================================================================
  // Map onboarding data directly to sellers columns
  const sellerPhoto = getProfilePhotoUrl(getNullableString(source.profilePhoto || source.profile_photo) || buildDefaultProfileImageUrl(userId));
  const sellerPayload = {
    user_id: userId,
    display_name: getNullableString(source.fullName || source.full_name) || 'Service Provider',
    headline: getNullableString(source.serviceType || source.customServiceType) || 'Service Provider',
    tagline: getNullableString(source.bio) || null,
    about: getNullableString(source.bio) || null,
    is_verified: false,
    verification_status: 'pending',
    response_time_minutes: 1440,
    languages: ['en'],
    default_currency: 'PHP',
    business_hours: null,
    profile_photo: sellerPhoto,
    avatar_url: sellerPhoto,
    search_meta: {
      name: getNullableString(source.fullName || source.full_name) || 'Service Provider',
      service_type: getNullableString(source.serviceType || source.customServiceType) || null,
      bio: getNullableString(source.bio) || null,
      booking_mode: getNullableString(source.bookingMode) || null,
      location: {
        city: getNullableString(source.city) || null,
        province: getNullableString(source.province) || null,
      },
    },
    updated_at: getTimestamp(),
  };

  const { error: sellerError } = await supabase
    .from('sellers')
    .upsert(sellerPayload, { onConflict: 'user_id' });

  if (sellerError) throw toReadableDatabaseSetupError(sellerError);

  // ============================================================================
  // STEP 4: Ensure at least one service row exists for dashboard/My Work
  // ============================================================================
  const existingServices = await fetchSellerServices(userId);
  if (!existingServices || existingServices.length === 0) {
    const defaultServicePayload = buildDefaultServiceFromOnboarding(source);
    try {
      await createSellerService(userId, defaultServicePayload);
    } catch (serviceError) {
      console.error('Failed to create default service during worker setup:', serviceError);
    }
  }

  // ============================================================================
  // STEP 5: Fetch and return complete profile
  // ============================================================================
  return fetchUserProfileBundle(userId);
};

export const uploadProfilePhoto = async ({ userId, file }) => {
  if (!userId) throw new Error('Missing authenticated user.');
  if (!file) throw new Error('No profile photo file selected.');

  const fileType = String(file.type || '').toLowerCase();
  if (!fileType.startsWith('image/')) {
    throw new Error('Please upload a valid image file.');
  }

  const sanitizedName = String(file.name || 'profile-photo')
    .replace(/[^a-zA-Z0-9._-]/g, '-')
    .toLowerCase();
  const extension = sanitizedName.includes('.') ? sanitizedName.split('.').pop() : 'jpg';
  const filePath = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extension}`;

  const { error: uploadError } = await supabase
    .storage
    .from(PROFILE_PHOTO_BUCKET)
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: false,
      contentType: file.type || 'image/jpeg',
    });

  if (uploadError) {
    throw new Error(
      'Unable to upload profile photo to Supabase Storage. Ensure bucket "profile-photos" exists and has upload/read policies for authenticated users.'
    );
  }

  const { data: publicUrlData } = supabase
    .storage
    .from(PROFILE_PHOTO_BUCKET)
    .getPublicUrl(filePath);

  const publicUrl = publicUrlData?.publicUrl;
  if (!publicUrl) {
    throw new Error('Profile photo uploaded but no public URL was returned.');
  }

  return `${publicUrl}?v=${Date.now()}`;
};

export const uploadPortfolioDocument = async ({ userId, file }) => {
  if (!file) throw new Error('No portfolio document selected.');

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;

  const ownerId = userData?.user?.id || userId;
  if (!ownerId) throw new Error('Missing authenticated user.');

  const allowedTypes = [
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ];
  const fileType = String(file.type || '').toLowerCase();

  if (fileType && !allowedTypes.includes(fileType)) {
    throw new Error('Upload a PDF, DOC, DOCX, JPG, PNG, or WEBP document.');
  }

  if (file.size > 10 * 1024 * 1024) {
    throw new Error('Portfolio document is too large. Maximum size is 10 MB.');
  }

  const sanitizedName = String(file.name || 'portfolio-document')
    .replace(/[^a-zA-Z0-9._-]/g, '-')
    .toLowerCase();
  const filePath = `${ownerId}/documents/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${sanitizedName}`;

  const { error: uploadError } = await supabase
    .storage
    .from(PORTFOLIO_BUCKET)
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: false,
      contentType: file.type || 'application/octet-stream',
    });

  if (uploadError) {
    throw new Error(
      `Unable to upload portfolio document to Supabase Storage. Ensure bucket "portfolio" exists and allows authenticated uploads. ${uploadError.message || ''}`.trim()
    );
  }

  const { data: publicUrlData } = supabase
    .storage
    .from(PORTFOLIO_BUCKET)
    .getPublicUrl(filePath);

  const publicUrl = publicUrlData?.publicUrl;
  if (!publicUrl) {
    throw new Error('Portfolio document uploaded but no public URL was returned.');
  }

  return {
    name: file.name || sanitizedName,
    size: file.size,
    type: file.type || 'application/octet-stream',
    storagePath: filePath,
    publicUrl: `${publicUrl}?v=${Date.now()}`,
    uploadedAt: getTimestamp(),
  };
};
