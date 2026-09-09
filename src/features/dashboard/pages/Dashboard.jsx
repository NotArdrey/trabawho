import { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  CalendarCheck,
  CheckCircle2,
  Clock3,
  MessageCircle,
  ReceiptText,
  Search,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MetricCard } from '@/components/ui/metric-card';
import DashboardNavigation from '../../../shared/components/DashboardNavigation';
import { fetchClientDashboardSnapshot } from '../../bookings/services/bookingService';

const terminalStatuses = new Set(['Completed Service', 'Service Stopped', 'Cancelled', 'Cancelled (Cash)', 'Refunded']);
const scheduledStatuses = new Set([
  'Service Scheduled',
  'Payment Confirmed',
  'Payment Submitted',
  'Cash Verification Pending',
  'Cash Verification Denied',
  'Active Service',
]);
const clientActionStatuses = new Set([
  'Awaiting Slot Selection',
  'Payment Pending',
  'Slot Selected - Payment Pending',
  'Cash Verification Denied',
]);

const emptyDashboardData = {
  user: null,
  bookings: [],
  conversations: [],
  messages: [],
  unreadMessageCount: 0,
};

const getRawBooking = (booking = {}) => booking.raw?.booking || {};

const getBookingUpdatedAt = (booking = {}) => {
  const raw = getRawBooking(booking);
  return raw.updated_at || raw.created_at || booking.requestDate || null;
};

const getBookingStartDate = (booking = {}) => {
  const raw = getRawBooking(booking);
  const rawStart = raw.start_ts || booking.startTs;

  if (rawStart) {
    const parsed = new Date(rawStart);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }

  const selectedSlot = booking.selectedSlot || {};
  const selectedDate = selectedSlot.date || selectedSlot.dateKey;
  const startTime = selectedSlot.timeBlock?.startTime;

  if (!selectedDate) return null;

  const parsed = new Date(`${selectedDate}T${startTime || '00:00'}:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const formatDayLabel = (date) => {
  if (!date) return 'Coordinated through chat';

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);
  const diffDays = Math.round((target.getTime() - today.getTime()) / 86400000);

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Tomorrow';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const formatSchedule = (booking) => {
  const startDate = getBookingStartDate(booking);
  if (!startDate) return 'Coordinated through chat';

  const time = startDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  return `${formatDayLabel(startDate)}, ${time}`;
};

const formatTimeAgo = (value) => {
  if (!value) return 'Recently';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Recently';

  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.max(0, Math.floor(diffMs / 60000));

  if (diffMinutes < 1) return 'Just now';
  if (diffMinutes < 60) return `${diffMinutes} min ago`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} hr ago`;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);

  if (today.getTime() === target.getTime()) return 'Today';

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const getMessagePreview = (message = {}) => {
  if (message.attachments?.type === 'quote' || message.message_type === 'quote') return 'Quote sent in chat';
  const body = String(message.body ?? message.content ?? '').trim();
  return body || 'New message in chat';
};

const buildDashboardModel = (data, isLoading) => {
  const bookings = data.bookings || [];
  const conversations = data.conversations || [];
  const messages = data.messages || [];
  const now = new Date();
  const bookingById = Object.fromEntries(bookings.map((booking) => [String(booking.id), booking]));
  const conversationById = Object.fromEntries(conversations.map((conversation) => [String(conversation.id), conversation]));
  const activeBookings = bookings.filter((booking) => !terminalStatuses.has(booking.status));
  const awaitingReplyCount = activeBookings.filter((booking) => (
    booking.status === 'Negotiating'
    || booking.status === 'Awaiting Slot Selection'
    || booking.status === 'Payment Pending'
    || booking.status === 'Slot Selected - Payment Pending'
  )).length;
  const upcomingBookings = bookings
    .map((booking) => ({ booking, startDate: getBookingStartDate(booking) }))
    .filter(({ booking, startDate }) => (
      !terminalStatuses.has(booking.status)
      && (scheduledStatuses.has(booking.status) || Boolean(startDate))
      && (!startDate || startDate.getTime() >= now.getTime() - 86400000)
    ))
    .sort((a, b) => {
      if (!a.startDate && !b.startDate) return 0;
      if (!a.startDate) return 1;
      if (!b.startDate) return -1;
      return a.startDate.getTime() - b.startDate.getTime();
    })
    .slice(0, 3)
    .map(({ booking }) => ({
      service: booking.serviceType || 'Service',
      provider: booking.workerName || 'Provider',
      schedule: formatSchedule(booking),
      status: booking.status || 'Pending',
    }));
  const actionNeededCount = bookings.filter((booking) => (
    clientActionStatuses.has(booking.status)
    || Boolean(booking.canRate)
  )).length;
  const nextBookingDetail = upcomingBookings[0]
    ? `Next service ${upcomingBookings[0].schedule.toLowerCase()}`
    : 'No scheduled services';
  const metrics = [
    {
      id: 'active',
      label: 'Active bookings',
      value: isLoading && bookings.length === 0 ? '...' : String(activeBookings.length),
      detail: isLoading && bookings.length === 0 ? 'Loading bookings' : `${awaitingReplyCount} awaiting provider reply`,
      icon: Clock3,
      tone: 'blue',
    },
    {
      id: 'upcoming',
      label: 'Upcoming bookings',
      value: isLoading && bookings.length === 0 ? '...' : String(upcomingBookings.length),
      detail: isLoading && bookings.length === 0 ? 'Loading schedule' : nextBookingDetail,
      icon: CalendarCheck,
      tone: 'green',
    },
    {
      id: 'messages',
      label: 'Unread messages',
      value: isLoading && messages.length === 0 ? '...' : String(data.unreadMessageCount || 0),
      detail: isLoading && messages.length === 0
        ? 'Loading chats'
        : (data.unreadMessageCount ? 'Across active chats' : 'No unread messages'),
      icon: MessageCircle,
      tone: 'sky',
    },
    {
      id: 'actions',
      label: 'Action needed',
      value: isLoading && bookings.length === 0 ? '...' : String(actionNeededCount),
      detail: isLoading && bookings.length === 0
        ? 'Checking bookings'
        : (actionNeededCount ? 'Review booking updates' : "You're all caught up"),
      icon: ReceiptText,
      tone: 'orange',
    },
  ];
  const messageUpdates = messages.map((message) => {
    const conversation = conversationById[String(message.conversation_id)] || {};
    const booking = bookingById[String(conversation.booking_id)] || {};
    const fromCurrentUser = data.user?.id && String(message.sender_id) === String(data.user.id);

    return {
      id: `message-${message.id}`,
      title: fromCurrentUser ? 'Message sent' : 'Provider message received',
      detail: `${booking.serviceType || 'Booking'} - ${getMessagePreview(message)}`,
      time: formatTimeAgo(message.created_at),
      sortDate: message.created_at,
    };
  });
  const bookingUpdates = bookings.map((booking) => ({
    id: `booking-${booking.id}`,
    title: booking.status === 'Refund Processing'
      ? 'Refund request updated'
      : booking.paymentProofSubmitted
        ? 'Payment proof received'
        : booking.canRate
          ? 'Review window open'
          : 'Booking updated',
    detail: `${booking.serviceType || 'Service'} - ${booking.status || 'Updated'}`,
    time: formatTimeAgo(getBookingUpdatedAt(booking)),
    sortDate: getBookingUpdatedAt(booking),
  }));
  const recentUpdates = [...messageUpdates, ...bookingUpdates]
    .sort((a, b) => new Date(b.sortDate || 0).getTime() - new Date(a.sortDate || 0).getTime())
    .slice(0, 3);

  return {
    metrics,
    upcomingBookings,
    recentUpdates,
  };
};

function Dashboard({
  appTheme = 'light',
  themeMode = 'system',
  onThemeChange,
  currentView = 'client-dashboard',
  searchQuery = '',
  onSearchChange,
  onLogout,
  onBecomeSeller,
  onOpenMyBookings,
  onOpenChatPage,
  sellerProfile,
  onOpenMyWork,
  onOpenProfile,
  onOpenAccountSettings,
  onOpenSettings,
  onOpenSellerSetup,
  onOpenDashboard,
  onOpenBrowseServices,
  onOpenAdminDashboard,
}) {
  const [dashboardData, setDashboardData] = useState(emptyDashboardData);
  const [isDashboardLoading, setIsDashboardLoading] = useState(true);
  const [dashboardError, setDashboardError] = useState('');

  const displayName = sellerProfile?.firstName
    || sellerProfile?.fullName
    || sellerProfile?.full_name
    || 'there';

  const dashboardModel = useMemo(
    () => buildDashboardModel(dashboardData, isDashboardLoading),
    [dashboardData, isDashboardLoading]
  );
  const metricHandlers = {
    active: () => onOpenMyBookings?.(),
    upcoming: () => onOpenMyBookings?.(),
    messages: () => onOpenChatPage?.(),
    actions: () => onOpenMyBookings?.(),
  };

  useEffect(() => {
    let isMounted = true;

    const loadDashboardData = async () => {
      try {
        setIsDashboardLoading(true);
        setDashboardError('');
        const snapshot = await fetchClientDashboardSnapshot();

        if (isMounted) {
          setDashboardData(snapshot || emptyDashboardData);
        }
      } catch (error) {
        if (isMounted) {
          setDashboardError(error?.message || 'Unable to load dashboard activity.');
          setDashboardData(emptyDashboardData);
        }
      } finally {
        if (isMounted) {
          setIsDashboardLoading(false);
        }
      }
    };

    loadDashboardData();

    return () => {
      isMounted = false;
    };
  }, [sellerProfile?.userId]);

  return (
    <div className="gl-page" data-testid="client-home-dashboard">
      <DashboardNavigation
        appTheme={appTheme}
        themeMode={themeMode}
        onThemeChange={onThemeChange}
        currentView={currentView}
        searchQuery={searchQuery}
        onSearchChange={onSearchChange}
        onLogout={onLogout}
        onOpenSellerSetup={onOpenSellerSetup || onBecomeSeller}
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
        onToggleAdminView={onOpenAdminDashboard}
      />

      <main className="gl-shell gl-page-pad dashboard-launchpad">
        <section className="dashboard-overview" aria-labelledby="dashboard-title">
          <div className="dashboard-overview-head dashboard-client-header">
            <div>
              <h1 id="dashboard-title" className="gl-title !mt-0">Good to see you, {displayName}.</h1>
              <p className="gl-subtitle">
                Your booking activity, provider messages, and service requests are organized here.
              </p>
              {dashboardError && (
                <p className="gl-subtitle" role="status">
                  {dashboardError}
                </p>
              )}
            </div>
            <div className="dashboard-hero-actions">
              <Button type="button" onClick={onOpenBrowseServices}>
                <Search size={17} aria-hidden="true" />
                Browse services
              </Button>
            </div>
          </div>

          <div className="dashboard-metric-grid">
            {dashboardModel.metrics.map((item) => (
              <MetricCard
                key={item.label}
                detail={item.detail}
                icon={item.icon}
                label={item.label}
                actionLabel={item.id === 'messages' ? 'Open messages' : `Open bookings for ${item.label.toLowerCase()}`}
                onClick={metricHandlers[item.id]}
                tone={item.tone}
                value={item.value}
              />
            ))}
          </div>
        </section>

        <section className="dashboard-workspace-grid" aria-label="Dashboard workspace">
          <article className="dashboard-main-panel gl-card">
            <div className="dashboard-panel-head">
              <div>
                <h2>Your next services</h2>
                <p>Upcoming appointments and active requests.</p>
              </div>
              <button className="gl-icon-button" type="button" onClick={onOpenMyBookings} aria-label="Open bookings" title="Open bookings">
                <ArrowRight size={18} aria-hidden="true" />
              </button>
            </div>
            <div className="dashboard-booking-list">
              {dashboardModel.upcomingBookings.length > 0 ? dashboardModel.upcomingBookings.map((booking) => (
                <div className="dashboard-booking-row" key={`${booking.service}-${booking.schedule}`}>
                  <span className="dashboard-booking-icon">
                    <CalendarCheck size={18} aria-hidden="true" />
                  </span>
                  <div>
                    <strong>{booking.service}</strong>
                    <p>{booking.provider} - {booking.schedule}</p>
                  </div>
                  <span className="dashboard-status-pill">{booking.status}</span>
                </div>
              )) : (
                <div className="dashboard-booking-row dashboard-client-empty">
                  <span className="dashboard-booking-icon">
                    <CalendarCheck size={18} aria-hidden="true" />
                  </span>
                  <div>
                    <strong>{isDashboardLoading ? 'Loading bookings...' : 'No upcoming bookings'}</strong>
                    <p>{isDashboardLoading ? 'Checking your latest schedule.' : 'Find a trusted provider whenever you are ready.'}</p>
                  </div>
                  {!isDashboardLoading && (
                    <Button type="button" onClick={onOpenBrowseServices}>
                      <Search aria-hidden="true" />
                      Browse services
                    </Button>
                  )}
                </div>
              )}
            </div>
          </article>

          <aside className="dashboard-side-panel gl-card" aria-label="Recent updates">
            <div className="dashboard-panel-head">
              <div>
                <h2>Recent updates</h2>
                <p>Booking and message activity.</p>
              </div>
            </div>
            <div className="dashboard-update-list">
              {dashboardModel.recentUpdates.length > 0 ? dashboardModel.recentUpdates.map((update) => (
                <div className="dashboard-update-row" key={update.id || `${update.title}-${update.time}`}>
                  <CheckCircle2 size={17} aria-hidden="true" />
                  <div>
                    <strong>{update.title}</strong>
                    <p>{update.detail}</p>
                  </div>
                  <time>{update.time}</time>
                </div>
              )) : (
                <div className="dashboard-update-row">
                  <CheckCircle2 size={17} aria-hidden="true" />
                  <div>
                    <strong>{isDashboardLoading ? 'Loading activity...' : 'No recent updates'}</strong>
                    <p>{isDashboardLoading ? 'Checking bookings and chats.' : 'Booking and chat activity will appear here.'}</p>
                  </div>
                  <time>{isDashboardLoading ? '' : 'Now'}</time>
                </div>
              )}
            </div>
          </aside>
        </section>

      </main>
    </div>
  );
}

export default Dashboard;
