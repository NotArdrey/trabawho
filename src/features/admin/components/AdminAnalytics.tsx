import { useCallback, useState } from "react";
import { BriefcaseBusiness, Inbox, RefreshCw, Star, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MetricCard } from "@/components/ui/metric-card";
import { SelectField } from "@/components/forms";
import { fetchAdminAnalytics } from "../services/adminAnalyticsService";
import { useAdminResource } from "../hooks/useAdminResource";
import { AdminActivityChart } from "./AdminActivityChart";

export default function AdminAnalytics({ embedded = false }: { embedded?: boolean }) {
  const [days, setDays] = useState(30);
  const load = useCallback(() => fetchAdminAnalytics(days), [days]);
  const { data, isLoading, error, refresh } = useAdminResource(load);
  const current = data?.days === days ? data : null;
  const display = (value: number | null | undefined) => value == null ? isLoading ? "…" : "Unavailable" : value.toLocaleString("en-PH");
  const Heading = embedded ? "h2" : "h1";
  return <section className="space-y-5" aria-labelledby="admin-analytics-title" aria-busy={isLoading}>
    <div className="flex flex-wrap items-start justify-between gap-4"><div><Heading id="admin-analytics-title" className={embedded ? "text-xl font-bold" : "text-3xl font-bold"}>Analytics</Heading><p className="mt-1 text-sm text-muted-foreground">Account and review activity for the selected period; service and case totals reflect the current state.</p></div>
      <div className="flex flex-wrap items-end gap-2"><SelectField id="analytics-period" label="Period" value={String(days)} onValueChange={(value) => setDays(Number(value))} options={[{ value: "7", label: "Last 7 days" }, { value: "30", label: "Last 30 days" }, { value: "90", label: "Last 90 days" }]} /><Button variant="outline" disabled={isLoading} onClick={() => { void refresh(); }}><RefreshCw aria-hidden="true" />Refresh analytics</Button></div>
    </div>
    {error && <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">{error}</p>}
    {!!current?.unavailable.length && <p role="status" className="text-sm text-muted-foreground">Some analytics are unavailable: {current.unavailable.join(", ")}. Refresh to retry.</p>}
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <MetricCard icon={UserPlus} label="New accounts" value={display(current?.newAccounts)} detail={`Last ${days} days`} tone="blue" />
      <MetricCard icon={BriefcaseBusiness} label="Active services" value={display(current?.activeServices)} detail="Currently active listings" tone="green" />
      <MetricCard icon={Star} label="Published reviews" value={display(current?.publishedReviews)} detail={current?.averageRating != null ? `${current.averageRating.toFixed(1)} / 5 average · Last ${days} days` : `Last ${days} days`} tone="orange" />
      <MetricCard icon={Inbox} label="Open support cases" value={display(current?.openCases)} detail="Open or under review" tone="sky" />
    </div>
    {current && <div className="grid gap-4 lg:grid-cols-2"><AdminActivityChart title="Daily account registrations" points={current.trend} series="accounts" unavailable={current.newAccounts === null} /><AdminActivityChart title="Daily published reviews" points={current.trend} series="reviews" unavailable={current.publishedReviews === null} /></div>}
    <p className="text-xs text-muted-foreground" role="status">{isLoading ? "Refreshing analytics…" : current ? `Updated ${new Date(current.updatedAt).toLocaleString("en-PH", { timeZone: "Asia/Manila", dateStyle: "medium", timeStyle: "short" })} · Philippine time · Refreshes every 30 seconds.` : "Refresh to load analytics."}</p>
  </section>;
}
