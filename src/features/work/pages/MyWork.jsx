import React, { useEffect, useState } from 'react';
import DashboardNavigation from '../../../shared/components/DashboardNavigation';
import InquiryChatModal from '../components/InquiryChatModal';
import { ActiveInquiriesSection } from '../components/ActiveInquiriesSection';
import WorkProviderSummary from '../components/WorkProviderSummary';
import WorkSectionFilter from '../components/WorkSectionFilter';
import WorkPaymentQueues from '../components/WorkPaymentQueues';
import SlotEditModal from '../components/SlotEditModal';
import ProfileEditModal from '../components/ProfileEditModal';
import { ConfirmActionModal } from '@/shared/components';
import QrPreviewModal from '../components/modals/QrPreviewModal';
import CreateServiceModal from '../components/CreateServiceModal';
import SuccessNotification from '../../../shared/components/SuccessNotification';
import ErrorNotification from '../../../shared/components/ErrorNotification';
import { markBookingDelivered } from '../../bookings/services/bookingService';
import { getThemeTokens } from '../../../shared/styles/themeTokens';
import { useWorkPayments, useWorkProfileServices, useWorkSchedule } from '../hooks';
import {
  CalendarDays,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  UserRound,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

const formatDateLong = (date) =>
  date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

const normalizeRateBasis = (value) => {
  const raw = String(value || '').trim().toLowerCase().replace(/_/g, '-');
  if (raw === 'per-hour' || raw === 'hourly') return 'per-hour';
  if (raw === 'per-day' || raw === 'daily') return 'per-day';
  if (raw === 'per-week' || raw === 'weekly') return 'per-week';
  if (raw === 'per-month' || raw === 'monthly') return 'per-month';
  if (raw === 'per-project' || raw === 'project' || raw === 'package' || raw === 'fixed' || raw === 'custom') return 'per-project';
  return '';
};

const classStyles = {
  'my-work-page': { minHeight: '100vh', background: '#f9f9f9', fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif", overflowX: 'hidden' },
  'my-work-header-bar': { background: 'white', borderBottom: '1px solid #eceff1', padding: '16px 24px', display: 'flex', justifyContent: 'center', alignItems: 'center', position: 'sticky', top: 0, zIndex: 100, boxShadow: '0 2px 4px rgba(0, 0, 0, 0.05)' },
  'my-work-title': { fontSize: '24px', fontWeight: 700, color: '#2c3e50', margin: 0, textAlign: 'center' },
  'back-to-dashboard-btn': { padding: '10px 16px', background: 'white', color: '#2c3e50', border: '1px solid #eceff1', borderRadius: '6px', fontSize: '14px', fontWeight: 600, cursor: 'pointer', transition: 'all 0.3s ease' },
  'header-spacer': { width: '148px' },
  'my-work-main': { width: '100%', maxWidth: '1120px', margin: '0 auto', padding: '40px 16px', boxSizing: 'border-box' },
  'empty-state-banner': { background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)', border: '1px solid #fcd34d', borderRadius: '12px', padding: '40px 24px', textAlign: 'center', marginBottom: '32px' },
  'inquiries-section': { width: '100%', maxWidth: '1100px', margin: '0 auto 48px' },
  'section-header': { marginBottom: '24px' },
  'section-header-with-action': { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px', flexWrap: 'wrap', marginBottom: '18px' },
  'section-heading-copy': { minWidth: 0, flex: '1 1 260px' },
  'section-subtitle': { fontSize: '14px', color: '#7f8c8d', margin: 0 },
  'inquiries-grid': { width: '100%', margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '20px' },
  'inquiry-card': { width: '100%', boxSizing: 'border-box', background: 'white', borderRadius: '12px', padding: '20px', boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)', transition: 'all 0.3s ease', border: '1px solid transparent' },
  'inquiry-header': { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '14px', marginBottom: '16px' },
  'client-info': { display: 'flex', gap: '12px', flex: '1 1 auto', minWidth: 0, alignItems: 'center' },
  'client-photo': { width: '48px', height: '48px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0, overflow: 'hidden' },
  'client-photo-fallback': { width: '48px', height: '48px', borderRadius: '50%', flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, var(--gl-blue), var(--gl-green))', color: '#ffffff', fontSize: '15px', fontWeight: 800, letterSpacing: 0, border: '1px solid rgba(255, 255, 255, 0.16)' },
  'client-rating': { fontSize: '12px', color: '#f59e0b', margin: '4px 0 0 0' },
  'status-badge': { display: 'inline-block', padding: '4px 12px', borderRadius: '20px', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', whiteSpace: 'nowrap' },
  'status-pending': { background: '#fef3c7', color: '#92400e' },
  'status-waiting': { background: 'var(--gl-accent-soft)', color: 'var(--gl-blue)' },
  'status-negotiating': { background: '#fecdd3', color: '#831843' },
  'status-default': { background: '#e5e7eb', color: '#374151' },
  'inquiry-body': { marginBottom: '16px' },
  'inquiry-service': { fontSize: '15px', fontWeight: 600, color: 'var(--gl-blue)', margin: '0 0 8px 0' },
  'inquiry-description': { fontSize: '14px', color: '#555', margin: '0 0 12px 0', lineHeight: 1.5 },
  'inquiry-meta': { display: 'flex', gap: '16px', fontSize: '12px', color: '#7f8c8d' },
  'inquiry-actions': { display: 'flex', justifyContent: 'flex-end', gap: '8px' },
  'schedule-section': { width: '100%', maxWidth: '1100px', margin: '0 auto 48px' },
  'week-slider': { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '10px', padding: '10px 12px', marginBottom: '16px' },
  'week-nav-btn': { border: '1px solid #cbd5e1', background: '#f8fafc', color: '#1f2937', borderRadius: '8px', padding: '8px 10px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' },
  'week-range': { display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', color: '#1f2937' },
  'schedule-state-message': { margin: '0 0 12px', padding: '10px 12px', borderRadius: '8px', fontSize: '13px', fontWeight: 700 },
  'schedule-loading-state': { background: 'var(--gl-accent-soft)', border: '1px solid var(--gl-accent-border)', color: 'var(--gl-blue)' },
  'schedule-error-state': { background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c' },
  'calendar-availability-grid': { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px' },
  'calendar-day-card': { background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '10px', padding: '16px' },
  'calendar-date': { margin: '0 0 6px', color: '#1f2937', fontSize: '17px' },
  'calendar-booked': { margin: '0 0 4px', color: '#166534', fontSize: '13px', fontWeight: 700 },
  'calendar-note': { margin: 0, color: '#6b7280', fontSize: '13px' },
  'calendar-bookings-list': { marginTop: '10px', paddingTop: '10px', borderTop: '1px dashed #d1d5db', display: 'grid', gap: '6px' },
  'schedule-grid': { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' },
  'schedule-day-card': { background: 'white', borderRadius: '12px', padding: '20px', boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)' },
  'day-header': { fontSize: '18px', fontWeight: 700, color: '#2c3e50', margin: 0, paddingBottom: '12px', borderBottom: '2px solid var(--gl-blue)' },
  'day-date': { margin: '8px 0 12px', fontSize: '12px', color: '#64748b' },
  'no-slots': { fontSize: '14px', color: '#95a5a6', textAlign: 'center', padding: '20px 0', margin: 0 },
  'time-blocks': { display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '16px' },
  'time-block': { padding: '16px', border: '1px solid #eceff1', borderRadius: '8px', background: '#f9f9f9', position: 'relative', transition: 'all 0.3s ease' },
  'slot-available': { border: '1px solid var(--gl-accent-border)', background: 'var(--gl-accent-soft)' },
  'slot-half': { border: '1px solid #fef3c7', background: '#fffbeb' },
  'slot-full': { border: '1px solid #fecaca', background: '#fef2f2', opacity: 0.7 },
  'block-time': { fontSize: '15px', fontWeight: 700, color: '#2c3e50', marginBottom: '8px' },
  'block-status': { marginBottom: '8px' },
  'slots-counter': { display: 'block', fontSize: '12px', color: '#555', marginBottom: '4px' },
  'status-bar': { width: '100%', height: '6px', background: '#e5e7eb', borderRadius: '3px', overflow: 'hidden' },
  'filled-bar': { height: '100%', background: 'linear-gradient(90deg, var(--gl-blue), var(--gl-blue-2))', transition: 'width 0.3s ease' },
  'bookings-preview': { fontSize: '12px', color: '#555', margin: '8px 0', padding: '8px', background: 'rgba(0, 0, 0, 0.03)', borderRadius: '4px', display: 'grid', gap: '6px' },
  'booking-item': { padding: 0, margin: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', minHeight: '24px' },
  'booking-name': { fontWeight: 600, color: '#1f2937', fontSize: '12px', flexShrink: 0, minWidth: 'fit-content' },
  'booking-inline-actions': { display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 },
  'recurring-cycle-pill': { display: 'inline-flex', alignItems: 'center', padding: '3px 8px', borderRadius: '999px', background: 'var(--gl-accent-soft)', color: 'var(--gl-blue)', fontSize: '11px', fontWeight: 700, height: '24px', whiteSpace: 'nowrap' },
  'lock-hint': { fontSize: '11px', fontWeight: 600, color: '#6b7280', whiteSpace: 'nowrap' },
  'booking-item-checks': { fontSize: '11px', color: '#374151', whiteSpace: 'nowrap' },
  'check-toggle': { display: 'flex', gap: '6px', alignItems: 'center', fontSize: '13px', fontWeight: 600, color: '#374151' },
  compact: { fontSize: '11px', padding: 0, height: '24px', display: 'flex', alignItems: 'center', gap: '4px' },
  'mark-done-btn': { border: 'none', background: 'var(--gl-green)', color: '#fff', borderRadius: '6px', padding: '5px 8px', fontSize: '11px', fontWeight: 700, cursor: 'pointer', height: '24px', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s ease' },
  'done-pill': { display: 'inline-flex', alignItems: 'center', background: '#dcfce7', color: '#166534', border: '1px solid #86efac', borderRadius: '999px', padding: '4px 8px', fontSize: '11px', fontWeight: 700, height: '24px', whiteSpace: 'nowrap' },
  'block-actions': { display: 'flex', gap: '8px', marginTop: '8px', justifyContent: 'flex-end' },
  'action-btn': { width: '28px', height: '28px', padding: 0, background: 'white', border: '1px solid #eceff1', borderRadius: '6px', fontSize: '14px', cursor: 'pointer', transition: 'all 0.2s ease', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  'btn-add-slot': { width: '100%', padding: '10px', background: 'white', color: 'var(--gl-blue)', border: '2px dashed var(--gl-blue)', borderRadius: '6px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', transition: 'all 0.3s ease' },
  'section-add-slot-btn': { width: 'auto', minWidth: '148px', minHeight: '40px', padding: '9px 14px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', alignSelf: 'flex-start', whiteSpace: 'nowrap' },
  'stats-footer': { width: '100%', maxWidth: '1100px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px', margin: '48px auto 0' },
  'stat-card': { background: 'white', borderRadius: '12px', padding: '24px', textAlign: 'center', boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)' },
  'stat-value': { fontSize: '32px', fontWeight: 700, color: 'var(--gl-blue)', margin: '0 0 4px 0' },
  'stat-desc': { fontSize: '12px', color: '#95a5a6', margin: 0 },
  'btn-gcash-preview': { border: '1px solid var(--gl-accent-border)', background: 'var(--gl-accent-soft)', color: 'var(--gl-blue)', borderRadius: '6px', padding: '5px 8px', fontSize: '11px', fontWeight: 700, cursor: 'pointer', height: '24px', whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginLeft: 0 },
  'payment-qr-grid': { marginTop: '12px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '14px' },
  'payment-qr-item': { border: '1px solid #e5e7eb', borderRadius: '8px', padding: '10px', background: '#f8fafc', textAlign: 'center' },
  'payment-qr-title': { margin: '0 0 6px', fontSize: '13px', fontWeight: 700, color: '#1f2937' },
  'payment-qr-caption': { margin: '6px 0 0', fontSize: '12px', color: '#6b7280' },
};

const hoverStyles = {
  backButton: { background: 'var(--gl-surface-2)', border: '1px solid var(--gl-blue)', color: 'var(--gl-blue)' },
  logoutButton: { background: '#fee', border: '1px solid #e74c3c' },
  profileName: { color: 'var(--gl-blue)', textDecoration: 'underline' },
  weekNav: { background: '#eef2ff', border: '1px solid #818cf8' },
  gcashButton: { background: 'var(--gl-accent-soft)', border: '1px solid var(--gl-accent-border)' },
  markDone: { background: '#219653' },
  addSlot: { background: 'var(--gl-accent-soft)', border: '2px dashed var(--gl-blue)', color: 'var(--gl-blue)' },
  editAction: { background: 'var(--gl-accent-soft)', border: '1px solid var(--gl-blue)' },
  deleteAction: { background: '#fecaca', border: '1px solid #e74c3c' },
  deleteConfirm: { background: '#b91c1c' },
};

/**
 * - In production, these would be fetched from an API based on sellerProfile.id
 * - Conditional rendering checks the "hasService" flag to show Empty vs. Active states
 *
 * STATE MACHINE:
 * - If hasService === false: Show "Welcome! Setup your profile" banner
 * - If hasService === true: Show Active Inquiries + Schedule sections
 * - isSelectedChat: Controls which inquiry's chat is displayed (null = no chat open)
 *
 * DEMO DATA STRUCTURE:
 * inquiries: [{ id, clientName, service, status, requestDate }, ...]
 * schedules: { 'Mon': [...timeBlocks], 'Tue': [...], ... }
 */
const MyWork = ({ appTheme = 'light', themeMode = 'system', onThemeChange, currentView, searchQuery, onSearchChange, onLogout, onOpenSellerSetup, onOpenMyBookings, onOpenChatPage, sellerProfile, onOpenMyWork, onOpenProfile, onOpenAccountSettings, onOpenSettings, onOpenDashboard, onOpenBrowseServices, onBackToDashboard, onAddNewWork, onOpenAdminDashboard }) => {
  // ============ STATE MANAGEMENT ============

  const [selectedChatId, setSelectedChatId] = useState(null);
  const [doneConfirmTarget, setDoneConfirmTarget] = useState(null);
  const [profileEditModalOpen, setProfileEditModalOpen] = useState(false);
  const [isGcashPreviewOpen, setIsGcashPreviewOpen] = useState(false);
  const [isCashQrPreviewOpen, setIsCashQrPreviewOpen] = useState(false);
  const [hoverKey, setHoverKey] = useState('');
  const [workSectionFilter, setWorkSectionFilter] = useState('all'); // all | inquiries | cash-approvals | refunds | cancelled
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth <= 768 : false
  );

  const {
    activeServiceIndex,
    closeCreateService,
    currentProfile,
    handleCreateServiceChange,
    handleCreateServiceSubmit,
    handleSaveProfileEdit,
    hasSellerRecord,
    isCreateServiceOpen,
    isLoadingSellerData,
    newService,
    sellerData,
    sellerDataError,
    sellerDbServices,
    sellerId,
    sellerRatingAggregate,
    setActiveServiceIndex,
    setIsCreateServiceOpen,
    setSellerDataError,
    setSuccessMessage,
    showSetupBanner,
    successMessage,
    workerServices,
  } = useWorkProfileServices({ sellerProfile });

  const {
    calendarAvailability,
    closeSlotModal,
    currentWeekMonday,
    currentWeekSunday,
    dayKeys,
    deleteConfirmTarget,
    editSlotData,
    editSlotDayKey,
    editSlotModalOpen,
    handleAddSlot,
    handleConfirmDelete,
    handleDeleteSlot,
    handleEditSlot,
    handleSaveSlotEdit,
    isScheduleLoading,
    scheduleError,
    scheduleMode,
    setDeleteConfirmTarget,
    setWeekOffset,
    slotModalType,
    weekDateByDay,
    weekOffset,
    weekRangeLabel,
    weeklySchedule,
  } = useWorkSchedule({ sellerId, currentProfile });

  const {
    cancelledCashTransactions,
    cashConfirmationNotifications,
    cashDecisionTarget,
    cashPaymentView,
    handleApproveRefund,
    handleCloseCashDecisionModal,
    handleConfirmCashDecision,
    handleRequestCashConfirmationReview,
    paymentError,
    refundTransactions,
    refreshSellerTransactions,
    setCashPaymentView,
    setPaymentError,
    setTransactions,
    transactions,
    weekTransactions,
  } = useWorkPayments({ sellerId, weekOffset });

  const supportsAvailabilitySchedule = scheduleMode === 'with-slots';

  useEffect(() => {
    if (activeServiceIndex >= (workerServices || []).length) {
      setActiveServiceIndex(Math.max(0, (workerServices || []).length - 1));
    }
  }, [activeServiceIndex, setActiveServiceIndex, workerServices]);

  useEffect(() => {
    if (!supportsAvailabilitySchedule && workSectionFilter === 'schedule') {
      setWorkSectionFilter('all');
    }
  }, [supportsAvailabilitySchedule, workSectionFilter]);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const activeInquiries = transactions
    .filter((txn) => !['Completed Service', 'Refunded', 'Cancelled (Cash)'].includes(txn.bookingStatus))
    .map((txn) => ({
      id: txn.sourceBookingId || txn.id,
      clientName: txn.clientName,
      clientPhoto: txn.clientPhoto || txn.rawBooking?.clientPhoto || '',
      clientRating: null,
      service: txn.service,
      description: txn.rawBooking?.description || 'Service booking request',
      status: txn.bookingStatus || 'Service Scheduled',
      requestDate: txn.rawBooking?.requestDate || '',
      proposedBudget: txn.expectedCashAmount ? `PHP ${txn.expectedCashAmount}` : 'See booking',
      messages: 0,
      booking: txn.rawBooking,
    }));  
  const getTransactionForBooking = (scheduleRef, clientName) => {
    const matches = weekTransactions.filter(
      (txn) => txn.scheduleRef === scheduleRef && txn.clientName === clientName
    );

    if (matches.length === 0) return undefined;

    if (currentProfile?.rateBasis === 'per-month') {
      const monthlyMatch = matches.find((txn) => txn.recurringCycle === 'monthly');
      if (monthlyMatch) return monthlyMatch;
    }

    return matches[0];
  };

  const isMonthlyRecurringTxn = (txn) => txn?.recurringCycle === 'monthly' && !!txn?.subscriptionId;

  const getSubscriptionTransactions = (subscriptionId) =>
    transactions.filter((txn) => txn.subscriptionId === subscriptionId);

  const isLastCycleEntry = (txn) => {
    if (!isMonthlyRecurringTxn(txn)) return false;
    const cycleEntries = getSubscriptionTransactions(txn.subscriptionId);
    const maxOrder = Math.max(...cycleEntries.map((entry) => entry.cycleOrder || 0));
    return (txn.cycleOrder || 0) === maxOrder;
  };

  const canTogglePaid = (txn) => {
    // Payment success is provider/server controlled. Cash collection uses the
    // seller-claim + buyer-acknowledgement workflow instead of this toggle.
    return false;
  };

  const canMarkDone = (txn) => {
    if (!txn) return false;
    if (!isMonthlyRecurringTxn(txn)) return !txn.isDone;

    if (txn.paymentMode === 'After Service') {
      return !txn.isDone && isLastCycleEntry(txn);
    }

    return !txn.isDone;
  };

  // ============ EVENT HANDLERS ============
  
  /**
   * handleRespondClick(inquiryId)
   * Opens the chat modal for a specific inquiry
   */
  const handleRespondClick = (inquiryId) => {
    setSelectedChatId(inquiryId);
  };
  
  /**
   * handleCloseChat()
   * Closes the chat modal
   */
  const handleCloseChat = () => {
    setSelectedChatId(null);
  };
  
  const handleOpenDoneModal = (transaction) => {
    setDoneConfirmTarget(transaction);
  };

  const handleConfirmDone = async () => {
    if (!doneConfirmTarget) return;
    if (!doneConfirmTarget.sourceBookingId) return;

    try {
      setPaymentError('');
      await markBookingDelivered(doneConfirmTarget.sourceBookingId);
    } catch (error) {
      setPaymentError(error?.message || 'Unable to record service delivery.');
      return;
    }

    // Monthly after-service rule: if final cycle entry is marked done,
    // mark whole cycle paid and lock the paid state.
    if (isMonthlyRecurringTxn(doneConfirmTarget) && doneConfirmTarget.paymentMode === 'After Service' && isLastCycleEntry(doneConfirmTarget)) {
      setTransactions((prev) =>
        prev.map((txn) => {
          if (txn.subscriptionId === doneConfirmTarget.subscriptionId) {
            return {
              ...txn,
              isPaid: true,
              paymentLocked: true,
              isDone: txn.isDone || txn.id === doneConfirmTarget.id,
            };
          }

          if (txn.id === doneConfirmTarget.id) {
            return {
              ...txn,
              isDone: true,
            };
          }

          return txn;
        })
      );
      setDoneConfirmTarget(null);
      return;
    }

    setTransactions((prev) =>
      prev.map((txn) =>
        txn.id === doneConfirmTarget.id
          ? {
              ...txn,
              isDone: true,
              isPaid: txn.isPaid || doneConfirmTarget.paymentMode === 'Advance',
            }
          : txn
      )
    );
    setDoneConfirmTarget(null);
  };

  const handleOpenProfileEdit = () => {
    setProfileEditModalOpen(true);
  };

  const handleProfileEditSave = async (updatedData) => {
    await handleSaveProfileEdit(updatedData);
    setProfileEditModalOpen(false);
  };

  const handleOpenGcashPreview = () => {
    setIsGcashPreviewOpen(true);
  };

  const handleCloseGcashPreview = () => {
    setIsGcashPreviewOpen(false);
  };

  const handleOpenCashQrPreview = () => {
    setIsCashQrPreviewOpen(true);
  };

  const handleCloseCashQrPreview = () => {
    setIsCashQrPreviewOpen(false);
  };

  const themeTokens = getThemeTokens(appTheme);
  const isDarkMode = themeTokens.isDarkMode;
  const sectionCardStyle = {
    background: themeTokens.surface,
    border: `1px solid ${themeTokens.border}`,
    borderRadius: '8px',
    padding: isMobile ? '16px' : '20px',
    color: themeTokens.textPrimary,
    boxShadow: themeTokens.shadowSoft,
  };
  const queueCardStyle = {
    background: isDarkMode ? themeTokens.surfaceAlt : '#ffffff',
    border: `1px solid ${themeTokens.border}`,
    color: themeTokens.textSecondary,
    boxShadow: isDarkMode ? 'none' : '0 2px 8px rgba(15, 23, 42, 0.05)',
  };
  const themeClassStyles = {
    'my-work-page': {
      background: themeTokens.pageBg,
      color: themeTokens.textPrimary,
    },
    'empty-state-banner': {
      background: `linear-gradient(135deg, ${themeTokens.warningBg}, ${themeTokens.surfaceAlt})`,
      border: `1px solid ${themeTokens.warningBorder}`,
    },
    'inquiries-section': sectionCardStyle,
    'schedule-section': sectionCardStyle,
    'section-header': {
      marginBottom: '18px',
    },
    'section-subtitle': {
      color: themeTokens.textSecondary,
    },
    'schedule-loading-state': {
      background: themeTokens.accentSoft,
      border: `1px solid ${themeTokens.accentBorder}`,
      color: themeTokens.accent,
    },
    'schedule-error-state': {
      background: themeTokens.dangerBg,
      border: `1px solid ${themeTokens.dangerBorder}`,
      color: themeTokens.danger,
    },
    'inquiry-card': queueCardStyle,
    'inquiry-description': {
      color: themeTokens.textSecondary,
    },
    'inquiry-service': {
      color: themeTokens.accent,
    },
    'inquiry-meta': {
      color: themeTokens.textMuted,
    },
    'week-slider': {
      background: themeTokens.surfaceAlt,
      border: `1px solid ${themeTokens.border}`,
    },
    'week-nav-btn': {
      background: themeTokens.surface,
      border: `1px solid ${themeTokens.border}`,
      color: themeTokens.textPrimary,
    },
    'week-range': {
      color: themeTokens.textPrimary,
    },
    'calendar-day-card': queueCardStyle,
    'calendar-date': {
      color: themeTokens.textPrimary,
    },
    'calendar-note': {
      color: themeTokens.textSecondary,
    },
    'calendar-booked': {
      color: isDarkMode ? '#86efac' : '#166534',
    },
    'schedule-day-card': queueCardStyle,
    'day-header': {
      color: themeTokens.textPrimary,
    },
    'day-date': {
      color: themeTokens.textMuted,
    },
    'no-slots': {
      color: themeTokens.textMuted,
    },
    'time-block': {
      background: isDarkMode ? themeTokens.surfaceSoft : themeTokens.surfaceAlt,
      border: `1px solid ${themeTokens.border}`,
    },
    'slot-available': {
      background: themeTokens.accentSoft,
      border: `1px solid ${themeTokens.accentBorder}`,
    },
    'slot-half': {
      background: themeTokens.warningBg,
      border: `1px solid ${themeTokens.warningBorder}`,
    },
    'slot-full': {
      background: themeTokens.dangerBg,
      border: `1px solid ${themeTokens.dangerBorder}`,
    },
    'block-time': {
      color: themeTokens.textPrimary,
    },
    'slots-counter': {
      color: themeTokens.textSecondary,
    },
    'filled-bar': {
      background: `linear-gradient(90deg, ${themeTokens.accent}, ${themeTokens.accentDeep || themeTokens.accent})`,
    },
    'bookings-preview': {
      background: isDarkMode ? 'rgba(255, 255, 255, 0.04)' : 'rgba(15, 23, 42, 0.04)',
      color: themeTokens.textSecondary,
    },
    'booking-name': {
      color: themeTokens.textPrimary,
    },
    'check-toggle': {
      color: themeTokens.textPrimary,
    },
    'booking-item-checks': {
      color: themeTokens.textSecondary,
    },
    'recurring-cycle-pill': {
      background: themeTokens.accentSoft,
      color: themeTokens.accent,
    },
    'lock-hint': {
      color: themeTokens.textMuted,
    },
    'action-btn': {
      background: themeTokens.surface,
      border: `1px solid ${themeTokens.border}`,
      color: themeTokens.textPrimary,
    },
    'btn-add-slot': {
      background: themeTokens.surface,
      color: themeTokens.accent,
      border: `2px dashed ${themeTokens.accent}`,
    },
    'stat-card': queueCardStyle,
    'stat-desc': {
      color: themeTokens.textMuted,
    },
    'stat-value': {
      color: themeTokens.accent,
    },
    'gcash-qr-btn': {
      background: themeTokens.accentSoft,
      border: `1px solid ${themeTokens.accentBorder}`,
      color: themeTokens.accent,
    },
    'btn-gcash-preview': {
      background: themeTokens.accentSoft,
      border: `1px solid ${themeTokens.accentBorder}`,
      color: themeTokens.accent,
    },
    'payment-qr-item': queueCardStyle,
    'payment-qr-title': {
      color: themeTokens.textPrimary,
    },
    'payment-qr-caption': {
      color: themeTokens.textSecondary,
    },
  };

  const responsiveClassStyles = isMobile
    ? {
        'my-work-header-bar': { padding: '12px', gap: '8px', flexWrap: 'wrap' },
        'my-work-title': { width: '100%', textAlign: 'center', fontSize: '20px', order: 2 },
        'back-to-dashboard-btn': { padding: '8px 10px', fontSize: '12px', order: 1, position: 'static' },
        'header-spacer': { display: 'none' },
        'my-work-main': { width: '100%', maxWidth: '640px', margin: '0 auto', padding: '18px 10px', boxSizing: 'border-box' },
        'empty-state-banner': { padding: '24px 14px' },
        'inquiries-section': { width: '100%', maxWidth: '600px', margin: '0 auto 32px' },
        'section-header': { textAlign: 'center' },
        'section-header-with-action': { alignItems: 'stretch', textAlign: 'left' },
        'section-add-slot-btn': { width: '100%' },
        'inquiries-grid': { width: '100%', maxWidth: '600px', margin: '0 auto', gridTemplateColumns: '1fr', justifyItems: 'center' },
        'inquiry-card': { width: '100%', maxWidth: '560px', margin: '0 auto' },
        'inquiry-meta': { flexWrap: 'wrap', gap: '8px' },
        'inquiry-actions': { flexDirection: 'column' },
        'week-slider': { flexDirection: 'column', alignItems: 'stretch' },
        'schedule-section': { width: '100%', maxWidth: '600px', margin: '0 auto 32px' },
        'calendar-availability-grid': { gridTemplateColumns: '1fr' },
        'schedule-grid': { gridTemplateColumns: '1fr' },
        'booking-item': { flexDirection: 'column', alignItems: 'flex-start', gap: '6px' },
        'booking-name': { minWidth: 0 },
        'booking-inline-actions': { width: '100%', flexWrap: 'wrap' },
        'stats-footer': { gridTemplateColumns: '1fr', margin: '24px auto 0' },
        'payment-qr-grid': { gridTemplateColumns: '1fr' },
      }
    : {};

  const sx = (...names) =>
    names.reduce(
      (acc, name) => ({
        ...acc,
        ...(classStyles[name] || {}),
        ...(themeClassStyles[name] || {}),
        ...(responsiveClassStyles[name] || {}),
      }),
      {}
    );

  const isHovered = (key) => hoverKey === key;
  const sectionTitleStyle = { fontSize: '22px', fontWeight: 800, color: themeTokens.textPrimary, margin: '0 0 4px 0', lineHeight: 1.2 };
  const modalTextStyle = { margin: 0, color: themeTokens.textPrimary, lineHeight: 1.5 };
  const modalMetaTextStyle = { margin: '8px 0 0', color: themeTokens.textSecondary, fontSize: '13px' };
  const modalDangerTextStyle = { margin: '8px 0 0', color: isDarkMode ? '#fca5a5' : '#b91c1c', fontSize: '13px', fontWeight: 600 };

  const gcashNumber = currentProfile?.gcashNumber || '09054891105';
  const currentRateBasis = normalizeRateBasis(
    currentProfile?.raw?.metadata?.rate_basis ||
    currentProfile?.raw?.rate_basis ||
    currentProfile?.raw?.price_type ||
    currentProfile?.rateBasis ||
    currentProfile?.pricingModel
  ) || 'per-project';
  const currentPriceValue = (() => {
    if (currentProfile?.raw?.base_price != null) return currentProfile.raw.base_price;
    if (currentRateBasis === 'per-hour') return currentProfile?.hourlyRate ?? currentProfile?.fixedPrice;
    if (currentRateBasis === 'per-day') return currentProfile?.dailyRate ?? currentProfile?.fixedPrice;
    if (currentRateBasis === 'per-week') return currentProfile?.weeklyRate ?? currentProfile?.fixedPrice;
    if (currentRateBasis === 'per-month') return currentProfile?.monthlyRate ?? currentProfile?.fixedPrice;
    return currentProfile?.fixedPrice ?? null;
  })();
  const currentPriceLabel =
    currentProfile?.pricingModel === 'inquiry'
      ? 'Price on inquiry'
      : currentPriceValue
        ? `P${currentPriceValue}/${
          currentRateBasis === 'per-day'
            ? 'day'
            : currentRateBasis === 'per-hour'
              ? 'hr'
              : currentRateBasis === 'per-week'
                ? 'wk'
                : currentRateBasis === 'per-month'
                  ? 'mo'
                  : 'project'
        }`
        : 'Custom pricing';
  const currentServiceDescription =
    currentProfile?.raw?.description ||
    currentProfile?.description ||
    currentProfile?.raw?.short_description ||
    'Add a detailed service description so clients understand the scope, deliverables, schedule expectations, and what makes your work a good fit.';
  const currentDurationLabel = currentProfile?.raw?.duration_minutes
    ? `${currentProfile.raw.duration_minutes} min`
    : 'Flexible';
  const currentPaymentLabel = currentProfile?.paymentAdvance && currentProfile?.paymentAfterService
    ? 'Advance or after service'
    : currentProfile?.paymentAdvance
      ? 'Advance payment'
      : 'After service';
  const currentBoostEndsAt = currentProfile?.boostEndsAt || currentProfile?.raw?.metadata?.ad_booster?.ends_at || currentProfile?.raw?.metadata?.adBooster?.endsAt || null;
  const currentBoostLabel = currentProfile?.isBoosted
    ? `Active until ${currentBoostEndsAt ? new Date(currentBoostEndsAt).toLocaleDateString() : 'manually stopped'}`
    : 'Not boosted';
  const avgRatingLabel = sellerRatingAggregate?.rating_count
    ? Number(sellerRatingAggregate.avg_rating || 0).toFixed(2).replace(/\.00$/, '')
    : '0';
  const normalizedSellerRole = String(sellerProfile?.role || '').trim().toLowerCase();
  const canShowAddServiceButton = normalizedSellerRole === 'worker';
  const cashQrId = currentProfile?.cashQrId || `CASHQR-${(currentProfile?.fullName || 'WORKER').replace(/\s+/g, '-').toUpperCase()}`;
  const gcashQrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(`GCash-${gcashNumber}`)}`;
  const cashConfirmQrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(`CASH-CONFIRM-${currentProfile?.fullName || 'Worker'}-${gcashNumber}`)}`;
  
  const showInquiriesSection = workSectionFilter === 'all' || workSectionFilter === 'inquiries';
  const showCashApprovalSection = workSectionFilter === 'all' || workSectionFilter === 'cash-approvals';
  const showRefundSection = workSectionFilter === 'all' || workSectionFilter === 'refunds';
  const showCancelledSection = workSectionFilter === 'all' || workSectionFilter === 'cancelled';
  const showScheduleSection = supportsAvailabilitySchedule && (workSectionFilter === 'all' || workSectionFilter === 'schedule');
  const visibleCalendarAvailability = calendarAvailability.filter((entry) => {
    const entryDate = new Date(`${entry.date}T00:00:00`);
    return entryDate >= currentWeekMonday && entryDate <= currentWeekSunday;
  });
  const workSectionOptions = [
    { label: 'Show All', shortLabel: 'All', value: 'all', description: 'Overview of every work section' },
    { label: 'Active Inquiries', shortLabel: 'Inquiries', value: 'inquiries', description: 'Client requests waiting for a response' },
    { label: 'Payment Confirmations', shortLabel: 'Cash', value: 'cash-approvals', description: 'Cash payment review queue' },
    { label: 'Refund Cases', shortLabel: 'Refunds', value: 'refunds', description: 'GCash refund tracking' },
    { label: 'Cancelled Bookings', shortLabel: 'Cancelled', value: 'cancelled', description: 'Cancelled cash bookings' },
    ...(supportsAvailabilitySchedule
      ? [{ label: 'Service Availability', shortLabel: 'Availability', value: 'schedule', description: 'Time slots for the selected service' }]
      : []),
  ];
  
  // ============ HELPER FUNCTIONS ============
  
  /**
   * getInquiryById(id)
   * Retrieves inquiry data for a specific ID
   */
  const getInquiryById = (id) => activeInquiries.find(inq => inq.id === id);
  
  /**
   * getSlotStatusColor(slotsLeft, capacity)
   * Returns CSS class for slot availability coloring
   */
  const getSlotStatusColor = (slotsLeft, capacity) => {
    if (slotsLeft === 0) return 'slot-full';
    if (slotsLeft <= capacity / 2) return 'slot-half';
    return 'slot-available';
  };
  
  // Currently selected inquiry for chat
  const selectedInquiry = selectedChatId ? getInquiryById(selectedChatId) : null;
  
  // ============ RENDER ============
  
  return (
    <div style={sx('my-work-page')} data-testid="my-work-page">
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
      
      <main className="my-work-main-modern" style={sx('my-work-main')} aria-hidden={editSlotModalOpen ? 'true' : undefined}>

        <header className="my-work-page-heading max-[760px]:relative">
          <div className="my-work-page-heading-copy">
            <h1>Manage My Work</h1>
            <p>Handle client requests, payments, refunds, and your published services from one place.</p>
          </div>
          <div className="my-work-page-heading-actions max-[760px]:absolute max-[760px]:right-0 max-[760px]:top-0">
            {canShowAddServiceButton && sellerData && (
              <span className="inline-flex">
                <Button type="button" className="max-[760px]:h-10 max-[760px]:min-h-10 max-[760px]:px-3" onClick={() => setIsCreateServiceOpen(true)}>
                  <Plus size={16} aria-hidden="true" />
                  Add service
                </Button>
              </span>
            )}
          </div>
        </header>

        {/* Inline notifications */}
        {successMessage && (
          <SuccessNotification
            message={successMessage}
            isVisible={Boolean(successMessage)}
            onClose={() => setSuccessMessage('')}
          />
        )}
        {(sellerDataError || paymentError) && (
          <ErrorNotification
            message={sellerDataError || paymentError}
            isVisible={Boolean(sellerDataError || paymentError)}
            onClose={() => {
              setSellerDataError(null);
              setPaymentError('');
            }}
          />
        )}

        {/* Loading state while fetching seller data */}
        {isLoadingSellerData && (
          <div style={{ textAlign: 'center', padding: '48px 0', color: themeTokens.textSecondary }}>
            <Loader2 size={30} className="gl-spin" aria-hidden="true" style={{ marginBottom: '12px' }} />
            <p style={{ fontSize: '16px', fontWeight: 500 }}>Loading your seller profile…</p>
          </div>
        )}

        {!isLoadingSellerData && hasSellerRecord && (workerServices || []).length > 1 && (
          <div
            style={{
              width: '100%',
              maxWidth: '1100px',
              margin: '0 auto 16px',
              padding: '12px 14px',
              borderRadius: '8px',
              border: `1px solid ${themeTokens.border}`,
              background: themeTokens.surface,
              boxShadow: themeTokens.shadowSoft,
              boxSizing: 'border-box',
            }}
          >
            <label
              style={{
                display: 'grid',
                gap: '6px',
                color: themeTokens.textPrimary,
                fontSize: '13px',
                fontWeight: 800,
              }}
            >
              Active Service
              <select
                aria-label="Active service"
                value={activeServiceIndex}
                onChange={(event) => setActiveServiceIndex(Number(event.target.value))}
                style={{
                  width: '100%',
                  borderRadius: '8px',
                  border: `1px solid ${themeTokens.inputBorder}`,
                  background: themeTokens.inputBg,
                  color: themeTokens.inputText,
                  padding: '10px 12px',
                  fontWeight: 700,
                }}
              >
                {(workerServices || []).map((service, index) => (
                  <option key={service.raw?.id || `${service.serviceType}-${index}`} value={index}>
                    {service.serviceType || service.raw?.title || `Service ${index + 1}`}
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}

        {showSetupBanner && (
          <div style={sx('empty-state-banner')}>
            <h2 style={{ fontSize: '28px', fontWeight: 700, color: isDarkMode ? '#fde68a' : '#78350f', margin: '0 0 8px 0' }}>Welcome! Setup your profile</h2>
            <p style={{ fontSize: '16px', color: isDarkMode ? '#fed7aa' : '#92400e', margin: '0 0 20px 0' }}>Complete your service profile to start receiving inquiries from clients.</p>
            <button
              style={{
                padding: '12px 28px',
                background: '#f59e0b',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontWeight: 600,
                cursor: 'pointer',
                ...(isHovered('empty-add-work') ? { background: '#d97706' } : {}),
              }}
              onMouseEnter={() => setHoverKey('empty-add-work')}
              onMouseLeave={() => setHoverKey('')}
              onClick={onAddNewWork}
            >
              Get Started
            </button>
          </div>
        )}
        
        {!isLoadingSellerData && hasSellerRecord && (
          <>
            <WorkProviderSummary
              name={currentProfile?.fullName || 'Service Provider'}
              profilePhoto={currentProfile?.profilePhoto}
              service={currentProfile?.serviceType || 'Service'}
              price={currentPriceLabel}
              location={`${currentProfile?.location?.address || currentProfile?.location?.barangay || 'Sabang'}, ${currentProfile?.location?.city || 'Baliwag'}, ${currentProfile?.location?.province || 'Bulacan'}`}
              bookingMode={supportsAvailabilitySchedule ? 'Time-slot booking' : 'Request booking'}
              isBoosted={currentProfile?.isBoosted}
              activeInquiries={activeInquiries.length}
              averageRating={avgRatingLabel}
              completed={0}
              description={currentServiceDescription}
              duration={currentDurationLabel}
              payment={currentPaymentLabel}
              booster={currentBoostLabel}
              onEditProfile={handleOpenProfileEdit}
              onOpenGcashQr={handleOpenGcashPreview}
              onOpenCashQr={handleOpenCashQrPreview}
            />

            <WorkSectionFilter value={workSectionFilter} options={workSectionOptions} onValueChange={setWorkSectionFilter} />
            
            {showInquiriesSection && <ActiveInquiriesSection inquiries={activeInquiries} onRespond={handleRespondClick} />}

            <WorkPaymentQueues
              cancelledTransactions={cancelledCashTransactions}
              cashTransactions={cashConfirmationNotifications}
              cashView={cashPaymentView}
              onApproveRefund={handleApproveRefund}
              onCashReview={handleRequestCashConfirmationReview}
              onCashViewChange={setCashPaymentView}
              refundTransactions={refundTransactions}
              showCancelled={showCancelledSection}
              showCash={showCashApprovalSection}
              showRefunds={showRefundSection}
            />
            
            {showScheduleSection && <section style={sx('schedule-section')} data-testid="work-schedule-section">
              <div style={sx('section-header', 'section-header-with-action')}>
                <div style={sx('section-heading-copy')}>
                  <h2 style={sectionTitleStyle}>Service Availability</h2>
                  <p style={sx('section-subtitle')}>
                    Manage time-slot availability for {currentProfile?.serviceType || 'this service'}
                  </p>
                </div>
                <button
                  style={{ ...sx('btn-add-slot', 'section-add-slot-btn'), ...(isHovered('schedule-header-add') ? hoverStyles.addSlot : {}) }}
                  onMouseEnter={() => setHoverKey('schedule-header-add')}
                  onMouseLeave={() => setHoverKey('')}
                  onClick={() => handleAddSlot(undefined)}
                >
                  + Add Slot
                </button>
              </div>

              <div style={sx('week-slider')}>
                <button
                  style={{ ...sx('week-nav-btn'), ...(isHovered('prev-week') ? hoverStyles.weekNav : {}) }}
                  onMouseEnter={() => setHoverKey('prev-week')}
                  onMouseLeave={() => setHoverKey('')}
                  onClick={() => setWeekOffset((prev) => prev - 1)}
                >
                  Previous Week
                </button>
                <div style={sx('week-range')}>
                  <strong>{weekRangeLabel}</strong>
                  <span style={{ fontSize: '12px', color: themeTokens.textMuted }}>{weekOffset === 0 ? 'Current Week' : `${weekOffset > 0 ? '+' : ''}${weekOffset} week`}</span>
                </div>
                <button
                  style={{ ...sx('week-nav-btn'), ...(isHovered('next-week') ? hoverStyles.weekNav : {}) }}
                  onMouseEnter={() => setHoverKey('next-week')}
                  onMouseLeave={() => setHoverKey('')}
                  onClick={() => setWeekOffset((prev) => prev + 1)}
                >
                  Next Week
                </button>
              </div>

              {isScheduleLoading && (
                <p role="status" style={sx('schedule-state-message', 'schedule-loading-state')}>
                  Loading real schedule slots...
                </p>
              )}

              {scheduleError && (
                <p role="alert" style={sx('schedule-state-message', 'schedule-error-state')}>
                  {scheduleError}
                </p>
              )}

              {scheduleMode === 'calendar-only' ? (
                <div style={sx('calendar-availability-grid')}>
                  {visibleCalendarAvailability
                    .map((entry) => {
                      const entryTransactions = weekTransactions.filter((txn) => txn.scheduleRef === entry.id);
                      return (
                        <div key={entry.id} style={sx('calendar-day-card')}>
                          <h3 style={sx('calendar-date')} className="gl-inline-icon-line">
                            <CalendarDays size={16} aria-hidden="true" />
                            {entry.date}
                          </h3>
                          <p style={sx('calendar-booked')}>Booked: {entry.booked}/{entry.maxBookings}</p>
                          <p style={sx('calendar-note')}>{entry.note || 'No notes added'}</p>

                          {entryTransactions.length > 0 && (
                            <div style={sx('calendar-bookings-list')}>
                              {entryTransactions.map((txn) => (
                                <div key={txn.id} style={sx('booking-item')}>
                                  <span style={sx('booking-name')} className="gl-inline-icon-line">
                                    <UserRound size={13} aria-hidden="true" />
                                    {txn.clientName}
                                  </span>
                                  {isMonthlyRecurringTxn(txn) && (
                                    <span style={sx('recurring-cycle-pill')}>
                                      Monthly {txn.cycleOrder}/4 ({txn.cycleStart} to {txn.cycleEnd})
                                    </span>
                                  )}
                                  <div style={sx('booking-inline-actions')}>
                                    <label style={sx('check-toggle', 'compact')}>
                                      <input
                                        type="checkbox"
                                        checked={txn.isPaid}
                                        disabled={!canTogglePaid(txn)}
                                        readOnly
                                        style={{ margin: 0, padding: 0 }}
                                      />
                                      <span>{txn.isPaid ? 'Paid (verified)' : 'Awaiting verification'}</span>
                                    </label>
                                    {isMonthlyRecurringTxn(txn) && !canTogglePaid(txn) && (
                                      <span style={sx('lock-hint')}>Locked for monthly cycle</span>
                                    )}
                                    {txn.isDone ? (
                                      <span style={sx('done-pill')}>Done</span>
                                    ) : (
                                      <button
                                        style={{ ...sx('mark-done-btn'), ...(isHovered(`mark-done-${txn.id}`) ? hoverStyles.markDone : {}), ...( !canMarkDone(txn) ? { background: isDarkMode ? '#475569' : '#9ca3af', cursor: 'not-allowed' } : {}) }}
                                        onMouseEnter={() => setHoverKey(`mark-done-${txn.id}`)}
                                        onMouseLeave={() => setHoverKey('')}
                                        disabled={!canMarkDone(txn)}
                                        onClick={() => handleOpenDoneModal(txn)}
                                      >
                                        Mark Done
                                      </button>
                                    )}
                                    {isMonthlyRecurringTxn(txn) && txn.paymentMode === 'After Service' && !isLastCycleEntry(txn) && (
                                      <span style={sx('lock-hint')}>Finalize on last cycle entry</span>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}

                          <div style={sx('block-actions')}>
                            <button
                              style={{ ...sx('action-btn'), ...(isHovered(`cal-edit-${entry.id}`) ? hoverStyles.editAction : {}) }}
                              onMouseEnter={() => setHoverKey(`cal-edit-${entry.id}`)}
                              onMouseLeave={() => setHoverKey('')}
                              title="Edit date"
                              onClick={() => handleEditSlot(null, entry.id)}
                            >
                              <Pencil size={14} aria-hidden="true" />
                            </button>
                            <button
                              style={{ ...sx('action-btn'), ...(isHovered(`cal-delete-${entry.id}`) ? hoverStyles.deleteAction : {}) }}
                              onMouseEnter={() => setHoverKey(`cal-delete-${entry.id}`)}
                              onMouseLeave={() => setHoverKey('')}
                              title="Delete date"
                              aria-label="Remove date"
                              onClick={() => handleDeleteSlot(null, entry.id)}
                            >
                              <Trash2 size={14} aria-hidden="true" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  <button
                    style={{ ...sx('btn-add-slot'), ...(isHovered('add-date') ? hoverStyles.addSlot : {}) }}
                    onMouseEnter={() => setHoverKey('add-date')}
                    onMouseLeave={() => setHoverKey('')}
                    onClick={() => handleAddSlot('calendar')}
                  >
                    + Add Date
                  </button>
                </div>
              ) : (
                <div style={sx('schedule-grid')}>
                  {dayKeys.map((dayKey) => {
                    const timeBlocks = weeklySchedule[dayKey] || [];
                    return (
                      <div key={dayKey} style={sx('schedule-day-card')}>
                        <h3 style={sx('day-header')}>{dayKey}</h3>
                        <p style={sx('day-date')}>{formatDateLong(weekDateByDay[dayKey])}</p>

                        {timeBlocks.length === 0 ? (
                          <p style={sx('no-slots')}>No slots scheduled</p>
                        ) : (
                          <div style={sx('time-blocks')}>
                            {timeBlocks.map((block) => (
                              <div
                                key={block.id}
                                style={sx('time-block', getSlotStatusColor(block.slotsLeft, block.capacity))}
                              >
                                <div style={sx('block-time')}>
                                  <strong>
                                    {block.startTime} - {block.endTime}
                                  </strong>
                                </div>

                                <div style={sx('block-status')}>
                                  <span style={sx('slots-counter')}>
                                    {block.capacity - block.slotsLeft}/{block.capacity} Filled
                                  </span>
                                  <div style={sx('status-bar')}>
                                    <div
                                      style={{ ...sx('filled-bar'),
                                        width: `${((block.capacity - block.slotsLeft) / block.capacity) * 100}%`,
                                      }}
                                    ></div>
                                  </div>
                                </div>

                                {block.bookings.length > 0 && (
                                  <div style={sx('bookings-preview')}>
                                    {block.bookings.map((booking, idx) => {
                                      const bookingTxn = getTransactionForBooking(block.id, booking.clientName);
                                      return (
                                        <div key={idx} style={sx('booking-item')}>
                                          <span style={sx('booking-name')} className="gl-inline-icon-line">
                                            <UserRound size={13} aria-hidden="true" />
                                            {booking.clientName}
                                          </span>
                                          {bookingTxn ? (
                                            <div style={sx('booking-inline-actions')}>
                                              {isMonthlyRecurringTxn(bookingTxn) && (
                                                <span style={sx('recurring-cycle-pill')}>
                                                  Monthly {bookingTxn.cycleOrder}/4 ({bookingTxn.cycleStart} to {bookingTxn.cycleEnd})
                                                </span>
                                              )}
                                              <label style={sx('check-toggle', 'compact')}>
                                                <input
                                                  type="checkbox"
                                                  checked={bookingTxn.isPaid}
                                                  disabled={!canTogglePaid(bookingTxn)}
                                                  readOnly
                                                  style={{ margin: 0, padding: 0 }}
                                                />
                                                <span>{bookingTxn.isPaid ? 'Paid (verified)' : 'Awaiting verification'}</span>
                                              </label>
                                              {isMonthlyRecurringTxn(bookingTxn) && !canTogglePaid(bookingTxn) && (
                                                <span style={sx('lock-hint')}>Locked for monthly cycle</span>
                                              )}
                                              {bookingTxn.isDone ? (
                                                <span style={sx('done-pill')}>Done</span>
                                              ) : (
                                                <button
                                                  style={{ ...sx('mark-done-btn'), ...(isHovered(`mark-done-${bookingTxn.id}`) ? hoverStyles.markDone : {}), ...(!canMarkDone(bookingTxn) ? { background: isDarkMode ? '#475569' : '#9ca3af', cursor: 'not-allowed' } : {}) }}
                                                  onMouseEnter={() => setHoverKey(`mark-done-${bookingTxn.id}`)}
                                                  onMouseLeave={() => setHoverKey('')}
                                                  disabled={!canMarkDone(bookingTxn)}
                                                  onClick={() => handleOpenDoneModal(bookingTxn)}
                                                >
                                                  Mark Done
                                                </button>
                                              )}
                                              {isMonthlyRecurringTxn(bookingTxn) && bookingTxn.paymentMode === 'After Service' && !isLastCycleEntry(bookingTxn) && (
                                                <span style={sx('lock-hint')}>Finalize on last cycle entry</span>
                                              )}
                                            </div>
                                          ) : (
                                            <span style={sx('booking-item-checks')}>No transaction record</span>
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}

                                <div style={sx('block-actions')}>
                                  <button
                                    style={{ ...sx('action-btn'), ...(isHovered(`slot-edit-${block.id}`) ? hoverStyles.editAction : {}) }}
                                    onMouseEnter={() => setHoverKey(`slot-edit-${block.id}`)}
                                    onMouseLeave={() => setHoverKey('')}
                                    title="Edit slot"
                                    onClick={() => handleEditSlot(dayKey, block.id)}
                                  >
                                    <Pencil size={14} aria-hidden="true" />
                                  </button>
                                  <button
                                    style={{ ...sx('action-btn'), ...(isHovered(`slot-delete-${block.id}`) ? hoverStyles.deleteAction : {}) }}
                                    onMouseEnter={() => setHoverKey(`slot-delete-${block.id}`)}
                                    onMouseLeave={() => setHoverKey('')}
                                    title="Delete slot"
                                    aria-label="Remove slot"
                                    onClick={() => handleDeleteSlot(dayKey, block.id)}
                                  >
                                    <Trash2 size={14} aria-hidden="true" />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        <button
                          style={{ ...sx('btn-add-slot'), ...(isHovered(`add-slot-${dayKey}`) ? hoverStyles.addSlot : {}) }}
                          onMouseEnter={() => setHoverKey(`add-slot-${dayKey}`)}
                          onMouseLeave={() => setHoverKey('')}
                          onClick={() => handleAddSlot(dayKey)}
                        >
                          + Add Slot
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>}
            
          </>
        )}
      </main>

      <ConfirmActionModal
        isOpen={Boolean(doneConfirmTarget)}
        title="Confirm service delivery?"
        description="The client must still confirm completion, or the system may auto-confirm after 72 hours when there is no dispute."
        onCancel={() => setDoneConfirmTarget(null)}
        onConfirm={handleConfirmDone}
        confirmLabel="Claim Service Delivered"
      >
        <p className="m-0">
          Claim that the service for <strong>{doneConfirmTarget?.clientName}</strong> was delivered?
        </p>
      </ConfirmActionModal>

      <ConfirmActionModal
        isOpen={Boolean(deleteConfirmTarget)}
        title="Delete this time slot?"
        description="This action cannot be undone. Existing booking records will not be deleted."
        variant="destructive"
        onCancel={() => setDeleteConfirmTarget(null)}
        onConfirm={handleConfirmDelete}
        confirmLabel="Delete"
      >
        <p className="m-0">You are about to remove <strong>{deleteConfirmTarget?.label}</strong>.</p>
      </ConfirmActionModal>

      <QrPreviewModal
        isOpen={isGcashPreviewOpen}
        title="GCash Face-to-Face Payment"
        subtitle="Show this QR to your client during meetup."
        imageSrc={gcashQrImageUrl}
        imageAlt="GCash QR"
        primaryLabel="GCash Number"
        primaryValue={gcashNumber}
        note="Ask your client to scan this QR or send payment to the number above."
        onClose={handleCloseGcashPreview}
      />

      <QrPreviewModal
        isOpen={isCashQrPreviewOpen}
        title="Cash Confirmation QR"
        subtitle="Let the client scan this QR after handing over cash to submit payment details for your approval."
        imageSrc={cashConfirmQrImageUrl}
        imageAlt="Cash Confirmation QR"
        primaryLabel="Cash QR ID"
        primaryValue={cashQrId}
        note="Client submits amount using this QR, then you approve or deny inside Payment Confirmations."
        onClose={handleCloseCashQrPreview}
      />

      <ConfirmActionModal
        isOpen={Boolean(cashDecisionTarget)}
        title={`${cashDecisionTarget?.decision === 'approve' ? 'Approve' : 'Deny'} cash confirmation?`}
        description="Verify the submitted and expected amounts before continuing."
        variant={cashDecisionTarget?.decision === 'deny' ? 'destructive' : 'default'}
        onCancel={handleCloseCashDecisionModal}
        onConfirm={handleConfirmCashDecision}
        cancelLabel="No"
        confirmLabel={`Yes, ${cashDecisionTarget?.decision === 'approve' ? 'Approve' : 'Deny'}`}
      >
        <p className="m-0">
          Client: <strong>{cashDecisionTarget?.clientName}</strong> | Service: <strong>{cashDecisionTarget?.service}</strong>
        </p>
        <p style={modalMetaTextStyle}>
          Submitted: ₱{cashDecisionTarget?.submittedCashAmount} | Expected: ₱{cashDecisionTarget?.expectedCashAmount}
        </p>
        {cashDecisionTarget?.decision === 'deny' && (
          <p style={modalDangerTextStyle}>
            Denying this payment can affect transaction records. Please verify details before continuing.
          </p>
        )}
      </ConfirmActionModal>
      
      {/* CHAT MODAL */}
      {selectedChatId && selectedInquiry && (
        <InquiryChatModal
          inquiry={selectedInquiry}
          onClose={handleCloseChat}
          onBookingUpdated={() => refreshSellerTransactions()}
          onError={setPaymentError}
        />
      )}

      {/* SLOT EDIT MODAL */}
      {editSlotModalOpen && <SlotEditModal
        isOpen={editSlotModalOpen}
        mode={scheduleMode}
        slotData={editSlotData}
        dayLabel={editSlotDayKey || 'Calendar Date'}
        modalTitle={
          scheduleMode === 'calendar-only'
            ? slotModalType === 'add'
              ? 'Add Available Date'
              : 'Edit Available Date'
            : `${slotModalType === 'add' ? 'Add' : 'Edit'} Time Slot - ${editSlotDayKey || 'Day'}`
        }
        submitLabel={slotModalType === 'add' ? (scheduleMode === 'calendar-only' ? 'Add Date' : 'Add Slot') : 'Save Changes'}
        onSave={handleSaveSlotEdit}
        onClose={closeSlotModal}
        appTheme={appTheme}
      />}

      {isCreateServiceOpen && <CreateServiceModal
        isOpen={isCreateServiceOpen}
        newService={newService}
        onChange={handleCreateServiceChange}
        onClose={closeCreateService}
        onSubmit={handleCreateServiceSubmit}
        appTheme={appTheme}
      />}

      {/* PROFILE EDIT MODAL */}
      <ProfileEditModal
        isOpen={profileEditModalOpen}
        profileData={currentProfile}
        onSave={handleProfileEditSave}
        onClose={() => setProfileEditModalOpen(false)}
        appTheme={appTheme}
      />

    </div>
  );
};

export default MyWork;
