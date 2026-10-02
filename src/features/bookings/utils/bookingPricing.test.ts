import { describe, expect, it } from "vitest";
import {
  BOOKING_TRANSACTION_FEE_RATE,
  calculateBookingPricing,
} from './bookingPricing';

describe('calculateBookingPricing', () => {
  it('matches the 8% deposit and charges the platform fee once', () => {
    const pricing = calculateBookingPricing(1200);
    expect(pricing.transactionFeeAmount).toBe(96);
    expect(pricing.downpaymentUpfrontAmount).toBe(696);
    expect(pricing.downpaymentBalanceAmount).toBe(600);
    expect(pricing.totalChargedAmount).toBe(1296);
  });
  it('rounds half-cent deposits up to match PostgreSQL numeric rounding', () => {
    expect(calculateBookingPricing(0.29)).toMatchObject({ serviceDownpaymentAmount: 0.15, downpaymentBalanceAmount: 0.14 });
    expect(calculateBookingPricing(10.01)).toMatchObject({ serviceDownpaymentAmount: 5.01, downpaymentBalanceAmount: 5 });
  });
  it('adds a 8% transaction fee to a booking', () => {
    expect(calculateBookingPricing(1500)).toEqual({
      serviceAmount: 1500,
      transactionFeeRate: BOOKING_TRANSACTION_FEE_RATE,
      transactionFeePercent: '8%',
      transactionFeeAmount: 120,
      totalChargedAmount: 1620,
      serviceDownpaymentAmount: 750,
      downpaymentUpfrontAmount: 870,
      downpaymentBalanceAmount: 750,
    });
  });

  it('rounds currency values to two decimal places', () => {
    expect(calculateBookingPricing(999.99)).toMatchObject({
      serviceAmount: 999.99,
      transactionFeeAmount: 80,
      totalChargedAmount: 1079.99,
      serviceDownpaymentAmount: 500,
      downpaymentUpfrontAmount: 580,
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
