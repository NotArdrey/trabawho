export const BOOKING_TRANSACTION_FEE_RATE = 0.05;

export interface BookingPricing {
  serviceAmount: number;
  transactionFeeRate: number;
  transactionFeePercent: string;
  transactionFeeAmount: number;
  totalChargedAmount: number;
  serviceDownpaymentAmount: number;
  downpaymentUpfrontAmount: number;
  downpaymentBalanceAmount: number;
}

type NumericInput = number | string | null | undefined;

const roundCurrency = (value: NumericInput) => Number(Number(value || 0).toFixed(2));

export const calculateBookingPricing = (
  serviceAmount: NumericInput,
  transactionFeeRate: NumericInput = BOOKING_TRANSACTION_FEE_RATE,
): BookingPricing => {
  const parsedAmount = Number(serviceAmount);
  const parsedFeeRate = Number(transactionFeeRate);
  const normalizedFeeRate = Number.isFinite(parsedFeeRate) && parsedFeeRate >= 0
    ? parsedFeeRate
    : BOOKING_TRANSACTION_FEE_RATE;
  const normalizedServiceAmount = Number.isFinite(parsedAmount) && parsedAmount > 0
    ? roundCurrency(parsedAmount)
    : 0;
  const transactionFeeAmount = roundCurrency(
    normalizedServiceAmount * normalizedFeeRate
  );
  const serviceDownpaymentAmount = roundCurrency(normalizedServiceAmount * 0.5);
  const downpaymentBalanceAmount = roundCurrency(
    normalizedServiceAmount - serviceDownpaymentAmount
  );

  return {
    serviceAmount: normalizedServiceAmount,
    transactionFeeRate: normalizedFeeRate,
    transactionFeePercent: `${Number((normalizedFeeRate * 100).toFixed(2))}%`,
    transactionFeeAmount,
    totalChargedAmount: roundCurrency(normalizedServiceAmount + transactionFeeAmount),
    serviceDownpaymentAmount,
    downpaymentUpfrontAmount: roundCurrency(serviceDownpaymentAmount + transactionFeeAmount),
    downpaymentBalanceAmount,
  };
};
