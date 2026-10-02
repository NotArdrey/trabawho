export function boostCheckoutAmount(days: number, configuredRate?: string): number {
  if (!Number.isInteger(days) || days < 1 || days > 365) {
    throw new Error("Enter whole days between 1 and 365.");
  }
  const text = configuredRate?.trim() || "50";
  const rate = Number(text);
  if (!/^\d+(\.\d{1,2})?$/.test(text) || !Number.isFinite(rate) || rate < 1 || rate > 27397.26) {
    throw new Error("Ad booster pricing is unavailable. Please contact support.");
  }
  return Math.round(rate * 100) * days / 100;
}
