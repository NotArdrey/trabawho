const philippineDate = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit",
});

/** The client can choose a visit no earlier than tomorrow in Philippine time. */
export function philippineDateKey(value: Date | string): string | null {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  const parts = Object.fromEntries(philippineDate.formatToParts(date).map(({ type, value: part }) => [type, part]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function isFutureClientBookingDate(dateKey: string, now: Date = new Date()): boolean {
  const today = philippineDateKey(now);
  return Boolean(today && /^\d{4}-\d{2}-\d{2}$/.test(dateKey) && dateKey > today);
}

export function isBookableClientAppointment(startAt: string, endAt: string, now: Date = new Date()): boolean {
  const start = new Date(startAt).getTime();
  const end = new Date(endAt).getTime();
  const startDate = philippineDateKey(startAt);
  return Number.isFinite(start) && Number.isFinite(end) && end > start && Boolean(startDate && isFutureClientBookingDate(startDate, now));
}
