import { act, renderHook } from '@testing-library/react';
import { useBookingListController } from './useBookingListController';
import { submitBookingReview } from '../services/bookingService';

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

  test('forwards an optional review image to review persistence', async () => {
    const image = new File(['image'], 'work.png', { type: 'image/png' });
    submitBookingReview.mockResolvedValue({ ...bookings[3], rating: 5, canRate: false });
    const { result } = setup();

    await act(async () => {
      await result.current.updateBooking('completed', {
        rating: 5,
        review: 'Excellent work',
        reviewImage: image,
      });
    });

    expect(submitBookingReview).toHaveBeenCalledWith(bookings[3], 5, 'Excellent work', image);
  });
});
