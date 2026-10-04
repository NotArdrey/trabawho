/** Older showcase bookings were marked paid without a PayMongo checkout. */
export function isShowcasePaymentReference(reference?: string | null): boolean {
  return /^SHOWCASE-PAID-/i.test(reference || "");
}
