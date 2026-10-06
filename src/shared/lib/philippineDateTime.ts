const TIME_ZONE = "Asia/Manila";

export function philippineDayKey(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(date);
  const value = (type: string) => parts.find((part) => part.type === type)?.value || "";
  return `${value("year")}-${value("month")}-${value("day")}`;
}

export function samePhilippineDay(left: Date, right: Date): boolean {
  return philippineDayKey(left) === philippineDayKey(right);
}

export function parsePhilippineSlot(date: string, time = "00:00"): Date | null {
  const match = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(time);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !match) return null;
  const parsed = new Date(`${date}T${match[1].padStart(2, "0")}:${match[2]}:${match[3] || "00"}+08:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function formatPhilippineSchedule(date: Date): string {
  return date.toLocaleString("en-PH", {
    timeZone: TIME_ZONE, month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
  });
}
