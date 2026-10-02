type RecordValue = Record<string, unknown>;
const record = (value: unknown): RecordValue => value !== null && typeof value === "object" && !Array.isArray(value) ? value as RecordValue : {};

/** Only server-verified, paid campaigns with a bounded active period rank as ads. */
export function getActiveAdBooster(service: unknown = {}, now = Date.now()) {
  const metadata = record(record(service).metadata);
  const boost = record(metadata.ad_booster);
  const payment = record(boost.payment);
  const endsAt = typeof boost.ends_at === "string" ? boost.ends_at : null;
  const startsAt = typeof boost.starts_at === "string" ? boost.starts_at : "";
  const start = Date.parse(startsAt);
  const end = endsAt ? Date.parse(endsAt) : NaN;
  const budget = Number(boost.budget_php);
  const isBoosted = boost.active === true && boost.payment_verified === true
    && payment.provider === "paymongo" && payment.status === "paid"
    && Number.isFinite(budget) && budget > 0
    && Number.isFinite(start) && Number.isFinite(end) && start <= now && now < end;
  return { adBooster: isBoosted ? boost : null, boostBudget: isBoosted ? budget : 0, boostEndsAt: isBoosted ? endsAt : null, isBoosted };
}
