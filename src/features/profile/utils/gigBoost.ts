export interface BoostDraft { serviceId: number; days: number; amount: number; serviceTitle: string }

export function parseBoostDailyRate(value?: string): number {
  const text = value?.trim() || "50";
  const rate = Number(text);
  if (!/^\d+(\.\d{1,2})?$/.test(text) || !Number.isFinite(rate) || rate < 1 || rate > 27397.26) {
    throw new Error("Ad booster pricing is unavailable. Please contact support.");
  }
  return rate;
}

export function getBoostDailyRate(): number {
  return parseBoostDailyRate(import.meta.env.VITE_AD_BOOST_DAILY_RATE_PHP);
}

export const calculateBoostTotal = (days: number, dailyRate: number): number => Math.round(dailyRate * 100) * days / 100;

export function validateBoostSettings(daysText: string): { days?: string } {
  const days = Number(daysText);
  return {
    ...(!/^\d+$/.test(daysText.trim()) || !Number.isInteger(days) || days < 1 || days > 365
      ? { days: "Enter whole days between 1 and 365." } : {}),
  };
}

export function buildBoostDraft(serviceId: string, title: string, daysText: string): BoostDraft {
  const id = Number(serviceId);
  const days = Number(daysText);
  if (!Number.isSafeInteger(id) || id <= 0) throw new Error("Choose a gig to boost.");
  const errors = validateBoostSettings(daysText);
  if (errors.days) throw new Error(errors.days);
  const amount = calculateBoostTotal(days, getBoostDailyRate());
  return { serviceId: id, serviceTitle: title, days, amount };
}

export const formatBoostDate = (value: string) => new Intl.DateTimeFormat("en-PH", {
  timeZone: "Asia/Manila", dateStyle: "medium", timeStyle: "short",
}).format(new Date(value));
