import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import {
  AlertCircle,
  CalendarCheck,
  CalendarDays,
  CalendarX2,
  CheckCircle2,
  Clock,
  CreditCard,
  Eye,
  Filter,
  MessageCircle,
  Receipt,
  RotateCcw,
  Search,
  ShieldCheck,
  Star,
} from 'lucide-react';
import DashboardNavigation from '../../../shared/components/DashboardNavigation';
import ChatWindow from '../components/ChatWindow';
import SlotSelectionModal from '../components/SlotSelectionModal';
import PaymentModal from '../components/PaymentModal';
import BookingTermsModal from '../components/BookingTermsModal';
import RatingModal from '../components/RatingModal';
import { BookingDetailsDialog } from '../components/BookingDetailsDialog';
import { BookingScopeSwitcher } from '../components/BookingScopeSwitcher';
import { Button } from '@/components/ui/button';
import { MetricCard } from '@/components/ui/metric-card';
import { SearchFilterBar } from '@/components/ui/search-filter-bar';
import { WorkflowEmptyState } from '@/components/ui/workflow-panel';
import { paths } from '@/app/router/routes';

import {
  useBookingListController,
  usePaymentController,
  useRefundController,
  useRatingController,
} from '../hooks';
import {
  acknowledgeCashPayment,
  archiveConversationThread,
  confirmBookingCompletion,
  fetchBookingById,
  markBookingDelivered,
} from '../services/bookingService';

const WORKER_ROLE_VALUES = new Set(['worker', 'workers', 'seller', 'sellers']);
const CLIENT_ROLE_VALUES = new Set(['client', 'clients', 'buyer', 'buyers', 'customer', 'customers']);

const isWorkerProfile = (profile = {}) => {
  const normalizedRole = String(profile?.role || '').trim().toLowerCase();
  if (CLIENT_ROLE_VALUES.has(normalizedRole)) return false;
  if (WORKER_ROLE_VALUES.has(normalizedRole)) return true;
  return !normalizedRole && Boolean(profile?.isWorker || profile?.is_worker || profile?.sellerId || profile?.workerProfileId);
};

const isBookingNavigationMatch = (booking = {}, navigationId = null) => {
  if (!navigationId) return false;
  const targetId = String(navigationId);
  return [
    booking.id,
    booking.conversationId,
    booking.raw?.conversation?.id,
  ].some((candidate) => candidate && String(candidate) === targetId);
};

const formatPhp = (value) => `PHP ${Number(value || 0).toLocaleString('en-PH', {
  minimumFractionDigits: Number(value || 0) % 1 === 0 ? 0 : 2,
  maximumFractionDigits: 2,
})}`;

const formatBookingTime = (value) => {
  const rawTime = String(value || '').trim();
  if (!rawTime || /\b(?:am|pm)\b/i.test(rawTime)) return rawTime;

  const match = rawTime.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (!match) return rawTime;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return rawTime;

  const period = hours >= 12 ? 'PM' : 'AM';
  const twelveHour = hours % 12 || 12;
  return `${twelveHour}:${match[2]} ${period}`;
};

const formatBookingTimeRange = (timeBlock) => (
  timeBlock
    ? `${formatBookingTime(timeBlock.startTime)} – ${formatBookingTime(timeBlock.endTime)}`
    : 'Coordinated in chat'
);

const getAvatarInitials = (name = '') => {
  const parts = String(name).trim().split(/\s+/);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return name.slice(0, 2).toUpperCase() || 'TW';
};

const getStatusMeta = (status) => {
  if (status === 'Completed Service') {
    return { className: 'booking-status-completed', icon: CheckCircle2, label: 'Completed' };
  }
  if (status === 'Service Scheduled' || status === 'Payment Confirmed') {
    return { className: 'booking-status-completed', icon: ShieldCheck, label: status };
  }
  if (status === 'Payment Pending' || status === 'Slot Selected - Payment Pending') {
    return { className: 'booking-status-pending', icon: CreditCard, label: 'Payment Pending' };
  }
  if (status === 'Cash Verification Pending') {
    return { className: 'booking-status-pending', icon: Clock, label: 'Cash Verification' };
  }
  if (status === 'Refund Processing' || status === 'Refunded') {
    return { className: 'booking-status-cancelled', icon: RotateCcw, label: status };
  }
  if (status === 'Cancelled' || status === 'Cancelled (Cash)') {
    return { className: 'booking-status-cancelled', icon: AlertCircle, label: 'Cancelled' };
  }
  if (status === 'Awaiting Slot Selection') {
    return { className: 'booking-status-active', icon: CalendarDays, label: 'Select Slot' };
  }
  if (status === 'Negotiating') {
    return { className: 'booking-status-active', icon: MessageCircle, label: 'Negotiating' };
  }
  return { className: 'booking-status-active', icon: CalendarCheck, label: status || 'Active' };
};

const COMPLETED_BOOKING_STATUSES = ['Completed Service', 'Service Stopped'];
const CANCELLED_BOOKING_STATUSES = ['Cancelled', 'Cancelled (Cash)'];
const SCHEDULED_BOOKING_STATUSES = ['Payment Confirmed', 'Service Scheduled', 'Active Service'];
const isBookingActionNeeded = (booking, scope) => {
  if (scope === 'incoming') {
    return ['Negotiating', 'Cash Verification Pending', 'Refund Processing'].includes(booking.status)
      || booking.paymentStatus === 'pending_provider';
  }
  return ['Awaiting Slot Selection', 'Payment Pending', 'Downpayment Paid', 'Slot Selected - Payment Pending'].includes(booking.status)
    || booking.deliveryStatus === 'seller_claimed';
};

const matchesBookingHubFilter = (booking, filter, scope) => {
  if (filter === 'all') return true;
  if (filter === 'completed') return COMPLETED_BOOKING_STATUSES.includes(booking.status);
  if (filter === 'cancelled') return CANCELLED_BOOKING_STATUSES.includes(booking.status);
  if (filter === 'refunds') return Boolean(booking.refundStatus) || ['Refund Processing', 'Refunded'].includes(booking.status);
  if (filter === 'delivered') return booking.deliveryStatus === 'seller_claimed' || booking.status === 'Service Delivered';
  if (filter === 'scheduled') return SCHEDULED_BOOKING_STATUSES.includes(booking.status);
  if (filter === 'payment-due') {
    return ['Payment Pending', 'Slot Selected - Payment Pending', 'Downpayment Paid'].includes(booking.status)
      || ['pending_provider', 'partially_paid'].includes(booking.paymentStatus);
  }
  if (filter === 'action-needed') return isBookingActionNeeded(booking, scope);
  if (filter === 'active') {
    return ![...COMPLETED_BOOKING_STATUSES, ...CANCELLED_BOOKING_STATUSES, 'Refunded'].includes(booking.status);
  }
  return scope === 'incoming';
};

const MyBookings = ({
  appTheme = 'light',
  themeMode = 'system',
  onThemeChange,
  currentView,
  selectedChatBookingId = null,
  searchQuery,
  onSearchChange,
  onLogout,
  onOpenSellerSetup,
  onOpenMyWork,
  sellerProfile,
  onOpenProfile,
  onOpenAccountSettings,
  onOpenSettings,
  onOpenMyBookings,
  onOpenChatPage,
  onOpenDashboard,
  onOpenBrowseServices,
  onOpenAdminDashboard,
}) => {
  // ========================================================================
  // CONTROLLER HOOKS INITIALIZATION
  // ========================================================================
  
  const [, setHeaderNotifications] = useState([]);
  const pushHeaderNotification = useCallback((title, message) => {
    const id = `notif-${Date.now()}-${Math.floor(Math.random() * 999)}`;
    setHeaderNotifications((prev) => [
      {
        id,
        title,
        message,
        time: 'just now',
        isRead: false,
      },
      ...prev,
    ]);
  }, []);

  const normalizedRole = String(sellerProfile?.role || '').trim().toLowerCase();
  const isAdminProfile = Boolean(sellerProfile?.isAdmin) || normalizedRole === 'admin';
  const isWorkerAccount = isWorkerProfile(sellerProfile) && !isAdminProfile;
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedScope = searchParams.get('scope');
  const explicitScope = ['incoming', 'purchases'].includes(requestedScope) ? requestedScope : null;
  const isChatRoute = currentView === 'chat';
  const [resolvedChatScope, setResolvedChatScope] = useState(null);
  const isProviderBookingsRoute = location.pathname === paths.workerBookings;
  const defaultScope = isWorkerAccount && isProviderBookingsRoute ? 'incoming' : 'purchases';
  const activeScope = isWorkerAccount && (explicitScope || resolvedChatScope)
    ? (explicitScope || resolvedChatScope)
    : defaultScope;
  const shouldLoadSellerBookings = activeScope === 'incoming';
  const isResolvingChatScope = Boolean(isWorkerAccount && isChatRoute && selectedChatBookingId && !explicitScope && !resolvedChatScope);

  useEffect(() => {
    if (!isResolvingChatScope) return undefined;
    let isMounted = true;
    void fetchBookingById(selectedChatBookingId).then((booking) => {
      if (!isMounted || !booking) return;
      const userId = String(sellerProfile?.userId || sellerProfile?.user_id || '');
      setResolvedChatScope(String(booking.sellerId || booking.workerId || '') === userId ? 'incoming' : 'purchases');
    }).catch(() => {
      if (isMounted) setResolvedChatScope(defaultScope);
    });
    return () => { isMounted = false; };
  }, [defaultScope, isResolvingChatScope, selectedChatBookingId, sellerProfile?.userId, sellerProfile?.user_id]);

  useEffect(() => {
    if (isChatRoute && !requestedScope) return;
    if (requestedScope === activeScope) return;
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('scope', activeScope);
    setSearchParams(nextParams, { replace: true });
  }, [activeScope, isChatRoute, requestedScope, searchParams, setSearchParams]);

  // Main booking list controller
  const bookingListCtrl = useBookingListController([], {
    autoLoad: !isResolvingChatScope,
    includeStandaloneChats: isChatRoute,
    listRole: shouldLoadSellerBookings ? 'seller' : 'buyer',
    sellerId: shouldLoadSellerBookings ? sellerProfile?.userId : null,
  });

  // Payment controller
  const paymentCtrl = usePaymentController(
    undefined, // onPaymentProofSubmit
    undefined, // onPaymentMethodSelect
    bookingListCtrl.updateBooking,
    bookingListCtrl.replaceBooking
  );

  // Refund controller
  const refundCtrl = useRefundController(
    bookingListCtrl.replaceBooking,
    pushHeaderNotification
  );

  // Rating controller
  const ratingCtrl = useRatingController(
    bookingListCtrl.updateBooking,
    pushHeaderNotification
  );

  // ========================================================================
  // LOCAL UI STATE
  // ========================================================================
  
  const [selectedBookingId, setSelectedBookingId] = useState(selectedChatBookingId || null);
  const [uiState, setUiState] = useState(() => (isChatRoute ? 'chat' : 'list'));
  const [isTermsModalOpen, setIsTermsModalOpen] = useState(false);
  const [detailBookingId, setDetailBookingId] = useState(null);
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth <= 768 : false
  );

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    setUiState((prevState) => {
      if (isChatRoute) return 'chat';
      return prevState === 'chat' ? 'list' : prevState;
    });
  }, [isChatRoute]);

  useEffect(() => {
    if (!selectedChatBookingId) return;
    setSelectedBookingId(selectedChatBookingId);
    setUiState('chat');
  }, [selectedChatBookingId]);

  // Chat navigation
  const handleOpenChat = useCallback((bookingId) => {
    setSelectedBookingId(bookingId);
    setUiState('chat');
    onOpenChatPage?.(bookingId, activeScope);
  }, [activeScope, onOpenChatPage]);

  // Slot selection
  const handleOpenSlotSelection = useCallback(() => {
    setUiState('slots');
  }, []);

  const handleLeaveRating = useCallback(async (payload) => {
    try {
      await ratingCtrl.handleLeaveRating(payload);
    } catch (error) {
      pushHeaderNotification('Rating Failed', error?.message || 'Unable to save rating right now.');
      throw error;
    }
  }, [pushHeaderNotification, ratingCtrl]);

  const handleOpenPaymentSelection = useCallback(() => {
    setIsTermsModalOpen(true);
  }, []);

  const handlePayBooking = useCallback((bookingId) => {
    setSelectedBookingId(bookingId);
    setIsTermsModalOpen(true);
  }, []);

  const handleConfirmPaymentTerms = useCallback(() => {
    setIsTermsModalOpen(false);
    setUiState('payment');
  }, []);

  const handleSelectPaymentMethod = useCallback(async (bookingId, paymentMethod, mockPayment) => {
    const booking = bookingListCtrl.getBooking(bookingId);
    if (booking) {
      try {
        await paymentCtrl.handleSelectPaymentMethod(booking, paymentMethod, mockPayment);
        setUiState('confirmed');

        if (paymentMethod === 'after-service-cash') {
          pushHeaderNotification(
            'Cash QR Ready',
            `Worker ${booking.workerName} generated a Cash Confirmation QR. Scan and submit amount after meetup.`
          );
        }
      } catch (error) {
        pushHeaderNotification('Payment Update Failed', error?.message || 'Unable to update payment method.');
      }
    }
  }, [paymentCtrl, bookingListCtrl, pushHeaderNotification]);

  // Refund workflow
  const handleRequestRefund = useCallback(async (bookingId, reason) => {
    const booking = bookingListCtrl.getBooking(bookingId);
    if (booking) {
      try {
        await refundCtrl.handleRequestRefund(booking, reason);
      } catch (error) {
        pushHeaderNotification('Refund Request Failed', error?.message || 'Unable to submit refund request.');
      }
    }
  }, [refundCtrl, bookingListCtrl, pushHeaderNotification]);

  const handleConfirmRefundReceived = useCallback(async (bookingId) => {
    const booking = bookingListCtrl.getBooking(bookingId);
    if (booking) {
      try {
        await refundCtrl.handleConfirmRefundReceived(booking);
      } catch (error) {
        pushHeaderNotification('Refund Update Failed', error?.message || 'Unable to confirm refund.');
      }
    }
  }, [refundCtrl, bookingListCtrl, pushHeaderNotification]);

  // Slot and payment confirmation
  const handleConfirmSlot = useCallback(async (bookingId, slotInfo) => {
    try {
      await bookingListCtrl.updateBooking(bookingId, {
        selectedSlot: slotInfo,
        status: 'Slot Selected - Payment Pending',
      });
      setIsTermsModalOpen(true);
    } catch (error) {
      pushHeaderNotification('Slot Update Failed', error?.message || 'Unable to update selected slot.');
    }
  }, [bookingListCtrl, pushHeaderNotification]);

  // Quote operations
  const handleApproveQuote = useCallback(async (bookingId) => {
    try {
      await bookingListCtrl.handleApproveQuote(bookingId);
      setUiState('chat');
    } catch (error) {
      pushHeaderNotification('Quote Update Failed', error?.message || 'Unable to approve quote.');
    }
  }, [bookingListCtrl, pushHeaderNotification]);

  const handleRejectQuote = useCallback(async (bookingId, reason) => {
    try {
      await bookingListCtrl.handleRejectQuote(bookingId, reason);
      pushHeaderNotification('Quote Rejected', 'Your reason was sent to the worker so they can review or revise the quote.');
      setUiState('chat');
    } catch (error) {
      pushHeaderNotification('Quote Update Failed', error?.message || 'Unable to reject quote.');
    }
  }, [bookingListCtrl, pushHeaderNotification]);

  // Service control
  const handleStopServiceAccepted = useCallback(async (bookingId) => {
    try {
      await bookingListCtrl.handleStopServiceAccepted(bookingId);
    } catch (error) {
      pushHeaderNotification('Service Update Failed', error?.message || 'Unable to stop service.');
    }
  }, [bookingListCtrl, pushHeaderNotification]);

  const handleAcknowledgeCashPayment = useCallback(async (bookingId) => {
    try {
      const updated = await acknowledgeCashPayment(bookingId);
      bookingListCtrl.replaceBooking(updated);
      pushHeaderNotification('Cash Payment Confirmed', 'Your cash-payment acknowledgement was recorded.');
    } catch (error) {
      pushHeaderNotification('Cash Confirmation Failed', error?.message || 'Unable to acknowledge cash payment.');
    }
  }, [bookingListCtrl, pushHeaderNotification]);

  const handleConfirmCompletion = useCallback(async (bookingId) => {
    try {
      const updated = await confirmBookingCompletion(bookingId);
      bookingListCtrl.replaceBooking(updated);
      pushHeaderNotification('Booking Completed', 'The completed service was recorded and can now be rated.');
    } catch (error) {
      pushHeaderNotification('Completion Failed', error?.message || 'Unable to confirm service completion.');
    }
  }, [bookingListCtrl, pushHeaderNotification]);

  const handleMarkDelivered = useCallback(async (bookingId) => {
    try {
      const updated = await markBookingDelivered(bookingId);
      bookingListCtrl.replaceBooking(updated);
      pushHeaderNotification(
        'Delivery Confirmed by Provider',
        'The client can now confirm completion from their booking.'
      );
    } catch (error) {
      pushHeaderNotification('Delivery Confirmation Failed', error?.message || 'Unable to mark the service delivered.');
    }
  }, [bookingListCtrl, pushHeaderNotification]);

  const hideCurrentChat = useCallback(async (targetBooking, mode) => {
    if (!targetBooking) return;

    try {
      await archiveConversationThread(targetBooking, mode);
      const nextRows = await bookingListCtrl.refreshBookings();
      const nextSelected = nextRows.find((row) => String(row.id) !== String(targetBooking.id));
      setSelectedBookingId(nextSelected?.id || null);
      setUiState('chat');
      pushHeaderNotification(
        mode === 'delete' ? 'Chat Deleted' : 'Chat Archived',
        mode === 'delete' ? 'The chat was removed from your inbox.' : 'The chat was moved out of your active inbox.'
      );
    } catch (error) {
      pushHeaderNotification('Chat Update Failed', error?.message || 'Unable to update this chat.');
    }
  }, [bookingListCtrl, pushHeaderNotification]);

  const handleArchiveChat = useCallback((targetBooking) => hideCurrentChat(targetBooking, 'archive'), [hideCurrentChat]);
  const handleDeleteChat = useCallback((targetBooking) => hideCurrentChat(targetBooking, 'delete'), [hideCurrentChat]);

  // Navigation
  const handleBackToList = useCallback(() => {
    setSelectedBookingId(null);
    setUiState(isChatRoute ? 'chat' : 'list');
  }, [isChatRoute]);

  const handleNewInquiry = useCallback(() => {
    setSelectedBookingId(null);
    setUiState(isChatRoute ? 'chat' : 'list');
  }, [isChatRoute]);

  useEffect(() => {
    const selectedBooking = selectedBookingId
      ? bookingListCtrl.bookings.find((booking) => isBookingNavigationMatch(booking, selectedBookingId))
      : null;

    if (selectedBooking) {
      if (String(selectedBooking.id) !== String(selectedBookingId)) {
        setSelectedBookingId(selectedBooking.id);
      }
      return;
    }
    if (selectedChatBookingId && isChatRoute && bookingListCtrl.bookings.length === 0) return;

    setSelectedBookingId(bookingListCtrl.bookings[0]?.id || null);
  }, [bookingListCtrl.bookings, isChatRoute, selectedBookingId, selectedChatBookingId]);

  const currentBooking = bookingListCtrl.bookings.find((b) => isBookingNavigationMatch(b, selectedBookingId));
  const detailBooking = bookingListCtrl.bookings.find((b) => String(b.id) === String(detailBookingId));
  const ratingBooking = bookingListCtrl.bookings.find((b) => String(b.id) === String(ratingCtrl.ratingTargetId));
  const currentBookingFee = Number(currentBooking?.transactionFeeAmount || 0);
  const currentBookingTotal = Number(currentBooking?.totalChargedAmount || currentBooking?.quoteAmount || 0);

  // ========================================================================
  // COMPUTED KPI & FILTER COUNTS
  // ========================================================================
  const allBookings = useMemo(() => bookingListCtrl.bookings || [], [bookingListCtrl.bookings]);

  const activeBookingsCount = useMemo(() => (
    allBookings.filter(
      (b) => !['Completed Service', 'Service Stopped', 'Cancelled', 'Cancelled (Cash)', 'Refunded'].includes(b.status)
    ).length
  ), [allBookings]);

  const completedBookingsCount = useMemo(() => (
    allBookings.filter(
      (b) => ['Completed Service', 'Service Stopped'].includes(b.status)
    ).length
  ), [allBookings]);

  const pendingActionCount = useMemo(() => (
    allBookings.filter((booking) => isBookingActionNeeded(booking, activeScope)).length
  ), [activeScope, allBookings]);

  const metrics = useMemo(() => [
    {
      label: shouldLoadSellerBookings ? 'Client bookings' : 'Total bookings',
      value: bookingListCtrl.isLoading && allBookings.length === 0 ? '...' : String(allBookings.length),
      icon: CalendarCheck,
      tone: 'blue',
    },
    {
      label: shouldLoadSellerBookings ? 'Active jobs' : 'Active & scheduled',
      value: bookingListCtrl.isLoading && allBookings.length === 0 ? '...' : String(activeBookingsCount),
      icon: Clock,
      tone: 'green',
    },
    {
      label: shouldLoadSellerBookings ? 'Completed jobs' : 'Completed',
      value: bookingListCtrl.isLoading && allBookings.length === 0 ? '...' : String(completedBookingsCount),
      icon: CheckCircle2,
      tone: 'neutral',
    },
    {
      label: 'Action Needed',
      value: bookingListCtrl.isLoading && allBookings.length === 0 ? '...' : String(pendingActionCount),
      icon: AlertCircle,
      tone: 'orange',
    },
  ], [bookingListCtrl.isLoading, allBookings.length, activeBookingsCount, completedBookingsCount, pendingActionCount, shouldLoadSellerBookings]);

  const filterDefinitions = shouldLoadSellerBookings
    ? [
        ['all', 'All'],
        ['action-needed', 'Action needed'],
        ['scheduled', 'Scheduled'],
        ['delivered', 'Delivered'],
        ['completed', 'Completed'],
        ['refunds', 'Refunds'],
        ['cancelled', 'Cancelled'],
      ]
    : [
        ['all', 'All'],
        ['active', 'Active'],
        ['payment-due', 'Payment due'],
        ['delivered', 'Delivered'],
        ['completed', 'Completed'],
        ['refunds', 'Refunds'],
        ['cancelled', 'Cancelled'],
      ];
  const allowedFilters = filterDefinitions.map(([value]) => value);
  const requestedFilter = searchParams.get('filter') || 'all';
  const selectedDisplayFilter = allowedFilters.includes(requestedFilter) ? requestedFilter : 'all';
  const displayFilters = filterDefinitions.map(([value, label]) => ({
    value,
    label,
    count: allBookings.filter((booking) => matchesBookingHubFilter(booking, value, activeScope)).length,
  }));

  const updateSearchParams = (updates, replace = false) => {
    const nextParams = new URLSearchParams(searchParams);
    Object.entries(updates).forEach(([key, value]) => {
      if (value && value !== 'all') nextParams.set(key, value);
      else nextParams.delete(key);
    });
    nextParams.set('scope', activeScope);
    setSearchParams(nextParams, { replace });
  };

  const handleScopeChange = (nextScope) => {
    const nextParams = new URLSearchParams();
    nextParams.set('scope', nextScope);
    const destination = nextScope === 'incoming' || isProviderBookingsRoute
      ? paths.workerBookings
      : paths.bookings;
    navigate(`${destination}?${nextParams.toString()}`);
  };

  // Search filter applied on top of list controller
  const bookingSearch = searchParams.get('q') || '';
  const activeSearch = bookingSearch.trim().toLowerCase();

  const displayedBookings = useMemo(() => {
    let list = allBookings.filter((booking) => matchesBookingHubFilter(booking, selectedDisplayFilter, activeScope));
    if (activeSearch) {
      list = list.filter((b) => {
        const workerName = String(b.workerName || '').toLowerCase();
        const serviceType = String(b.serviceType || '').toLowerCase();
        const desc = String(b.description || '').toLowerCase();
        const status = String(b.status || '').toLowerCase();
        const paymentRef = String(b.paymentReference || '').toLowerCase();
        const date = String(b.selectedSlot?.date || b.requestDate || '').toLowerCase();
        return (
          workerName.includes(activeSearch) ||
          serviceType.includes(activeSearch) ||
          desc.includes(activeSearch) ||
          status.includes(activeSearch) ||
          paymentRef.includes(activeSearch) ||
          date.includes(activeSearch)
        );
      });
    }
    return list;
  }, [activeScope, activeSearch, allBookings, selectedDisplayFilter]);

  // ========================================================================
  // RENDER BOOKINGS LIST
  // ========================================================================

  const renderBookingCard = (booking) => {
    const statusMeta = getStatusMeta(booking.status);
    const StatusIcon = statusMeta.icon;
    const canPayNow = !shouldLoadSellerBookings && (
      ['Payment Pending', 'Slot Selected - Payment Pending'].includes(booking.status)
      || booking.paymentStatus === 'partially_paid'
    );
    const hasPrimaryWorkflowAction = canPayNow
      || (!shouldLoadSellerBookings && booking.cashCollectionStatus === 'seller_claimed')
      || (!shouldLoadSellerBookings && booking.deliveryStatus === 'seller_claimed')
      || (shouldLoadSellerBookings && booking.deliveryStatus === 'not_delivered' && booking.paymentStatus === 'paid');
    const counterpartName = shouldLoadSellerBookings ? booking.clientName : booking.workerName;
    const messageLabel = shouldLoadSellerBookings ? 'Message client' : 'Message provider';

    return (
      <article
        key={booking.id}
        className="booking-card-modern"
        data-testid={`booking-card-${booking.id}`}
      >
        <div className="booking-card-header">
          <div className="booking-provider-info">
            <div className="booking-provider-avatar">
              {getAvatarInitials(counterpartName)}
            </div>
            <div className="booking-provider-details">
              <h3 className="booking-worker-title">
                {counterpartName}
                <span className="booking-service-tag">{booking.serviceType}</span>
              </h3>
              <span className="booking-mode-label">
                {booking.bookingModeLabel || (booking.bookingMode === 'calendar-only' ? 'Direct Schedule' : 'Chat Coordination')}
              </span>
            </div>
          </div>

          <div>
            <span className={`booking-status-badge ${statusMeta.className}`}>
              <StatusIcon size={14} aria-hidden="true" />
              {statusMeta.label}
            </span>
          </div>
        </div>

        <div className="booking-card-body">
          {booking.description && (
            <p className="booking-card-desc">{booking.description}</p>
          )}

          <div className="booking-details-grid">
            <div className="booking-detail-item">
              <CalendarDays size={16} aria-hidden="true" />
              <div>
                <span>Date: </span>
                <strong>{booking.selectedSlot?.date || booking.requestDate || 'Coordinated in chat'}</strong>
              </div>
            </div>

            <div className="booking-detail-item">
              <Clock size={16} aria-hidden="true" />
              <div>
                <span>Time: </span>
                <strong>
                  {formatBookingTimeRange(booking.selectedSlot?.timeBlock)}
                </strong>
              </div>
            </div>

            <div className="booking-detail-item">
              <CreditCard size={16} aria-hidden="true" />
              <div>
                <span>Payment: </span>
                <strong>
                  {booking.paymentMethod === 'gcash-advance'
                    ? 'GCash Advance'
                    : booking.paymentMethod === 'after-service-cash'
                    ? 'Cash on Meetup'
                    : booking.paymentMethod === 'after-service-gcash'
                    ? 'GCash on Meetup'
                    : 'Pending Selection'}
                </strong>
              </div>
            </div>

            {booking.paymentReference && (
              <div className="booking-detail-item">
                <Receipt size={16} aria-hidden="true" />
                <div>
                  <span>Ref: </span>
                  <code className="booking-reference">
                    {booking.paymentReference}
                  </code>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="booking-card-footer">
          <dl className="flex min-w-0 flex-wrap items-stretch gap-2 text-sm">
            <div className="min-w-32 rounded-lg bg-muted/50 px-3 py-2">
              <dt className="text-xs font-semibold text-muted-foreground">{shouldLoadSellerBookings ? 'Booking amount' : 'Service price'}</dt><dd className="mt-1 font-bold text-foreground">{formatPhp(booking.quoteAmount || booking.totalChargedAmount || 0)}</dd>
            </div>
            {!shouldLoadSellerBookings && booking.transactionFeeAmount > 0 && (
              <div className="min-w-28 rounded-lg bg-muted/50 px-3 py-2">
                <dt className="text-xs font-semibold text-muted-foreground">Platform fee</dt><dd className="mt-1 font-bold text-foreground">{formatPhp(booking.transactionFeeAmount)}</dd>
              </div>
            )}
            {!shouldLoadSellerBookings && booking.totalChargedAmount > 0 && (
              <div className="min-w-32 rounded-lg bg-emerald-50 px-3 py-2 dark:bg-emerald-950/30">
                <dt className="text-xs font-semibold text-muted-foreground">Total payment</dt><dd className="mt-1 font-extrabold text-emerald-700 dark:text-emerald-300">{formatPhp(booking.totalChargedAmount)}</dd>
              </div>
            )}
            {booking.paymentPlan === 'downpayment' && (
              <div className="min-w-48 rounded-lg bg-muted/50 px-3 py-2">
                <dt className="text-xs font-semibold text-muted-foreground">Payment progress</dt><dd className="mt-1 font-bold text-foreground">Paid: {formatPhp(booking.amountPaid)} · Balance: {formatPhp(booking.balanceDueAmount)}</dd>
              </div>
            )}
          </dl>

          <div className="booking-card-actions">
            <Button
              type="button"
              variant="outline"
              onClick={() => setDetailBookingId(booking.id)}
            >
              <Eye size={16} aria-hidden="true" />
              View Details
            </Button>

            <Button
              type="button"
              variant={hasPrimaryWorkflowAction ? 'outline' : 'primary'}
              onClick={() => handleOpenChat(booking.id)}
            >
              <MessageCircle size={16} aria-hidden="true" />
              {messageLabel}
            </Button>

            {canPayNow && (
              <Button
                type="button"
                onClick={() => handlePayBooking(booking.id)}
              >
                <CreditCard size={16} aria-hidden="true" />
                {booking.paymentStatus === 'partially_paid' ? 'Pay Balance' : 'Pay Now'}
              </Button>
            )}

            {!shouldLoadSellerBookings && booking.cashCollectionStatus === 'seller_claimed' && (
              <Button
                type="button"
                onClick={() => handleAcknowledgeCashPayment(booking.id)}
              >
                <ShieldCheck size={16} aria-hidden="true" />
                Acknowledge Cash
              </Button>
            )}

            {!shouldLoadSellerBookings && booking.deliveryStatus === 'seller_claimed' && (
              <Button
                type="button"
                disabled={booking.paymentStatus !== 'paid'}
                title={booking.paymentStatus === 'paid' ? 'Confirm that the service was delivered' : 'Payment confirmation is required first'}
                onClick={() => handleConfirmCompletion(booking.id)}
              >
                <CheckCircle2 size={16} aria-hidden="true" />
                Confirm Completion
              </Button>
            )}

            {shouldLoadSellerBookings
              && booking.deliveryStatus === 'not_delivered'
              && booking.paymentStatus === 'paid'
              && ['Payment Confirmed', 'Service Scheduled', 'Active Service'].includes(booking.status) && (
              <Button
                type="button"
                onClick={() => handleMarkDelivered(booking.id)}
              >
                <CheckCircle2 size={16} aria-hidden="true" />
                Mark Delivered
              </Button>
            )}

            {booking.canRate && (
              <Button
                type="button"
                variant="outline"
                className="text-brand-highlight-foreground hover:text-brand-highlight-foreground"
                onClick={() => ratingCtrl.handleOpenRating(booking.id)}
              >
                <Star size={16} aria-hidden="true" />
                Rate Service
              </Button>
            )}
          </div>
        </div>
      </article>
    );
  };

  const renderBookingsList = () => (
    <main className="gl-shell gl-page-pad bookings-launchpad">
      <section className="bookings-hero" aria-labelledby="bookings-title">
        <div className="bookings-hero-copy">
          <h1 id="bookings-title" className="gl-title !mt-0">{isWorkerAccount ? 'Bookings' : 'My Bookings'}</h1>
          <p className="gl-subtitle">
            {shouldLoadSellerBookings
              ? 'Review client bookings, scheduled jobs, payment states, and delivery progress.'
              : 'Track services you booked, scheduled appointments, payments, refunds, and provider conversations.'}
          </p>
        </div>

        <div className="bookings-hero-actions max-[880px]:w-full">
          {!shouldLoadSellerBookings && (
            <Button
              type="button"
              className="max-[880px]:w-full"
              onClick={onOpenBrowseServices}
            >
              <Search size={16} aria-hidden="true" />
              Browse Services
            </Button>
          )}
        </div>
      </section>

      {isWorkerAccount && <BookingScopeSwitcher value={activeScope} onValueChange={handleScopeChange} />}

      {/* KPI Overview Metrics Grid */}
      <section className="grid auto-cols-[minmax(15rem,1fr)] grid-flow-col gap-3 overflow-x-auto pb-2 md:grid-flow-row md:grid-cols-2 md:overflow-visible lg:grid-cols-4" aria-label="Bookings metrics snapshot">
        {metrics.map((item) => <MetricCard key={item.label} icon={item.icon} label={item.label} tone={item.tone} value={item.value} />)}
      </section>

      <SearchFilterBar
        activeValue={selectedDisplayFilter}
        onActiveValueChange={(value) => updateSearchParams({ filter: value })}
        onSearchValueChange={(value) => {
          updateSearchParams({ q: value }, true);
          onSearchChange?.({ target: { value } });
        }}
        options={displayFilters}
        resultLabel={`Showing ${displayedBookings.length} of ${allBookings.length} booking${allBookings.length === 1 ? '' : 's'}`}
        searchLabel="Search bookings"
        searchPlaceholder="Search by worker, service, or reference..."
        searchValue={bookingSearch}
      />

      {/* Error Notices */}
      {(bookingListCtrl.loadError || bookingListCtrl.actionError) && (
        <div
          style={{
            padding: '14px 18px',
            borderRadius: '8px',
            background: 'var(--gl-danger-soft)',
            border: '1px solid var(--gl-danger-border)',
            color: 'var(--gl-red)',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
          }}
          role="alert"
        >
          <AlertCircle size={18} />
          <span>{bookingListCtrl.loadError || bookingListCtrl.actionError}</span>
        </div>
      )}

      {/* Loading State Skeletons */}
      {bookingListCtrl.isLoading && allBookings.length === 0 && (
        <div className="bookings-list" aria-busy="true">
          {[1, 2, 3].map((key) => (
            <div key={key} className="booking-skeleton-card">
              <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
                <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'var(--gl-surface-3)' }} />
                <div style={{ flex: 1, display: 'grid', gap: '8px' }}>
                  <div className="booking-skeleton-line" style={{ width: '40%' }} />
                  <div className="booking-skeleton-line" style={{ width: '25%', height: '10px' }} />
                </div>
              </div>
              <div className="booking-skeleton-line" style={{ width: '85%' }} />
              <div className="booking-skeleton-line" style={{ width: '60%' }} />
            </div>
          ))}
        </div>
      )}

      {/* Empty State: No bookings at all */}
      {!bookingListCtrl.isLoading && allBookings.length === 0 && (
        <WorkflowEmptyState
          className="rounded-xl border bg-card"
          data-testid="bookings-empty-state"
          icon={CalendarX2}
          title="No bookings yet"
          description={shouldLoadSellerBookings ? 'Client booking requests and service appointments for your profile will appear here.' : 'You haven\'t booked any services yet. Browse trusted local providers when you are ready.'}
          tone="primary"
          action={shouldLoadSellerBookings ? <Button type="button" onClick={onOpenMyWork}>Manage My Work</Button> : <Button type="button" onClick={onOpenBrowseServices}><Search size={16} aria-hidden="true" />Browse Marketplace</Button>}
        />
      )}

      {/* Filter Empty State: Filter/Search yielded 0 results */}
      {!bookingListCtrl.isLoading && allBookings.length > 0 && displayedBookings.length === 0 && (
        <WorkflowEmptyState
          className="rounded-xl border bg-card"
          data-testid="bookings-filter-empty-state"
          icon={Filter}
          title="No matching bookings"
          description="No bookings match your current search or status filter. Reset the filters to see the full list."
          action={<Button type="button" variant="outline" onClick={() => { bookingListCtrl.setActiveFilter('all'); bookingListCtrl.setDisplayFilter('all'); updateSearchParams({ filter: '', q: '' }); onSearchChange?.({ target: { value: '' } }); }}><RotateCcw size={16} aria-hidden="true" />Reset filters</Button>}
        />
      )}

      {/* Bookings List Cards */}
      {!bookingListCtrl.isLoading && displayedBookings.length > 0 && (
        <section className="bookings-list" aria-label="Bookings list">
          {displayedBookings.map((booking) => renderBookingCard(booking))}
        </section>
      )}
    </main>
  );

  // ========================================================================
  // RENDER - Main Page Component
  // ========================================================================

  return (
    <div
      className={`gl-page ${uiState === 'chat' ? 'booking-chat-page' : ''}`}
      data-testid="my-bookings-page"
    >
      <DashboardNavigation
        appTheme={appTheme}
        themeMode={themeMode}
        onThemeChange={onThemeChange}
        currentView={currentView}
        searchQuery={searchQuery}
        onSearchChange={onSearchChange}
        onLogout={onLogout}
        onOpenSellerSetup={onOpenSellerSetup}
        onOpenMyBookings={onOpenMyBookings}
        onOpenChatPage={onOpenChatPage}
        sellerProfile={sellerProfile}
        onOpenMyWork={onOpenMyWork}
        onOpenProfile={onOpenProfile}
        onOpenAccountSettings={onOpenAccountSettings}
        onOpenSettings={onOpenSettings}
        onOpenDashboard={onOpenDashboard}
        onOpenBrowseServices={onOpenBrowseServices}
        isAdminView={false}
        onToggleAdminView={() => { if (typeof onOpenAdminDashboard === 'function') onOpenAdminDashboard(); }}
      />

      {!isChatRoute && renderBookingsList()}

      {isChatRoute && bookingListCtrl.bookings.length === 0 && !bookingListCtrl.isLoading && (
        <main className="gl-shell gl-page-pad">
          <WorkflowEmptyState
            className="rounded-xl border bg-card"
            icon={MessageCircle}
            title="No conversations yet"
            description={shouldLoadSellerBookings ? 'Client booking requests and conversations for your services will appear here.' : 'Start a booking from the marketplace to open a conversation here.'}
            tone="primary"
            action={shouldLoadSellerBookings ? <Button type="button" onClick={onOpenMyWork}>Manage My Work</Button> : <Button type="button" onClick={onOpenBrowseServices}><Search size={16} aria-hidden="true" />Browse Services</Button>}
          />
        </main>
      )}

      {currentBooking && (
        <>
          {isChatRoute && uiState === 'chat' && (
            <ChatWindow
              appTheme={appTheme}
              booking={currentBooking}
              bookings={bookingListCtrl.bookings}
              selectedBookingId={selectedBookingId}
              initialMobileListOpen={isMobile && !selectedChatBookingId}
              viewerRole={shouldLoadSellerBookings ? 'seller' : 'buyer'}
              onSelectBooking={handleOpenChat}
              onApproveQuote={() => handleApproveQuote(currentBooking.id)}
              onRejectQuote={(reason) => handleRejectQuote(currentBooking.id, reason)}
              onOpenSlotSelection={handleOpenSlotSelection}
              onOpenPaymentSelection={handleOpenPaymentSelection}
              onRequestRefund={(reason) => handleRequestRefund(currentBooking.id, reason)}
              onConfirmRefundReceived={() => handleConfirmRefundReceived(currentBooking.id)}
              onStopServiceAccepted={() => handleStopServiceAccepted(currentBooking.id)}
              onLeaveRating={handleLeaveRating}
              onArchiveChat={handleArchiveChat}
              onDeleteChat={handleDeleteChat}
            />
          )}

          {isChatRoute && uiState === 'slots' && (
            <SlotSelectionModal
              booking={currentBooking}
              onConfirmSlot={(slotInfo) => handleConfirmSlot(currentBooking.id, slotInfo)}
              onCancel={handleBackToList}
            />
          )}

          {uiState === 'confirmed' && (
            <div
              style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(15, 23, 42, 0.65)',
                backdropFilter: 'blur(6px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 1100,
                padding: '16px',
              }}
            >
              <div
                className="gl-card"
                style={{
                  maxWidth: '520px',
                  width: '100%',
                  padding: isMobile ? '24px 16px' : '36px 28px',
                  boxShadow: '0 25px 60px rgba(0, 0, 0, 0.3)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '20px',
                }}
              >
                <div style={{ textAlign: 'center' }}>
                  <div
                    style={{
                      width: '64px',
                      height: '64px',
                      borderRadius: '50%',
                      background: 'var(--gl-success-soft)',
                      color: 'var(--gl-green)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      margin: '0 auto 12px',
                      border: '2px solid var(--gl-success-border)',
                    }}
                  >
                    <CheckCircle2 size={36} />
                  </div>
                  <h2 style={{ margin: 0, fontSize: '24px', fontWeight: 850, color: 'var(--gl-text)' }}>
                    Booking Confirmed!
                  </h2>
                  <p style={{ margin: '6px 0 0', fontSize: '14px', color: 'var(--gl-text-2)' }}>
                    Your service booking has been processed successfully.
                  </p>
                </div>

                <div
                  style={{
                    background: 'var(--gl-surface-2)',
                    border: '1px solid var(--gl-border)',
                    borderRadius: '10px',
                    padding: '16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                    <span style={{ color: 'var(--gl-text-3)', fontWeight: 600 }}>Worker:</span>
                    <strong style={{ color: 'var(--gl-text)' }}>{currentBooking.workerName}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                    <span style={{ color: 'var(--gl-text-3)', fontWeight: 600 }}>Service:</span>
                    <strong style={{ color: 'var(--gl-text)' }}>{currentBooking.serviceType}</strong>
                  </div>
                  {currentBookingFee > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                      <span style={{ color: 'var(--gl-text-3)', fontWeight: 600 }}>Transaction Fee:</span>
                      <strong style={{ color: 'var(--gl-text)' }}>{formatPhp(currentBookingFee)}</strong>
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                    <span style={{ color: 'var(--gl-text-3)', fontWeight: 600 }}>Total Cost:</span>
                    <strong style={{ color: 'var(--gl-green)', fontSize: '15px' }}>{formatPhp(currentBookingTotal)}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                    <span style={{ color: 'var(--gl-text-3)', fontWeight: 600 }}>Scheduled Date:</span>
                    <strong style={{ color: 'var(--gl-text)' }}>{currentBooking.selectedSlot?.date || 'Coordinated through chat'}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                    <span style={{ color: 'var(--gl-text-3)', fontWeight: 600 }}>Payment Method:</span>
                    <strong style={{ color: 'var(--gl-blue)' }}>
                      {currentBooking.paymentMethod === 'gcash-advance'
                        ? 'GCash Advance Payment'
                        : currentBooking.paymentMethod === 'after-service-gcash'
                        ? 'Pay After Service (GCash)'
                        : 'Pay After Service (Cash)'}
                    </strong>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', textAlign: 'center' }}>
                  <button
                    type="button"
                    className="gl-button primary"
                    style={{ width: '100%', minHeight: '44px', justifyContent: 'center' }}
                    onClick={handleNewInquiry}
                  >
                    Back to My Bookings
                  </button>
                  <p style={{ margin: 0, fontSize: '12px', color: 'var(--gl-text-3)', lineHeight: 1.4 }}>
                    Cash confirmation has been sent to the worker review queue. You can track progress anytime from this dashboard.
                  </p>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      <BookingDetailsDialog
        booking={detailBooking}
        isProviderView={shouldLoadSellerBookings}
        statusLabel={detailBooking ? getStatusMeta(detailBooking.status).label : ''}
        onClose={() => setDetailBookingId(null)}
        onMessage={(bookingId) => { setDetailBookingId(null); handleOpenChat(bookingId); }}
      />

      {currentBooking && uiState === 'payment' && (
        <PaymentModal
          booking={currentBooking}
          onSelectPayment={(method, mockPayment) => handleSelectPaymentMethod(currentBooking.id, method, mockPayment)}
          onCancel={handleBackToList}
          confirmLabel={currentBooking.paymentStatus === 'partially_paid' ? 'Pay Remaining Balance' : 'Submit Payment'}
        />
      )}

      {ratingBooking && (
        <RatingModal
          booking={ratingBooking}
          onClose={() => ratingCtrl.setRatingTargetId(null)}
          onSubmit={({ rating, comment, imageFile }) => handleLeaveRating({
            bookingId: ratingBooking.id,
            rating,
            comment,
            imageFile,
          })}
        />
      )}

      <BookingTermsModal
        isOpen={isTermsModalOpen}
        appTheme={appTheme}
        title="Agree Before Payment"
        confirmLabel="Agree and Open Payment"
        onCancel={() => setIsTermsModalOpen(false)}
        onConfirm={handleConfirmPaymentTerms}
      />
    </div>
  );
};

export default MyBookings;
