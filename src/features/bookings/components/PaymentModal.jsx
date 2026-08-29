import React, { useEffect, useState } from 'react';
import { calculateBookingPricing } from '../utils/bookingPricing';


/**
 * PaymentModal Component
 * 
 * Final payment method selection in the booking workflow.
 * 
 * Flow:
 * 1. Display two payment options:
 *    - GCash Advance Payment: Client pays upfront via GCash
 *    - Pay After Service: Client pays after service is completed
 * 2. Selection triggers state change in parent (MyBookings)
 * 3. After selection, shows confirmation screen
 * 
 * Payment Methods:
 * - gcash-advance: Pay now via GCash (locked until payment confirmed)
 * - after-service: Pay after service completion (flexible)
 * 
 * State Management:
 * - selectedMethod: 'gcash-advance' | 'after-service' | null
 * - isProcessing: Loading state while the parent persists the selection
 */
const PaymentModal = ({
  booking,
  onSelectPayment,
  onCancel,
  title = 'Select Payment Method',
  subtitle,
  amountLabel = 'Cost',
  scheduleLabel,
  scheduleValue,
  advancePaymentDescription,
  transactionFeeRate,
  testModeTitle = 'Mock payment test mode',
  testModeDescription = 'This flow records a sandbox payment reference only. No real GCash or cash transfer is processed.',
  confirmLabel = 'Create Payment-Pending Booking',
}) => {
  const [selectedMethod, setSelectedMethod] = useState(null);
  const [paymentPlan, setPaymentPlan] = useState('full');
  const [afterServiceChannel, setAfterServiceChannel] = useState('cash');
  const [isProcessing, setIsProcessing] = useState(false);
  const [showProcessing, setShowProcessing] = useState(false);
  const [hoveredKey, setHoveredKey] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth <= 720 : false
  );

  const allowsAdvanceGcash = booking?.allowGcashAdvance !== false;
  const allowsAfterService = false;
  const afterServicePaymentType = booking?.afterServicePaymentType || 'both';
  const allowsAfterServiceCash = allowsAfterService && (afterServicePaymentType === 'both' || afterServicePaymentType === 'cash-only');
  const allowsAfterServiceGcash = allowsAfterService && (afterServicePaymentType === 'both' || afterServicePaymentType === 'gcash-only');
  const isRequestBooking = booking?.bookingMode === 'calendar-only' || booking?.isRequestBooking;
  const baseAmount = Number(booking?.quoteAmount || 0) || 0;
  const {
    transactionFeeRate: feeRate,
    transactionFeeAmount,
    totalChargedAmount: totalPaymentAmount,
    transactionFeePercent,
    serviceDownpaymentAmount,
    downpaymentUpfrontAmount,
    downpaymentBalanceAmount,
  } = calculateBookingPricing(baseAmount, transactionFeeRate);
  const isPayingRemainingBalance = booking?.paymentStatus === 'partially_paid';
  const amountDueNow = isPayingRemainingBalance
    ? Number(booking?.balanceDueAmount || downpaymentBalanceAmount)
    : paymentPlan === 'downpayment'
      ? downpaymentUpfrontAmount
      : totalPaymentAmount;
  const remainingBalance = isPayingRemainingBalance
    ? 0
    : paymentPlan === 'downpayment'
      ? downpaymentBalanceAmount
      : 0;
  const resolvedSubtitle = subtitle || `Choose how you'd like to pay for ${booking.workerName}'s service`;
  const resolvedScheduleLabel = scheduleLabel || (isRequestBooking ? 'Schedule:' : 'Scheduled:');
  const resolvedScheduleValue = scheduleValue || (
    isRequestBooking
      ? 'Coordinated through chat'
      : `${booking.selectedSlot?.date || 'Pending'} at ${booking.selectedSlot?.timeBlock?.startTime || 'TBD'}`
  );
  const buildMockReference = (method) => {
    const date = new Date();
    const stamp = [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, '0'),
      String(date.getDate()).padStart(2, '0'),
    ].join('');
    const suffix = Math.floor(Math.random() * 900000 + 100000);
    return `MOCK-${String(method || 'PAY').toUpperCase()}-${stamp}-${suffix}`;
  };
  const formatPhp = (value) => `PHP ${Number(value || 0).toLocaleString('en-PH', {
    minimumFractionDigits: Number(value || 0) % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;

  useEffect(() => {
    const availableMethods = [];
    if (allowsAdvanceGcash) availableMethods.push('gcash-advance');
    if (allowsAfterService) availableMethods.push('after-service');

    if (!availableMethods.includes(selectedMethod)) {
      setSelectedMethod(availableMethods[0] || null);
    }

    if (afterServicePaymentType === 'gcash-only') {
      setAfterServiceChannel('gcash');
    } else if (afterServicePaymentType === 'cash-only') {
      setAfterServiceChannel('cash');
    }
  }, [allowsAdvanceGcash, allowsAfterService, afterServicePaymentType, selectedMethod]);

  useEffect(() => {
    setPaymentPlan(booking?.paymentPlan === 'downpayment' ? 'downpayment' : 'full');
  }, [booking?.id, booking?.paymentPlan]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const handleResize = () => setIsMobile(window.innerWidth <= 720);
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  // ============ EVENT HANDLERS ============
  
  /**
   * handleSelectMethod(method)
   * User selects a payment method
   * method = 'gcash-advance' | 'after-service'
   */
  const handleSelectMethod = (method) => {
    setSelectedMethod(method);
  };
  
  /**
   * handleConfirmPayment()
   * Persists the chosen payment method through the parent callback.
   */
  const handleConfirmPayment = async () => {
    if (!selectedMethod) {
      setSubmitError('Please select a payment method.');
      return;
    }
    
    let resolvedMethod = selectedMethod;
    if (selectedMethod === 'after-service') {
      resolvedMethod = afterServiceChannel === 'gcash' ? 'after-service-gcash' : 'after-service-cash';
    }

    try {
      setSubmitError('');
      setShowProcessing(true);
      setIsProcessing(true);
      const mockPaymentReference = buildMockReference(resolvedMethod);
      await Promise.resolve(onSelectPayment(resolvedMethod, {
        mockPaymentReference,
        mockPaymentAt: new Date().toISOString(),
        mockPaymentProvider: resolvedMethod.includes('gcash') ? 'GCash sandbox' : 'Cash confirmation sandbox',
        mockPaymentStatus: 'test-approved',
        serviceAmount: baseAmount,
        transactionFeeRate: feeRate,
        transactionFeePercent,
        transactionFeeAmount,
        totalChargedAmount: totalPaymentAmount,
        paymentPlan,
        serviceDownpaymentAmount,
        upfrontPaymentAmount: amountDueNow,
        remainingBalanceAmount: remainingBalance,
        paymentAttemptAmount: amountDueNow,
      }));
    } finally {
      setIsProcessing(false);
      setShowProcessing(false);
    }
  };

  const styles = {
    overlay: {
      position: 'fixed',
      inset: 0,
      backgroundColor: 'rgba(15, 23, 42, 0.55)',
      display: 'flex',
      alignItems: isMobile ? 'flex-start' : 'center',
      justifyContent: 'center',
      zIndex: 280,
      padding: isMobile ? '0.75rem' : '1rem',
      overflowY: 'auto',
    },
    card: {
      width: 'min(100%, 900px)',
      maxHeight: isMobile ? 'calc(100svh - 24px)' : '94vh',
      overflowY: 'auto',
      borderRadius: '8px',
      border: '1px solid var(--gl-border)',
      backgroundColor: 'var(--gl-surface)',
      boxShadow: '0 18px 40px rgba(15, 23, 42, 0.24)',
      color: 'var(--gl-text)',
    },
    header: {
      borderBottom: '1px solid var(--gl-border)',
      backgroundColor: 'var(--gl-surface-2)',
      padding: isMobile ? '0.75rem' : '0.85rem 1rem',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: isMobile ? 'flex-start' : 'center',
      gap: '0.6rem',
      flexWrap: 'wrap',
    },
    subtitle: { marginTop: '0.25rem', color: 'var(--gl-text-3)' },
    close: { width: '34px', height: '34px', borderRadius: '8px', border: '1px solid var(--gl-border-strong)', backgroundColor: 'var(--gl-surface)', color: 'var(--gl-text)', cursor: 'pointer' },
    summary: {
      margin: '0.85rem 1rem 0',
      border: '1px solid var(--gl-border)',
      borderRadius: '8px',
      backgroundColor: 'var(--gl-surface-2)',
      padding: '0.75rem',
      display: 'flex',
      flexDirection: 'column',
      gap: '0.35rem',
    },
    row: { display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', gap: isMobile ? '0.15rem' : '0.5rem', color: 'var(--gl-text-2)' },
    label: { fontWeight: 700 },
    value: { color: 'var(--gl-text)' },
    amount: { color: 'var(--gl-green)', fontWeight: 800 },
    processing: {
      margin: '1rem',
      border: '1px solid var(--gl-accent-border)',
      backgroundColor: 'var(--gl-accent-soft)',
      borderRadius: '8px',
      padding: '1rem',
      textAlign: 'center',
      color: 'var(--gl-blue)',
    },
    spinner: {
      width: '34px',
      height: '34px',
      borderRadius: '999px',
      border: '4px solid var(--gl-accent-soft)',
      borderTopColor: 'var(--gl-blue)',
      margin: '0 auto 0.6rem',
    },
    methods: {
      padding: '0.9rem 1rem',
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 270px), 1fr))',
      gap: '0.65rem',
    },
    option: {
      border: '1px solid var(--gl-border-strong)',
      borderRadius: '8px',
      padding: '0.7rem',
      backgroundColor: 'var(--gl-surface)',
      cursor: 'pointer',
    },
    optionSelected: { borderColor: 'var(--gl-blue)', backgroundColor: 'var(--gl-accent-soft)' },
    optionHeader: { display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' },
    icon: { fontSize: '1.1rem' },
    desc: { color: 'var(--gl-text-2)', fontSize: '0.9rem' },
    list: { margin: '0.45rem 0', color: 'var(--gl-text-2)', paddingLeft: '1.15rem' },
    footer: { borderTop: '1px solid var(--gl-border)', marginTop: '0.5rem', paddingTop: '0.45rem', color: 'var(--gl-text)' },
    chooser: {
      display: 'flex',
      gap: '0.6rem',
      marginTop: '0.45rem',
      border: '1px solid var(--gl-border-strong)',
      borderRadius: '8px',
      backgroundColor: 'var(--gl-surface)',
      padding: '0.45rem 0.5rem',
      flexWrap: 'wrap',
    },
    actionWrap: {
      borderTop: '1px solid var(--gl-border)',
      backgroundColor: 'var(--gl-surface-2)',
      padding: '0.75rem 1rem',
      display: 'flex',
      justifyContent: 'space-between',
      gap: '0.7rem',
      alignItems: isMobile ? 'stretch' : 'center',
      flexWrap: 'wrap',
      flexDirection: isMobile ? 'column' : 'row',
    },
    note: { margin: 0, color: 'var(--gl-text-2)', fontSize: '0.9rem', maxWidth: '560px' },
    testPanel: {
      margin: '0 1rem 0.75rem',
      border: '1px solid var(--gl-accent-border)',
      borderRadius: '8px',
      backgroundColor: 'var(--gl-accent-soft)',
      color: 'var(--gl-text)',
      padding: '0.7rem 0.8rem',
      fontSize: '0.9rem',
      lineHeight: 1.45,
    },
    testTitle: { margin: '0 0 0.25rem', fontWeight: 800, color: 'var(--gl-blue)' },
    confirm: {
      border: 'none',
      borderRadius: '8px',
      backgroundColor: 'var(--gl-blue)',
      color: '#ffffff',
      fontWeight: 700,
      cursor: 'pointer',
      padding: '0.55rem 0.85rem',
      width: isMobile ? '100%' : 'auto',
    },
  };
  
  return (
    <div style={styles.overlay}>
      <div style={styles.card}>
        {/* Header */}
        <div style={styles.header}>
          <h2>{title}</h2>
          <p style={styles.subtitle}>
            {resolvedSubtitle}
          </p>
          <button style={styles.close} onClick={onCancel} aria-label="Cancel payment selection">x</button>
        </div>
        
        {/* Payment Summary */}
        <div style={styles.summary}>
          <div style={styles.row}>
            <span style={styles.label}>Service:</span>
            <span style={styles.value}>{booking.serviceType}</span>
          </div>
          <div style={styles.row}>
            <span style={styles.label}>{amountLabel}:</span>
            <span style={styles.value}>{formatPhp(baseAmount)}</span>
          </div>
          {feeRate > 0 && (
            <div style={styles.row}>
              <span style={styles.label}>Transaction fee ({transactionFeePercent}):</span>
              <span style={styles.value}>{formatPhp(transactionFeeAmount)}</span>
            </div>
          )}
          <div style={styles.row}>
            <span style={styles.label}>Total payment:</span>
            <span style={{ ...styles.value, ...styles.amount }}>{formatPhp(totalPaymentAmount)}</span>
          </div>
          <div style={styles.row}>
            <span style={styles.label}>Amount due now:</span>
            <span style={{ ...styles.value, ...styles.amount }}>{formatPhp(amountDueNow)}</span>
          </div>
          {remainingBalance > 0 && (
            <div style={styles.row}>
              <span style={styles.label}>Remaining before completion:</span>
              <span style={styles.value}>{formatPhp(remainingBalance)}</span>
            </div>
          )}
          <div style={styles.row}>
            <span style={styles.label}>{resolvedScheduleLabel}</span>
            <span style={styles.value}>{resolvedScheduleValue}</span>
          </div>
        </div>
        
        {/* Processing Overlay */}
        {submitError && (
          <div style={{ margin: '0.8rem 1rem 0', color: 'var(--gl-red)', fontWeight: 700, fontSize: '13px' }}>
            {submitError}
          </div>
        )}

        {showProcessing && (
          <div style={styles.processing}>
            <div style={styles.spinner}></div>
            <p>{isProcessing ? 'Saving payment choice...' : 'Payment choice saved.'}</p>
          </div>
        )}
        
        {/* Payment Method Selection */}
        {!showProcessing && (
          <>
          <div style={{ ...styles.methods, paddingBottom: 0 }}>
            <div
              style={{ ...styles.option, ...(paymentPlan === 'full' ? styles.optionSelected : {}) }}
              onClick={() => { if (!isPayingRemainingBalance) setPaymentPlan('full'); }}
            >
              <div style={styles.optionHeader}>
                <input type="radio" checked={paymentPlan === 'full'} disabled={isPayingRemainingBalance} onChange={() => setPaymentPlan('full')} />
                <h3>Full Payment</h3>
              </div>
              <p style={styles.desc}>Pay the full service cost and 5% platform fee upfront.</p>
              <strong>{formatPhp(totalPaymentAmount)} due now</strong>
            </div>
            <div
              style={{ ...styles.option, ...(paymentPlan === 'downpayment' ? styles.optionSelected : {}) }}
              onClick={() => { if (!isPayingRemainingBalance) setPaymentPlan('downpayment'); }}
            >
              <div style={styles.optionHeader}>
                <input type="radio" checked={paymentPlan === 'downpayment'} disabled={isPayingRemainingBalance} onChange={() => setPaymentPlan('downpayment')} />
                <h3>50% Downpayment</h3>
              </div>
              <p style={styles.desc}>Pay 50% of the service plus the full 5% platform fee now.</p>
              <strong>{formatPhp(downpaymentUpfrontAmount)} due now</strong>
              <p style={styles.desc}>{formatPhp(downpaymentBalanceAmount)} remaining before completion</p>
            </div>
          </div>
          <div style={styles.methods}>
            {allowsAdvanceGcash && (
              <div
                style={{
                  ...styles.option,
                  ...(selectedMethod === 'gcash-advance' ? styles.optionSelected : {}),
                  ...(hoveredKey === 'gcash-option' && selectedMethod !== 'gcash-advance' ? { backgroundColor: 'var(--gl-surface-2)' } : {}),
                }}
                onClick={() => handleSelectMethod('gcash-advance')}
                onMouseEnter={() => setHoveredKey('gcash-option')}
                onMouseLeave={() => setHoveredKey('')}
              >
                <div style={styles.optionHeader}>
                  <input
                    type="radio"
                    name="payment-method"
                    value="gcash-advance"
                    checked={selectedMethod === 'gcash-advance'}
                    onChange={() => {}}
                  />
                  <div style={styles.icon}></div>
                  <h3>GCash Advance Payment</h3>
                </div>

                <p style={styles.desc}>
                  {advancePaymentDescription || (isRequestBooking
                    ? 'Pay now via GCash after agreeing on the details in chat.'
                    : 'Pay now via GCash, immediately securing your booking slot')}
                </p>

                <ul style={styles.list}>
                  <li>- Booking confirms after provider verification</li>
                  <li>- Payment secured with GCash encryption</li>
                  <li>- Receive a payment reference and booking receipt</li>
                  <li>- Refund eligible if service not rendered</li>
                </ul>

                <div style={styles.footer}>
                  <p>Service cost: <strong>{formatPhp(baseAmount)}</strong></p>
                  {feeRate > 0 && <p>Transaction fee ({transactionFeePercent}): <strong>{formatPhp(transactionFeeAmount)}</strong></p>}
                  <p>Total payment: <strong>{formatPhp(totalPaymentAmount)}</strong></p>
                </div>
              </div>
            )}

            {allowsAfterService && (
              <div
                style={{
                  ...styles.option,
                  ...(selectedMethod === 'after-service' ? styles.optionSelected : {}),
                  ...(hoveredKey === 'after-service-option' && selectedMethod !== 'after-service' ? { backgroundColor: 'var(--gl-surface-2)' } : {}),
                }}
                onClick={() => handleSelectMethod('after-service')}
                onMouseEnter={() => setHoveredKey('after-service-option')}
                onMouseLeave={() => setHoveredKey('')}
              >
                <div style={styles.optionHeader}>
                  <input
                    type="radio"
                    name="payment-method"
                    value="after-service"
                    checked={selectedMethod === 'after-service'}
                    onChange={() => {}}
                  />
                  <div style={styles.icon}></div>
                  <h3>Pay After Service</h3>
                </div>

                <p style={styles.desc}>
                  {afterServicePaymentType === 'cash-only'
                    ? 'Pay in cash after the service is completed.'
                    : afterServicePaymentType === 'gcash-only'
                      ? 'Pay via GCash after the service is completed.'
                      : 'Pay after the service is completed and choose Cash or GCash.'}
                </p>

                {selectedMethod === 'after-service' && afterServicePaymentType === 'both' && (
                  <div style={styles.chooser}>
                    <label>
                      <input
                        type="radio"
                        name="after-service-channel"
                        value="cash"
                        checked={afterServiceChannel === 'cash'}
                        onChange={() => setAfterServiceChannel('cash')}
                      />
                      Cash
                    </label>
                    <label>
                      <input
                        type="radio"
                        name="after-service-channel"
                        value="gcash"
                        checked={afterServiceChannel === 'gcash'}
                        onChange={() => setAfterServiceChannel('gcash')}
                      />
                      GCash
                    </label>
                  </div>
                )}

                <ul style={styles.list}>
                  {allowsAfterServiceCash && <li>- Cash payment accepted after completion</li>}
                  {allowsAfterServiceGcash && <li>- GCash payment accepted after completion</li>}
                  <li>- Verify service quality before paying</li>
                  <li>- Worker receives notification of your choice</li>
                </ul>

                <div style={styles.footer}>
                  <p>Service cost: <strong>{formatPhp(baseAmount)}</strong></p>
                  {feeRate > 0 && <p>Transaction fee ({transactionFeePercent}): <strong>{formatPhp(transactionFeeAmount)}</strong></p>}
                  <p>Total payment: <strong>{formatPhp(totalPaymentAmount)}</strong></p>
                </div>
              </div>
            )}
          </div>
          </>
        )}
        
        {/* Confirmation Button */}
        {!showProcessing || !isProcessing ? (
          <>
          <div style={styles.testPanel}>
            <p style={styles.testTitle}>{testModeTitle}</p>
            {testModeDescription}
          </div>
          <div style={styles.actionWrap}>
            <p style={styles.note}>
              {selectedMethod === 'after-service' && afterServiceChannel === 'cash'
                ? 'Cash payment is expected after service completion.'
                : 'GCash payment will redirect you to GCash app or website to complete the transaction.'}
            </p>
            <button
              style={{
                ...styles.confirm,
                ...(selectedMethod
                  ? { backgroundColor: hoveredKey === 'confirm-payment' ? 'var(--gl-blue-2)' : 'var(--gl-blue)' }
                  : { backgroundColor: '#94a3b8', cursor: 'not-allowed' }),
              }}
              onClick={handleConfirmPayment}
              disabled={!selectedMethod || isProcessing}
              onMouseEnter={() => setHoveredKey('confirm-payment')}
              onMouseLeave={() => setHoveredKey('')}
            >
              {isProcessing ? 'Processing...' : confirmLabel}
            </button>
          </div>
          </>
        ) : null}
      </div>
    </div>
  );
};

export default PaymentModal;
