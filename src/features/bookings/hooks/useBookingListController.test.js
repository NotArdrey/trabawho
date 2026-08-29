import { act, renderHook } from '@testing-library/react';
import { useBookingListController } from './useBookingListController';

jest.mock('../services/bookingService', () => ({
  fetchClientBookings: jest.fn(),
  fetchSellerBookings: jest.fn(),
  submitBookingReview: jest.fn(),
  updateBookingWorkflow: jest.fn(),
}));

const bookings = [
  { id: 'pending', status: 'Payment Pending', paymentStatus: 'pending_provider', paymentMethod: 'gcash-advance' },
  { id: 'partial', status: 'Downpayment Paid', paymentStatus: 'partially_paid', paymentMethod: 'gcash-advance' },
  { id: 'paid', status: 'Payment Confirmed', paymentStatus: 'paid', paymentMethod: 'gcash-advance' },
  { id: 'completed', status: 'Completed Service', paymentStatus: 'paid', paymentMethod: 'after-service-cash' },
  { id: 'refunded', status: 'Refunded', paymentStatus: 'refunded', refundStatus: 'completed' },
  { id: 'cancelled', status: 'Cancelled', paymentStatus: 'unpaid' },
];

describe('useBookingListController filters', () => {
  const setup = () => renderHook(() => useBookingListController(bookings, { autoLoad: false }));

  test.each([
    ['payment-pending', ['pending', 'partial']],
    ['paid', ['paid', 'completed']],
    ['completed', ['completed']],
    ['cash-approvals', ['completed']],
    ['refunds', ['refunded']],
    ['cancelled', ['cancelled']],
  ])('filters %s bookings', (filter, expectedIds) => {
    const { result } = setup();
    act(() => result.current.setDisplayFilter(filter));
    expect(result.current.filteredBookings.map((booking) => booking.id)).toEqual(expectedIds);
  });

  test('status tabs separate active and completed bookings correctly', () => {
    const { result } = setup();

    act(() => result.current.setActiveFilter('completed'));
    expect(result.current.filteredBookings.map((booking) => booking.id)).toEqual(['completed']);

    act(() => result.current.setActiveFilter('active'));
    expect(result.current.filteredBookings.map((booking) => booking.id)).toEqual(['pending', 'partial', 'paid']);
  });
});
