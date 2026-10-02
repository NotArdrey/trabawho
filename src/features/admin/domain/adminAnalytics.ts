import type { ActivityPoint } from "../types/admin-activity";

const dayKey = (date: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);

export function analyticsWindow(days: number, now = new Date()) {
  const today = dayKey(now);
  const end = new Date(`${today}T00:00:00+08:00`);
  const start = new Date(end.getTime() - (days - 1) * 86_400_000);
  return { start: start.toISOString(), end: now.toISOString() };
}

export function activityTrend(days: number, accounts: { created_at: string }[], reviews: { created_at: string }[], now = new Date()): ActivityPoint[] {
  const { start } = analyticsWindow(days, now);
  const points = Array.from({ length: days }, (_, index) => ({ date: dayKey(new Date(new Date(start).getTime() + index * 86_400_000)), accounts: 0, reviews: 0 }));
  const byDay = new Map(points.map((point) => [point.date, point]));
  for (const [field, rows] of [["accounts", accounts], ["reviews", reviews]] as const) {
    for (const row of rows) {
      const date = new Date(row.created_at);
      if (!Number.isFinite(date.getTime()) || date > now) continue;
      const point = byDay.get(dayKey(date));
      if (point) point[field]++;
    }
  }
  return points;
}
