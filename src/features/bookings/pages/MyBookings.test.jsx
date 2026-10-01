import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import MyBookings from './MyBookings';

// Mock the navigation component to simplify testing
vi.mock('../../../shared/components/DashboardNavigation', () => ({
  default: () => <nav data-testid="mock-dashboard-nav">Navigation</nav>,
}));

// Mock child modals
vi.mock('../components/ChatWindow', () => ({
  default: ({ viewerRole }) => <div data-testid="mock-chat-window" data-viewer-role={viewerRole}>Chat</div>,
}));
vi.mock('../components/SlotSelectionModal', () => ({
  default: () => <div data-testid="mock-slot-modal">Slots</div>,
}));
vi.mock('../components/PaymentModal', () => ({
  default: () => <div data-testid="mock-payment-modal">Payment</div>,
}));
vi.mock('../components/BookingTermsModal', () => ({
  default: ({ isOpen, onConfirm }) => (
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

let mockCurrentBookings = [];
let mockIsLoading = false;
let mockListRole = '';
const mockHandleOpenRating = vi.fn();

vi.mock('../hooks', () => ({
  useBookingListController: (_initialBookings, options) => {
    mockListRole = options.listRole;
    return ({
    bookings: mockCurrentBookings,
    filteredBookings: mockCurrentBookings,
    activeFilter: 'all',
    displayFilter: 'all',
    isLoading: mockIsLoading,
    loadError: '',
    actionError: '',
    setActiveFilter: vi.fn(),
    setDisplayFilter: vi.fn(),
    updateBooking: vi.fn(),
    replaceBooking: vi.fn(),
    refreshBookings: vi.fn(),
    handleApproveQuote: vi.fn(),
    handleRejectQuote: vi.fn(),
    handleStopServiceAccepted: vi.fn(),
    getBooking: (id) => mockCurrentBookings.find((b) => String(b.id) === String(id)),
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
  const renderBookings = (component, initialEntry = '/bookings?scope=purchases') => render(
    <MemoryRouter initialEntries={[initialEntry]}>{component}<LocationProbe /></MemoryRouter>
  );

  beforeEach(() => {
    mockCurrentBookings = [];
    mockIsLoading = false;
    mockHandleOpenRating.mockClear();
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
  });

  test('shows the provider confirmation action before client completion', () => {
    mockCurrentBookings = [{
      ...mockBookings[0],
      status: 'Payment Confirmed',
      paymentStatus: 'paid',
      deliveryStatus: 'not_delivered',
    }];

    renderBookings(
      <MyBookings currentView="worker-bookings" sellerProfile={{ role: 'worker', userId: 'worker-1' }} />,
      '/worker/bookings?scope=incoming',
    );

    expect(screen.getByRole('button', { name: /Mark Delivered/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Confirm Completion/i })).not.toBeInTheDocument();
  });

  test('opens the rating workflow instead of routing to hidden chat controls', () => {
    mockCurrentBookings = [mockBookings[1]];

    renderBookings(<MyBookings currentView="my-bookings" />);
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
    expect(screen.getAllByRole('button', { name: 'Message client' })).toHaveLength(2);
    expect(mockListRole).toBe('seller');
  });

  test('forces client-only accounts onto purchased services', () => {
    mockCurrentBookings = mockBookings;

    renderBookings(<MyBookings currentView="my-bookings" sellerProfile={{ role: 'client' }} />, '/bookings?scope=incoming');

    expect(screen.getByRole('heading', { name: 'My Bookings' })).toBeInTheDocument();
    expect(screen.getByText('Juan Dela Cruz')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Incoming bookings' })).not.toBeInTheDocument();
    expect(mockListRole).toBe('buyer');
  });

  test('gives a provider-capable account the same client booking shell on the client route', () => {
    mockCurrentBookings = mockBookings;

    renderBookings(
      <MyBookings currentView="my-bookings" sellerProfile={{ role: 'worker', userId: 'worker-1' }} />,
      '/bookings?scope=incoming',
    );

    expect(screen.getByRole('heading', { name: 'My Bookings' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Incoming bookings' })).not.toBeInTheDocument();
    expect(mockListRole).toBe('buyer');
  });

  test('moves a worker to the client route when opening purchased services', () => {
    mockCurrentBookings = mockBookings;
    renderBookings(
      <MyBookings currentView="worker-bookings" sellerProfile={{ role: 'worker', userId: 'worker-1' }} />,
      '/worker/bookings?scope=incoming',
    );

    fireEvent.click(screen.getByRole('button', { name: 'Services I booked' }));
    expect(screen.getByTestId('location-probe')).toHaveTextContent('/bookings?scope=purchases');
    expect(mockListRole).toBe('buyer');
  });

  test('uses the booking scope to set the chat participant role', () => {
    mockCurrentBookings = mockBookings;
    renderBookings(
      <MyBookings currentView="chat" selectedChatBookingId="b1" sellerProfile={{ role: 'worker', userId: 'worker-1' }} />,
      '/messages/b1?scope=purchases',
    );

    expect(screen.getByTestId('mock-chat-window')).toHaveAttribute('data-viewer-role', 'buyer');
  });
});
