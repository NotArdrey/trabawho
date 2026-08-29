import {
  BOOKING_TRANSACTION_FEE_RATE,
  calculateBookingPricing,
} from './bookingPricing';

describe('calculateBookingPricing', () => {
  it('adds a 5% transaction fee to a booking', () => {
    expect(calculateBookingPricing(1500)).toEqual({
      serviceAmount: 1500,
      transactionFeeRate: BOOKING_TRANSACTION_FEE_RATE,
      transactionFeePercent: '5%',
      transactionFeeAmount: 75,
      totalChargedAmount: 1575,
      serviceDownpaymentAmount: 750,
      downpaymentUpfrontAmount: 825,
      downpaymentBalanceAmount: 750,
    });
  });

  it('rounds currency values to two decimal places', () => {
    expect(calculateBookingPricing(999.99)).toMatchObject({
      serviceAmount: 999.99,
      transactionFeeAmount: 50,
      totalChargedAmount: 1049.99,
      serviceDownpaymentAmount: 500,
      downpaymentUpfrontAmount: 550,
      downpaymentBalanceAmount: 499.99,
    });
  });

  it('does not produce negative charges for invalid amounts', () => {
    expect(calculateBookingPricing(-100)).toMatchObject({
      serviceAmount: 0,
      transactionFeeAmount: 0,
      totalChargedAmount: 0,
    });
  });

  it('supports fee-free non-booking uses of the shared payment modal', () => {
    expect(calculateBookingPricing(500, 0)).toMatchObject({
      transactionFeeAmount: 0,
      totalChargedAmount: 500,
    });
  });
});
