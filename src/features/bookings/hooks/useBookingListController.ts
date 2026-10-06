import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import {
  fetchClientBookings,
  fetchSellerBookings,
  submitBookingReview,
  updateBookingWorkflow,
} from '@/features/bookings/services/bookingService';
import { useBookingActivity } from './useBookingActivity';
import { matchesBookingHubFilter, matchesBookingDisplayFilter } from '../utils/bookingFilters';

export interface BookingListItem {
  id: string;
  status: string;
  paymentStatus?: string;
  paymentMethod?: string | null;
  refundStatus?: string | null;
  bookingMode?: string;
  isRequestBooking?: boolean;
}
interface Options {
  autoLoad?: boolean;
  includeStandaloneChats?: boolean;
  listRole?: "buyer" | "seller";
  sellerId?: string | null;
}
type BookingUpdates = Record<string, unknown> & { rating?: number; review?: string; reviewImage?: File | null };
const saveReview = submitBookingReview as unknown as (booking: BookingListItem, rating: number, review: string, image: File | null) => Promise<BookingListItem>;
function loadErrorMessage(error: unknown) {
  if (error instanceof Error && /sign in/i.test(error.message)) return "Please sign in again to load your bookings.";
  return "Bookings could not be loaded. Check your connection and retry.";
}

export function useBookingListController(initialBookings: BookingListItem[] = [], options: Options = {}) {
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
      setActionError('');
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
        setLoadError(loadErrorMessage(error));
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
    let active = true;
    queueMicrotask(() => { if (active) void refreshBookings(); });
    return () => {
      active = false;
      activeRequestRef.current += 1;
    };
  }, [autoLoad, refreshBookings]);

  useBookingActivity(refreshBookings, autoLoad);

  const visibleBookings = useMemo(() => loadedSourceKey === sourceKey ? bookings : [], [bookings, loadedSourceKey, sourceKey]);

  const replaceBooking = useCallback((updatedBooking: BookingListItem) => {
    if (!updatedBooking?.id) return;
    setBookings((prevBookings) => {
      const exists = prevBookings.some((booking) => booking.id === updatedBooking.id);
      if (!exists) return [updatedBooking, ...prevBookings];
      return prevBookings.map((booking) => (
        booking.id === updatedBooking.id ? updatedBooking : booking
      ));
    });
  }, []);

  const getBooking = useCallback((bookingId: string) => (
    visibleBookings.find((booking) => String(booking.id) === String(bookingId)) || null
  ), [visibleBookings]);

  const persistBookingUpdate = useCallback(async (bookingId: string, updates: BookingUpdates) => {
    const current = getBooking(bookingId);
    if (!current) return null;

    try {
      setActionError('');
      const updated = updates.rating !== undefined
        ? await saveReview(current, updates.rating, updates.review || '', updates.reviewImage || null)
        : await updateBookingWorkflow(current, updates);
      replaceBooking({ ...current, ...updated });
      return updated;
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Unable to update booking.');
      throw error;
    }
  }, [getBooking, replaceBooking]);

  const handleApproveQuote = useCallback((bookingId: string) => {
    const booking = getBooking(bookingId);
    const isRequestBooking = booking?.bookingMode === 'calendar-only' || booking?.isRequestBooking;

    return persistBookingUpdate(bookingId, {
      quoteApproved: true,
      quoteRejectionReason: null,
      status: isRequestBooking ? 'Payment Pending' : 'Awaiting Slot Selection',
      dbStatus: 'pending',
    });
  }, [getBooking, persistBookingUpdate]);

  const handleRejectQuote = useCallback((bookingId: string, reason: string) => (
    persistBookingUpdate(bookingId, {
      quoteApproved: false,
      quoteRejectionReason: reason,
      status: 'Quote Rejected',
      dbStatus: 'pending',
    })
  ), [persistBookingUpdate]);

  const handleStopServiceAccepted = useCallback((bookingId: string) => (
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

  const updateBooking = useCallback((bookingId: string, updates: BookingUpdates) => (
    persistBookingUpdate(bookingId, updates)
  ), [persistBookingUpdate]);

  const filteredBookings = useMemo(() => visibleBookings.filter((booking) =>
    matchesBookingHubFilter(booking, activeFilter, listRole === 'seller' ? 'incoming' : 'purchases')
    && matchesBookingDisplayFilter(booking, displayFilter)
  ), [visibleBookings, activeFilter, displayFilter, listRole]);

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
    isLoading: isLoading || (loadedSourceKey !== sourceKey && !loadError),
    hasLoaded: loadedSourceKey === sourceKey,
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

