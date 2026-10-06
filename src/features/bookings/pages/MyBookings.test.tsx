import type { ComponentType, ReactNode } from 'react';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import LegacyMyBookings from '@/features/bookings/pages/MyBookings';
const MyBookings = LegacyMyBookings as unknown as ComponentType<Record<string, unknown>>;

// Mock the navigation component to simplify testing
vi.mock('@/shared/components/DashboardNavigation', () => ({
  default: () => <nav data-testid="mock-dashboard-nav">Navigation</nav>,
}));

// Mock child modals
vi.mock('@/features/bookings/components/ChatWindow', () => ({
  default: ({ viewerRole, highlighted, onOpenSlotSelection }: { viewerRole: string; highlighted: boolean; onOpenSlotSelection: () => void }) => <div id="chat-conversation" tabIndex={-1} data-testid="mock-chat-window" data-highlighted={highlighted || undefined} data-viewer-role={viewerRole}>Chat<button onClick={onOpenSlotSelection}>Open schedule</button></div>,
}));
vi.mock('@/features/bookings/components/SlotSelectionModal', () => ({
  default: ({ onConfirmSlot }: { onConfirmSlot: (slot: { slotId: number; date: string }) => void }) => <div data-testid="mock-slot-modal">Slots<button onClick={() => onConfirmSlot({ slotId: 42, date: '2026-10-10' })}>Review booking</button></div>,
}));
vi.mock('@/features/bookings/components/PaymentModal', () => ({
  default: () => <div data-testid="mock-payment-modal">Payment</div>,
}));
const replacementState = vi.hoisted(() => ({ schedules: new Map<string, { status: string; startAt: string; endAt: string }>() }));
vi.mock('@/features/bookings/hooks/useProviderReplacementSchedules', () => ({
  useProviderReplacementSchedules: () => replacementState.schedules,
}));
vi.mock('@/features/bookings/components/BookingTermsModal', () => ({
  default: ({ isOpen, onConfirm }: { isOpen: boolean; onConfirm: () => void }) => (
    isOpen ? <button data-testid="mock-terms-modal" onClick={onConfirm}>Continue to payment</button> : null
  ),
}));

// Mock the hooks
const mockBookings = [
  {
    id: 'b1',
    workerName: 'Juan Dela Cruz',
    clientName: 'Ana Client',
    serviceType: 'Tutor',
    description: 'Math tutorial sessions for grade 10',
    status: 'Service Scheduled',
    quoteAmount: 1500,
    createdAt: '2026-10-05T05:07:00Z',
    requestDate: '2026-08-20',
    selectedSlot: {
      timeBlock: { startTime: '08:08', endTime: '10:08' },
    },
    bookingMode: 'calendar-only',
    bookingModeLabel: 'Direct Schedule',
    paymentMethod: 'gcash-advance',
    paymentReference: 'GCASH-998811',
  },
  {
    id: 'b2',
    workerName: 'Maria Santos',
    serviceType: 'Cleaner',
    description: 'Deep house cleaning service',
    status: 'Completed Service',
    quoteAmount: 2200,
    requestDate: '2026-08-15',
    canRate: true,
    paymentMethod: 'after-service-cash',
  },
];

let mockCurrentBookings: Array<{ id: string; status: string; [key: string]: unknown }> = [];
let mockIsLoading = false;
let mockHasLoaded = true;
let mockListRole = '';
const mockHandleOpenRating = vi.fn();
const mockRefreshBookings = vi.fn();

vi.mock('@/features/bookings/hooks', () => ({
  useBookingListController: (_initialBookings: unknown, options: { listRole: string }) => {
    mockListRole = options.listRole;
    return ({
    bookings: mockCurrentBookings,
    filteredBookings: mockCurrentBookings,
    activeFilter: 'all',
    displayFilter: 'all',
    isLoading: mockIsLoading,
    hasLoaded: mockHasLoaded,
    loadError: '',
    actionError: '',
    setActiveFilter: vi.fn(),
    setDisplayFilter: vi.fn(),
    updateBooking: vi.fn(),
    replaceBooking: vi.fn(),
    refreshBookings: mockRefreshBookings,
    handleApproveQuote: vi.fn(),
    handleRejectQuote: vi.fn(),
    handleStopServiceAccepted: vi.fn(),
    getBooking: (id: string) => mockCurrentBookings.find((b) => String(b.id) === String(id)),
    });
  },
  usePaymentController: () => ({
    handleSelectPaymentMethod: vi.fn(),
  }),
  useRefundController: () => ({
    handleRequestRefund: vi.fn(),
    handleConfirmRefundReceived: vi.fn(),
  }),
  useRatingController: () => ({
    ratingTargetId: null,
    setRatingTargetId: vi.fn(),
    handleOpenRating: mockHandleOpenRating,
    handleLeaveRating: vi.fn(),
  }),
}));

describe('MyBookings Redesign Component', () => {
  const LocationProbe = () => {
    const location = useLocation();
    return <output data-testid="location-probe">{`${location.pathname}${location.search}`}</output>;
  };
  const renderBookings = (component: ReactNode, initialEntry = '/bookings?scope=purchases') => render(
    <MemoryRouter initialEntries={[initialEntry]}>{component}<LocationProbe /></MemoryRouter>
  );

  beforeEach(() => {
    mockCurrentBookings = [];
    mockIsLoading = false;
    mockHasLoaded = true;
    replacementState.schedules = new Map();
    mockHandleOpenRating.mockClear();
    mockRefreshBookings.mockClear();
  });

  test('renders empty state with rich CTA when there are no bookings', () => {
    mockCurrentBookings = [];
    const handleBrowse = vi.fn();

    renderBookings(
      <MyBookings
        currentView="my-bookings"
        onOpenBrowseServices={handleBrowse}
      />
    );

    expect(screen.getByRole('heading', { name: 'My Bookings' })).toBeInTheDocument();
    expect(screen.getByTestId('bookings-empty-state')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'No bookings yet' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Browse Marketplace/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Browse Marketplace/i }));
    expect(handleBrowse).toHaveBeenCalledTimes(1);
  });

  test('renders KPI snapshot cards and booking cards when bookings exist', () => {
    mockCurrentBookings = mockBookings;

    renderBookings(
      <MyBookings
        currentView="my-bookings"
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'All, 2' }));

    // KPI Metrics
    expect(screen.getByText('Total bookings')).toBeInTheDocument();
    expect(screen.getByText('Active & scheduled')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Completed' })).toBeInTheDocument();

    // Booking Cards
    expect(screen.getByTestId('booking-card-b1')).toBeInTheDocument();
    expect(screen.getByTestId('booking-card-b2')).toBeInTheDocument();
    expect(screen.getByText('Juan Dela Cruz')).toBeInTheDocument();
    expect(screen.getByText('Maria Santos')).toBeInTheDocument();
    expect(screen.getByText('PHP 1,500')).toBeInTheDocument();
    expect(screen.getByText('PHP 2,200')).toBeInTheDocument();
    expect(screen.getByText('Booked on')).toBeVisible();
    expect(screen.getByText(/Oct 5, 2026.*1:07 PM PHT/)).toBeVisible();
  });

  test('a provider quick link isolates and highlights an expired booking outside the Scheduled tab', async () => {
    mockCurrentBookings = [
      { ...mockBookings[0], id: 'expired-1', status: 'Reservation Expired' },
      { ...mockBookings[0], id: 'other-2', status: 'Service Scheduled' },
    ];
    renderBookings(<MyBookings currentView="worker-bookings" sellerProfile={{ role: 'worker', userId: 'worker-1' }} />,
      '/worker/bookings?scope=incoming&filter=all&q=expired-1&focus=expired-1');
    expect(screen.getByRole('button', { name: 'All, 2' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('searchbox', { name: 'Search bookings' })).toHaveValue('expired-1');
    expect(screen.getByTestId('booking-card-expired-1')).toBeInTheDocument();
    expect(screen.queryByTestId('booking-card-other-2')).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId('booking-card-expired-1')).toHaveAttribute('data-highlighted', 'true'));
    expect(screen.getByTestId('booking-card-expired-1')).toHaveFocus();
  });

  test('counts a confirmed replacement visit in the provider Scheduled tab', () => {
    mockCurrentBookings = [{ ...mockBookings[0], id: 'case-booking', status: 'Dispute Open' }];
    replacementState.schedules = new Map([['case-booking', { status: 'accepted',
      startAt: '2026-10-10T08:00:00+08:00', endAt: '2026-10-10T09:00:00+08:00' }]]);
    renderBookings(<MyBookings currentView="worker-bookings" sellerProfile={{ role: 'worker', userId: 'worker-1' }} />,
      '/worker/bookings?scope=incoming&filter=scheduled');
    expect(screen.getByRole('button', { name: 'Scheduled, 1' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('booking-card-case-booking')).toBeVisible();
  });

  test('keeps empty feedback visible during silent background refresh', () => {
    mockCurrentBookings = [{ ...mockBookings[0], status: 'Reservation Expired' }];
    mockIsLoading = true;
    renderBookings(<MyBookings currentView="worker-bookings" sellerProfile={{ role: 'worker', userId: 'worker-1' }} />,
      '/worker/bookings?scope=incoming&filter=scheduled');
    expect(screen.getByTestId('bookings-filter-empty-state')).toBeVisible();
    expect(screen.getByRole('heading', { name: 'No matching bookings' })).toBeVisible();
    expect(screen.queryByText('Updating bookings...')).not.toBeInTheDocument();
  });

  test('keeps zero-count metrics and the empty state stable during refresh', () => {
    mockCurrentBookings = [];
    mockIsLoading = true;
    mockHasLoaded = true;
    renderBookings(<MyBookings currentView="worker-bookings" sellerProfile={{ role: 'worker', userId: 'worker-1' }} />,
      '/worker/bookings?scope=incoming');
    expect(screen.getByTestId('bookings-empty-state')).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Client bookings' }).previousElementSibling).toHaveTextContent('0');
    expect(screen.queryByText('...')).not.toBeInTheDocument();
  });

  test('the provider inquiry tab includes pending requests that are not scheduled', () => {
    mockCurrentBookings = [
      { ...mockBookings[0], id: 'pending-1', status: 'Pending Response' },
      { ...mockBookings[0], id: 'scheduled-2', status: 'Service Scheduled' },
    ];
    renderBookings(<MyBookings currentView="worker-bookings" sellerProfile={{ role: 'worker', userId: 'worker-1' }} />,
      '/worker/bookings?scope=incoming&filter=inquiries');
    expect(screen.getByRole('button', { name: 'Inquiries, 1' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('booking-card-pending-1')).toBeInTheDocument();
    expect(screen.queryByTestId('booking-card-scheduled-2')).not.toBeInTheDocument();
  });

  test.each([
    { view: 'my-bookings', scope: 'purchases', label: 'My Bookings' },
    { view: 'worker-bookings', scope: 'incoming', label: 'Bookings' },
  ])('shows a completed sandbox refund in the $scope Refunds tab and refreshes on selection', ({ view, scope, label }) => {
    mockCurrentBookings = [{ ...mockBookings[0], status: 'Refund Simulated', paymentStatus: 'paid', refundSimulated: true }];
    renderBookings(<MyBookings currentView={view} sellerProfile={scope === 'incoming' ? { role: 'worker', userId: 'worker-1' } : { role: 'client' }} />,
      `/bookings?scope=${scope}&filter=all`);
    expect(screen.getByRole('heading', { name: label })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Refunds, 1' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Refunds, 1' }));
    expect(screen.getByTestId('booking-card-b1')).toBeInTheDocument();
    expect(mockRefreshBookings).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('location-probe')).toHaveTextContent('filter=refunds');
  });

  test('pages bookings after filtering and resets to page one when searching', () => {
    mockCurrentBookings = Array.from({ length: 18 }, (_, index) => ({
      ...mockBookings[0], id: `booking-${index + 1}`, workerName: `Provider ${index + 1}`,
    }));
    renderBookings(<MyBookings currentView="my-bookings" />, '/bookings?scope=purchases&filter=all&page=2');
    expect(screen.getByTestId('booking-card-booking-9')).toBeInTheDocument();
    expect(screen.queryByTestId('booking-card-booking-1')).not.toBeInTheDocument();
    expect(screen.getByText('Showing 9–16 of 18 matching bookings')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByTestId('booking-card-booking-17')).toBeInTheDocument();
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search bookings' }), { target: { value: 'Provider 2' } });
    expect(screen.getByTestId('booking-card-booking-2')).toBeInTheDocument();
    expect(screen.getByTestId('location-probe')).not.toHaveTextContent('page=');
  });

  test('allows searching bookings by provider or service name', () => {
    mockCurrentBookings = mockBookings;

    renderBookings(
      <MyBookings
        currentView="my-bookings"
      />
    );

    const searchInput = screen.getByPlaceholderText(/Search by worker, service, or reference/i);
    expect(searchInput).toBeInTheDocument();

    fireEvent.change(searchInput, { target: { value: 'Juan' } });
    expect(screen.getByText('Juan Dela Cruz')).toBeInTheDocument();
    expect(screen.queryByText('Maria Santos')).not.toBeInTheDocument();
  });

  test('opens booking details from a card', () => {
    mockCurrentBookings = mockBookings;

    renderBookings(<MyBookings currentView="my-bookings" />);

    fireEvent.click(screen.getAllByRole('button', { name: /View Details/i })[0]);

    const detailsDialog = screen.getByRole('dialog', { name: /Tutor/i });
    expect(detailsDialog).toBeInTheDocument();
    expect(detailsDialog).toHaveTextContent('Booked on');
    expect(detailsDialog).toHaveTextContent('Oct 5, 2026');
    expect(detailsDialog).toHaveTextContent('GCASH-998811');
    expect(detailsDialog).toHaveTextContent('8:08 AM – 10:08 AM');
  });

  test('lets a buyer open payment directly from a pending booking card', () => {
    mockCurrentBookings = [{
      ...mockBookings[0],
      status: 'Payment Pending',
      paymentStatus: 'pending_provider',
    }];

    renderBookings(<MyBookings currentView="my-bookings" />);

    const messageButton = screen.getByRole('button', { name: /Message provider/i });
    const payButton = screen.getByRole('button', { name: /Pay Now/i });
    const detailsButton = screen.getByRole('button', { name: /View details/i });
    expect(detailsButton.compareDocumentPosition(messageButton) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(messageButton.compareDocumentPosition(payButton) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    fireEvent.click(payButton);
    fireEvent.click(screen.getByTestId('mock-terms-modal'));

    expect(screen.getByTestId('mock-payment-modal')).toBeInTheDocument();
  });

  test('highlights the conversation opened from a message notification', async () => {
    mockCurrentBookings = [mockBookings[0]];
    renderBookings(<MyBookings currentView="chat" selectedChatBookingId="b1" />,
      '/messages/b1?scope=purchases&focus=conversation');
    const conversation = screen.getByTestId('mock-chat-window');
    await waitFor(() => expect(conversation).toHaveAttribute('data-highlighted', 'true'));
    expect(conversation).toHaveFocus();
  });

  test('closes schedule before opening terms and payment review', () => {
    mockCurrentBookings = [mockBookings[0]];
    renderBookings(<MyBookings currentView="chat" selectedChatBookingId="b1" />, '/chats?scope=purchases');

    fireEvent.click(screen.getByRole('button', { name: 'Open schedule' }));
    expect(screen.getByTestId('mock-slot-modal')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Review booking' }));

    expect(screen.queryByTestId('mock-slot-modal')).not.toBeInTheDocument();
    expect(screen.getByTestId('mock-terms-modal')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('mock-terms-modal'));
    expect(screen.getByTestId('mock-payment-modal')).toBeInTheDocument();
  });

  test('keeps lower-frequency booking changes in a management menu', async () => {
    mockCurrentBookings = [mockBookings[0]];

    renderBookings(<MyBookings currentView="my-bookings" />);

    expect(screen.queryByRole('button', { name: 'Reschedule' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cancel booking' })).not.toBeInTheDocument();

    fireEvent.pointerDown(screen.getByRole('button', { name: /Manage booking/i }));

    const rescheduleAction = await screen.findByRole('menuitem', { name: 'Reschedule' });
    expect(screen.getByRole('menuitem', { name: 'Cancel booking' })).toBeInTheDocument();

    fireEvent.click(rescheduleAction);
    expect(screen.getByTestId('mock-slot-modal')).toBeInTheDocument();
  });

  test('replaces payment with schedule recovery when an unpaid appointment has passed', () => {
    mockCurrentBookings = [{
      ...mockBookings[0],
      status: 'Payment Pending',
      paymentStatus: 'pending_provider',
      scheduleStatus: 'confirmed',
      raw: { booking: { start_ts: '2020-01-01T09:00:00Z' } },
    }];

    renderBookings(<MyBookings currentView="my-bookings" />);

    expect(screen.queryByRole('button', { name: /Pay Now/i })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Scheduled time has passed' })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Choose another time' }));
    expect(screen.getByTestId('mock-slot-modal')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Review booking' }));
    expect(screen.getByTestId('mock-terms-modal')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('mock-terms-modal'));
    expect(screen.getByTestId('mock-payment-modal')).toBeInTheDocument();
  });

  test('shows the provider confirmation action before client completion', () => {
    mockCurrentBookings = [{
      ...mockBookings[0],
      status: 'Payment Confirmed',
      paymentStatus: 'paid',
      deliveryStatus: 'not_delivered',
      workStartedAt: '2026-10-02T00:00:00Z',
      scheduleStatus: 'confirmed',
      raw: { booking: { status: 'in_progress' } },
    }];

    renderBookings(
      <MyBookings currentView="worker-bookings" sellerProfile={{ role: 'worker', userId: 'worker-1' }} />,
      '/worker/bookings?scope=incoming',
    );

    expect(screen.getByRole('button', { name: /Submit delivery/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Confirm Completion/i })).not.toBeInTheDocument();
  });

  test('opens the rating workflow instead of routing to hidden chat controls', () => {
    mockCurrentBookings = [mockBookings[1]];

    renderBookings(<MyBookings currentView="my-bookings" />);
    fireEvent.click(screen.getByRole('button', { name: 'All, 1' }));
    fireEvent.click(screen.getByRole('button', { name: /Rate Service/i }));

    expect(mockHandleOpenRating).toHaveBeenCalledWith('b2');
  });

  test('shows client bookings by default in the provider booking workspace', () => {
    mockCurrentBookings = mockBookings;

    renderBookings(
      <MyBookings currentView="worker-bookings" sellerProfile={{ role: 'worker', userId: 'worker-1' }} />,
      '/worker/bookings?scope=incoming',
    );

    expect(screen.getByRole('heading', { name: 'Bookings' })).toBeInTheDocument();
    expect(screen.getByText('Ana Client')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Scheduled, 1' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getAllByRole('button', { name: 'Message client' })).toHaveLength(1);
    expect(screen.getByText('PHP 1,500')).toHaveClass('text-lg', 'text-emerald-700');
    expect(screen.getByText('Booked on')).toBeVisible();
    expect(screen.getByText(/Oct 5, 2026.*1:07 PM PHT/)).toBeVisible();
    expect(screen.queryByTestId('booking-card-b2')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'All, 2' }));
    expect(screen.getByTestId('booking-card-b2')).toBeInTheDocument();
    expect(screen.getByTestId('location-probe')).toHaveTextContent('filter=all');
    expect(mockListRole).toBe('seller');
  });

  test('warns on the worker cards before opening an overlapping job across services', () => {
    const first = { ...mockBookings[0], id: 'job-one', sellerId: 'provider-1', serviceType: 'Garden cleanup',
      status: 'Payment Confirmed', paymentStatus: 'paid', scheduleStatus: 'confirmed',
      raw: { booking: { status: 'confirmed', start_ts: '2026-10-10T01:00:00Z', end_ts: '2026-10-10T02:00:00Z' } } };
    const second = { ...first, id: 'job-two', clientName: 'Bea Client', serviceType: 'House painting',
      raw: { booking: { status: 'confirmed', start_ts: '2026-10-10T01:30:00Z', end_ts: '2026-10-10T02:30:00Z' } } };
    mockCurrentBookings = [first, second];

    renderBookings(<MyBookings currentView="worker-bookings" sellerProfile={{ role: 'worker', userId: 'provider-1' }} />,
      '/worker/bookings?scope=incoming');

    const card = within(screen.getByTestId('booking-card-job-one'));
    expect(card.getByRole('alert')).toHaveTextContent('Schedule conflict with 1 other booking');
    expect(card.getByText(/House painting for Bea Client/)).toBeVisible();
    fireEvent.click(card.getByRole('button', { name: 'View conflicting booking' }));
    expect(screen.getByRole('dialog')).toHaveTextContent('House painting');
  });

  test('forces client-only accounts onto purchased services', () => {
    mockCurrentBookings = mockBookings;

    renderBookings(<MyBookings currentView="my-bookings" sellerProfile={{ role: 'client' }} />, '/bookings?scope=incoming');

    expect(screen.getByRole('heading', { name: 'My Bookings' })).toBeInTheDocument();
    expect(screen.getByText('Juan Dela Cruz')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Incoming bookings' })).not.toBeInTheDocument();
    expect(mockListRole).toBe('buyer');
  });

  test('keeps Worker bookings incoming when an old URL requests purchased services', () => {
    mockCurrentBookings = mockBookings;
    renderBookings(
      <MyBookings currentView="worker-bookings" sellerProfile={{ role: 'worker', userId: 'worker-1' }} />,
      '/worker/bookings?scope=purchases',
    );
    expect(screen.getByRole('heading', { name: 'Bookings' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Services I booked' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Incoming bookings' })).not.toBeInTheDocument();
    expect(screen.getByTestId('location-probe')).toHaveTextContent('scope=incoming');
    expect(mockListRole).toBe('seller');
  });

  test('uses the fixed account role for chat despite a purchased-services URL', () => {
    mockCurrentBookings = mockBookings;
    renderBookings(
      <MyBookings currentView="chat" selectedChatBookingId="b1" sellerProfile={{ role: 'worker', userId: 'worker-1' }} />,
      '/messages/b1?scope=purchases',
    );

    expect(screen.getByTestId('mock-chat-window')).toHaveAttribute('data-viewer-role', 'seller');
  });
});
