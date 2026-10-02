export interface BoostDraft { serviceId: number; days: number; amount: number; serviceTitle: string }

export function buildBoostDraft(serviceId: string, title: string, daysText: string, budgetText: string): BoostDraft {
  const id = Number(serviceId);
  const days = Number(daysText);
  const amount = Number(budgetText);
  if (!Number.isSafeInteger(id) || id <= 0) throw new Error("Choose a gig to boost.");
  if (!Number.isInteger(days) || days < 1 || days > 365) throw new Error("Enter whole days between 1 and 365.");
  if (!Number.isFinite(amount) || amount < 1 || amount > 9999999.99 || !/^\d+(\.\d{1,2})?$/.test(budgetText.trim())) {
    throw new Error("Enter a budget of at least PHP 1 with at most two decimal places.");
  }
  return { serviceId: id, serviceTitle: title, days, amount };
}

export const formatBoostDate = (value: string) => new Intl.DateTimeFormat("en-PH", {
  timeZone: "Asia/Manila", dateStyle: "medium", timeStyle: "short",
}).format(new Date(value));
