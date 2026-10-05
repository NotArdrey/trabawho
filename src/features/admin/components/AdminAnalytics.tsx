import { useCallback, useState } from "react";
import { BriefcaseBusiness, Inbox, RefreshCw, Star, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MetricCard } from "@/components/ui/metric-card";
import { SelectField } from "@/components/forms";
import { fetchAdminAnalytics } from "../services/adminAnalyticsService";
import { useAdminResource } from "../hooks/useAdminResource";
import { AdminActivityChart } from "./AdminActivityChart";

export default function AdminAnalytics({ loadAnalytics = fetchAdminAnalytics }: { loadAnalytics?: typeof fetchAdminAnalytics } = {}) {
  const [days, setDays] = useState(30);
  const load = useCallback(() => loadAnalytics(days), [days, loadAnalytics]);
  const { data, isLoading, error, refresh } = useAdminResource(load);
  const current = data?.days === days ? data : null;
  const display = (value: number | null | undefined) => value == null ? isLoading ? "…" : "Unavailable" : value.toLocaleString("en-PH");

  return <div className="space-y-6" aria-busy={isLoading}>
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div><p className="text-sm font-semibold text-primary">Admin workspace</p><h1 className="mt-1 text-3xl font-bold tracking-tight">Analytics</h1><p className="mt-2 max-w-2xl text-muted-foreground">Track registrations and published feedback over time. Current inventory appears separately below.</p></div>
      <div className="flex flex-wrap items-end gap-2"><SelectField id="analytics-period" label="Period" value={String(days)} onValueChange={(value) => setDays(Number(value))} options={[{ value: "7", label: "Last 7 days" }, { value: "30", label: "Last 30 days" }, { value: "90", label: "Last 90 days" }]} /><Button type="button" variant="outline" disabled={isLoading} onClick={() => { void refresh(); }}><RefreshCw aria-hidden="true" />Refresh analytics</Button></div>
    </div>
    {error && <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">{error}</p>}
    {!!current?.unavailable.length && <p role="status" className="text-sm text-muted-foreground">Some analytics are unavailable: {current.unavailable.join(", ")}. Refresh to retry.</p>}
    <section aria-labelledby="period-activity-heading" className="space-y-3">
      <div><h2 id="period-activity-heading" className="text-lg font-bold">Activity in the last {days} days</h2><p className="text-sm text-muted-foreground">New accounts and published reviews by creation date, in Philippine time.</p></div>
      <div className="grid gap-3 sm:grid-cols-3">
        <MetricCard icon={UserPlus} label="New accounts" value={display(current?.newAccounts)} detail="Registered in this period" tone="blue" />
        <MetricCard icon={Star} label="Published reviews" value={display(current?.publishedReviews)} detail="Created in this period" tone="orange" />
        <MetricCard icon={Star} label="Average review rating" value={current?.averageRating != null ? `${current.averageRating.toFixed(1)} / 5` : isLoading ? "…" : current?.publishedReviews === 0 ? "—" : "Unavailable"} detail={current?.publishedReviews === 0 ? "No published reviews in this period" : "For reviews in this period"} tone="neutral" />
      </div>
      {current && <div className="grid gap-4 lg:grid-cols-2"><AdminActivityChart title="Account registrations" points={current.trend} series="accounts" unavailable={current.newAccounts === null} /><AdminActivityChart title="Published reviews" points={current.trend} series="reviews" unavailable={current.publishedReviews === null} /></div>}
    </section>
    <section aria-labelledby="current-inventory-heading" className="space-y-3">
      <div><h2 id="current-inventory-heading" className="text-lg font-bold">Current inventory</h2><p className="text-sm text-muted-foreground">Live totals across all dates; changing the period does not affect these figures.</p></div>
      <div className="grid gap-3 sm:grid-cols-2">
        <MetricCard icon={BriefcaseBusiness} label="Active services" value={display(current?.activeServices)} detail="Currently active listings" tone="green" />
        <MetricCard icon={Inbox} label="Open support cases" value={display(current?.openCases)} detail="Open or under review" tone="sky" />
      </div>
    </section>
    <p className="text-xs text-muted-foreground" role="status">{isLoading ? "Refreshing analytics…" : current ? `Updated ${new Date(current.updatedAt).toLocaleString("en-PH", { timeZone: "Asia/Manila", dateStyle: "medium", timeStyle: "short" })} · Philippine time · Refreshes every 30 seconds.` : "Refresh to load analytics."}</p>
  </div>;
}
