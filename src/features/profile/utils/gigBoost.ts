export interface BoostDraft { serviceId: number; days: number; amount: number; serviceTitle: string }

export function validateBoostSettings(daysText: string, budgetText: string): { days?: string; budget?: string } {
  const days = Number(daysText);
  const amount = Number(budgetText);
  return {
    ...(!/^\d+$/.test(daysText.trim()) || !Number.isInteger(days) || days < 1 || days > 365
      ? { days: "Enter whole days between 1 and 365." } : {}),
    ...(!Number.isFinite(amount) || amount < 1 || amount > 9999999.99 || !/^\d+(\.\d{1,2})?$/.test(budgetText.trim())
      ? { budget: "Enter PHP 1 to PHP 9,999,999.99 with at most two decimal places." } : {}),
  };
}

export function buildBoostDraft(serviceId: string, title: string, daysText: string, budgetText: string): BoostDraft {
  const id = Number(serviceId);
  const days = Number(daysText);
  const amount = Number(budgetText);
  if (!Number.isSafeInteger(id) || id <= 0) throw new Error("Choose a gig to boost.");
  const errors = validateBoostSettings(daysText, budgetText);
  if (errors.days || errors.budget) throw new Error(errors.days || errors.budget);
  return { serviceId: id, serviceTitle: title, days, amount };
}

export const formatBoostDate = (value: string) => new Intl.DateTimeFormat("en-PH", {
  timeZone: "Asia/Manila", dateStyle: "medium", timeStyle: "short",
}).format(new Date(value));
