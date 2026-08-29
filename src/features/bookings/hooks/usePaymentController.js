// ============================================================================
// usePaymentController.js - Payment Workflow Controller Hook
// ============================================================================
// Purpose: Manages payment proof and payment method selection workflows
// Responsibilities:
//   - Manage payment proof UI state (which booking, file, reference)
//   - Handle payment proof submission validation
//   - Handle payment method selection
//   - Manage error messages
// 
// Returns: Object with state and handlers for payment workflows
// ============================================================================

import { useState, useCallback } from 'react';
import { selectBookingPaymentPlan } from '../services/bookingService';

export function usePaymentController(onPaymentProofSubmit, onPaymentMethodSelect, updateBooking, replaceBooking) {
  // ========================================================================
  // STATE MANAGEMENT
  // ========================================================================
  
  // Payment proof modal state
  const [paymentProofBookingId, setPaymentProofBookingId] = useState(null);
  const [proofFileName, setProofFileName] = useState('');
  const [referenceNo, setReferenceNo] = useState('');
  const [paymentProofError, setPaymentProofError] = useState('');
  const [isReferenceFocused, setIsReferenceFocused] = useState(false);

  // Payment status notification state
  const [showPaymentStatusNotice, setShowPaymentStatusNotice] = useState(false);
  const [paymentStatusMessage, setPaymentStatusMessage] = useState('');

  // ========================================================================
  // HANDLER FUNCTIONS - Payment Workflows
  // ========================================================================

  /**
   * Open payment proof modal for a specific booking
   */
  const handleOpenPaymentProofModal = useCallback((bookingId) => {
    setPaymentProofBookingId(bookingId);
    setProofFileName('');
    setReferenceNo('');
    setPaymentProofError('');
  }, []);

  /**
   * Handle file selection for proof upload
   */
  const handleProofFileChange = useCallback((event) => {
    const selectedFile = event.target.files && event.target.files[0];
    setProofFileName(selectedFile ? selectedFile.name : '');
  }, []);

  /**
   * Submit payment proof
   * Validates that at least proof file or reference number is provided
   * Updates booking with payment reference and status
   */
  const handleSubmitPaymentProof = useCallback(async (booking, isRecurringBilling) => {
    // Validation
    if (!proofFileName && !referenceNo.trim()) {
      setPaymentProofError('Please upload proof of transaction or enter a reference number.');
      return;
    }

    // Clear error
    setPaymentProofError('');

    // Calculate status based on booking type
    let newStatus = 'Payment Submitted';
    if (isRecurringBilling) {
      newStatus = 'Active Service';
      // Calculate next charge date
      const chargeDate = booking.nextChargeDate || new Date().toISOString().slice(0, 10);
      await updateBooking(booking.id, {
        paymentProofSubmitted: true,
        paymentReference: referenceNo.trim(),
        status: newStatus,
        canRate: false,
        lastChargeDate: chargeDate,
      });
    } else {
      await updateBooking(booking.id, {
        paymentProofSubmitted: true,
        paymentReference: referenceNo.trim(),
        status: newStatus,
        canRate: true,
      });
    }

    // Show success notification
    setPaymentStatusMessage('Payment proof submitted. Please check My Bookings for the updated status.');
    setShowPaymentStatusNotice(true);
    setTimeout(() => setShowPaymentStatusNotice(false), 2600);

    // Close modal
    setPaymentProofBookingId(null);
    setProofFileName('');
    setReferenceNo('');

    // Call parent callback
    onPaymentProofSubmit?.(booking.id, referenceNo.trim());
  }, [proofFileName, referenceNo, updateBooking, onPaymentProofSubmit]);

  /**
   * Select payment method
   * Updates booking with selected payment method and status
   * For cash payments, sets up cash confirmation QR
   */
  const handleSelectPaymentMethod = useCallback(async (booking, paymentMethod, mockPayment = {}) => {
    if (paymentMethod === 'gcash-advance') {
      if (booking?.paymentStatus === 'partially_paid') {
        onPaymentMethodSelect?.(booking.id, paymentMethod, mockPayment);
        return booking;
      }
      const updated = await selectBookingPaymentPlan(
        booking,
        mockPayment?.paymentPlan === 'downpayment' ? 'downpayment' : 'full'
      );
      replaceBooking?.(updated);
      onPaymentMethodSelect?.(booking.id, paymentMethod, mockPayment);
      return updated;
    }

    const updates = {
      paymentMethod,
      status: 'Payment Pending',
    };

    if (mockPayment?.mockPaymentReference && paymentMethod !== 'after-service-cash') {
      updates.paymentProofSubmitted = true;
    }

    if (mockPayment?.mockPaymentReference) {
      updates.mockPayment = mockPayment;
    }

    // Setup cash confirmation if cash payment selected
    if (paymentMethod === 'after-service-cash') {
      updates.cashConfirmationStatus = 'awaiting-client-scan';
      updates.cashVerifierQrId = booking.cashVerifierQrId || `CASHQR-${booking.workerId || booking.id}-${booking.id}`;
      updates.submittedCashAmount = null;
      updates.expectedCashAmount = mockPayment?.totalChargedAmount || booking.expectedCashAmount || booking.quoteAmount;
    }

    await updateBooking(booking.id, updates);

    // Notify parent
    onPaymentMethodSelect?.(booking.id, paymentMethod, mockPayment);
  }, [updateBooking, replaceBooking, onPaymentMethodSelect]);

  // ========================================================================
  // RETURN OBJECT - Exposed state and handlers
  // ========================================================================
  
  return {
    // Payment proof modal state
    paymentProofBookingId,
    setPaymentProofBookingId,
    proofFileName,
    setProofFileName,
    referenceNo,
    setReferenceNo,
    paymentProofError,
    setPaymentProofError,
    isReferenceFocused,
    setIsReferenceFocused,

    // Payment status notification state
    showPaymentStatusNotice,
    setShowPaymentStatusNotice,
    paymentStatusMessage,
    setPaymentStatusMessage,

    // Handlers
    handleOpenPaymentProofModal,
    handleProofFileChange,
    handleSubmitPaymentProof,
    handleSelectPaymentMethod,
  };
}
