export const BOOKING_TRANSACTION_FEE_RATE = 0.05;

const roundCurrency = (value) => Number(Number(value || 0).toFixed(2));

export const calculateBookingPricing = (
  serviceAmount,
  transactionFeeRate = BOOKING_TRANSACTION_FEE_RATE
) => {
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
