import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
  Home,
  MessageCircle,
  Receipt,
  RotateCcw,
  Search,
  ShieldCheck,
  Star,
  X,
} from 'lucide-react';
import DashboardNavigation from '../../../shared/components/DashboardNavigation';
import ChatWindow from '../components/ChatWindow';
import SlotSelectionModal from '../components/SlotSelectionModal';
import PaymentModal from '../components/PaymentModal';
import BookingTermsModal from '../components/BookingTermsModal';

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

const formatPhp = (value) => `\u20B1${Number(value || 0).toLocaleString('en-PH', {
  minimumFractionDigits: Number(value || 0) % 1 === 0 ? 0 : 2,
  maximumFractionDigits: 2,
})}`;

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
  const shouldLoadSellerBookings = isWorkerProfile(sellerProfile) && !isAdminProfile;
  const isChatRoute = currentView === 'chat';

  // Main booking list controller
  const bookingListCtrl = useBookingListController([], {
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
  const [localSearchTerm, setLocalSearchTerm] = useState('');

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
    onOpenChatPage?.(bookingId);
  }, [onOpenChatPage]);

  // Slot selection
  const handleOpenSlotSelection = useCallback(() => {
    setUiState('slots');
  }, []);

  const handleLeaveRating = useCallback(async (payload) => {
    try {
      await ratingCtrl.handleLeaveRating(payload);
    } catch (error) {
      pushHeaderNotification('Rating Failed', error?.message || 'Unable to save rating right now.');
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
    allBookings.filter((b) =>
      [
        'Negotiating',
        'Awaiting Slot Selection',
        'Payment Pending',
        'Downpayment Paid',
        'Slot Selected - Payment Pending',
        'Cash Verification Pending',
        'Refund Processing',
      ].includes(b.status)
    ).length
  ), [allBookings]);

  const metrics = useMemo(() => [
    {
      label: 'Total Bookings',
      value: bookingListCtrl.isLoading && allBookings.length === 0 ? '...' : String(allBookings.length),
      icon: CalendarCheck,
      accent: 'blue',
    },
    {
      label: 'Active & Scheduled',
      value: bookingListCtrl.isLoading && allBookings.length === 0 ? '...' : String(activeBookingsCount),
      icon: Clock,
      accent: 'emerald',
    },
    {
      label: 'Completed',
      value: bookingListCtrl.isLoading && allBookings.length === 0 ? '...' : String(completedBookingsCount),
      icon: CheckCircle2,
      accent: 'slate',
    },
    {
      label: 'Action Needed',
      value: bookingListCtrl.isLoading && allBookings.length === 0 ? '...' : String(pendingActionCount),
      icon: AlertCircle,
      accent: 'amber',
    },
  ], [bookingListCtrl.isLoading, allBookings.length, activeBookingsCount, completedBookingsCount, pendingActionCount]);

  const statusFilters = [
    { key: 'all', label: 'All', count: allBookings.length },
    { key: 'active', label: 'Active', count: activeBookingsCount },
    { key: 'completed', label: 'Completed', count: completedBookingsCount },
  ];

  const displayFilters = [
    { key: 'all', label: 'All types' },
    { key: 'cash-approvals', label: 'Cash' },
    { key: 'refunds', label: 'Refunds' },
    { key: 'cancelled', label: 'Cancelled' },
  ];

  // Search filter applied on top of list controller
  const activeSearch = (searchQuery || localSearchTerm).trim().toLowerCase();

  const displayedBookings = useMemo(() => {
    let list = bookingListCtrl.filteredBookings;
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
  }, [bookingListCtrl.filteredBookings, activeSearch]);

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

    return (
      <article
        key={booking.id}
        className="booking-card-modern"
        data-testid={`booking-card-${booking.id}`}
      >
        <div className="booking-card-header">
          <div className="booking-provider-info">
            <div className="booking-provider-avatar">
              {getAvatarInitials(booking.workerName)}
            </div>
            <div className="booking-provider-details">
              <h3 className="booking-worker-title">
                {booking.workerName}
                <span className="booking-service-tag">{booking.serviceType}</span>
              </h3>
              <span style={{ fontSize: '12px', color: 'var(--gl-text-3)', fontWeight: 600 }}>
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
                  {booking.selectedSlot?.timeBlock
                    ? `${booking.selectedSlot.timeBlock.startTime} - ${booking.selectedSlot.timeBlock.endTime}`
                    : 'Coordinated in chat'}
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
                  <code style={{ fontSize: '12px', fontWeight: 700, color: 'var(--gl-blue)', background: 'var(--gl-accent-soft)', padding: '2px 6px', borderRadius: '4px' }}>
                    {booking.paymentReference}
                  </code>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="booking-card-footer">
          <div className="booking-price-box">
            <span className="booking-price-label">Price:</span>
            <span className="booking-price-value">
              {formatPhp(booking.quoteAmount || booking.totalChargedAmount || 0)}
            </span>
            {booking.transactionFeeAmount > 0 && (
              <span style={{ fontSize: '12px', color: 'var(--gl-text-3)', fontWeight: 600 }}>
                (+{formatPhp(booking.transactionFeeAmount)} fee)
              </span>
            )}
            {booking.paymentPlan === 'downpayment' && (
              <span style={{ fontSize: '12px', color: 'var(--gl-text-3)', fontWeight: 600 }}>
                Paid: {formatPhp(booking.amountPaid)} · Balance: {formatPhp(booking.balanceDueAmount)}
              </span>
            )}
          </div>

          <div className="booking-card-actions">
            <button
              type="button"
              className="gl-button secondary"
              onClick={() => setDetailBookingId(booking.id)}
            >
              <Eye size={16} aria-hidden="true" />
              View Details
            </button>

            {canPayNow && (
              <button
                type="button"
                className="gl-button primary"
                onClick={() => handlePayBooking(booking.id)}
              >
                <CreditCard size={16} aria-hidden="true" />
                {booking.paymentStatus === 'partially_paid' ? 'Pay Balance' : 'Pay Now'}
              </button>
            )}

            <button
              type="button"
              className="gl-button primary"
              onClick={() => handleOpenChat(booking.id)}
            >
              <MessageCircle size={16} aria-hidden="true" />
              Open Chat
            </button>

            {!shouldLoadSellerBookings && booking.cashCollectionStatus === 'seller_claimed' && (
              <button
                type="button"
                className="gl-button secondary"
                onClick={() => handleAcknowledgeCashPayment(booking.id)}
              >
                <ShieldCheck size={16} aria-hidden="true" />
                Acknowledge Cash
              </button>
            )}

            {!shouldLoadSellerBookings && booking.deliveryStatus === 'seller_claimed' && (
              <button
                type="button"
                className="gl-button primary"
                disabled={booking.paymentStatus !== 'paid'}
                title={booking.paymentStatus === 'paid' ? 'Confirm that the service was delivered' : 'Payment confirmation is required first'}
                onClick={() => handleConfirmCompletion(booking.id)}
              >
                <CheckCircle2 size={16} aria-hidden="true" />
                Confirm Completion
              </button>
            )}

            {booking.canRate && (
              <button
                type="button"
                className="gl-button secondary"
                style={{ borderColor: 'var(--gl-amber)', color: 'var(--gl-amber)' }}
                onClick={() => handleOpenChat(booking.id)}
              >
                <Star size={16} aria-hidden="true" />
                Rate Service
              </button>
            )}
          </div>
        </div>
      </article>
    );
  };

  const renderBookingsList = () => (
    <main className="gl-shell gl-page-pad bookings-launchpad">
      {/* Hero Overview Header */}
      <section className="bookings-hero" aria-labelledby="bookings-title">
        <div className="bookings-hero-copy">
          <span className="gl-eyebrow">
            <CalendarCheck size={15} aria-hidden="true" />
            Booking Hub
          </span>
          <h1 id="bookings-title" className="gl-title">My Bookings</h1>
          <p className="gl-subtitle">
            Track your scheduled appointments, active service orders, payments, refunds, and provider conversations.
          </p>
        </div>

        <div className="bookings-hero-actions">
          <button
            className="gl-button primary"
            type="button"
            onClick={onOpenBrowseServices}
          >
            <Search size={16} aria-hidden="true" />
            Browse Services
          </button>
          {shouldLoadSellerBookings && (
            <button
              className="gl-button secondary"
              type="button"
              onClick={onOpenMyWork}
            >
              My Work Desk
            </button>
          )}
        </div>
      </section>

      {/* KPI Overview Metrics Grid */}
      <section className="bookings-metric-grid" aria-label="Bookings metrics snapshot">
        {metrics.map((item) => {
          const Icon = item.icon;
          return (
            <article className={`bookings-metric-card accent-${item.accent}`} key={item.label}>
              <span className="bookings-metric-icon">
                <Icon size={20} aria-hidden="true" />
              </span>
              <div>
                <p className="bookings-metric-value">{item.value}</p>
                <h3>{item.label}</h3>
              </div>
            </article>
          );
        })}
      </section>

      {/* Unified Search and Filter Toolbar */}
      <section className="bookings-toolbar gl-card" aria-label="Bookings filters and search">
        <div className="bookings-toolbar-top">
          <div className="bookings-search-box">
            <Search size={16} aria-hidden="true" />
            <input
              type="text"
              className="bookings-search-input"
              placeholder="Search by worker, service, or reference..."
              value={activeSearch}
              onChange={(e) => {
                setLocalSearchTerm(e.target.value);
                onSearchChange?.(e);
              }}
              aria-label="Search bookings"
            />
            {activeSearch && (
              <button
                type="button"
                className="bookings-search-clear"
                onClick={() => {
                  setLocalSearchTerm('');
                  onSearchChange?.({ target: { value: '' } });
                }}
                aria-label="Clear search"
              >
                <X size={15} />
              </button>
            )}
          </div>

          <div className="bookings-filter-tabs" role="tablist" aria-label="Booking status filters">
            {statusFilters.map((filter) => (
              <button
                key={filter.key}
                type="button"
                role="tab"
                aria-selected={bookingListCtrl.activeFilter === filter.key}
                className={`bookings-tab-btn ${bookingListCtrl.activeFilter === filter.key ? 'active' : ''}`}
                onClick={() => bookingListCtrl.setActiveFilter(filter.key)}
              >
                <span>{filter.label}</span>
                <span className="bookings-tab-badge">{filter.count}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="bookings-toolbar-sub">
          <div className="bookings-sub-pills" aria-label="Payment and dispute filters">
            <span style={{ fontSize: '12px', fontWeight: 800, color: 'var(--gl-text-3)', textTransform: 'uppercase', marginRight: '4px' }}>
              Filter by:
            </span>
            {displayFilters.map((filter) => (
              <button
                key={filter.key}
                type="button"
                className={`bookings-sub-pill ${bookingListCtrl.displayFilter === filter.key ? 'active' : ''}`}
                onClick={() => bookingListCtrl.setDisplayFilter(filter.key)}
              >
                {filter.label}
              </button>
            ))}
          </div>

          <p className="bookings-count-label">
            Showing <strong>{displayedBookings.length}</strong> of {allBookings.length} booking{allBookings.length === 1 ? '' : 's'}
          </p>
        </div>
      </section>

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
        <div className="bookings-empty-card" data-testid="bookings-empty-state">
          <div className="bookings-empty-icon-box">
            <CalendarX2 size={32} aria-hidden="true" />
          </div>
          <div>
            <h2 className="bookings-empty-title">No bookings yet</h2>
            <p className="bookings-empty-desc">
              {shouldLoadSellerBookings
                ? 'Client booking requests and service appointments for your profile will appear here.'
                : 'You haven\'t booked any services yet. Discover top-rated local providers for home tutoring, appliance repair, cleaning, and more.'}
            </p>
          </div>

          <div className="bookings-empty-actions">
            <button
              type="button"
              className="gl-button primary"
              onClick={onOpenBrowseServices}
            >
              <Search size={16} aria-hidden="true" />
              Browse Marketplace
            </button>
            <button
              type="button"
              className="gl-button secondary"
              onClick={onOpenDashboard}
            >
              <Home size={16} aria-hidden="true" />
              Back to Dashboard
            </button>
          </div>

          <div className="bookings-quick-categories">
            <span style={{ fontSize: '12px', color: 'var(--gl-text-3)', fontWeight: 800, textTransform: 'uppercase' }}>
              Explore:
            </span>
            {['Tutor', 'Technician', 'Cleaner', 'More Services'].map((cat) => (
              <button
                key={cat}
                type="button"
                className="bookings-quick-category-pill"
                onClick={onOpenBrowseServices}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Filter Empty State: Filter/Search yielded 0 results */}
      {!bookingListCtrl.isLoading && allBookings.length > 0 && displayedBookings.length === 0 && (
        <div className="bookings-empty-card" data-testid="bookings-filter-empty-state">
          <div
            className="bookings-empty-icon-box"
            style={{
              background: 'var(--gl-warning-soft)',
              color: 'var(--gl-amber)',
              borderColor: 'var(--gl-warning-border)',
            }}
          >
            <Filter size={32} aria-hidden="true" />
          </div>
          <div>
            <h2 className="bookings-empty-title">No matching bookings</h2>
            <p className="bookings-empty-desc">
              No bookings match your current filter or search criteria. Try clearing search keywords or selecting another status tab.
            </p>
          </div>
          <div className="bookings-empty-actions">
            <button
              type="button"
              className="gl-button secondary"
              onClick={() => {
                bookingListCtrl.setActiveFilter('all');
                bookingListCtrl.setDisplayFilter('all');
                setLocalSearchTerm('');
                onSearchChange?.({ target: { value: '' } });
              }}
            >
              <RotateCcw size={16} aria-hidden="true" />
              Reset All Filters
            </button>
          </div>
        </div>
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
          <div className="bookings-empty-card">
            <div className="bookings-empty-icon-box">
              <MessageCircle size={32} aria-hidden="true" />
            </div>
            <div>
              <h2 className="bookings-empty-title">No conversations yet</h2>
              <p className="bookings-empty-desc">
                {shouldLoadSellerBookings
                  ? 'Client booking requests and conversations for your services will appear here.'
                  : 'Start a booking from the marketplace to open a conversation here.'}
              </p>
            </div>
            <div className="bookings-empty-actions">
              <button
                type="button"
                className="gl-button primary"
                onClick={onOpenBrowseServices}
              >
                <Search size={16} aria-hidden="true" />
                Browse Services
              </button>
            </div>
          </div>
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

      {detailBooking && (
        <div
          className="booking-detail-modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setDetailBookingId(null);
          }}
        >
          <section
            className="booking-detail-modal gl-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="booking-detail-title"
          >
            <header className="booking-detail-modal-header">
              <div>
                <span className="gl-eyebrow">Booking details</span>
                <h2 id="booking-detail-title">{detailBooking.serviceType}</h2>
                <p>{detailBooking.workerName}</p>
              </div>
              <button
                type="button"
                className="booking-detail-modal-close"
                aria-label="Close booking details"
                onClick={() => setDetailBookingId(null)}
              >
                <X size={20} aria-hidden="true" />
              </button>
            </header>

            <div className="booking-detail-modal-grid">
              <div><span>Status</span><strong>{getStatusMeta(detailBooking.status).label}</strong></div>
              <div><span>Date</span><strong>{detailBooking.selectedSlot?.date || detailBooking.requestDate || 'Coordinated in chat'}</strong></div>
              <div><span>Time</span><strong>{detailBooking.selectedSlot?.timeBlock ? `${detailBooking.selectedSlot.timeBlock.startTime} - ${detailBooking.selectedSlot.timeBlock.endTime}` : 'Coordinated in chat'}</strong></div>
              <div><span>Payment</span><strong>{detailBooking.paymentMethod === 'gcash-advance' ? 'GCash Advance' : 'Pending Selection'}</strong></div>
              <div><span>Service price</span><strong>{formatPhp(detailBooking.quoteAmount || 0)}</strong></div>
              <div><span>Total charged</span><strong>{formatPhp(detailBooking.totalChargedAmount || detailBooking.quoteAmount || 0)}</strong></div>
              {detailBooking.paymentReference && <div><span>Reference</span><strong>{detailBooking.paymentReference}</strong></div>}
              {detailBooking.completedAt && <div><span>Completed</span><strong>{new Date(detailBooking.completedAt).toLocaleDateString('en-PH')}</strong></div>}
            </div>

            {detailBooking.description && <p className="booking-detail-modal-description">{detailBooking.description}</p>}

            <footer className="booking-detail-modal-actions">
              <button type="button" className="gl-button secondary" onClick={() => setDetailBookingId(null)}>Close</button>
              <button
                type="button"
                className="gl-button primary"
                onClick={() => {
                  setDetailBookingId(null);
                  handleOpenChat(detailBooking.id);
                }}
              >
                <MessageCircle size={16} aria-hidden="true" />
                Open Chat
              </button>
            </footer>
          </section>
        </div>
      )}

      {currentBooking && uiState === 'payment' && (
        <PaymentModal
          booking={currentBooking}
          onSelectPayment={(method, mockPayment) => handleSelectPaymentMethod(currentBooking.id, method, mockPayment)}
          onCancel={handleBackToList}
          confirmLabel={currentBooking.paymentStatus === 'partially_paid' ? 'Pay Remaining Balance' : 'Submit Payment'}
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
