export function boostCheckoutAmount(days: number, configuredRate?: string): number {
  if (![3, 7, 14, 30].includes(days)) {
    throw new Error("Choose a 3, 7, 14, or 30-day boost.");
  }
  const text = configuredRate?.trim() || "50";
  const rate = Number(text);
  if (!/^\d+(\.\d{1,2})?$/.test(text) || !Number.isFinite(rate) || rate < 1 || rate > 27397.26) {
    throw new Error("Ad booster pricing is unavailable. Please contact support.");
  }
  return Math.round(rate * 100) * days / 100;
}
