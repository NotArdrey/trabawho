import React, { useMemo, useState, useEffect, useRef } from 'react';
import { Archive, MoreVertical, Trash2 } from 'lucide-react';
import { getThemeTokens } from '../../../shared/styles/themeTokens';
import { fetchBookingMessages, sendBookingMessage } from '../services/bookingService';

const normalizeChatKeyPart = (value) => String(value || '').trim().toLowerCase();

const getChatListKey = (booking = {}, viewerRole = 'buyer') => {
  const otherParticipantKey = viewerRole === 'seller'
    ? (booking.buyerId || booking.clientId || booking.clientName)
    : (booking.workerId || booking.sellerId || booking.workerName);
  const serviceKey = booking.serviceId || booking.serviceType || booking.description;

  return [
    viewerRole,
    otherParticipantKey,
    serviceKey,
  ].map(normalizeChatKeyPart).join('|');
};

const ChatWindow = ({ appTheme = 'light', booking, onApproveQuote, onRejectQuote, onStopServiceAccepted, bookings, onSelectBooking, selectedBookingId, onOpenSlotSelection, onOpenPaymentSelection, onRequestRefund, onConfirmRefundReceived, onLeaveRating, onArchiveChat, onDeleteChat, viewerRole = 'buyer' }) => {
  const [messages, setMessages] = useState([]);
  const [clientMessage, setClientMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [messageError, setMessageError] = useState('');
  const [isApproveHovered, setIsApproveHovered] = useState(false);
  const [isSendHovered, setIsSendHovered] = useState(false);
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [hoveredChatId, setHoveredChatId] = useState(null);
  const [activeSidebarPanel, setActiveSidebarPanel] = useState(null);
  const [showRefundRequestModal, setShowRefundRequestModal] = useState(false);
  const [showRefundConfirmModal, setShowRefundConfirmModal] = useState(false);
  const [refundReason, setRefundReason] = useState('');
  const [showRejectQuoteModal, setShowRejectQuoteModal] = useState(false);
  const [rejectQuoteReason, setRejectQuoteReason] = useState('');
  const [draftRating, setDraftRating] = useState(booking?.rating || 0);
  const [ratingComment, setRatingComment] = useState(booking?.ratingComment || '');
  const [ratingSubmitted, setRatingSubmitted] = useState(!!booking?.rating);
  const [isChatActionSaving, setIsChatActionSaving] = useState(false);
  const [isConversationMenuOpen, setIsConversationMenuOpen] = useState(false);
  const [pendingChatAction, setPendingChatAction] = useState(null);
  const conversationMenuRef = useRef(null);

  const hasSellerQuote = messages.some((message) => message.type === 'quote');
  const isRecurringService = booking?.billingCycle === 'weekly' || booking?.billingCycle === 'monthly';
  const isServiceStopped =
    booking?.status === 'Service Stopped'
    || Boolean(booking?.stopRequested && booking?.workerStopApproved);
  const isClosedConversation = ['Completed Service', 'Service Stopped', 'Cancelled (Cash)', 'Refund Processing', 'Refunded'].includes(booking?.status);
  const isRefundConversation = booking?.status === 'Refund Processing' || booking?.status === 'Refunded' || booking?.refundStatus === 'requested';
  const isQuoteRejected = booking?.status === 'Quote Rejected';
  const isRequestBooking = booking?.bookingMode === 'calendar-only' || booking?.isRequestBooking;
  const canRequestRefund = booking?.refundEligible && !booking?.refundStatus;
  const canConfirmRefund = booking?.refundStatus === 'approved-awaiting-client-confirmation';
  const shouldShowSlotSelectionNotice =
    booking?.quoteApproved
    && !booking?.selectedSlot
    && booking?.status === 'Awaiting Slot Selection'
    && !isRequestBooking
    && !isClosedConversation
    && !isRefundConversation;
  const shouldShowRequestPaymentNotice =
    booking?.quoteApproved
    && isRequestBooking
    && !booking?.paymentMethod
    && !isClosedConversation
    && !isRefundConversation;
  const canReviewQuote =
    hasSellerQuote
    && !booking?.quoteApproved
    && !isClosedConversation
    && !isRefundConversation
    && !isQuoteRejected;
  const shouldShowPriceAmount = hasSellerQuote || booking?.quoteApproved || !isRequestBooking;
  const priceDetailLabel = hasSellerQuote || booking?.quoteApproved
    ? 'Quote Amount'
    : (isRequestBooking ? 'Quote Status' : 'Listed Rate');
  const priceDetailValue = shouldShowPriceAmount
    ? `\u20B1${booking.quoteAmount || 0}`
    : 'Waiting for worker quote';
  const formatPhp = (value) => `\u20B1${Number(value || 0).toLocaleString('en-PH', {
    minimumFractionDigits: Number(value || 0) % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
  const transactionFeeAmount = Number(booking?.transactionFeeAmount || 0);
  const totalChargedAmount = Number(booking?.totalChargedAmount || booking?.quoteAmount || 0);
  const isSellerView = viewerRole === 'seller';
  const getChatDisplayName = (targetBooking = {}) => (
    isSellerView
      ? (targetBooking.clientName || 'Client')
      : (targetBooking.workerName || 'Service Provider')
  );
  const getChatAvatarLetter = (targetBooking = {}) => (
    getChatDisplayName(targetBooking).trim().charAt(0).toUpperCase() || '?'
  );
  const chatBookings = useMemo(() => {
    const rows = Array.isArray(bookings) ? bookings : [];
    const seen = new Set();

    return rows.filter((item) => {
      const key = getChatListKey(item, viewerRole);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [bookings, viewerRole]);

  const isGcashFlow = (paymentMethod) => paymentMethod === 'gcash-advance' || paymentMethod === 'after-service-gcash';
  const isRecurringBilling = (targetBooking) => targetBooking?.billingCycle === 'weekly' || targetBooking?.billingCycle === 'monthly';
  const getBillingLabel = (targetBooking) => {
    if (targetBooking?.billingCycle === 'weekly') return 'Weekly';
    if (targetBooking?.billingCycle === 'monthly') return 'Monthly';
    return '';
  };
  const isRecurringChargeDue = (targetBooking) => {
    if (!isRecurringBilling(targetBooking) || isServiceStopped || !targetBooking?.nextChargeDate) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dueDate = new Date(targetBooking.nextChargeDate);
    dueDate.setHours(0, 0, 0, 0);
    return dueDate <= today;
  };
  const shouldShowSlotPaymentAction = booking.selectedSlot && !isServiceStopped && !booking.transactionId && !booking.paymentMethod;
  const shouldShowRecurringGcashPaymentAction = booking.selectedSlot && !isServiceStopped && !booking.transactionId && isGcashFlow(booking.paymentMethod || '') && !booking.paymentProofSubmitted && isRecurringBilling(booking) && isRecurringChargeDue(booking);
  const shouldShowGcashPaymentAction = booking.selectedSlot && !isServiceStopped && !booking.transactionId && isGcashFlow(booking.paymentMethod || '') && !booking.paymentProofSubmitted && !isRecurringBilling(booking);
  const shouldShowCashConfirmationAction = booking.paymentMethod === 'after-service-cash' && !isServiceStopped && !booking.transactionId && booking.cashConfirmationStatus !== 'approved';
  const shouldShowTransactionAction = Boolean(booking.transactionId || booking.paymentReference);
  const showServiceDetailsSidebar = false;
  const hasSidebarActions = shouldShowSlotSelectionNotice
    || shouldShowRequestPaymentNotice
    || shouldShowSlotPaymentAction
    || shouldShowRecurringGcashPaymentAction
    || shouldShowGcashPaymentAction
    || shouldShowCashConfirmationAction
    || (canRequestRefund && !isServiceStopped)
    || canConfirmRefund
    || shouldShowTransactionAction;

  useEffect(() => {
    let mounted = true;

    // sync rating state when booking changes
    setDraftRating(booking?.rating || 0);
    setRatingComment(booking?.review || booking?.ratingComment || '');
    setRatingSubmitted(!!booking?.rating);
    setIsConversationMenuOpen(false);
    setPendingChatAction(null);

    const loadMessages = async () => {
      if (!booking?.id) return;
      setIsLoading(true);
      setMessageError('');

      try {
        const dbMessages = await fetchBookingMessages(booking);
        if (!mounted) return;
        setMessages(dbMessages);
      } catch (error) {
        if (!mounted) return;
        setMessageError(error?.message || 'Unable to load conversation messages.');
        setMessages([]);
      } finally {
        if (mounted) setIsLoading(false);
      }
    };

    loadMessages();
    return () => {
      mounted = false;
    };
  }, [booking]);

  useEffect(() => {
    if (!isConversationMenuOpen) return undefined;

    const handleOutsideClick = (event) => {
      if (conversationMenuRef.current && !conversationMenuRef.current.contains(event.target)) {
        setIsConversationMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [isConversationMenuOpen]);

  const handleSendMessage = async () => {
    if (!clientMessage.trim()) return;

    try {
      const savedMessage = await sendBookingMessage(booking, clientMessage);
      setMessages((prevMessages) => [...prevMessages, savedMessage]);
      setClientMessage('');
      setMessageError('');
    } catch (error) {
      setMessageError(error?.message || 'Unable to send message.');
    }
  };

  const handleApproveQuoteClick = async () => {
    const approvalMessage = {
      id: `approval-${Date.now()}`,
      sender: 'system',
      type: 'text',
      content: 'You approved the quote. Proceeding to calendar/slot selection...',
      timestamp: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
    };
    setMessages([...messages, approvalMessage]);
    await onApproveQuote();
  };

  const handleSubmitRefundRequest = () => {
    if (!refundReason.trim()) return;
    onRequestRefund(refundReason.trim());
    setShowRefundRequestModal(false);
    setRefundReason('');
  };

  const handleConfirmRefundReceived = () => {
    onConfirmRefundReceived();
    setShowRefundConfirmModal(false);
  };

  const handleSubmitRejectQuote = () => {
    if (!rejectQuoteReason.trim() || !onRejectQuote) return;
    onRejectQuote(rejectQuoteReason.trim());
    setShowRejectQuoteModal(false);
    setRejectQuoteReason('');
  };

  const themeTokens = getThemeTokens(appTheme);
  const isDarkMode = appTheme === 'dark';
  const chatTheme = {
    bgPrimary: themeTokens.surface,
    bgSecondary: themeTokens.surfaceAlt,
    bgTertiary: themeTokens.surfaceSoft,
    messageBg: themeTokens.pageBg,
    activeBg: isDarkMode ? 'rgba(255, 154, 61, 0.16)' : themeTokens.accentSoft,
    hoverBg: isDarkMode ? 'rgba(255, 154, 61, 0.10)' : 'rgba(255, 122, 0, 0.08)',
    border: themeTokens.border,
    textPrimary: themeTokens.textPrimary,
    textSecondary: themeTokens.textSecondary,
    textMuted: themeTokens.textMuted,
    badgeBg: themeTokens.badgeBg,
    badgeText: themeTokens.badgeText,
    dangerText: themeTokens.danger,
    disabledBg: isDarkMode ? themeTokens.border : '#cbd5e1',
  };

  const styles = {
    // Embedded full-page layout (no modal overlay)
    pageContainer: { width: '100%', height: 'calc(100vh - 72px)', minHeight: '640px', background: chatTheme.bgPrimary },
    mainContainer: { background: chatTheme.bgPrimary, display: 'grid', gridTemplateColumns: '320px 1fr', width: '100%', height: '100%', overflow: 'hidden', borderTop: `1px solid ${chatTheme.border}` },
    
    // LEFT COLUMN: Chat List
    chatList: { display: 'flex', flexDirection: 'column', borderRight: `1px solid ${chatTheme.border}`, background: chatTheme.bgSecondary, overflow: 'hidden' },
    chatListHeader: { padding: '16px', borderBottom: `1px solid ${chatTheme.border}`, background: chatTheme.bgSecondary, flexShrink: 0 },
    chatListTitle: { fontSize: '16px', fontWeight: 700, color: chatTheme.textPrimary, margin: 0 },
    chatListScroll: { flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 0 },
    chatItem: { padding: '12px 16px', borderBottom: `1px solid ${chatTheme.border}`, background: chatTheme.bgSecondary, cursor: 'pointer', transition: 'all 0.2s ease', borderLeftWidth: '4px', borderLeftStyle: 'solid', borderLeftColor: 'transparent' },
    chatItemHovered: { background: chatTheme.hoverBg, borderLeftColor: themeTokens.accent },
    chatItemActive: { background: chatTheme.activeBg, borderLeftColor: themeTokens.accent },
    chatItemWorkerName: { fontSize: '14px', fontWeight: 600, color: chatTheme.textPrimary, margin: '0 0 4px 0' },
    chatItemService: { fontSize: '13px', color: chatTheme.textSecondary, margin: 0 },
    chatItemMode: { display: 'inline-block', marginTop: '6px', padding: '3px 8px', borderRadius: '999px', background: chatTheme.badgeBg, color: chatTheme.badgeText, fontSize: '11px', fontWeight: 800 },
    chatItemStatus: { fontSize: '12px', color: chatTheme.textMuted, marginTop: '4px', margin: '4px 0 0 0' },
    
    // CENTER COLUMN: Messages & Chat
    chatContainer: { display: 'flex', flexDirection: 'column', background: chatTheme.bgPrimary },
    header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', padding: '16px 20px', borderBottom: `1px solid ${chatTheme.border}`, flexShrink: 0, background: chatTheme.bgSecondary },
    workerInfo: { display: 'flex', gap: '12px', flex: 1 },
    workerAvatar: { width: '48px', height: '48px', background: themeTokens.accent, color: 'white', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '20px', flexShrink: 0 },
    workerName: { fontSize: '15px', fontWeight: 700, color: chatTheme.textPrimary, margin: 0 },
    workerService: { fontSize: '13px', color: chatTheme.textSecondary, margin: '2px 0 0 0' },
    workerStatus: { fontSize: '12px', color: themeTokens.success, margin: '4px 0 0 0', fontWeight: 700 },
    workerMode: { fontSize: '12px', color: chatTheme.badgeText, margin: '4px 0 0 0', fontWeight: 800 },
    recurringBadge: { fontSize: '11px', margin: '6px 0 0 0', fontWeight: 700, color: chatTheme.badgeText },
    stoppedBadge: { fontSize: '11px', margin: '6px 0 0 0', fontWeight: 700, color: chatTheme.dangerText },
    conversationMenuWrap: { position: 'relative', flexShrink: 0 },
    conversationMenuBtn: { width: '36px', height: '36px', borderRadius: '8px', border: `1px solid ${chatTheme.border}`, background: chatTheme.bgTertiary, color: chatTheme.textSecondary, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0 },
    conversationMenu: { position: 'absolute', top: '44px', right: 0, minWidth: '176px', padding: '6px', borderRadius: '8px', border: `1px solid ${chatTheme.border}`, background: chatTheme.bgSecondary, boxShadow: isDarkMode ? '0 14px 32px rgba(0,0,0,0.36)' : '0 14px 32px rgba(15, 23, 42, 0.14)', zIndex: 12 },
    conversationMenuItem: { width: '100%', display: 'flex', alignItems: 'center', gap: '8px', padding: '9px 10px', border: 'none', borderRadius: '6px', background: 'transparent', color: chatTheme.textPrimary, fontSize: '13px', fontWeight: 700, textAlign: 'left', cursor: 'pointer' },
    conversationMenuDanger: { color: chatTheme.dangerText },
    conversationMenuDisabled: { opacity: 0.55, cursor: 'not-allowed' },
    messages: { flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px', background: chatTheme.messageBg },
    loadingState: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '12px', color: chatTheme.textSecondary },
    loadingBubble: { height: '14px', borderRadius: '999px', background: isDarkMode ? '#58606c' : '#e2e8f0' },
    emptyConversation: { margin: 'auto', maxWidth: '320px', padding: '18px', borderRadius: '8px', border: `1px solid ${chatTheme.border}`, background: chatTheme.bgSecondary, color: chatTheme.textSecondary, textAlign: 'center' },
    chatMessage: { display: 'flex', flexDirection: 'column', marginBottom: '8px', gap: '4px' },
    chatMessageWorker: { alignSelf: 'flex-start', maxWidth: '70%' },
    chatMessageClient: { alignSelf: 'flex-end', maxWidth: '70%', alignItems: 'flex-end' },
    chatMessageSystem: { alignSelf: 'center', maxWidth: '100%' },
    chatMessageTextBase: { padding: '12px 16px', borderRadius: '12px', margin: 0, fontSize: '14px', color: chatTheme.textPrimary, lineHeight: 1.5, wordWrap: 'break-word', boxShadow: 'none' },
    chatMessageTextWorker: { background: chatTheme.bgSecondary, border: `1px solid ${chatTheme.border}`, borderRadius: '12px 12px 12px 2px' },
    chatMessageTextClient: { background: themeTokens.accent, color: 'white', border: 'none', borderRadius: '12px 12px 2px 12px', boxShadow: isDarkMode ? 'none' : themeTokens.accentShadow },
    chatMessageTime: { fontSize: '11px', color: chatTheme.textMuted, padding: '0 4px' },
    chatSystemMessage: { background: chatTheme.bgTertiary, color: chatTheme.textSecondary, padding: '8px 12px', borderRadius: '8px', fontSize: '13px', textAlign: 'center', margin: 0 },
    quoteCard: { background: chatTheme.bgSecondary, borderRadius: '12px', overflow: 'hidden', boxShadow: isDarkMode ? 'none' : '0 2px 8px rgba(0, 0, 0, 0.12)', border: `2px solid ${themeTokens.accent}`, maxWidth: '320px' },
    quoteHeader: { background: themeTokens.accent, padding: '12px 16px', color: 'white' },
    quoteLabel: { fontSize: '13px', fontWeight: 700, margin: 0, textTransform: 'uppercase', letterSpacing: '0.5px' },
    quoteBody: { padding: '16px' },
    quoteAmount: { fontSize: '32px', fontWeight: 700, color: themeTokens.accent, margin: '0 0 8px 0' },
    quoteDescription: { fontSize: '13px', color: chatTheme.textSecondary, margin: '0 0 12px 0', lineHeight: 1.5 },
    quoteDelivery: { fontSize: '12px', color: chatTheme.textSecondary, margin: '0 0 8px 0', display: 'flex', justifyContent: 'space-between' },
    label: { fontWeight: 600, color: chatTheme.textPrimary },
    quoteNote: { fontSize: '12px', color: chatTheme.textSecondary, margin: 0, padding: '12px', background: chatTheme.bgTertiary, borderRadius: '6px', borderLeft: `3px solid ${themeTokens.accent}` },
    quoteActionBar: { background: chatTheme.bgSecondary, borderTop: `1px solid ${chatTheme.border}`, padding: '16px', marginTop: 'auto', flexShrink: 0 },
    actionContent: { textAlign: 'center' },
    actionPrompt: { fontSize: '13px', color: chatTheme.textPrimary, fontWeight: 600, margin: '0 0 12px 0' },
    approveBtn: { padding: '12px 24px', background: isApproveHovered ? themeTokens.accentHover : themeTokens.accent, color: 'white', border: `1px solid ${themeTokens.accent}`, borderRadius: '8px 0 0 8px', fontSize: '14px', fontWeight: 700, cursor: 'pointer', transition: 'all 0.3s ease', width: '100%', textTransform: 'uppercase', letterSpacing: '0.5px', transform: isApproveHovered ? 'translateY(-2px)' : 'translateY(0)', boxShadow: 'none' },
    inputArea: { display: 'flex', gap: '8px', padding: '12px', borderTop: `1px solid ${chatTheme.border}`, background: chatTheme.bgSecondary, flexShrink: 0 },
    messageInput: { flex: 1, padding: '10px 12px', border: `1px solid ${isInputFocused ? themeTokens.accent : chatTheme.border}`, borderRadius: '8px', fontSize: '14px', fontFamily: 'inherit', transition: 'all 0.2s ease', outline: 'none', boxShadow: isInputFocused ? `0 0 0 2px ${themeTokens.accentSoft}` : 'none', background: chatTheme.bgTertiary, color: chatTheme.textPrimary },
    sendBtn: { padding: '10px 20px', background: !clientMessage.trim() ? chatTheme.disabledBg : (isSendHovered ? themeTokens.accentHover : themeTokens.accent), color: 'white', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: 600, cursor: !clientMessage.trim() ? 'not-allowed' : 'pointer', transition: 'all 0.2s ease' },
    approvalStatus: { padding: '12px 16px', background: themeTokens.accentSoft, borderTop: `1px solid ${themeTokens.accent}`, textAlign: 'center', flexShrink: 0 },
    approvalStatusText: { fontSize: '13px', color: chatTheme.badgeText, fontWeight: 600, margin: 0 },
    
    // RIGHT COLUMN: Service Details & Actions
    rightSidebar: { display: 'flex', flexDirection: 'column', borderLeft: `1px solid ${chatTheme.border}`, background: chatTheme.bgSecondary, overflow: 'hidden' },
    rightHeader: { padding: '16px', borderBottom: `1px solid ${chatTheme.border}`, background: chatTheme.bgSecondary, flexShrink: 0 },
    rightTitle: { fontSize: '14px', fontWeight: 700, color: chatTheme.textPrimary, margin: 0 },
    rightScroll: { flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px' },
    detailSection: { display: 'flex', flexDirection: 'column', gap: '6px', padding: '10px', background: chatTheme.bgTertiary, borderRadius: '8px', border: `1px solid ${chatTheme.border}` },
    detailLabel: { fontSize: '11px', fontWeight: 700, color: chatTheme.textMuted, textTransform: 'uppercase', letterSpacing: '0.5px', margin: 0 },
    detailValue: { fontSize: '13px', color: chatTheme.textPrimary, fontWeight: 500, margin: 0 },
    detailValueLarge: { fontSize: '18px', fontWeight: 700, color: themeTokens.successText, margin: 0 },
    actionBtn: { padding: '10px 12px', background: themeTokens.accent, color: '#fff', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s ease', textAlign: 'center', textTransform: 'uppercase', letterSpacing: '0.3px' },
    actionBtnSecondary: { background: '#ea580c' },
    actionBtnDanger: { background: '#dc2626' },
    actionBtnDisabled: { background: isDarkMode ? '#687282' : '#cbd5e1', cursor: 'not-allowed' },
    actionSection: { display: 'flex', flexDirection: 'column', gap: '10px', paddingTop: '12px', marginTop: '4px', borderTop: `1px solid ${chatTheme.border}` },
    actionStack: { display: 'flex', flexDirection: 'column', gap: '8px' },
    sidebarPanel: { background: chatTheme.bgTertiary, border: `1px solid ${chatTheme.border}`, borderRadius: '8px', padding: '12px' },
    sidebarPanelTitle: { margin: '0 0 6px', fontSize: '13px', fontWeight: 700, color: chatTheme.textPrimary },
    sidebarPanelText: { margin: 0, fontSize: '12px', color: chatTheme.textSecondary, lineHeight: 1.5 },
    ratingCard: { background: chatTheme.bgSecondary, border: `1px solid ${chatTheme.border}`, borderRadius: '8px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' },
    starsRow: { display: 'flex', gap: '8px', alignItems: 'center' },
    starBtn: { cursor: 'pointer', fontSize: '20px', color: '#cbd5e1', transition: 'transform 0.12s ease' },
    starActive: { color: themeTokens.accent },
    ratingTextarea: { width: '100%', minHeight: '60px', border: `1px solid ${chatTheme.border}`, borderRadius: '6px', padding: '8px', background: chatTheme.bgTertiary, color: chatTheme.textPrimary },
    ratingSubmitBtn: { padding: '8px 12px', background: themeTokens.accent, color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 700, alignSelf: 'flex-start' },
    ratingSavedText: { fontSize: '13px', color: themeTokens.successText, fontWeight: 700 },
    modalOverlay: { position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1400, padding: '16px' },
    modalCard: { width: '100%', maxWidth: '540px', background: chatTheme.bgSecondary, borderRadius: '12px', padding: '18px', boxShadow: '0 20px 45px rgba(0,0,0,0.25)', display: 'flex', flexDirection: 'column', gap: '10px', border: `1px solid ${chatTheme.border}` },
    modalTitle: { margin: 0, fontSize: '18px', fontWeight: 700, color: chatTheme.textPrimary },
    modalText: { margin: 0, fontSize: '13px', color: chatTheme.textSecondary, lineHeight: 1.5 },
    modalTextarea: { width: '100%', minHeight: '100px', border: `1px solid ${chatTheme.border}`, borderRadius: '8px', padding: '10px', fontSize: '14px', fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box', background: chatTheme.bgTertiary, color: chatTheme.textPrimary },
    modalActions: { display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '4px' },
    modalBtnCancel: { padding: '9px 14px', border: 'none', borderRadius: '8px', background: isDarkMode ? '#58606c' : '#e2e8f0', color: chatTheme.textPrimary, fontWeight: 700, cursor: 'pointer' },
    modalBtnPrimary: { padding: '9px 14px', border: 'none', borderRadius: '8px', background: themeTokens.accent, color: '#fff', fontWeight: 700, cursor: 'pointer' },
    modalBtnDanger: { padding: '9px 14px', border: 'none', borderRadius: '8px', background: '#dc2626', color: '#fff', fontWeight: 700, cursor: 'pointer' },
    quoteDecisionActions: { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: 0, width: '100%', maxWidth: '100%', alignItems: 'stretch' },
    rejectQuoteBtn: { padding: '12px 18px', minWidth: '138px', background: chatTheme.bgTertiary, color: chatTheme.dangerText, border: `1px solid ${chatTheme.dangerText}`, borderLeft: 'none', borderRadius: '0 8px 8px 0', fontSize: '13px', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' },
  };

  const getMessageStyle = (msg) => {
    if (msg.sender === 'client') return { ...styles.chatMessage, ...styles.chatMessageClient };
    if (msg.sender === 'worker') return { ...styles.chatMessage, ...styles.chatMessageWorker };
    return { ...styles.chatMessage, ...styles.chatMessageSystem };
  };

  const getMessageTextStyle = (sender) => {
    if (sender === 'client') return { ...styles.chatMessageTextBase, ...styles.chatMessageTextClient };
    return { ...styles.chatMessageTextBase, ...styles.chatMessageTextWorker };
  };

  const handleStarClick = (value) => {
    setDraftRating(value);
  };

  const handleSubmitRating = () => {
    if (draftRating < 1) return;
    const payload = {
      bookingId: booking.id,
      rating: draftRating,
      comment: ratingComment,
      createdAt: new Date().toISOString(),
    };

    if (typeof onLeaveRating === 'function') {
      try { onLeaveRating(payload); } catch (e) { /* ignore */ }
    }
    setRatingSubmitted(true);
  };

  const openChatActionConfirm = (actionType) => {
    if (isChatActionSaving) return;
    setIsConversationMenuOpen(false);
    setPendingChatAction(actionType);
  };

  const handleCancelChatAction = () => {
    if (isChatActionSaving) return;
    setPendingChatAction(null);
  };

  const handleConfirmChatAction = async () => {
    if (!pendingChatAction || isChatActionSaving) return;

    const actionHandler = pendingChatAction === 'delete' ? onDeleteChat : onArchiveChat;
    if (!actionHandler) {
      setPendingChatAction(null);
      return;
    }

    try {
      setIsChatActionSaving(true);
      await actionHandler(booking);
      setPendingChatAction(null);
    } finally {
      setIsChatActionSaving(false);
    }
  };

  const isDeleteChatAction = pendingChatAction === 'delete';

  return (
    <div className="booking-workspace" style={styles.pageContainer}>
      <div className="booking-workspace-grid" style={styles.mainContainer}>
        {/* LEFT COLUMN: Chat List */}
        <div className="booking-chat-list" style={styles.chatList}>
          <div style={styles.chatListHeader}>
            <h3 style={styles.chatListTitle}>Your Chats</h3>
          </div>
          <div style={styles.chatListScroll}>
            {chatBookings.length > 0 ? (
              chatBookings.map((b) => (
                <div
                  key={b.id}
                  style={{
                    ...styles.chatItem,
                    ...(hoveredChatId === b.id ? styles.chatItemHovered : {}),
                    ...(selectedBookingId === b.id ? styles.chatItemActive : {}),
                  }}
                  onMouseEnter={() => setHoveredChatId(b.id)}
                  onMouseLeave={() => setHoveredChatId(null)}
                  onClick={() => onSelectBooking(b.id)}
                  >
                  <p style={styles.chatItemWorkerName}>{getChatDisplayName(b)}</p>
                  <p style={styles.chatItemService}>{b.serviceType}</p>
                </div>
              ))
            ) : (
              <div style={{ padding: '20px', textAlign: 'center', color: chatTheme.textMuted }}>
                <p>No active chats</p>
              </div>
            )}
          </div>
        </div>

        {/* CENTER COLUMN: Chat Messages */}
        <div className="booking-chat-thread" style={styles.chatContainer}>
          <div style={styles.header}>
            <div style={styles.workerInfo}>
              <div style={styles.workerAvatar}>{getChatAvatarLetter(booking)}</div>
              <div>
                <h3 style={styles.workerName}>{getChatDisplayName(booking)}</h3>
                <p style={styles.workerService}>{booking.serviceType}</p>
                <p style={styles.workerMode}>
                  {isRequestBooking ? 'Request booking - coordinate through chat' : 'Time-slot booking'}
                </p>
                <p style={styles.workerStatus}>{'\u2022'} Online</p>
                {isRecurringService && !isServiceStopped && (
                  <p style={styles.recurringBadge}>
                    {booking.billingCycle === 'monthly' ? 'Monthly' : 'Weekly'} Service
                  </p>
                )}
                {isServiceStopped && <p style={styles.stoppedBadge}>Service Stopped</p>}
              </div>
            </div>
            <div ref={conversationMenuRef} style={styles.conversationMenuWrap}>
              <button
                type="button"
                aria-label="Conversation actions"
                aria-expanded={isConversationMenuOpen}
                style={styles.conversationMenuBtn}
                onClick={() => setIsConversationMenuOpen((current) => !current)}
              >
                <MoreVertical size={18} strokeWidth={2.4} />
              </button>

              {isConversationMenuOpen && (
                <div style={styles.conversationMenu}>
                  <button
                    type="button"
                    style={{
                      ...styles.conversationMenuItem,
                      ...(isChatActionSaving ? styles.conversationMenuDisabled : {}),
                    }}
                    onClick={() => openChatActionConfirm('archive')}
                    disabled={isChatActionSaving}
                  >
                    <Archive size={15} strokeWidth={2.3} />
                    Archive Chat
                  </button>
                  <button
                    type="button"
                    style={{
                      ...styles.conversationMenuItem,
                      ...styles.conversationMenuDanger,
                      ...(isChatActionSaving ? styles.conversationMenuDisabled : {}),
                    }}
                    onClick={() => openChatActionConfirm('delete')}
                    disabled={isChatActionSaving}
                  >
                    <Trash2 size={15} strokeWidth={2.3} />
                    Delete Chat
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="booking-chat-messages" style={styles.messages}>
            {messageError && (
              <div style={{ marginBottom: '8px', color: themeTokens.danger, fontSize: '13px', fontWeight: 700 }}>
                {messageError}
              </div>
            )}
            {isLoading ? (
              <div style={styles.loadingState}>
                <div style={{ ...styles.loadingBubble, width: '65%', alignSelf: 'flex-start' }} />
                <div style={{ ...styles.loadingBubble, width: '55%', alignSelf: 'flex-start' }} />
                <div style={{ ...styles.loadingBubble, width: '60%', alignSelf: 'flex-end' }} />
                <p style={{ margin: 0, fontSize: '12px', color: chatTheme.textMuted }}>Loading conversation...</p>
              </div>
            ) : messages.length > 0 ? (
              messages.map((msg) => (
                <div key={msg.id} style={getMessageStyle(msg)}>
                  {msg.type === 'text' && msg.sender !== 'system' && (
                    <>
                      <p style={getMessageTextStyle(msg.sender)}>{msg.content}</p>
                      <span style={styles.chatMessageTime}>{msg.timestamp}</span>
                    </>
                  )}

                  {msg.type === 'quote' && !isClosedConversation && !isRefundConversation && (
                    <div style={styles.quoteCard}>
                      <div style={styles.quoteHeader}>
                        <p style={styles.quoteLabel}>Price Quote</p>
                      </div>
                      <div style={styles.quoteBody}>
                        <div style={styles.quoteAmount}>{`\u20B1${msg.content.amount}`}</div>
                        <p style={styles.quoteDescription}>{msg.content.description}</p>
                        <p style={styles.quoteDelivery}>
                          <span style={styles.label}>Estimated Delivery:</span>
                          <span>{msg.content.deliveryTime}</span>
                        </p>
                        <p style={styles.quoteNote}>{msg.content.note}</p>
                      </div>
                    </div>
                  )}

                  {msg.type === 'text' && msg.sender === 'system' && (
                    <p style={styles.chatSystemMessage}>{msg.content}</p>
                  )}
                </div>
              ))
            ) : (
              <div style={styles.emptyConversation}>
                <p style={{ margin: '0 0 6px', fontWeight: 800, color: chatTheme.textPrimary }}>
                  No saved messages yet.
                </p>
                <p style={{ margin: 0, fontSize: '13px', lineHeight: 1.5 }}>
                  {isRequestBooking
                    ? 'Send the worker your details. A price quote will appear here after the worker sends one.'
                    : 'Send a message to coordinate this booking with the worker.'}
                </p>
              </div>
            )}

          </div>

          {canReviewQuote && (
            <div style={styles.quoteActionBar}>
              <div style={styles.actionContent}>
                <p style={styles.actionPrompt}>Review this quote and choose what to do next.</p>
                <div className="booking-quote-actions" style={styles.quoteDecisionActions}>
                  <button
                    style={styles.approveBtn}
                    onMouseEnter={() => setIsApproveHovered(true)}
                    onMouseLeave={() => setIsApproveHovered(false)}
                    onClick={handleApproveQuoteClick}
                  >
                    Approve Quote
                  </button>
                  <button
                    style={styles.rejectQuoteBtn}
                    onClick={() => setShowRejectQuoteModal(true)}
                  >
                    Reject Quote
                  </button>
                </div>
              </div>
            </div>
          )}

          {shouldShowSlotSelectionNotice && (
            <div style={styles.approvalStatus}>
              <p style={styles.approvalStatusText}>{'\u2713'} Quote Approved - Proceed to calendar/slot selection</p>
            </div>
          )}

          {shouldShowRequestPaymentNotice && (
            <div style={styles.approvalStatus}>
              <p style={styles.approvalStatusText}>{'\u2713'} Quote Approved - schedule/details are coordinated in chat</p>
            </div>
          )}

          {isQuoteRejected && (
            <div style={{ ...styles.approvalStatus, background: isDarkMode ? '#7f1d1d' : '#fef2f2', borderColor: isDarkMode ? '#991b1b' : '#fecaca' }}>
              <p style={{ ...styles.approvalStatusText, color: isDarkMode ? '#fecaca' : '#991b1b' }}>
                {'\u2715'} Quote Rejected - waiting for worker response
              </p>
              {booking?.quoteRejectionReason && (
                <p style={{ margin: '8px 0 0', color: isDarkMode ? '#fecaca' : '#7f1d1d', fontSize: '13px', textAlign: 'center' }}>
                  Reason sent: {booking.quoteRejectionReason}
                </p>
              )}
            </div>
          )}

          {booking.status !== 'Cancelled (Cash)' && (
            <div className="booking-input-area" style={styles.inputArea}>
              <input
                type="text"
                placeholder={hasSellerQuote ? 'Ask a question or discuss the quote...' : 'Ask a question or share booking details...'}
                value={clientMessage}
                onChange={(e) => setClientMessage(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                onFocus={() => setIsInputFocused(true)}
                onBlur={() => setIsInputFocused(false)}
                style={styles.messageInput}
              />
              <button
                style={styles.sendBtn}
                onMouseEnter={() => setIsSendHovered(true)}
                onMouseLeave={() => setIsSendHovered(false)}
                onClick={handleSendMessage}
                disabled={!clientMessage.trim()}
              >
                Send
              </button>
            </div>
          )}
        </div>

        {showServiceDetailsSidebar && (
        <div className="booking-detail-sidebar" style={styles.rightSidebar}>
          <div style={styles.rightHeader}>
            <h3 style={styles.rightTitle}>Service Details</h3>
          </div>
          <div style={styles.rightScroll}>
            {/* Service Information */}
            <div style={styles.detailSection}>
              <p style={styles.detailLabel}>Service Type</p>
              <p style={styles.detailValue}>{booking.serviceType}</p>
            </div>

            <div style={styles.detailSection}>
              <p style={styles.detailLabel}>Description</p>
              <p style={styles.detailValue}>{booking.description}</p>
            </div>

            <div style={styles.detailSection}>
              <p style={styles.detailLabel}>{priceDetailLabel}</p>
              <p style={shouldShowPriceAmount ? styles.detailValueLarge : styles.detailValue}>{priceDetailValue}</p>
            </div>

            <div style={styles.detailSection}>
              <p style={styles.detailLabel}>Status</p>
              <p style={styles.detailValue}>{booking.status}</p>
            </div>

            <div style={styles.detailSection}>
              <p style={styles.detailLabel}>Booking Setup</p>
              <p style={styles.detailValue}>
                {isRequestBooking ? 'Request booking - through chat' : 'Time-slot booking'}
              </p>
            </div>

            {booking.selectedSlot && (
              <div style={styles.detailSection}>
                <p style={styles.detailLabel}>Scheduled Date</p>
                <p style={styles.detailValue}>{booking.selectedSlot.date}</p>
                <p style={{ ...styles.detailValue, fontSize: '12px', marginTop: '4px' }}>
                  {booking.selectedSlot.timeBlock.startTime} - {booking.selectedSlot.timeBlock.endTime}
                </p>
              </div>
            )}

            {booking.paymentMethod && (
              <div style={styles.detailSection}>
                <p style={styles.detailLabel}>Payment Method</p>
                <p style={styles.detailValue}>
                  {booking.paymentMethod === 'gcash-advance'
                    ? 'GCash Advance'
                    : booking.paymentMethod === 'after-service-gcash'
                      ? 'GCash After Service'
                      : 'Cash After Service'}
                </p>
              </div>
            )}

            {booking.paymentMethod && transactionFeeAmount > 0 && (
              <div style={styles.detailSection}>
                <p style={styles.detailLabel}>Payment Breakdown</p>
                <p style={styles.detailValue}>Service cost: {formatPhp(booking.quoteAmount)}</p>
                <p style={styles.detailValue}>Transaction fee ({booking.transactionFeePercent || '5%'}): {formatPhp(transactionFeeAmount)}</p>
                <p style={styles.detailValue}>Total payment: {formatPhp(totalChargedAmount)}</p>
              </div>
            )}

            {/* Rating (one-time completed transactions only) */}
            {(!isRecurringService && booking?.status && (booking.status.toLowerCase().includes('complete') || booking.status.toLowerCase().includes('done') || booking.status.toLowerCase().includes('completed'))) && (
              <div style={styles.ratingCard}>
                {!ratingSubmitted ? (
                  <>
                    <p style={{ margin: 0, fontWeight: 800, color: chatTheme.textPrimary }}>Leave a Rating</p>
                    <div style={styles.starsRow}>
                      {[1,2,3,4,5].map((n) => (
                        <span
                          key={n}
                          onClick={() => handleStarClick(n)}
                          style={{ ...styles.starBtn, ...(draftRating >= n ? styles.starActive : {}) }}
                          title={`${n} star${n>1 ? 's' : ''}`}
                        >
                          {draftRating >= n ? '★' : '☆'}
                        </span>
                      ))}
                    </div>
                    <textarea
                      placeholder="Write an optional comment (helpful for future implementation)..."
                      value={ratingComment}
                      onChange={(e) => setRatingComment(e.target.value)}
                      style={styles.ratingTextarea}
                    />
                    <button style={styles.ratingSubmitBtn} onClick={handleSubmitRating}>Submit Rating</button>
                  </>
                ) : (
                  <div>
                    <p style={styles.ratingSavedText}>Thank you — your rating has been recorded.</p>
                    <p style={{ margin: '6px 0 0', color: chatTheme.textSecondary }}>Rating: {draftRating} / 5</p>
                    {ratingComment && <p style={{ margin: '6px 0 0', color: chatTheme.textSecondary }}>{ratingComment}</p>}
                  </div>
                )}
              </div>
            )}

            {/* Action Buttons */}
            {hasSidebarActions && (
              <div style={styles.actionSection}>
                <div style={styles.actionStack}>
                  {shouldShowSlotSelectionNotice && (
                    <button
                      style={{ ...styles.actionBtn, width: '100%' }}
                      onClick={onOpenSlotSelection}
                    >
                      Proceed to Calendar / Slot Selection
                    </button>
                  )}

                  {shouldShowRequestPaymentNotice && (
                    <button
                      style={{ ...styles.actionBtn, width: '100%' }}
                      onClick={onOpenPaymentSelection}
                    >
                      Select Payment Method
                    </button>
                  )}

                  {shouldShowSlotPaymentAction && (
                    <button
                      style={{ ...styles.actionBtn, width: '100%' }}
                      onClick={onOpenPaymentSelection}
                    >
                      Select Payment Method
                    </button>
                  )}

                  {shouldShowRecurringGcashPaymentAction && (
                    <button
                      style={{ ...styles.actionBtn, width: '100%' }}
                      onClick={onOpenPaymentSelection}
                    >
                      {`Pay ${getBillingLabel(booking)} Charge`}
                    </button>
                  )}

                  {shouldShowGcashPaymentAction && (
                    <button
                      style={{ ...styles.actionBtn, width: '100%' }}
                      onClick={onOpenPaymentSelection}
                    >
                      Pay via GCash
                    </button>
                  )}

                  {shouldShowCashConfirmationAction && (
                    <button
                      style={{ ...styles.actionBtn, ...styles.actionBtnSecondary, width: '100%' }}
                      onClick={onOpenPaymentSelection}
                    >
                      Confirm Cash via Worker QR
                    </button>
                  )}

                  {canRequestRefund && !isServiceStopped && (
                    <button
                      style={{ ...styles.actionBtn, background: '#7c3aed', width: '100%' }}
                      onClick={() => setShowRefundRequestModal(true)}
                    >
                      Request Refund
                    </button>
                  )}

                  {canConfirmRefund && (
                    <button
                      style={{ ...styles.actionBtn, background: '#0f766e', width: '100%' }}
                      onClick={() => setShowRefundConfirmModal(true)}
                    >
                      Confirm Refund Received
                    </button>
                  )}

                  {shouldShowTransactionAction && (
                    <button
                      style={{ ...styles.actionBtn, background: '#0f766e', width: '100%' }}
                      onClick={() => setActiveSidebarPanel(activeSidebarPanel === 'transaction' ? null : 'transaction')}
                    >
                      View Transaction ID
                    </button>
                  )}

                  {shouldShowTransactionAction && activeSidebarPanel === 'transaction' && (
                    <div style={styles.sidebarPanel}>
                      <p style={styles.sidebarPanelTitle}>Transaction Proof</p>
                      <p style={styles.sidebarPanelText}>Use this ID for verification and proof purposes.</p>
                      <p style={{ ...styles.sidebarPanelText, marginTop: '8px', fontFamily: "'Courier New', monospace", wordBreak: 'break-all' }}>
                        {booking.transactionId || booking.paymentReference}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
        )}
      </div>

      {showRefundRequestModal && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalCard}>
            <h3 style={styles.modalTitle}>Request Refund</h3>
            <p style={styles.modalText}>Explain your reason. This request will require worker approval and your final confirmation once money is returned.</p>
            <textarea
              style={styles.modalTextarea}
              placeholder="Describe why you are requesting a refund..."
              value={refundReason}
              onChange={(event) => setRefundReason(event.target.value)}
            />
            <div style={styles.modalActions}>
              <button style={styles.modalBtnCancel} onClick={() => setShowRefundRequestModal(false)}>Cancel</button>
              <button
                style={{ ...styles.modalBtnPrimary, ...(refundReason.trim() ? {} : { background: isDarkMode ? '#687282' : '#cbd5e1', cursor: 'not-allowed' }) }}
                onClick={handleSubmitRefundRequest}
                disabled={!refundReason.trim()}
              >
                Submit Request
              </button>
            </div>
          </div>
        </div>
      )}

      {pendingChatAction && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalCard}>
            <h3 style={styles.modalTitle}>
              {isDeleteChatAction ? 'Delete Chat' : 'Archive Chat'}
            </h3>
            <p style={styles.modalText}>
              {isDeleteChatAction
                ? 'Delete this chat from your inbox?'
                : 'Archive this chat and move it out of your active inbox?'}
            </p>
            <div style={styles.modalActions}>
              <button
                type="button"
                style={styles.modalBtnCancel}
                onClick={handleCancelChatAction}
                disabled={isChatActionSaving}
              >
                Cancel
              </button>
              <button
                type="button"
                style={isDeleteChatAction ? styles.modalBtnDanger : styles.modalBtnPrimary}
                onClick={handleConfirmChatAction}
                disabled={isChatActionSaving}
              >
                {isChatActionSaving ? 'Saving...' : (isDeleteChatAction ? 'Delete Chat' : 'Archive Chat')}
              </button>
            </div>
          </div>
        </div>
      )}

      {showRefundConfirmModal && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalCard}>
            <h3 style={styles.modalTitle}>Confirm Refund Receipt</h3>
            <p style={styles.modalText}>Confirm that you already received the correct refund amount from the worker/provider.</p>
            <div style={styles.modalActions}>
              <button style={styles.modalBtnCancel} onClick={() => setShowRefundConfirmModal(false)}>Not Yet</button>
              <button style={{ ...styles.modalBtnPrimary, background: '#0f766e' }} onClick={handleConfirmRefundReceived}>Yes, Amount Received</button>
            </div>
          </div>
        </div>
      )}

      {showRejectQuoteModal && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalCard}>
            <h3 style={styles.modalTitle}>Reject Quote</h3>
            <p style={styles.modalText}>Let the worker know why you are declining this quote so they can revise their offer.</p>
            <textarea
              style={styles.modalTextarea}
              placeholder="Type your reason for rejecting the quote..."
              value={rejectQuoteReason}
              onChange={(event) => setRejectQuoteReason(event.target.value)}
            />
            <div style={styles.modalActions}>
              <button style={styles.modalBtnCancel} onClick={() => setShowRejectQuoteModal(false)}>Cancel</button>
              <button
                style={{ ...styles.modalBtnPrimary, ...(rejectQuoteReason.trim() ? { background: '#b91c1c' } : { background: isDarkMode ? '#687282' : '#cbd5e1', cursor: 'not-allowed' }) }}
                onClick={handleSubmitRejectQuote}
                disabled={!rejectQuoteReason.trim()}
              >
                Submit Rejection
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatWindow;
