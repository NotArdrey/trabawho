import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import {
  fetchClientBookings,
  fetchSellerBookings,
  submitBookingReview,
  updateBookingWorkflow,
} from '../services/bookingService';
import { isSupabaseConfigured, supabase } from '../../../shared/services/supabaseClient';

const COMPLETED_STATUSES = ['Completed Service', 'Service Stopped'];
const TERMINAL_STATUSES = [...COMPLETED_STATUSES, 'Cancelled', 'Cancelled (Cash)', 'Refunded'];
const PAYMENT_PENDING_STATUSES = ['Payment Pending', 'Slot Selected - Payment Pending', 'Downpayment Paid'];

export function useBookingListController(initialBookings = [], options = {}) {
  const { autoLoad = true, includeStandaloneChats = false, listRole = 'buyer', sellerId = null } = options;
  const sourceKey = `${listRole}:${sellerId || 'current'}:${includeStandaloneChats ? 'chats' : 'bookings'}`;
  const [bookings, setBookings] = useState(Array.isArray(initialBookings) ? initialBookings : []);
  const [loadedSourceKey, setLoadedSourceKey] = useState(autoLoad ? '' : sourceKey);
  const [activeFilter, setActiveFilter] = useState('all');
  const [displayFilter, setDisplayFilter] = useState('all');
  const [isLoading, setIsLoading] = useState(Boolean(autoLoad));
  const [loadError, setLoadError] = useState('');
  const [actionError, setActionError] = useState('');
  const activeRequestRef = useRef(0);

  const refreshBookings = useCallback(async () => {
    const requestId = activeRequestRef.current + 1;
    activeRequestRef.current = requestId;
    const isLatestRequest = () => activeRequestRef.current === requestId;

    try {
      setIsLoading(true);
      setLoadError('');
      const rows = listRole === 'seller'
        ? await fetchSellerBookings(sellerId, { includeStandaloneChats })
        : await fetchClientBookings({ includeStandaloneChats });
      if (isLatestRequest()) {
        setBookings(rows);
        setLoadedSourceKey(sourceKey);
      }
      return rows;
    } catch (error) {
      if (isLatestRequest()) {
        setLoadError(error?.message || 'Unable to load bookings.');
      }
      return [];
    } finally {
      if (isLatestRequest()) {
        setIsLoading(false);
      }
    }
  }, [includeStandaloneChats, listRole, sellerId, sourceKey]);

  useEffect(() => {
    if (!autoLoad) return undefined;
    refreshBookings();
    return () => {
      activeRequestRef.current += 1;
    };
  }, [autoLoad, refreshBookings]);

  useEffect(() => {
    if (!autoLoad || !isSupabaseConfigured) return undefined;

    let refreshTimer = null;
    const queueRefresh = () => {
      window.clearTimeout(refreshTimer);
      refreshTimer = window.setTimeout(() => void refreshBookings(), 250);
    };
    const channel = supabase
      .channel(`booking-hub-${listRole}-${sellerId || 'current'}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, queueRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversations' }, queueRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, queueRefresh)
      .subscribe();

    return () => {
      window.clearTimeout(refreshTimer);
      void supabase.removeChannel(channel);
    };
  }, [autoLoad, listRole, refreshBookings, sellerId]);

  const visibleBookings = loadedSourceKey === sourceKey ? bookings : [];

  const replaceBooking = useCallback((updatedBooking) => {
    if (!updatedBooking?.id) return;
    setBookings((prevBookings) => {
      const exists = prevBookings.some((booking) => booking.id === updatedBooking.id);
      if (!exists) return [updatedBooking, ...prevBookings];
      return prevBookings.map((booking) => (
        booking.id === updatedBooking.id ? updatedBooking : booking
      ));
    });
  }, []);

  const getBooking = useCallback((bookingId) => (
    visibleBookings.find((booking) => String(booking.id) === String(bookingId)) || null
  ), [visibleBookings]);

  const persistBookingUpdate = useCallback(async (bookingId, updates) => {
    const current = getBooking(bookingId);
    if (!current) return null;

    try {
      setActionError('');
      const updated = updates.rating !== undefined
        ? await submitBookingReview(current, updates.rating, updates.review || '', updates.reviewImage || null)
        : await updateBookingWorkflow(current, updates);
      replaceBooking(updated);
      return updated;
    } catch (error) {
      setActionError(error?.message || 'Unable to update booking.');
      throw error;
    }
  }, [getBooking, replaceBooking]);

  const handleApproveQuote = useCallback((bookingId) => {
    const booking = getBooking(bookingId);
    const isRequestBooking = booking?.bookingMode === 'calendar-only' || booking?.isRequestBooking;

    return persistBookingUpdate(bookingId, {
      quoteApproved: true,
      quoteRejectionReason: null,
      status: isRequestBooking ? 'Payment Pending' : 'Awaiting Slot Selection',
      dbStatus: 'pending',
    });
  }, [getBooking, persistBookingUpdate]);

  const handleRejectQuote = useCallback((bookingId, reason) => (
    persistBookingUpdate(bookingId, {
      quoteApproved: false,
      quoteRejectionReason: reason,
      status: 'Quote Rejected',
      dbStatus: 'pending',
    })
  ), [persistBookingUpdate]);

  const handleStopServiceAccepted = useCallback((bookingId) => (
    persistBookingUpdate(bookingId, {
      status: 'Service Stopped',
      serviceActive: false,
      stopRequested: true,
      workerStopApproved: true,
      canRate: false,
      nextChargeDate: null,
      dbStatus: 'cancelled',
    })
  ), [persistBookingUpdate]);

  const updateBooking = useCallback((bookingId, updates) => (
    persistBookingUpdate(bookingId, updates)
  ), [persistBookingUpdate]);

  const statusFilteredBookings = useMemo(() => (
    visibleBookings.filter((booking) => {
      if (activeFilter === 'completed') {
        return COMPLETED_STATUSES.includes(booking.status);
      }
      if (activeFilter === 'active') {
        return !TERMINAL_STATUSES.includes(booking.status);
      }
      return true;
    })
  ), [activeFilter, visibleBookings]);

  const filteredBookings = useMemo(() => (
    statusFilteredBookings.filter((booking) => {
      if (displayFilter === 'cash-approvals') {
        return booking.paymentMethod === 'after-service-cash';
      }
      if (displayFilter === 'payment-pending') {
        return PAYMENT_PENDING_STATUSES.includes(booking.status)
          || ['pending_provider', 'partially_paid'].includes(booking.paymentStatus);
      }
      if (displayFilter === 'paid') {
        return booking.paymentStatus === 'paid';
      }
      if (displayFilter === 'completed') {
        return COMPLETED_STATUSES.includes(booking.status);
      }
      if (displayFilter === 'refunds') {
        return Boolean(booking.refundStatus) || ['Refund Processing', 'Refunded'].includes(booking.status);
      }
      if (displayFilter === 'cancelled') {
        return ['Cancelled', 'Cancelled (Cash)'].includes(booking.status);
      }
      return true;
    })
  ), [statusFilteredBookings, displayFilter]);

  return {
    actionError,
    activeFilter,
    bookings: visibleBookings,
    displayFilter,
    filteredBookings,
    getBooking,
    handleApproveQuote,
    handleRejectQuote,
    handleStopServiceAccepted,
    isLoading: isLoading || loadedSourceKey !== sourceKey,
    loadError,
    refreshBookings,
    replaceBooking,
    setActionError,
    setActiveFilter,
    setDisplayFilter,
    setLoadError,
    updateBooking,
  };
}

