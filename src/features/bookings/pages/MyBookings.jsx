import { matchesBookingSearch } from '@/features/bookings/utils/bookingSearch';
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
import { ChatArchiveBrowser } from '../components/ChatArchiveBrowser';
import SlotSelectionModal from '../components/SlotSelectionModal';
import PaymentModal from '../components/PaymentModal';
import BookingTermsModal from '../components/BookingTermsModal';
import RatingModal from '../components/RatingModal';
import { BookingDetailsDialog } from '../components/BookingDetailsDialog';
import { BookingScopeSwitcher } from '../components/BookingScopeSwitcher';
import { ReservationStatus } from '../components/ReservationStatus';
import { CancelBookingDialog } from '../components/CancelBookingDialog';
import { BookingRequestReviewDialog } from '../components/BookingRequestReviewDialog';
import { PaymentReturnStatus } from '../components/PaymentReturnStatus';
import { BookingCardFooter } from '../components/BookingCardFooter';
import { BookingTransactionActions } from '../components/BookingTransactionActions';
import { BookingListFeedback } from '@/features/bookings/components/BookingListFeedback';
import { Button } from '@/components/ui/button';
import { MetricCard } from '@/components/ui/metric-card';
import { SearchFilterBar } from '@/components/ui/search-filter-bar';
import { WorkflowEmptyState } from '@/components/ui/workflow-panel';
import { paths } from '@/app/router/routes';
import { hasPastUnpaidSchedule } from '@/features/bookings/utils/bookingSchedule';
import {
  useBookingListController,
  usePaymentController,
  useRefundController,
  useRatingController,
} from '../hooks';
import {
  acknowledgeCashPayment,
  archiveConversationThread,
  fetchBookingById,
} from '../services/bookingService';
import {
  cancelBooking,
  proposeBookingQuote,
  rejectBookingQuote,
  rescheduleBooking,
  reviewBookingCancellation,
  reviewBookingReschedule,
} from '../services/bookingTransactions';

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
  if (status === 'Refund Pending' || status === 'Cancellation Requested') {
    return { className: 'booking-status-pending', icon: Clock, label: status };
  }
  if (status === 'Reservation Expired') {
    return { className: 'booking-status-pending', icon: CalendarX2, label: 'Choose New Time' };
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
  const activeScope = isWorkerAccount && isChatRoute
    ? (explicitScope || resolvedChatScope || defaultScope)
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

  const bookingListCtrl = useBookingListController([], {
    autoLoad: !isResolvingChatScope,
    includeStandaloneChats: isChatRoute,
    listRole: shouldLoadSellerBookings ? 'seller' : 'buyer',
    sellerId: shouldLoadSellerBookings ? sellerProfile?.userId : null,
  });

  const paymentCtrl = usePaymentController(
    undefined, // onPaymentProofSubmit
    undefined, // onPaymentMethodSelect
    bookingListCtrl.updateBooking,
    bookingListCtrl.replaceBooking
  );

  const refundCtrl = useRefundController(
    bookingListCtrl.replaceBooking,
    pushHeaderNotification
  );

  const ratingCtrl = useRatingController(
    bookingListCtrl.updateBooking,
    pushHeaderNotification
  );

  const [selectedBookingId, setSelectedBookingId] = useState(selectedChatBookingId || null);
  const [uiState, setUiState] = useState(() => (isChatRoute ? 'chat' : 'list'));
  const [isTermsModalOpen, setIsTermsModalOpen] = useState(false);
  const [pendingCheckoutSlot, setPendingCheckoutSlot] = useState(null);
  const [scheduleAction, setScheduleAction] = useState('checkout');
  const [cancelBookingId, setCancelBookingId] = useState(null);
  const [reviewRequest, setReviewRequest] = useState(null);
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

  const handleOpenChat = useCallback((bookingId) => {
    setSelectedBookingId(bookingId);
    setUiState('chat');
    onOpenChatPage?.(bookingId, activeScope);
  }, [activeScope, onOpenChatPage]);

  const handleOpenSlotSelection = useCallback(() => {
    setPendingCheckoutSlot(null); setScheduleAction('checkout'); setUiState('slots');
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
    setPendingCheckoutSlot(null); setIsTermsModalOpen(true);
  }, []);

  const handlePayBooking = useCallback((bookingId) => {
    setPendingCheckoutSlot(null);
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
        const checkoutBooking = pendingCheckoutSlot?.bookingId === bookingId
          ? { ...booking, selectedSlot: pendingCheckoutSlot.slot }
          : booking;
        await paymentCtrl.handleSelectPaymentMethod(checkoutBooking, paymentMethod, mockPayment);
        if (paymentMethod === 'after-service-cash') {
          pushHeaderNotification(
            'Cash QR Ready',
            `Worker ${booking.workerName} generated a Cash Confirmation QR. Scan and submit amount after meetup.`
          );
        }
      } catch (error) {
        pushHeaderNotification('Payment Update Failed', error?.message || 'Unable to update payment method.');
        throw error; // Keep the payment dialog open and surface the server's safe recovery message.
      }
    }
  }, [paymentCtrl, bookingListCtrl, pendingCheckoutSlot, pushHeaderNotification]);
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

  const handleConfirmSlot = useCallback(async (bookingId, slotInfo) => {
    if (scheduleAction === 'reschedule') {
      try {
        const result = await rescheduleBooking({ bookingId, newSlotId: Number(slotInfo.slotId) });
        bookingListCtrl.replaceBooking(await fetchBookingById(bookingId));
        pushHeaderNotification(
          result.outcome === 'approval_required' ? 'Reschedule Requested' : 'Schedule Updated',
          result.outcome === 'approval_required'
            ? 'Your current time stays reserved until the provider reviews the new request.'
            : 'Your booking has moved to the selected time.'
        );
        setUiState(isChatRoute ? 'chat' : 'list');
      } catch (error) {
        pushHeaderNotification('Reschedule Failed', error?.message || 'Unable to change this booking time.');
        throw error;
      }
      return;
    }
    setPendingCheckoutSlot({ bookingId, slot: slotInfo });
    setUiState('terms');
    setIsTermsModalOpen(true);
  }, [bookingListCtrl, isChatRoute, pushHeaderNotification, scheduleAction]);

  const handleCancelBooking = useCallback(async (reason) => {
    if (!cancelBookingId) return;
    const result = await cancelBooking({ bookingId: cancelBookingId, reason });
    bookingListCtrl.replaceBooking(await fetchBookingById(cancelBookingId));
    setCancelBookingId(null);
    pushHeaderNotification(
      result.outcome === 'review_required' ? 'Cancellation Requested' : 'Booking Cancelled',
      result.outcome === 'review_required'
        ? 'The provider will review your request. Your payment has not been changed.'
        : 'The reserved time is now available again.'
    );
  }, [bookingListCtrl, cancelBookingId, pushHeaderNotification]);

  const handleReviewRequest = useCallback(async (decision, note) => {
    if (!reviewRequest) return;
    if (reviewRequest.kind === 'cancellation') {
      await reviewBookingCancellation({ bookingId: reviewRequest.bookingId, decision, reason: note });
    } else {
      await reviewBookingReschedule({ requestId: reviewRequest.requestId, decision, reason: note });
    }
    bookingListCtrl.replaceBooking(await fetchBookingById(reviewRequest.bookingId));
    setReviewRequest(null);
    pushHeaderNotification(
      decision === 'approve' ? 'Request Approved' : 'Request Declined',
      decision === 'approve' ? 'The booking has been updated safely.' : 'The existing booking details remain in place.'
    );
  }, [bookingListCtrl, pushHeaderNotification, reviewRequest]);

  const handleApproveQuote = useCallback(async (bookingId) => {
    const booking = bookingListCtrl.getBooking(bookingId);
    if (!booking?.activeQuote) {
      pushHeaderNotification('Quote Unavailable', 'Ask the provider to send an updated price and schedule.');
      return;
    }
    setSelectedBookingId(bookingId);
    setIsTermsModalOpen(true);
  }, [bookingListCtrl, pushHeaderNotification]);

  const handleRejectQuote = useCallback(async (bookingId, reason) => {
    try {
      const booking = bookingListCtrl.getBooking(bookingId);
      if (!booking?.quoteVersion) throw new Error('This quote is no longer available.');
      await rejectBookingQuote({ bookingId, quoteVersion: Number(booking.quoteVersion), reason });
      bookingListCtrl.replaceBooking(await fetchBookingById(bookingId));
      pushHeaderNotification('Quote Rejected', 'Your reason was sent to the worker so they can review or revise the quote.');
      setUiState('chat');
    } catch (error) {
      pushHeaderNotification('Quote Update Failed', error?.message || 'Unable to reject quote.');
    }
  }, [bookingListCtrl, pushHeaderNotification]);

  const handleProposeQuote = useCallback(async (bookingId, input) => {
    await proposeBookingQuote({ bookingId, ...input });
    bookingListCtrl.replaceBooking(await fetchBookingById(bookingId));
    pushHeaderNotification('Quote Sent', 'The client can now review the price and exact schedule.');
  }, [bookingListCtrl, pushHeaderNotification]);

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
        ['action-needed', 'Action needed'],
        ['scheduled', 'Scheduled'],
        ['delivered', 'Delivered'],
        ['all', 'All'],
        ['completed', 'Completed'],
        ['refunds', 'Refunds'],
        ['cancelled', 'Cancelled'],
      ]
    : [
        ['active', 'Active'],
        ['payment-due', 'Payment due'],
        ['delivered', 'Delivered'],
        ['all', 'All'],
        ['completed', 'Completed'],
        ['refunds', 'Refunds'],
        ['cancelled', 'Cancelled'],
      ];
  const allowedFilters = filterDefinitions.map(([value]) => value);
  const defaultFilter = shouldLoadSellerBookings ? 'scheduled' : 'active';
  const requestedFilter = searchParams.get('filter') || defaultFilter;
  const selectedDisplayFilter = allowedFilters.includes(requestedFilter) ? requestedFilter : defaultFilter;
  const displayFilters = filterDefinitions.map(([value, label]) => ({
    value,
    label,
    count: allBookings.filter((booking) => matchesBookingHubFilter(booking, value, activeScope)).length,
  }));
  const updateSearchParams = (updates, replace = false) => {
    const nextParams = new URLSearchParams(searchParams);
    Object.entries(updates).forEach(([key, value]) => {
      if (value && (key === 'filter' || value !== 'all')) nextParams.set(key, value);
      else nextParams.delete(key);
    });
    nextParams.set('scope', activeScope);
    setSearchParams(nextParams, { replace });
  };

  const handleScopeChange = (nextScope) => {
    const nextParams = new URLSearchParams();
    nextParams.set('scope', nextScope);
    const destination = nextScope === 'incoming' ? paths.workerBookings : paths.bookings;
    navigate(`${destination}?${nextParams.toString()}`);
  };

  const bookingSearch = searchParams.get('q') || '';
  const activeSearch = bookingSearch.trim().toLowerCase();

  const displayedBookings = useMemo(() => {
    let list = allBookings.filter((booking) => matchesBookingHubFilter(booking, selectedDisplayFilter, activeScope));
    if (activeSearch) {
      list = list.filter((booking) => matchesBookingSearch(booking, activeSearch));
    }
    return list;
  }, [activeScope, activeSearch, allBookings, selectedDisplayFilter]);
  const renderBookingCard = (booking) => {
    const scheduleHasPassed = hasPastUnpaidSchedule(booking);
    const statusMeta = getStatusMeta(scheduleHasPassed ? 'Reservation Expired' : booking.status);
    const StatusIcon = statusMeta.icon;
    const canPayNow = !shouldLoadSellerBookings && (
      ['Payment Pending', 'Slot Selected - Payment Pending'].includes(booking.status)
      || booking.paymentStatus === 'partially_paid') && !scheduleHasPassed;
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

          <ReservationStatus
            scheduleStatus={scheduleHasPassed ? 'passed' : booking.scheduleStatus}
            expiresAt={booking.holdExpiresAt}
            actionLabel={booking.quoteVersion ? 'Retry saved quote' : undefined}
            onChooseAnotherTime={!shouldLoadSellerBookings ? () => {
              setSelectedBookingId(booking.id);
              if (scheduleHasPassed) { setScheduleAction('checkout'); setUiState('slots'); }
              else if (booking.quoteVersion) setIsTermsModalOpen(true);
              else { setScheduleAction('checkout'); setUiState('slots'); }
            } : undefined}
          />

          <div className="booking-details-grid border border-orange-200 dark:border-orange-800/60">
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
                  {booking.paymentMethod === 'paymongo-card'
                    ? 'PayMongo Card'
                    : booking.paymentMethod === 'gcash-advance'
                    ? 'Legacy GCash'
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
        <BookingCardFooter
          amountLabel={shouldLoadSellerBookings ? 'Booking amount' : 'Service price'}
          amount={formatPhp(booking.quoteAmount || booking.totalChargedAmount || 0)}
          emphasizeAmount={shouldLoadSellerBookings}
          requestDate={shouldLoadSellerBookings ? booking.requestDate : undefined}
          platformFee={!shouldLoadSellerBookings && booking.transactionFeeAmount > 0 ? formatPhp(booking.transactionFeeAmount) : undefined}
          totalPayment={!shouldLoadSellerBookings && booking.totalChargedAmount > 0 ? formatPhp(booking.totalChargedAmount) : undefined}
          paymentProgress={booking.paymentPlan === 'downpayment' ? {
            paid: formatPhp(booking.amountPaid),
            balance: formatPhp(booking.balanceDueAmount),
          } : undefined}
          messageLabel={messageLabel}
          messageIsPrimary={!hasPrimaryWorkflowAction}
          onViewDetails={() => setDetailBookingId(booking.id)}
          onMessage={() => handleOpenChat(booking.id)}
          onReschedule={!shouldLoadSellerBookings && !['Completed Service', 'Cancelled', 'Cancelled (Cash)', 'Refunded'].includes(booking.status) && booking.selectedSlot ? () => {
            setSelectedBookingId(booking.id);
            setScheduleAction(scheduleHasPassed ? 'checkout' : 'reschedule'); setUiState('slots');
          } : undefined}
          onCancel={!shouldLoadSellerBookings && !['Completed Service', 'Cancelled', 'Cancelled (Cash)', 'Refunded'].includes(booking.status) ? () => setCancelBookingId(booking.id) : undefined}
        >
            {canPayNow && (
              <Button
                type="button"
                className="col-span-2 w-full sm:w-auto"
                onClick={() => handlePayBooking(booking.id)}
              >
                <CreditCard aria-hidden="true" />
                {booking.paymentStatus === 'partially_paid' ? 'Pay Balance' : 'Pay Now'}
              </Button>
            )}

            {shouldLoadSellerBookings && booking.cancellationStatus === 'requested' && (
              <Button type="button" onClick={() => setReviewRequest({ kind: 'cancellation', bookingId: booking.id })}>
                <CalendarX2 size={16} aria-hidden="true" />
                Review cancellation
              </Button>
            )}

            {shouldLoadSellerBookings && booking.rescheduleRequest && (
              <Button type="button" onClick={() => setReviewRequest({ kind: 'reschedule', bookingId: booking.id, requestId: booking.rescheduleRequest.id })}>
                <CalendarDays size={16} aria-hidden="true" />
                Review reschedule
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

            <BookingTransactionActions
              booking={booking}
              viewerRole={shouldLoadSellerBookings ? 'provider' : 'client'}
              onUpdated={bookingListCtrl.replaceBooking}
            />

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
        </BookingCardFooter>
      </article>
    );
  };

  const renderBookingsList = () => (
    <main className="gl-shell gl-page-pad bookings-launchpad">
      <section className="bookings-hero" aria-labelledby="bookings-title">
        <div className="bookings-hero-copy">
          <h1 id="bookings-title" className="gl-title !mt-0">{shouldLoadSellerBookings ? 'Bookings' : 'My Bookings'}</h1>
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

      {isWorkerAccount && !isChatRoute && <BookingScopeSwitcher value={activeScope} onValueChange={handleScopeChange} />}

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

      {(bookingListCtrl.loadError || bookingListCtrl.actionError) && <BookingListFeedback
        error={bookingListCtrl.loadError || bookingListCtrl.actionError}
        loading={bookingListCtrl.isLoading}
        onRetry={bookingListCtrl.refreshBookings}
      />}

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

      {!bookingListCtrl.isLoading && !bookingListCtrl.loadError && allBookings.length === 0 && (
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

      {!bookingListCtrl.isLoading && allBookings.length > 0 && displayedBookings.length === 0 && (
        <WorkflowEmptyState
          className="rounded-xl border bg-card"
          data-testid="bookings-filter-empty-state"
          icon={Filter}
          title="No matching bookings"
          description={selectedDisplayFilter === 'scheduled' && !bookingSearch ? 'No jobs are scheduled right now. Check another status or view all bookings.' : 'No bookings match your current search or status filter. View all bookings to reset the filters.'}
          action={<Button type="button" variant="outline" onClick={() => { bookingListCtrl.setActiveFilter('all'); bookingListCtrl.setDisplayFilter('all'); updateSearchParams({ filter: 'all', q: '' }); onSearchChange?.({ target: { value: '' } }); }}><RotateCcw size={16} aria-hidden="true" />View all bookings</Button>}
        />
      )}

      {displayedBookings.length > 0 && (
        <section className="bookings-list" aria-label="Bookings list">
          {displayedBookings.map((booking) => renderBookingCard(booking))}
        </section>
      )}
    </main>
  );

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
      <PaymentReturnStatus onBookingUpdated={bookingListCtrl.replaceBooking} />
      {isChatRoute && !currentBooking && <ChatArchiveBrowser viewerRole={shouldLoadSellerBookings ? 'seller' : 'buyer'} onRestored={bookingListCtrl.refreshBookings} />}
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
              onProposeQuote={(input) => handleProposeQuote(currentBooking.id, input)}
              onOpenSlotSelection={handleOpenSlotSelection}
              onOpenPaymentSelection={handleOpenPaymentSelection}
              onRequestRefund={(reason) => handleRequestRefund(currentBooking.id, reason)}
              onConfirmRefundReceived={() => handleConfirmRefundReceived(currentBooking.id)}
              onStopServiceAccepted={() => handleStopServiceAccepted(currentBooking.id)}
              onLeaveRating={handleLeaveRating}
              onArchiveChat={handleArchiveChat}
              onDeleteChat={handleDeleteChat}
              onChatRestored={bookingListCtrl.refreshBookings}
            />
          )}
          {uiState === 'slots' && (
            <SlotSelectionModal
              booking={currentBooking}
              action={scheduleAction}
              onConfirmSlot={(slotInfo) => handleConfirmSlot(currentBooking.id, slotInfo)}
              onCancel={handleBackToList}
            />
          )}
        </>
      )}

      <BookingDetailsDialog
        booking={detailBooking}
        isProviderView={shouldLoadSellerBookings}
        statusLabel={detailBooking ? getStatusMeta(detailBooking.status).label : ''}
        onClose={() => setDetailBookingId(null)}
        onMessage={(bookingId) => { setDetailBookingId(null); handleOpenChat(bookingId); }}
        onPay={!shouldLoadSellerBookings ? (bookingId) => { setDetailBookingId(null); handlePayBooking(bookingId); } : undefined}
      />
      <CancelBookingDialog
        open={Boolean(cancelBookingId)}
        serviceName={bookingListCtrl.getBooking(cancelBookingId)?.serviceType || 'booking'}
        hasVerifiedPayment={['partially_paid', 'paid'].includes(bookingListCtrl.getBooking(cancelBookingId)?.paymentStatus)}
        onCancel={() => setCancelBookingId(null)}
        onConfirm={handleCancelBooking}
      />

      <BookingRequestReviewDialog
        open={Boolean(reviewRequest)}
        title={reviewRequest?.kind === 'cancellation' ? 'Review cancellation request' : 'Review reschedule request'}
        description={reviewRequest?.kind === 'cancellation'
          ? 'Approving releases the schedule and marks the verified payment for refund review. No refund is issued automatically.'
          : 'Approving rechecks availability before replacing the current schedule. Declining keeps the existing time.'}
        onClose={() => setReviewRequest(null)}
        onDecision={handleReviewRequest}
      />

      {currentBooking && uiState === 'payment' && (
        <PaymentModal
          booking={pendingCheckoutSlot?.bookingId === currentBooking.id
            ? { ...currentBooking, selectedSlot: pendingCheckoutSlot.slot }
            : currentBooking}
          onSelectPayment={(method, mockPayment) => handleSelectPaymentMethod(currentBooking.id, method, mockPayment)}
          onCancel={handleBackToList}
          confirmLabel={currentBooking.paymentStatus === 'partially_paid' ? 'Pay remaining balance' : 'Reserve and continue'}
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
        onCancel={() => { setIsTermsModalOpen(false); if (pendingCheckoutSlot) setUiState('slots'); }}
        onConfirm={handleConfirmPaymentTerms}
      />
    </div>
  );
};

export default MyBookings;
