import { supabase } from "@/integrations/supabase";
import { analyticsWindow, activityTrend } from "../domain/adminAnalytics";
import { requireAdminReadAccess } from "./adminAccess";
import type { AdminAnalyticsData } from "../types/admin-activity";

async function accountActivity(start: string, end: string) {
  const rows: { created_at: string }[] = [];
  for (let offset = 0; ; offset += 1000) {
    const result = await supabase.from("profiles").select("user_id, created_at").gte("created_at", start).lte("created_at", end)
      .order("created_at").order("user_id").range(offset, offset + 999);
    if (result.error) return { data: null, error: true };
    rows.push(...result.data);
    if (result.data.length < 1000) return { data: rows, error: false };
  }
}
async function reviewActivity(start: string, end: string) {
  const rows: { created_at: string; rating: number }[] = [];
  for (let offset = 0; ; offset += 1000) {
    const result = await supabase.from("reviews").select("id, created_at, rating").or("published.eq.true,published.is.null")
      .gte("created_at", start).lte("created_at", end).order("created_at").order("id").range(offset, offset + 999);
    if (result.error) return { data: null, error: true };
    rows.push(...result.data);
    if (result.data.length < 1000) return { data: rows, error: false };
  }
}
export async function fetchAdminAnalytics(days: number): Promise<AdminAnalyticsData> {
  await requireAdminReadAccess();
  const now = new Date();
  const { start, end } = analyticsWindow(days, now);
  const [accounts, reviews, services, cases] = await Promise.all([
    accountActivity(start, end), reviewActivity(start, end),
    supabase.from("services").select("id", { count: "exact", head: true }).eq("active", true),
    supabase.from("booking_support_cases").select("id", { count: "exact", head: true }).in("status", ["open", "under_review"]),
  ]);
  const unavailable = [accounts.error && "New accounts", reviews.error && "Published reviews", services.error && "Active services", cases.error && "Open support cases"].filter((value): value is string => Boolean(value));
  if (unavailable.length === 4) throw new Error("Analytics could not be loaded. Check your connection and retry.");
  return { days, newAccounts: accounts.data?.length ?? null, activeServices: services.error ? null : services.count,
    publishedReviews: reviews.data?.length ?? null, averageRating: reviews.data?.length ? reviews.data.reduce((sum, row) => sum + row.rating, 0) / reviews.data.length : null,
    openCases: cases.error ? null : cases.count, trend: activityTrend(days, accounts.data || [], reviews.data || [], now), unavailable, updatedAt: now.toISOString() };
}
