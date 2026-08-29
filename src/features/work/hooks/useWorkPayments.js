import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  approveBookingRefund,
  fetchSellerBookings,
  reviewCashConfirmation,
} from '../../bookings/services/bookingService';

const mapBookingToTransaction = (booking) => {
  const paymentMethod = booking.paymentMethod || '';
  const isCash = paymentMethod === 'after-service-cash';
  const isAfterService = paymentMethod === 'after-service-cash' || paymentMethod === 'after-service-gcash';
  const isPaid = booking.paymentStatus === 'paid' || booking.paymentStatus === 'refunded';

  return {
    id: booking.id,
    clientName: booking.clientName || 'Client',
    clientPhoto: booking.clientPhoto || '',
    service: booking.serviceType || 'Service',
    scheduleRef: booking.selectedSlot?.timeBlock?.id || booking.selectedSlot?.slotId || booking.id,
    paymentMode: isAfterService ? 'After Service' : 'Advance',
    paymentChannel: isCash ? 'cash' : 'gcash',
    isPaid,
    isDone: booking.deliveryStatus === 'seller_claimed' || booking.deliveryStatus === 'buyer_confirmed' || booking.status === 'Refunded',
    weekOffset: 0,
    expectedCashAmount: booking.expectedCashAmount || booking.quoteAmount || 0,
    submittedCashAmount: booking.submittedCashAmount || 0,
    cashConfirmationStatus: booking.cashConfirmationStatus,
    cashCollectionStatus: booking.cashCollectionStatus,
    cashConfirmationQrId: booking.cashVerifierQrId,
    transactionId: booking.transactionId || booking.paymentReference || '',
    refundStatus: booking.refundStatus,
    refundAmount: booking.refundAmount || booking.quoteAmount || 0,
    refundReason: booking.refundReason || '',
    refundReference: booking.refundReference || '',
    bookingStatus: booking.status,
    sourceBookingId: booking.id,
    rawBooking: booking,
  };
};

export const useWorkPayments = ({ sellerId = null, weekOffset = 0 } = {}) => {
  const [transactions, setTransactions] = useState([]);
  const [cashPaymentView, setCashPaymentView] = useState('pending');
  const [cashDecisionTarget, setCashDecisionTarget] = useState(null);
  const [paymentError, setPaymentError] = useState('');

  const refreshSellerTransactions = useCallback(async () => {
    if (!sellerId) {
      setTransactions([]);
      return [];
    }

    try {
      setPaymentError('');
      const bookings = await fetchSellerBookings(sellerId);
      const mapped = bookings.map(mapBookingToTransaction);
      setTransactions(mapped);
      return mapped;
    } catch (error) {
      setPaymentError(error?.message || 'Unable to load seller payments.');
      return [];
    }
  }, [sellerId]);

  useEffect(() => {
    refreshSellerTransactions();
  }, [refreshSellerTransactions]);

  const weekTransactions = useMemo(
    () => transactions.filter((transaction) => transaction.weekOffset === weekOffset),
    [transactions, weekOffset]
  );

  const allCashTransactions = weekTransactions.filter((transaction) => transaction.paymentChannel === 'cash');
  const cashConfirmationNotifications =
    cashPaymentView === 'pending'
      ? allCashTransactions.filter((transaction) => (
        transaction.cashConfirmationStatus === 'pending-worker-review'
        && transaction.cashCollectionStatus !== 'seller_claimed'
        && transaction.cashCollectionStatus !== 'buyer_acknowledged'
      ))
      : allCashTransactions.filter((transaction) => (
        transaction.cashConfirmationStatus === 'approved'
        || transaction.cashConfirmationStatus === 'denied'
        || transaction.cashCollectionStatus === 'seller_claimed'
        || transaction.cashCollectionStatus === 'buyer_acknowledged'
      ));

  const refundTransactions = weekTransactions.filter((transaction) => Boolean(transaction.refundStatus));
  const cancelledCashTransactions = weekTransactions.filter(
    (transaction) => transaction.bookingStatus === 'Cancelled (Cash)' && transaction.paymentChannel === 'cash'
  );

  const handleReviewCashConfirmation = useCallback(async (transactionId, decision) => {
    const target = transactions.find((transaction) => transaction.id === transactionId);
    if (!target?.sourceBookingId) return null;

    const updated = await reviewCashConfirmation(target.sourceBookingId, decision);
    setTransactions((prev) => prev.map((transaction) => (
      transaction.id === transactionId ? mapBookingToTransaction(updated) : transaction
    )));
    return updated;
  }, [transactions]);

  const handleRequestCashConfirmationReview = useCallback((transaction, decision) => {
    setCashDecisionTarget({
      transactionId: transaction.id,
      clientName: transaction.clientName,
      service: transaction.service,
      submittedCashAmount: transaction.submittedCashAmount || 0,
      expectedCashAmount: transaction.expectedCashAmount || 0,
      decision,
    });
  }, []);

  const handleCloseCashDecisionModal = useCallback(() => {
    setCashDecisionTarget(null);
  }, []);

  const handleConfirmCashDecision = useCallback(async () => {
    if (!cashDecisionTarget) return;
    try {
      setPaymentError('');
      await handleReviewCashConfirmation(cashDecisionTarget.transactionId, cashDecisionTarget.decision);
      setCashDecisionTarget(null);
    } catch (error) {
      setPaymentError(error?.message || 'Unable to update cash confirmation.');
    }
  }, [cashDecisionTarget, handleReviewCashConfirmation]);

  const handleApproveRefund = useCallback(async (transactionId) => {
    const target = transactions.find((transaction) => transaction.id === transactionId);
    if (!target?.sourceBookingId) return null;

    try {
      setPaymentError('');
      const updated = await approveBookingRefund(target.sourceBookingId);
      setTransactions((prev) => prev.map((transaction) => (
        transaction.id === transactionId ? mapBookingToTransaction(updated) : transaction
      )));
      return updated;
    } catch (error) {
      setPaymentError(error?.message || 'Unable to approve refund.');
      return null;
    }
  }, [transactions]);

  return {
    allCashTransactions,
    cancelledCashTransactions,
    cashConfirmationNotifications,
    cashDecisionTarget,
    cashPaymentView,
    handleApproveRefund,
    handleCloseCashDecisionModal,
    handleConfirmCashDecision,
    handleRequestCashConfirmationReview,
    handleReviewCashConfirmation,
    paymentError,
    refreshSellerTransactions,
    refundTransactions,
    setCashPaymentView,
    setPaymentError,
    setTransactions,
    transactions,
    weekTransactions,
  };
};

export default useWorkPayments;
