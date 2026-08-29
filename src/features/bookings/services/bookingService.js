import { supabase } from '../../../shared/services/supabaseClient';
import { getProfilePhotoUrl } from '../../../shared/utils/profilePhoto';
import { calculateBookingPricing } from '../utils/bookingPricing';

const getCleanString = (value) => (typeof value === 'string' ? value.trim() : '');
const getNullableString = (value) => {
  const clean = getCleanString(value);
  return clean ? clean : null;
};

const getNumberOrNull = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const toArray = (value) => (Array.isArray(value) ? value : []);
const unique = (values) => Array.from(new Set(values.filter((value) => value !== null && value !== undefined && value !== '')));
const nowIso = () => new Date().toISOString();

const maybeSingleOrNull = (error) => {
  if (!error) return false;
  return error.code === 'PGRST116';
};

const mapDatabaseError = (error) => {
  if (!error) return error;
  const message = String(error.message || '');

  if (/row level security|permission denied/i.test(message)) {
    return new Error('Database permission denied. Please sign in again or check booking RLS policies.');
  }

  if (/relation.*does not exist|Could not find the table/i.test(message)) {
    return new Error('Database setup incomplete. The booking tables are missing or not applied to this Supabase project.');
  }

  return error;
};

const getAuthUser = async () => {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  return data?.user || null;
};

const getRequiredAuthUser = async () => {
  const user = await getAuthUser();
  if (!user?.id) throw new Error('Please sign in to access your bookings.');
  return user;
};

const participantFilter = (userId) => `buyer_id.eq.${userId},seller_id.eq.${userId}`;

const isBookingParticipant = (booking = {}, userId = '') => {
  const row = booking.raw?.booking || booking;
  return Boolean(
    userId
      && (
        String(row.buyer_id || booking.buyerId || '') === String(userId)
        || String(row.seller_id || booking.workerId || '') === String(userId)
      )
  );
};

const isConversationParticipant = (conversation = {}, userId = '') => (
  Boolean(
    userId
      && (
        String(conversation.buyer_id || '') === String(userId)
        || String(conversation.seller_id || '') === String(userId)
      )
  )
);

const toStringArray = (value) => {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === 'string' && value.trim()) return [value.trim()];
  return [];
};

const hasUserFlag = (metadata = {}, keys = [], userId = '') => (
  keys.some((key) => toStringArray(metadata?.[key]).some((value) => String(value) === String(userId)))
);

const isConversationHiddenForUser = (conversation = {}, userId = '') => {
  const metadata = conversation.metadata || {};
  return hasUserFlag(metadata, ['archived_by', 'archivedBy', 'deleted_by', 'deletedBy'], userId);
};

const isConversationDeletedForUser = (conversation = {}, userId = '') => {
  const metadata = conversation.metadata || {};
  return hasUserFlag(metadata, ['deleted_by', 'deletedBy'], userId);
};

const addUserFlag = (metadata = {}, snakeKey, camelKey, userId = '') => {
  const existing = new Set([
    ...toStringArray(metadata[snakeKey]),
    ...toStringArray(metadata[camelKey]),
  ]);
  if (userId) existing.add(String(userId));
  return Array.from(existing);
};

const removeUserFlag = (metadata = {}, snakeKey, camelKey, userId = '') => {
  const userIdString = String(userId);
  return Array.from(new Set([
    ...toStringArray(metadata[snakeKey]),
    ...toStringArray(metadata[camelKey]),
  ].filter((value) => String(value) !== userIdString)));
};

const getProfileNameFromUser = (user) => {
  const metadata = user?.user_metadata || {};
  return (
    getCleanString(metadata.full_name)
    || getCleanString([metadata.first_name, metadata.middle_name, metadata.last_name].filter(Boolean).join(' '))
    || getCleanString(metadata.name)
    || getCleanString(user?.email)
    || 'Client'
  );
};

const getServiceSeller = (service = {}) => service.sellers || service.seller || {};

const getServiceType = (service = {}, seller = {}) =>
  seller?.search_meta?.service_type
  || service?.metadata?.service_type
  || service?.metadata?.serviceType
  || service?.title
  || 'Service';

const getSellerName = (service = {}, seller = {}) =>
  seller?.display_name
  || seller?.search_meta?.name
  || service?.title
  || 'Service Provider';

const getRateAmount = (service = {}, metadata = {}) =>
  getNumberOrNull(metadata.quote_amount)
  ?? getNumberOrNull(metadata.quoteAmount)
  ?? getNumberOrNull(service?.base_price)
  ?? getNumberOrNull(service?.projectRate)
  ?? getNumberOrNull(service?.hourlyRate)
  ?? getNumberOrNull(service?.dailyRate)
  ?? getNumberOrNull(service?.weeklyRate)
  ?? getNumberOrNull(service?.monthlyRate)
  ?? 0;

const getServiceBookingMode = (service = {}, seller = {}, metadata = {}) => {
  const mode = getCleanString(
    metadata.booking_mode
    || metadata.bookingMode
    || service?.metadata?.booking_mode
    || service?.metadata?.bookingMode
    || seller?.booking_mode
    || seller?.search_meta?.booking_mode
    || ''
  ).toLowerCase();

  return mode === 'calendar-only' ? 'calendar-only' : 'with-slots';
};

export const getBookingModeLabel = (bookingMode) =>
  bookingMode === 'calendar-only' ? 'Request booking' : 'Time-slot booking';

const formatDate = (value) => {
  if (!value) return '';
  return String(value).slice(0, 10);
};

const formatTime = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(11, 16);
  return date.toTimeString().slice(0, 5);
};

const buildSelectedSlot = (booking = {}, metadata = {}) => {
  const saved = metadata.selected_slot || metadata.selectedSlot;
  if (saved?.date) return saved;

  if (!booking.start_ts && !booking.end_ts) return null;

  return {
    date: formatDate(booking.start_ts),
    dateKey: formatDate(booking.start_ts),
    slotId: booking.slot_id || null,
    timeBlock: {
      id: booking.slot_id || `booking-${booking.id}`,
      startTime: formatTime(booking.start_ts),
      endTime: formatTime(booking.end_ts),
      slotsLeft: 0,
    },
  };
};

const uiStatusFromDb = (booking = {}, metadata = {}) => {
  if (booking.dispute_status === 'open') return 'Dispute Open';
  if (booking.status === 'completed') return 'Completed Service';
  if (booking.status === 'refunded') return 'Refunded';
  if (booking.status === 'cancelled') {
    return metadata.payment_method === 'after-service-cash' ? 'Cancelled (Cash)' : 'Cancelled';
  }
  if (booking.delivery_status === 'seller_claimed') return 'Service Delivered';
  if (metadata.payment_method === 'gcash-advance') {
    if (booking.payment_status === 'paid') return 'Payment Confirmed';
    if (booking.payment_status === 'partially_paid') return 'Downpayment Paid';
    return 'Payment Pending';
  }
  if (metadata.ui_status) return metadata.ui_status;
  if (metadata.uiStatus) return metadata.uiStatus;

  if (metadata.refund_status === 'requested' || metadata.refund_status === 'approved-awaiting-client-confirmation') {
    return 'Refund Processing';
  }

  if (metadata.cash_confirmation_status === 'pending-worker-review') return 'Cash Verification Pending';
  if (metadata.cash_confirmation_status === 'denied') return 'Cash Verification Denied';

  switch (booking.status) {
    case 'pending':
      return metadata.quote_approved ? 'Awaiting Slot Selection' : 'Negotiating';
    case 'confirmed':
      return metadata.payment_method ? 'Service Scheduled' : 'Slot Selected - Payment Pending';
    case 'in_progress':
      return 'Active Service';
    case 'completed':
      return 'Completed Service';
    case 'cancelled':
      return metadata.payment_method === 'after-service-cash' ? 'Cancelled (Cash)' : 'Cancelled';
    case 'refunded':
      return 'Refunded';
    default:
      return 'Negotiating';
  }
};

const dbStatusFromUiStatus = (status, fallback = 'pending') => {
  switch (status) {
    case 'Awaiting Slot Selection':
    case 'Payment Pending':
    case 'Slot Selected - Payment Pending':
    case 'Quote Rejected':
    case 'Negotiating':
      return 'pending';
    case 'Service Scheduled':
    case 'Payment Confirmed':
    case 'Payment Submitted':
    case 'Cash Verification Pending':
    case 'Cash Verification Denied':
    case 'Refund Processing':
      return 'confirmed';
    case 'Active Service':
      return 'in_progress';
    case 'Completed Service':
    case 'Service Stopped':
      return 'completed';
    case 'Cancelled':
    case 'Cancelled (Cash)':
      return 'cancelled';
    case 'Refunded':
      return 'refunded';
    default:
      return fallback || 'pending';
  }
};

const normalizeReview = (reviewRows = [], bookingId) =>
  toArray(reviewRows).find((review) => String(review.booking_id) === String(bookingId)) || null;

export const mapBookingRowToUiBooking = (booking = {}, context = {}) => {
  const metadata = booking.metadata || {};
  const service = context.servicesById?.[booking.service_id] || booking.services || {};
  const seller = context.sellersById?.[booking.seller_id] || getServiceSeller(service) || {};
  const buyerProfile = context.profilesById?.[booking.buyer_id] || {};
  const review = normalizeReview(context.reviews || [], booking.id);
  const selectedSlot = buildSelectedSlot(booking, metadata);
  const paymentMethod = metadata.payment_method || metadata.paymentMethod || null;
  const cashStatus = metadata.cash_confirmation_status || metadata.cashConfirmationStatus || null;
  const refundStatus = metadata.refund_status || metadata.refundStatus || null;
  const mockPayment = metadata.mock_payment || metadata.mockPayment || null;
  const uiStatus = uiStatusFromDb(booking, metadata);
  const totalAmount = getRateAmount(service, { ...metadata, quote_amount: booking.total_amount ?? metadata.quote_amount });
  const fallbackPricing = calculateBookingPricing(totalAmount);
  const transactionFeeRate = getNumberOrNull(booking.transaction_fee_rate)
    ?? getNumberOrNull(mockPayment?.transactionFeeRate)
    ?? fallbackPricing.transactionFeeRate;
  const transactionFeeAmount = getNumberOrNull(booking.transaction_fee_amount)
    ?? getNumberOrNull(mockPayment?.transactionFeeAmount)
    ?? fallbackPricing.transactionFeeAmount;
  const totalChargedAmount = getNumberOrNull(booking.total_charged_amount)
    ?? getNumberOrNull(mockPayment?.totalChargedAmount)
    ?? fallbackPricing.totalChargedAmount;
  const bookingMode = getServiceBookingMode(service, seller, metadata);

  return {
    id: booking.id,
    buyerId: booking.buyer_id,
    sellerId: booking.seller_id,
    serviceId: booking.service_id,
    workerId: booking.seller_id,
    workerName: metadata.worker_name || metadata.workerName || metadata.seller_name || metadata.sellerName || getSellerName(service, seller),
    clientName: buyerProfile.full_name || metadata.client_name || metadata.clientName || metadata.buyer_name || metadata.buyerName || 'Client',
    clientPhoto: getProfilePhotoUrl(buyerProfile.profile_photo),
    serviceType: getServiceType(service, seller) || metadata.service_type || metadata.serviceType,
    status: uiStatus,
    requestDate: formatDate(booking.created_at) || formatDate(nowIso()),
    description: service.short_description || service.description || metadata.description || seller.about || 'Service booking',
    quoteAmount: totalAmount,
    bookingMode,
    bookingModeLabel: getBookingModeLabel(bookingMode),
    isRequestBooking: bookingMode === 'calendar-only',
    quoteApproved: metadata.quote_approved !== undefined ? Boolean(metadata.quote_approved) : booking.status !== 'pending',
    quoteRejectionReason: metadata.quote_rejection_reason || metadata.quoteRejectionReason || null,
    selectedSlot,
    paymentMethod,
    allowGcashAdvance: metadata.allow_gcash_advance !== false,
    allowAfterService: false,
    afterServicePaymentType: 'gcash-only',
    gcashNumber: metadata.gcash_number || '',
    qrImageUrl: metadata.qr_image_url || '',
    paymentProofSubmitted: Boolean(metadata.payment_proof_submitted || metadata.paymentProofSubmitted),
    paymentReference: booking.payment_reference || metadata.payment_reference || '',
    transactionId: metadata.transaction_id || booking.payment_reference || '',
    mockPayment,
    transactionFeeRate,
    transactionFeePercent: `${Number((transactionFeeRate * 100).toFixed(2))}%`,
    transactionFeeAmount,
    totalChargedAmount,
    deliveryStatus: booking.delivery_status || (booking.status === 'completed' ? 'buyer_confirmed' : 'not_delivered'),
    paymentStatus: booking.payment_status || (booking.payment_reference ? 'paid' : 'unpaid'),
    paymentPlan: booking.payment_plan || 'full',
    serviceDownpaymentAmount: getNumberOrNull(booking.service_downpayment_amount) ?? 0,
    upfrontRequiredAmount: getNumberOrNull(booking.upfront_required_amount) ?? totalChargedAmount,
    amountPaid: getNumberOrNull(booking.amount_paid) ?? (booking.payment_status === 'paid' ? totalChargedAmount : 0),
    balanceDueAmount: getNumberOrNull(booking.balance_due_amount) ?? 0,
    cashCollectionStatus: booking.cash_collection_status || 'not_applicable',
    disputeStatus: booking.dispute_status || 'none',
    scheduleVersion: booking.schedule_version || 1,
    deliveredAt: booking.delivered_at || null,
    completionDueAt: booking.completion_due_at || null,
    completedAt: booking.completed_at || null,
    disputeDeadlineAt: booking.dispute_deadline_at || null,
    cashConfirmationStatus: cashStatus,
    cashVerifierQrId: metadata.cash_verifier_qr_id || metadata.cashVerifierQrId || (booking.id ? `CASHQR-${booking.id}` : ''),
    submittedCashAmount: metadata.submitted_cash_amount ?? metadata.submittedCashAmount ?? null,
    expectedCashAmount: totalChargedAmount,
    refundEligible: metadata.refund_eligible ?? (paymentMethod === 'gcash-advance' && booking.status === 'completed'),
    refundStatus,
    refundAmount: metadata.refund_amount ?? metadata.refundAmount ?? null,
    refundReason: metadata.refund_reason || metadata.refundReason || '',
    refundReference: metadata.refund_reference || metadata.refundReference || '',
    canRate: booking.status === 'completed' && !review,
    rating: review?.rating || metadata.rating || null,
    review: review?.body || metadata.review || '',
    reviewImageUrl: review?.image_url || metadata.review_image_url || '',
    billingCycle: metadata.billing_cycle || metadata.billingCycle || null,
    serviceActive: metadata.service_active ?? metadata.serviceActive ?? booking.status === 'in_progress',
    stopRequested: Boolean(metadata.stop_requested || metadata.stopRequested),
    workerStopApproved: Boolean(metadata.worker_stop_approved || metadata.workerStopApproved),
    raw: {
      booking,
      service,
      seller,
      review,
      metadata,
    },
  };
};

const fetchRowsByIds = async (table, column, ids, select = '*') => {
  const cleanIds = unique(ids);
  if (cleanIds.length === 0) return [];

  const { data, error } = await supabase
    .from(table)
    .select(select)
    .in(column, cleanIds);

  if (error && !maybeSingleOrNull(error)) throw mapDatabaseError(error);
  return data || [];
};

export const hydrateBookingRows = async (bookingRows = []) => {
  const rows = toArray(bookingRows);
  if (rows.length === 0) return [];

  const serviceIds = unique(rows.map((row) => row.service_id));
  const sellerIds = unique(rows.map((row) => row.seller_id));
  const buyerIds = unique(rows.map((row) => row.buyer_id));
  const bookingIds = unique(rows.map((row) => row.id));

  const [services, sellers, buyerProfiles, reviews] = await Promise.all([
    fetchRowsByIds('services', 'id', serviceIds, '*'),
    fetchRowsByIds('sellers', 'user_id', sellerIds, '*'),
    fetchRowsByIds('profiles', 'user_id', buyerIds, 'user_id, full_name, profile_photo'),
    fetchRowsByIds('reviews', 'booking_id', bookingIds, '*'),
  ]);

  const servicesById = Object.fromEntries(services.map((row) => [row.id, row]));
  const sellersById = Object.fromEntries(sellers.map((row) => [row.user_id, row]));
  const profilesById = Object.fromEntries(buyerProfiles.map((row) => [row.user_id, row]));

  return rows.map((row) => mapBookingRowToUiBooking(row, { servicesById, sellersById, profilesById, reviews }));
};

export const hydrateConversationRows = async (conversationRows = []) => {
  const rows = toArray(conversationRows);
  if (rows.length === 0) return [];

  const sellerIds = unique(rows.map((row) => row.seller_id));
  const buyerIds = unique(rows.map((row) => row.buyer_id));

  const [sellers, buyerProfiles] = await Promise.all([
    fetchRowsByIds('sellers', 'user_id', sellerIds, '*'),
    fetchRowsByIds('profiles', 'user_id', buyerIds, 'user_id, full_name, profile_photo'),
  ]);

  const sellersById = Object.fromEntries(sellers.map((row) => [row.user_id, row]));
  const profilesById = Object.fromEntries(buyerProfiles.map((row) => [row.user_id, row]));

  return rows.map((row) => mapConversationRowToUiChat(row, { sellersById, profilesById }));
};

const isReadByUser = (readBy, userId) => {
  if (!userId) return false;
  const userIdString = String(userId);

  if (Array.isArray(readBy)) {
    return readBy.some((value) => String(value) === userIdString);
  }

  if (typeof readBy === 'string') {
    try {
      return isReadByUser(JSON.parse(readBy), userId);
    } catch (error) {
      return false;
    }
  }

  if (readBy && typeof readBy === 'object') {
    return Object.values(readBy).some((value) => String(value) === userIdString);
  }

  return false;
};

const isUnreadForUser = (message = {}, userId) => (
  Boolean(userId)
  && String(message.sender_id || '') !== String(userId)
  && !isReadByUser(message.read_by, userId)
);

export const fetchBookingsForUser = async ({ userId, role = 'buyer' } = {}) => {
  if (!userId) return [];

  const column = role === 'seller' ? 'seller_id' : 'buyer_id';
  const { data, error } = await supabase
    .from('bookings')
    .select('*')
    .eq(column, userId)
    .order('updated_at', { ascending: false });

  if (error) throw mapDatabaseError(error);
  return hydrateBookingRows(data || []);
};

export const fetchStandaloneConversationsForUser = async ({ userId, role = 'buyer' } = {}) => {
  if (!userId) return [];

  const column = role === 'seller' ? 'seller_id' : 'buyer_id';
  const { data, error } = await supabase
    .from('conversations')
    .select('*')
    .eq(column, userId)
    .is('booking_id', null)
    .order('created_at', { ascending: false });

  if (error) throw mapDatabaseError(error);
  return hydrateConversationRows((data || []).filter((row) => !isConversationHiddenForUser(row, userId)));
};

export const fetchClientBookings = async ({ includeStandaloneChats = false } = {}) => {
  const user = await getAuthUser();
  if (!user?.id) return [];
  const bookings = await fetchBookingsForUser({ userId: user.id, role: 'buyer' });
  if (!includeStandaloneChats) return bookings;

  const bookingIds = unique(bookings.map((booking) => booking.id));
  let hiddenBookingIds = new Set();

  if (bookingIds.length > 0) {
    const { data: bookingConversations, error: conversationError } = await supabase
      .from('conversations')
      .select('booking_id, metadata')
      .in('booking_id', bookingIds)
      .or(participantFilter(user.id));

    if (conversationError) throw mapDatabaseError(conversationError);
    hiddenBookingIds = new Set((bookingConversations || [])
      .filter((row) => row.booking_id && isConversationHiddenForUser(row, user.id))
      .map((row) => String(row.booking_id)));
  }

  const conversations = await fetchStandaloneConversationsForUser({ userId: user.id, role: 'buyer' });
  return [...conversations, ...bookings.filter((booking) => !hiddenBookingIds.has(String(booking.id)))];
};

export const fetchClientDashboardSnapshot = async () => {
  const user = await getAuthUser();
  if (!user?.id) {
    return {
      user: null,
      bookings: [],
      conversations: [],
      messages: [],
      unreadMessageCount: 0,
    };
  }

  const bookings = await fetchBookingsForUser({ userId: user.id, role: 'buyer' });
  const bookingIds = unique(bookings.map((booking) => booking.id));

  if (bookingIds.length === 0) {
    return {
      user,
      bookings,
      conversations: [],
      messages: [],
      unreadMessageCount: 0,
    };
  }

  const { data: recentMessageRows, error: recentMessagesError } = await supabase
    .from('messages')
    .select('*, conversation:conversations!inner(*)')
    .in('conversation.booking_id', bookingIds)
    .order('created_at', { ascending: false })
    .limit(80);

  if (recentMessagesError) throw mapDatabaseError(recentMessagesError);

  const conversationsById = new Map();
  const messages = (recentMessageRows || []).map((row) => {
    const { conversation, conversations, ...message } = row;
    const embeddedConversation = conversation || conversations || null;

    if (embeddedConversation?.id) {
      conversationsById.set(String(embeddedConversation.id), embeddedConversation);
    }

    return message;
  });
  const conversations = Array.from(conversationsById.values());
  let unreadMessageCount = messages.filter((message) => isUnreadForUser(message, user.id)).length;

  const { count, error: unreadCountError } = await supabase
    .from('messages')
    .select('id, conversation:conversations!inner(id, booking_id)', { count: 'exact', head: true })
    .in('conversation.booking_id', bookingIds)
    .neq('sender_id', user.id)
    .not('read_by', 'cs', JSON.stringify([user.id]));

  if (!unreadCountError && typeof count === 'number') {
    unreadMessageCount = count;
  }

  return {
    user,
    bookings,
    conversations,
    messages,
    unreadMessageCount,
  };
};

export const mapConversationRowToUiChat = (conversation = {}, context = {}) => {
  const metadata = conversation.metadata || {};
  const seller = context.sellersById?.[conversation.seller_id] || {};
  const buyerProfile = context.profilesById?.[conversation.buyer_id] || {};

  return {
    id: `conversation:${conversation.id}`,
    conversationId: conversation.id,
    isStandaloneChat: true,
    buyerId: conversation.buyer_id,
    sellerId: conversation.seller_id,
    serviceId: metadata.service_id || null,
    workerId: conversation.seller_id,
    workerName: metadata.worker_name || metadata.workerName || metadata.seller_name || metadata.sellerName || seller.display_name || seller.search_meta?.name || 'Service Provider',
    clientName: buyerProfile.full_name || metadata.client_name || metadata.clientName || metadata.buyer_name || metadata.buyerName || 'Client',
    clientPhoto: getProfilePhotoUrl(buyerProfile.profile_photo),
    serviceType: metadata.service_type || metadata.serviceType || metadata.service_title || metadata.serviceTitle || seller.search_meta?.service_type || seller.headline || 'Conversation',
    status: metadata.ui_status || 'Chat',
    requestDate: formatDate(conversation.created_at) || formatDate(nowIso()),
    description: metadata.description || seller.about || 'Provider conversation',
    quoteAmount: getNumberOrNull(metadata.quote_amount) ?? 0,
    bookingMode: 'conversation',
    bookingModeLabel: 'Chat only',
    isRequestBooking: true,
    quoteApproved: false,
    quoteRejectionReason: null,
    selectedSlot: null,
    paymentMethod: null,
    allowGcashAdvance: false,
    allowAfterService: false,
    afterServicePaymentType: 'both',
    refundEligible: false,
    canRate: false,
    raw: {
      conversation,
      seller,
      metadata,
    },
  };
};

export const fetchSellerBookings = async (sellerId, { includeStandaloneChats = false } = {}) => {
  const userId = sellerId || (await getAuthUser())?.id;
  if (!userId) return [];
  const bookings = await fetchBookingsForUser({ userId, role: 'seller' });
  if (!includeStandaloneChats) return bookings;

  const bookingIds = unique(bookings.map((booking) => booking.id));
  let hiddenBookingIds = new Set();

  if (bookingIds.length > 0) {
    const { data: bookingConversations, error: conversationError } = await supabase
      .from('conversations')
      .select('booking_id, metadata')
      .in('booking_id', bookingIds)
      .or(participantFilter(userId));

    if (conversationError) throw mapDatabaseError(conversationError);
    hiddenBookingIds = new Set((bookingConversations || [])
      .filter((row) => row.booking_id && isConversationHiddenForUser(row, userId))
      .map((row) => String(row.booking_id)));
  }

  const conversations = await fetchStandaloneConversationsForUser({ userId, role: 'seller' });
  return [...conversations, ...bookings.filter((booking) => !hiddenBookingIds.has(String(booking.id)))];
};

export const fetchBookingById = async (bookingId) => {
  if (!bookingId) return null;
  const user = await getRequiredAuthUser();

  const { data, error } = await supabase
    .from('bookings')
    .select('*')
    .eq('id', bookingId)
    .or(participantFilter(user.id))
    .maybeSingle();

  if (error && !maybeSingleOrNull(error)) throw mapDatabaseError(error);
  const [mapped] = await hydrateBookingRows(data ? [data] : []);
  return mapped || null;
};

export const fetchConversationById = async (conversationId) => {
  if (!conversationId) return null;
  const user = await getRequiredAuthUser();

  const { data, error } = await supabase
    .from('conversations')
    .select('*')
    .eq('id', conversationId)
    .or(participantFilter(user.id))
    .maybeSingle();

  if (error && !maybeSingleOrNull(error)) throw mapDatabaseError(error);
  const [mapped] = await hydrateConversationRows(data ? [data] : []);
  return mapped || null;
};

export const startServiceConversation = async ({ provider, assistantContext = null } = {}) => {
  const user = await getRequiredAuthUser();
  const rawService = provider?.rawService || {};
  const seller = getServiceSeller(rawService);
  const sellerId = rawService.seller_id || provider?.sellerId || seller.user_id;
  const serviceId = rawService.id || provider?.serviceId;

  if (!sellerId) {
    throw new Error('Unable to start chat because the selected worker is missing a seller ID.');
  }

  const metadata = {
    source: 'marketplace-chat',
    service_id: serviceId || null,
    worker_name: provider?.name || getSellerName(rawService, seller),
    client_name: getProfileNameFromUser(user),
    service_type: provider?.serviceType || getServiceType(rawService, seller),
    description: provider?.description || rawService.short_description || rawService.description || '',
    quote_amount: getRateAmount(rawService),
    booking_mode: provider?.bookingMode || getServiceBookingMode(rawService, seller, rawService.metadata || {}),
    assistant_context: assistantContext || null,
    ui_status: 'Chat',
  };

  const { data: existingRows, error: existingError } = await supabase
    .from('conversations')
    .select('*')
    .eq('seller_id', sellerId)
    .eq('buyer_id', user.id)
    .is('booking_id', null)
    .order('created_at', { ascending: false })
    .limit(20);

  if (existingError) throw mapDatabaseError(existingError);

  const existing = (existingRows || []).find((row) => !isConversationDeletedForUser(row, user.id));

  if (existing) {
    const { data: updated, error: updateError } = await supabase
      .from('conversations')
      .update({
        metadata: {
          ...(existing.metadata || {}),
          ...metadata,
          archived_by: removeUserFlag(existing.metadata || {}, 'archived_by', 'archivedBy', user.id),
          deleted_by: removeUserFlag(existing.metadata || {}, 'deleted_by', 'deletedBy', user.id),
          reopened_at: nowIso(),
        },
      })
      .eq('id', existing.id)
      .select('*')
      .single();

    if (updateError) throw mapDatabaseError(updateError);
    const [mapped] = await hydrateConversationRows([updated]);
    return mapped;
  }

  const { data, error } = await supabase
    .from('conversations')
    .insert([{
      booking_id: null,
      seller_id: sellerId,
      buyer_id: user.id,
      metadata,
    }])
    .select('*')
    .single();

  if (error) throw mapDatabaseError(error);
  const [mapped] = await hydrateConversationRows([data]);
  return mapped;
};

export const startServiceConversationByServiceId = async ({
  serviceId,
  assistantContext = null,
} = {}) => {
  if (!serviceId) throw new Error('Select a worker before starting a chat.');

  const { data, error } = await supabase
    .from('services')
    .select('*, sellers(*)')
    .eq('id', serviceId)
    .eq('active', true)
    .maybeSingle();

  if (error && !maybeSingleOrNull(error)) throw mapDatabaseError(error);
  if (!data) throw new Error('This worker listing is no longer available.');

  const seller = getServiceSeller(data);
  const provider = {
    id: data.id,
    serviceId: data.id,
    rawService: data,
    name: getSellerName(data, seller),
    serviceType: getServiceType(data, seller),
    description: data.short_description || data.description || seller.about || '',
    bookingMode: getServiceBookingMode(data, seller, data.metadata || {}),
  };

  return startServiceConversation({ provider, assistantContext });
};

const getBookingParticipantIds = (booking = {}, userId = '') => {
  const row = booking.raw?.booking || {};
  return {
    buyerId: row.buyer_id || booking.buyerId || userId,
    sellerId: row.seller_id || booking.workerId,
  };
};

const getMessageSenderRole = (message = {}, booking = {}) => {
  const row = booking.raw?.booking || {};
  const buyerId = row.buyer_id || booking.buyerId || booking.clientId;
  const sellerId = row.seller_id || booking.sellerId || booking.workerId;

  if (message.sender_id && buyerId && String(message.sender_id) === String(buyerId)) return 'client';
  if (message.sender_id && sellerId && String(message.sender_id) === String(sellerId)) return 'worker';

  // Persisted chat messages always come from a participant. Reserve the centered
  // system treatment for messages the UI explicitly creates as system messages.
  return 'client';
};

export const mapMessageRowToUiMessage = (message = {}, booking = {}) => {
  const attachments = message.attachments || {};
  const body = message.body ?? message.content ?? '';
  const sender = getMessageSenderRole(message, booking);

  if (attachments?.type === 'quote' || message.message_type === 'quote') {
    const quotePayload = attachments?.type === 'quote'
      ? attachments
      : {
          amount: booking.quoteAmount,
          description: body,
          note: message.attachment_url || '',
        };
    return {
      id: message.id,
      sender,
      type: 'quote',
      content: {
        amount: quotePayload.amount,
        description: quotePayload.description || body || booking.description,
        deliveryTime: quotePayload.deliveryTime || '',
        note: quotePayload.note || '',
      },
      timestamp: message.created_at
        ? new Date(message.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
        : '',
      raw: message,
    };
  }

  return {
    id: message.id,
    sender,
    type: 'text',
    content: body || '',
    timestamp: message.created_at
      ? new Date(message.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
      : '',
    raw: message,
  };
};

export const ensureBookingConversation = async (bookingOrId) => {
  if (typeof bookingOrId === 'object' && bookingOrId?.isStandaloneChat) {
    const user = await getRequiredAuthUser();
    const conversation = bookingOrId.raw?.conversation || null;

    if (!conversation?.id || !isConversationParticipant(conversation, user.id)) {
      throw new Error('You can only open conversations for your own chats.');
    }

    return { conversation, booking: bookingOrId, user };
  }

  if (typeof bookingOrId === 'string' && bookingOrId.startsWith('conversation:')) {
    const chat = await fetchConversationById(bookingOrId.replace(/^conversation:/, ''));
    if (!chat) throw new Error('Missing conversation.');
    return ensureBookingConversation(chat);
  }

  const booking = typeof bookingOrId === 'object' ? bookingOrId : await fetchBookingById(bookingOrId);
  if (!booking?.id) throw new Error('Missing booking for conversation.');

  const user = await getRequiredAuthUser();
  if (!isBookingParticipant(booking, user.id)) {
    throw new Error('You can only open conversations for your own bookings.');
  }

  const { data: existing, error: selectError } = await supabase
    .from('conversations')
    .select('*')
    .eq('booking_id', booking.id)
    .maybeSingle();

  if (selectError && !maybeSingleOrNull(selectError)) throw mapDatabaseError(selectError);
  if (existing) return { conversation: existing, booking, user };

  const { buyerId, sellerId } = getBookingParticipantIds(booking, user.id);
  if (!buyerId || !sellerId) {
    throw new Error('Unable to create conversation because booking participant IDs are missing.');
  }

  const { data, error } = await supabase
    .from('conversations')
    .insert([{
      booking_id: booking.id,
      seller_id: sellerId,
      buyer_id: buyerId,
      metadata: { source: 'booking-workflow' },
    }])
    .select('*')
    .single();

  if (error) throw mapDatabaseError(error);
  return { conversation: data, booking, user };
};

export const fetchBookingMessages = async (bookingOrId) => {
  const { conversation, booking } = await ensureBookingConversation(bookingOrId);

  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('conversation_id', conversation.id)
    .order('created_at', { ascending: true });

  if (error) throw mapDatabaseError(error);
  return (data || []).map((row) => mapMessageRowToUiMessage(row, booking));
};

export const sendBookingMessage = async (bookingOrId, body, attachments = null) => {
  const cleanBody = getNullableString(body);
  if (!cleanBody && !attachments) throw new Error('Enter a message before sending.');

  const { conversation, booking, user } = await ensureBookingConversation(bookingOrId);
  const insertPayload = {
    conversation_id: conversation.id,
    sender_id: user.id,
    body: cleanBody,
    attachments,
  };

  let { data, error } = await supabase
    .from('messages')
    .insert([insertPayload])
    .select('*')
    .single();

  if (error && /body|attachments|Could not find.*column|schema cache/i.test(String(error.message || ''))) {
    const fallbackPayload = {
      conversation_id: conversation.id,
      sender_id: user.id,
      content: cleanBody || attachments?.description || '',
      message_type: attachments?.type === 'quote' ? 'quote' : 'text',
      attachment_url: attachments?.public_url || attachments?.url || null,
    };

    const fallbackResult = await supabase
      .from('messages')
      .insert([fallbackPayload])
      .select('*')
      .single();

    data = fallbackResult.data;
    error = fallbackResult.error;
  }

  if (error) throw mapDatabaseError(error);
  return mapMessageRowToUiMessage(data, booking);
};

export const archiveConversationThread = async (bookingOrChat, mode = 'archive') => {
  const { conversation, booking, user } = await ensureBookingConversation(bookingOrChat);
  const currentMetadata = conversation.metadata || {};
  const isDelete = mode === 'delete';
  const nextMetadata = {
    ...currentMetadata,
    ...(isDelete
      ? {
        deleted_by: addUserFlag(currentMetadata, 'deleted_by', 'deletedBy', user.id),
        deleted_at_by: {
          ...(currentMetadata.deleted_at_by || currentMetadata.deletedAtBy || {}),
          [user.id]: nowIso(),
        },
      }
      : {
        archived_by: addUserFlag(currentMetadata, 'archived_by', 'archivedBy', user.id),
        archived_at_by: {
          ...(currentMetadata.archived_at_by || currentMetadata.archivedAtBy || {}),
          [user.id]: nowIso(),
        },
      }),
  };

  const { data, error } = await supabase
    .from('conversations')
    .update({ metadata: nextMetadata })
    .eq('id', conversation.id)
    .or(participantFilter(user.id))
    .select('*')
    .single();

  if (error) throw mapDatabaseError(error);

  return {
    ...booking,
    raw: {
      ...(booking.raw || {}),
      conversation: data,
      metadata: data?.metadata || nextMetadata,
    },
  };
};

const snakeMetadataFromUpdates = (updates = {}) => {
  const metadata = {};

  if (updates.status !== undefined) metadata.ui_status = updates.status;
  if (updates.quoteApproved !== undefined) metadata.quote_approved = Boolean(updates.quoteApproved);
  if (updates.quoteRejectionReason !== undefined) metadata.quote_rejection_reason = updates.quoteRejectionReason || null;
  if (updates.selectedSlot !== undefined) metadata.selected_slot = updates.selectedSlot || null;
  if (updates.paymentMethod !== undefined) metadata.payment_method = updates.paymentMethod || null;
  if (updates.paymentProofSubmitted !== undefined) metadata.payment_proof_submitted = Boolean(updates.paymentProofSubmitted);
  if (updates.canRate !== undefined) metadata.can_rate = Boolean(updates.canRate);
  if (updates.lastChargeDate !== undefined) metadata.last_charge_date = updates.lastChargeDate || null;
  if (updates.nextChargeDate !== undefined) metadata.next_charge_date = updates.nextChargeDate || null;
  if (updates.cashConfirmationStatus !== undefined) metadata.cash_confirmation_status = updates.cashConfirmationStatus || null;
  if (updates.cashVerifierQrId !== undefined) metadata.cash_verifier_qr_id = updates.cashVerifierQrId || null;
  if (updates.submittedCashAmount !== undefined) metadata.submitted_cash_amount = getNumberOrNull(updates.submittedCashAmount);
  if (updates.expectedCashAmount !== undefined) metadata.expected_cash_amount = getNumberOrNull(updates.expectedCashAmount);
  if (updates.transactionId !== undefined) metadata.transaction_id = updates.transactionId || '';
  if (updates.refundStatus !== undefined) metadata.refund_status = updates.refundStatus || null;
  if (updates.refundReason !== undefined) metadata.refund_reason = updates.refundReason || '';
  if (updates.refundAmount !== undefined) metadata.refund_amount = getNumberOrNull(updates.refundAmount);
  if (updates.refundReference !== undefined) metadata.refund_reference = updates.refundReference || '';
  if (updates.serviceActive !== undefined) metadata.service_active = Boolean(updates.serviceActive);
  if (updates.stopRequested !== undefined) metadata.stop_requested = Boolean(updates.stopRequested);
  if (updates.workerStopApproved !== undefined) metadata.worker_stop_approved = Boolean(updates.workerStopApproved);
  if (updates.rating !== undefined) metadata.rating = updates.rating;
  if (updates.review !== undefined) metadata.review = updates.review || '';
  if (updates.mockPayment !== undefined) metadata.mock_payment = updates.mockPayment || null;

  return metadata;
};

export const updateBookingWorkflow = async (bookingOrId, updates = {}) => {
  const current = typeof bookingOrId === 'object' ? bookingOrId : await fetchBookingById(bookingOrId);
  if (!current?.id) throw new Error('Missing booking to update.');
  const user = await getRequiredAuthUser();
  if (!isBookingParticipant(current, user.id)) {
    throw new Error('You can only update your own bookings.');
  }

  const currentRow = current.raw?.booking || {};
  const currentMetadata = current.raw?.metadata || currentRow.metadata || {};
  const nextMetadata = {
    ...currentMetadata,
    ...snakeMetadataFromUpdates(updates),
    updated_via: 'web-client',
    updated_at: nowIso(),
  };

  const nextStatus = updates.dbStatus || (
    updates.status !== undefined
      ? dbStatusFromUiStatus(updates.status, currentRow.status)
      : currentRow.status
  );

  const payload = {
    status: nextStatus,
    metadata: nextMetadata,
    updated_at: nowIso(),
  };

  if (updates.paymentReference !== undefined) {
    payload.payment_reference = updates.paymentReference || null;
    nextMetadata.payment_reference = updates.paymentReference || '';
  }

  if (updates.totalAmount !== undefined || updates.quoteAmount !== undefined) {
    payload.total_amount = getNumberOrNull(updates.totalAmount ?? updates.quoteAmount);
    nextMetadata.quote_amount = payload.total_amount;
  }

  if (updates.selectedSlot?.slotId !== undefined) {
    payload.slot_id = updates.selectedSlot.slotId || null;
  }

  if (updates.selectedSlot?.startTs || updates.startTs) {
    payload.start_ts = updates.selectedSlot?.startTs || updates.startTs;
  }

  if (updates.selectedSlot?.endTs || updates.endTs) {
    payload.end_ts = updates.selectedSlot?.endTs || updates.endTs;
  }

  const { data, error } = await supabase
    .from('bookings')
    .update(payload)
    .eq('id', current.id)
    .or(participantFilter(user.id))
    .select('*')
    .single();

  if (error) throw mapDatabaseError(error);
  const [mapped] = await hydrateBookingRows([data]);
  return mapped;
};

export const createClientBooking = async ({ provider, pendingBooking, paymentMethod, mockPayment = null } = {}) => {
  const user = await getAuthUser();
  if (!user?.id) throw new Error('Please sign in before booking a service.');

  const rawService = provider?.rawService || pendingBooking?.rawService || {};
  const seller = getServiceSeller(rawService);
  const sellerId = rawService.seller_id || pendingBooking?.sellerId || seller.user_id;
  const serviceId = rawService.id || pendingBooking?.serviceId;

  if (!serviceId || !sellerId) {
    throw new Error('Unable to create booking because the selected service is missing database IDs.');
  }

  const selectedSlot = pendingBooking?.selectedSlot || {};
  const rawSlot = selectedSlot?.timeBlock?.rawSlot || selectedSlot?.rawSlot || null;
  const slotId = rawSlot?.id || selectedSlot?.slotId || null;
  const totalAmount = getNumberOrNull(pendingBooking?.quoteAmount) ?? getRateAmount(rawService);
  const totalChargedAmount = getNumberOrNull(mockPayment?.totalChargedAmount) ?? totalAmount;
  const uiStatus = paymentMethod === 'gcash-advance' ? 'Payment Pending' : 'Service Scheduled';
  const cashStatus = paymentMethod === 'after-service-cash' ? 'awaiting-client-scan' : null;
  const bookingMode = provider?.bookingMode === 'calendar-only' || pendingBooking?.bookingMode === 'calendar-only'
    ? 'calendar-only'
    : 'with-slots';
  const metadata = {
    ui_status: uiStatus,
    quote_approved: true,
    booking_mode: bookingMode,
    booking_mode_label: getBookingModeLabel(bookingMode),
    worker_name: pendingBooking?.workerName || getSellerName(rawService, seller),
    client_name: getProfileNameFromUser(user),
    service_type: pendingBooking?.serviceType || getServiceType(rawService, seller),
    description: pendingBooking?.description || rawService.short_description || rawService.description || '',
    quote_amount: totalAmount,
    selected_slot: selectedSlot,
    payment_method: paymentMethod,
    cash_confirmation_status: cashStatus,
    cash_verifier_qr_id: cashStatus ? `CASHQR-${slotId || serviceId}-${Date.now()}` : null,
    allow_gcash_advance: pendingBooking?.allowGcashAdvance !== false,
    allow_after_service: false,
    after_service_payment_type: 'gcash-only',
    expected_cash_amount: totalChargedAmount,
    refund_eligible: paymentMethod === 'gcash-advance',
    can_rate: false,
    created_via: 'marketplace',
    mock_payment: mockPayment,
    payment_plan: mockPayment?.paymentPlan || 'full',
  };

  const { data, error } = await supabase.rpc('create_service_booking', {
    p_service_id: serviceId,
    p_slot_id: slotId,
    p_payment_method: paymentMethod,
    p_total_amount: totalAmount,
    p_metadata: {
      ...metadata,
      payment_reference: mockPayment?.mockPaymentReference || null,
      transaction_id: mockPayment?.mockPaymentReference || null,
    },
  });

  if (error) throw mapDatabaseError(error);
  const [mapped] = await hydrateBookingRows([data]);
  return mapped;
};

export const createClientBookingRequest = async ({ provider, assistantContext = null } = {}) => {
  const user = await getAuthUser();
  if (!user?.id) throw new Error('Please sign in before requesting a booking.');

  const rawService = provider?.rawService || {};
  const seller = getServiceSeller(rawService);
  const sellerId = rawService.seller_id || seller.user_id;
  const serviceId = rawService.id || provider?.serviceId;

  if (!serviceId || !sellerId) {
    throw new Error('Unable to create request because the selected service is missing database IDs.');
  }

  const { data: existingRows, error: existingError } = await supabase
    .from('bookings')
    .select('*')
    .eq('service_id', serviceId)
    .eq('seller_id', sellerId)
    .eq('buyer_id', user.id)
    .eq('status', 'pending')
    .order('updated_at', { ascending: false })
    .limit(1);

  if (existingError) throw mapDatabaseError(existingError);
  if (existingRows?.[0]) {
    const [mapped] = await hydrateBookingRows([existingRows[0]]);
    return mapped;
  }

  const totalAmount = getRateAmount(rawService)
    || getNumberOrNull(provider?.hourlyRate)
    || getNumberOrNull(provider?.dailyRate)
    || getNumberOrNull(provider?.weeklyRate)
    || getNumberOrNull(provider?.monthlyRate)
    || getNumberOrNull(provider?.projectRate)
    || 0;
  const bookingMode = provider?.bookingMode === 'calendar-only' ? 'calendar-only' : 'with-slots';
  const metadata = {
    ui_status: 'Negotiating',
    quote_approved: false,
    booking_mode: bookingMode,
    booking_mode_label: getBookingModeLabel(bookingMode),
    booking_flow: bookingMode === 'calendar-only' ? 'request-booking' : 'worker-chat',
    worker_name: provider?.name || getSellerName(rawService, seller),
    client_name: getProfileNameFromUser(user),
    service_type: provider?.serviceType || getServiceType(rawService, seller),
    description: provider?.description || rawService.short_description || rawService.description || '',
    quote_amount: totalAmount,
    selected_slot: null,
    payment_method: null,
    allow_gcash_advance: true,
    allow_after_service: true,
    after_service_payment_type: 'both',
    refund_eligible: false,
    can_rate: false,
    created_via: 'marketplace-request',
    assistant_context: assistantContext || null,
  };

  const { data, error } = await supabase
    .from('bookings')
    .insert([{
      service_id: serviceId,
      seller_id: sellerId,
      buyer_id: user.id,
      slot_id: null,
      start_ts: null,
      end_ts: null,
      status: 'pending',
      total_amount: totalAmount || null,
      currency: rawService.currency || 'PHP',
      payment_reference: null,
      metadata,
    }])
    .select('*')
    .single();

  if (error) throw mapDatabaseError(error);
  const [mapped] = await hydrateBookingRows([data]);
  return mapped;
};

export const createClientBookingRequestByServiceId = async ({
  serviceId,
  assistantContext = null,
} = {}) => {
  if (!serviceId) throw new Error('Select a worker before starting a booking.');

  const { data, error } = await supabase
    .from('services')
    .select('*, sellers(*)')
    .eq('id', serviceId)
    .eq('active', true)
    .maybeSingle();

  if (error && !maybeSingleOrNull(error)) throw mapDatabaseError(error);
  if (!data) throw new Error('This worker listing is no longer available.');

  const seller = getServiceSeller(data);
  const metadata = data.metadata || {};
  const rateBasis = metadata.rate_basis || metadata.rateBasis || data.price_type || 'per-project';
  const amount = getRateAmount(data, metadata);
  const provider = {
    id: data.id,
    serviceId: data.id,
    rawService: data,
    name: getSellerName(data, seller),
    serviceType: getServiceType(data, seller),
    description: data.short_description || data.description || seller.about || '',
    bookingMode: getServiceBookingMode(data, seller, metadata),
    rateBasis,
    hourlyRate: rateBasis === 'per-hour' || rateBasis === 'hourly' ? amount : null,
    dailyRate: rateBasis === 'per-day' || rateBasis === 'daily' ? amount : null,
    weeklyRate: rateBasis === 'per-week' || rateBasis === 'weekly' ? amount : null,
    monthlyRate: rateBasis === 'per-month' || rateBasis === 'monthly' ? amount : null,
    projectRate: !['per-hour', 'hourly', 'per-day', 'daily', 'per-week', 'weekly', 'per-month', 'monthly'].includes(rateBasis)
      ? amount
      : null,
  };

  return createClientBookingRequest({ provider, assistantContext });
};

const uploadReviewImage = async ({ file, userId, bookingId }) => {
  if (!file) return '';

  const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
  if (!allowedTypes.has(file.type)) {
    throw new Error('Review photo must be a JPG, PNG, or WebP image.');
  }
  if (file.size > 5 * 1024 * 1024) {
    throw new Error('Review photo must be 5 MB or smaller.');
  }

  const extension = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
  const objectPath = `${userId}/${bookingId}/${Date.now()}-review.${extension}`;
  const { error } = await supabase.storage
    .from('review-images')
    .upload(objectPath, file, { cacheControl: '3600', contentType: file.type, upsert: false });

  if (error) throw mapDatabaseError(error);

  const { data } = supabase.storage.from('review-images').getPublicUrl(objectPath);
  return data?.publicUrl || '';
};

export const submitBookingReview = async (bookingOrId, ratingValue, ratingComment = '', ratingImageFile = null) => {
  const current = typeof bookingOrId === 'object' ? bookingOrId : await fetchBookingById(bookingOrId);
  if (!current?.id) throw new Error('Missing booking to review.');

  const user = await getAuthUser();
  if (!user?.id) throw new Error('Please sign in before leaving a review.');

  const rating = Number(ratingValue);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    throw new Error('Rating must be between 1 and 5.');
  }

  const existingReview = current.raw?.review || null;
  const imageUrl = ratingImageFile
    ? await uploadReviewImage({ file: ratingImageFile, userId: user.id, bookingId: current.id })
    : existingReview?.image_url || '';
  const payload = {
    seller_id: current.workerId,
    reviewer_id: user.id,
    booking_id: current.id,
    rating,
    body: getNullableString(ratingComment),
    image_url: getNullableString(imageUrl),
    published: true,
    updated_at: nowIso(),
  };

  if (existingReview?.id) {
    const { error } = await supabase
      .from('reviews')
      .update(payload)
      .eq('id', existingReview.id);

    if (error) throw mapDatabaseError(error);
  } else {
    const { error } = await supabase
      .from('reviews')
      .insert([{ ...payload, title: null }]);

    if (error) throw mapDatabaseError(error);
  }

  const refreshed = await fetchBookingById(current.id);
  return { ...refreshed, rating, review: ratingComment, reviewImageUrl: imageUrl, canRate: false };
};

const buildWorkflowIdempotencyKey = (action, bookingId) => (
  `${action}-${String(bookingId).slice(0, 8)}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
);

const runBookingWorkflowRpc = async (functionName, bookingId, params = {}) => {
  const { data, error } = await supabase.rpc(functionName, {
    p_booking_id: bookingId,
    p_idempotency_key: params.idempotencyKey || buildWorkflowIdempotencyKey(functionName, bookingId),
    ...params.rpcParams,
  });
  if (error) throw mapDatabaseError(error);
  const [mapped] = await hydrateBookingRows([data]);
  return mapped;
};

export const markBookingDelivered = (bookingOrId, options = {}) => {
  const bookingId = typeof bookingOrId === 'object' ? bookingOrId?.id : bookingOrId;
  return runBookingWorkflowRpc('mark_booking_delivered', bookingId, options);
};

export const confirmBookingCompletion = (bookingOrId, options = {}) => {
  const bookingId = typeof bookingOrId === 'object' ? bookingOrId?.id : bookingOrId;
  return runBookingWorkflowRpc('confirm_booking_completion', bookingId, options);
};

export const acknowledgeCashPayment = (bookingOrId, options = {}) => {
  const bookingId = typeof bookingOrId === 'object' ? bookingOrId?.id : bookingOrId;
  return runBookingWorkflowRpc('acknowledge_cash_payment', bookingId, options);
};

export const openBookingDispute = (bookingOrId, reason, options = {}) => {
  const bookingId = typeof bookingOrId === 'object' ? bookingOrId?.id : bookingOrId;
  return runBookingWorkflowRpc('open_booking_dispute', bookingId, {
    ...options,
    rpcParams: { p_reason: reason },
  });
};

export const selectBookingPaymentPlan = (bookingOrId, paymentPlan, options = {}) => {
  const bookingId = typeof bookingOrId === 'object' ? bookingOrId?.id : bookingOrId;
  return runBookingWorkflowRpc('select_booking_payment_plan', bookingId, {
    ...options,
    rpcParams: { p_payment_plan: paymentPlan },
  });
};

export const submitCashConfirmation = async (bookingOrId, amount) => {
  const current = typeof bookingOrId === 'object' ? bookingOrId : await fetchBookingById(bookingOrId);
  const parsedAmount = Number(amount);
  const expectedAmount = Number(current?.totalChargedAmount || current?.expectedCashAmount || 0);

  if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
    throw new Error('Enter a valid cash amount before sending for worker review.');
  }

  if (expectedAmount > 0 && Math.abs(parsedAmount - expectedAmount) > 0.009) {
    throw new Error(`Cash amount must match the booking total of PHP ${expectedAmount.toFixed(2)}.`);
  }

  return updateBookingWorkflow(current, {
    cashConfirmationStatus: 'pending-worker-review',
    submittedCashAmount: parsedAmount,
    paymentProofSubmitted: true,
    transactionId: '',
    paymentReference: '',
    status: 'Cash Verification Pending',
    dbStatus: 'confirmed',
  });
};

export const reviewCashConfirmation = async (bookingOrId, decision) => {
  const current = typeof bookingOrId === 'object' ? bookingOrId : await fetchBookingById(bookingOrId);
  if (!current?.id) throw new Error('Missing booking for cash review.');

  if (decision === 'approve') {
    return runBookingWorkflowRpc('claim_cash_payment_collected', current.id, {
      rpcParams: {
        p_amount: Number(current.submittedCashAmount || current.totalChargedAmount || 0),
      },
    });
  }

  return updateBookingWorkflow(current, {
    cashConfirmationStatus: 'denied',
    transactionId: '',
    paymentReference: '',
    status: 'Cash Verification Denied',
    dbStatus: 'confirmed',
  });
};

export const requestBookingRefund = async (bookingOrId, reason) => {
  const current = typeof bookingOrId === 'object' ? bookingOrId : await fetchBookingById(bookingOrId);
  const refundReference = `REFUND-REQ-${String(current.id).slice(0, 8).toUpperCase()}-${Date.now().toString().slice(-4)}`;

  return updateBookingWorkflow(current, {
    status: 'Refund Processing',
    refundStatus: 'requested',
    refundReason: reason,
    refundReference,
    refundAmount: current.refundAmount || current.quoteAmount,
    dbStatus: 'confirmed',
  });
};

export const approveBookingRefund = async (bookingOrId) => {
  const current = typeof bookingOrId === 'object' ? bookingOrId : await fetchBookingById(bookingOrId);
  return updateBookingWorkflow(current, {
    status: 'Refund Processing',
    refundStatus: 'approved-awaiting-client-confirmation',
    refundReference: current.refundReference || buildRefundReference(current.id),
    refundAmount: current.refundAmount || current.quoteAmount,
    dbStatus: 'confirmed',
  });
};

export const confirmBookingRefundReceived = async (bookingOrId) => {
  const current = typeof bookingOrId === 'object' ? bookingOrId : await fetchBookingById(bookingOrId);
  return updateBookingWorkflow(current, {
    status: 'Refunded',
    refundStatus: 'approved',
    refundReference: current.refundReference || buildRefundReference(current.id),
    refundAmount: current.refundAmount || current.quoteAmount,
    dbStatus: 'refunded',
  });
};

export const parseDateOnly = (dateString) => {
  const date = new Date(dateString);
  date.setHours(0, 0, 0, 0);
  return date;
};

export const addDaysToDate = (dateString, days) => {
  const date = new Date(dateString);
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
};

export const isRecurringBilling = (booking) =>
  booking?.billingCycle === 'weekly' || booking?.billingCycle === 'monthly';

export const isBookingStopped = (booking) =>
  booking?.status === 'Service Stopped' || booking?.serviceActive === false;

export const isRecurringChargeDue = (booking) => {
  if (!isRecurringBilling(booking) || isBookingStopped(booking) || !booking?.nextChargeDate) return false;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return parseDateOnly(booking.nextChargeDate) <= today;
};

export const getBillingLabel = (booking) => {
  if (booking?.billingCycle === 'weekly') return 'Weekly';
  if (booking?.billingCycle === 'monthly') return 'Monthly';
  return null;
};

export const buildTransactionId = (bookingId, channel) => {
  const now = new Date();
  const dateStamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
  const suffix = String(Math.floor(Math.random() * 9000) + 1000);
  return `${String(channel).toUpperCase()}-TRX-${dateStamp}-${String(bookingId).slice(0, 8).toUpperCase()}-${suffix}`;
};

export const buildRefundReference = (bookingId) => {
  const now = new Date();
  const dateStamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
  return `REFUND-APR-${String(bookingId).slice(0, 8).toUpperCase()}-${dateStamp}`;
};

export const bookingService = {
  addDaysToDate,
  approveBookingRefund,
  archiveConversationThread,
  buildTransactionId,
  buildRefundReference,
  confirmBookingRefundReceived,
  confirmBookingCompletion,
  createClientBooking,
  createClientBookingRequest,
  createClientBookingRequestByServiceId,
  fetchBookingById,
  fetchBookingMessages,
  fetchClientBookings,
  fetchClientDashboardSnapshot,
  fetchConversationById,
  fetchSellerBookings,
  fetchStandaloneConversationsForUser,
  getBillingLabel,
  hydrateBookingRows,
  hydrateConversationRows,
  isBookingStopped,
  isRecurringBilling,
  isRecurringChargeDue,
  mapBookingRowToUiBooking,
  mapConversationRowToUiChat,
  mapMessageRowToUiMessage,
  markBookingDelivered,
  acknowledgeCashPayment,
  openBookingDispute,
  selectBookingPaymentPlan,
  parseDateOnly,
  requestBookingRefund,
  reviewCashConfirmation,
  sendBookingMessage,
  startServiceConversation,
  startServiceConversationByServiceId,
  submitBookingReview,
  submitCashConfirmation,
  updateBookingWorkflow,
};

export default bookingService;
