import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import MyBookings from './MyBookings';

// Mock the navigation component to simplify testing
jest.mock('../../../shared/components/DashboardNavigation', () => () => (
  <nav data-testid="mock-dashboard-nav">Navigation</nav>
));

// Mock child modals
jest.mock('../components/ChatWindow', () => () => <div data-testid="mock-chat-window">Chat</div>);
jest.mock('../components/SlotSelectionModal', () => () => <div data-testid="mock-slot-modal">Slots</div>);
jest.mock('../components/PaymentModal', () => () => <div data-testid="mock-payment-modal">Payment</div>);
jest.mock('../components/BookingTermsModal', () => ({ isOpen, onConfirm }) => (
  isOpen ? <button data-testid="mock-terms-modal" onClick={onConfirm}>Continue to payment</button> : null
));

// Mock the hooks
const mockBookings = [
  {
    id: 'b1',
    workerName: 'Juan Dela Cruz',
    serviceType: 'Tutor',
    description: 'Math tutorial sessions for grade 10',
    status: 'Service Scheduled',
    quoteAmount: 1500,
    requestDate: '2026-08-20',
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

jest.mock('../hooks', () => ({
  useBookingListController: () => ({
    bookings: mockCurrentBookings,
    filteredBookings: mockCurrentBookings,
    activeFilter: 'all',
    displayFilter: 'all',
    isLoading: mockIsLoading,
    loadError: '',
    actionError: '',
    setActiveFilter: jest.fn(),
    setDisplayFilter: jest.fn(),
    updateBooking: jest.fn(),
    replaceBooking: jest.fn(),
    refreshBookings: jest.fn(),
    handleApproveQuote: jest.fn(),
    handleRejectQuote: jest.fn(),
    handleStopServiceAccepted: jest.fn(),
    getBooking: (id) => mockCurrentBookings.find((b) => String(b.id) === String(id)),
  }),
  usePaymentController: () => ({
    handleSelectPaymentMethod: jest.fn(),
  }),
  useRefundController: () => ({
    handleRequestRefund: jest.fn(),
    handleConfirmRefundReceived: jest.fn(),
  }),
  useRatingController: () => ({
    handleLeaveRating: jest.fn(),
  }),
}));

describe('MyBookings Redesign Component', () => {
  beforeEach(() => {
    mockCurrentBookings = [];
    mockIsLoading = false;
  });

  test('renders empty state with rich CTA when there are no bookings', () => {
    mockCurrentBookings = [];
    const handleBrowse = jest.fn();

    render(
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

    render(
      <MyBookings
        currentView="my-bookings"
      />
    );

    // KPI Metrics
    expect(screen.getByText('Total Bookings')).toBeInTheDocument();
    expect(screen.getByText('Active & Scheduled')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Completed' })).toBeInTheDocument();

    // Booking Cards
    expect(screen.getByTestId('booking-card-b1')).toBeInTheDocument();
    expect(screen.getByTestId('booking-card-b2')).toBeInTheDocument();
    expect(screen.getByText('Juan Dela Cruz')).toBeInTheDocument();
    expect(screen.getByText('Maria Santos')).toBeInTheDocument();
    expect(screen.getByText('₱1,500')).toBeInTheDocument();
    expect(screen.getByText('₱2,200')).toBeInTheDocument();
  });

  test('allows searching bookings by provider or service name', () => {
    mockCurrentBookings = mockBookings;

    render(
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

    render(<MyBookings currentView="my-bookings" />);

    fireEvent.click(screen.getAllByRole('button', { name: /View Details/i })[0]);

    const detailsDialog = screen.getByRole('dialog', { name: /Tutor/i });
    expect(detailsDialog).toBeInTheDocument();
    expect(detailsDialog).toHaveTextContent('GCASH-998811');
  });

  test('lets a buyer open payment directly from a pending booking card', () => {
    mockCurrentBookings = [{
      ...mockBookings[0],
      status: 'Payment Pending',
      paymentStatus: 'pending_provider',
    }];

    render(<MyBookings currentView="my-bookings" />);

    fireEvent.click(screen.getByRole('button', { name: /Pay Now/i }));
    fireEvent.click(screen.getByTestId('mock-terms-modal'));

    expect(screen.getByTestId('mock-payment-modal')).toBeInTheDocument();
  });

  test('shows the provider confirmation action before client completion', () => {
    mockCurrentBookings = [{
      ...mockBookings[0],
      status: 'Payment Confirmed',
      paymentStatus: 'paid',
      deliveryStatus: 'not_delivered',
    }];

    render(<MyBookings currentView="my-bookings" sellerProfile={{ role: 'worker', userId: 'worker-1' }} />);

    expect(screen.getByRole('button', { name: /Mark Delivered/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Confirm Completion/i })).not.toBeInTheDocument();
  });
});
