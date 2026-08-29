import {
  approveBookingRefund,
  buildTransactionId,
  buildRefundReference,
  reviewCashConfirmation,
} from '../../bookings/services/bookingService';

export const INITIAL_TRANSACTIONS = [];

export const mapBookingToWorkTransaction = (booking) => {
  const paymentMethod = booking?.paymentMethod || '';
  const isCash = paymentMethod === 'after-service-cash';
  const isAfterService = paymentMethod === 'after-service-cash' || paymentMethod === 'after-service-gcash';

  return {
    id: booking.id,
    clientName: booking.clientName || 'Client',
    clientPhoto: booking.clientPhoto || '',
    service: booking.serviceType || 'Service',
    scheduleRef: booking.selectedSlot?.timeBlock?.id || booking.selectedSlot?.slotId || booking.id,
    paymentMode: isAfterService ? 'After Service' : 'Advance',
    paymentChannel: isCash ? 'cash' : 'gcash',
    isPaid: booking.paymentStatus === 'paid' || booking.paymentStatus === 'refunded',
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

export {
  approveBookingRefund,
  buildTransactionId,
  buildRefundReference,
  reviewCashConfirmation,
};

export default {
  INITIAL_TRANSACTIONS,
  approveBookingRefund,
  buildTransactionId,
  buildRefundReference,
  mapBookingToWorkTransaction,
  reviewCashConfirmation,
};
