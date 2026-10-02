import { useMemo, useState } from "react";
import { ClipboardList, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { SearchFilterBar } from "@/components/ui/search-filter-bar";
import { fetchAdminAuditFeed } from "../services/adminAuditService";
import { useAdminResource } from "../hooks/useAdminResource";

const PAGE_SIZE = 15;
const sourceLabels = { bookings: "Booking", support: "Support follow-up", identity: "Identity review" };
export default function AdminLogsSection() {
  const { data, isLoading, error, refresh } = useAdminResource(fetchAdminAuditFeed);
  const [search, setSearch] = useState("");
  const [source, setSource] = useState("all");
  const [page, setPage] = useState(1);
  const matches = useMemo(() => (data?.entries || []).filter((entry) => {
    if (source !== "all" && entry.source !== source) return false;
    const haystack = [entry.actor, entry.actorId, entry.action, entry.target, entry.reason, entry.outcome, entry.createdAt, sourceLabels[entry.source]].join(" ").toLowerCase();
    return search.trim().toLowerCase().split(/\s+/).every((word) => haystack.includes(word));
  }), [data, source, search]);
  const lastPage = Math.max(1, Math.ceil(matches.length / PAGE_SIZE));
  const currentPage = Math.min(page, lastPage);
  const offset = (currentPage - 1) * PAGE_SIZE;
  const entries = matches.slice(offset, offset + PAGE_SIZE);
  return <section className="space-y-5" aria-labelledby="admin-audit-title" aria-busy={isLoading}>
    <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-sm font-semibold text-primary">Admin workspace</p><h1 id="admin-audit-title" className="mt-1 text-3xl font-bold">Audit logs</h1><p className="mt-2 text-sm text-muted-foreground">Recorded booking transitions, admin support follow-ups, and identity decisions. Account and review-moderation actions are not recorded in these feeds.</p></div><Button variant="outline" disabled={isLoading} onClick={() => { void refresh(); }}><RefreshCw aria-hidden="true" />Refresh logs</Button></div>
    {error && <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">{error}</p>}
    {!!data?.unavailable.length && <p role="status" className="text-sm text-destructive">History is incomplete: {data.unavailable.join(", ")} could not be loaded. Refresh to retry.</p>}
    <SearchFilterBar searchLabel="Search loaded audit logs" searchPlaceholder="Search actor, action, target, reason or outcome" searchValue={search} onSearchValueChange={(value) => { setSearch(value); setPage(1); }} activeValue={source} onActiveValueChange={(value) => { setSource(value); setPage(1); }} options={[{ value: "all", label: "All activity" }, { value: "bookings", label: "Bookings" }, { value: "support", label: "Support" }, { value: "identity", label: "Identity" }]} resultLabel={isLoading && !data ? "Loading audit logs…" : `${matches.length} matching recorded events`} />
    <p className="text-xs text-muted-foreground">Search covers the latest 500 records per source available to your admin account.{!!data?.cappedSources.length && ` Older history is outside this view for: ${data.cappedSources.join(", ")}.`} Times are shown in Philippine time.</p>
    {entries.length ? <ol className="space-y-3">{entries.map((entry) => <li key={entry.id}><Card><CardContent className="space-y-3 p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-2"><div className="min-w-0"><Badge variant="secondary">{sourceLabels[entry.source]}</Badge><h2 className="mt-2 break-words font-semibold capitalize">{entry.action}</h2><p className="mt-1 break-words text-sm">{entry.actor}</p></div><time dateTime={entry.createdAt} className="text-xs text-muted-foreground">{new Date(entry.createdAt).toLocaleString("en-PH", { timeZone: "Asia/Manila", dateStyle: "medium", timeStyle: "short" })}</time></div>
      <dl className="grid gap-3 text-sm sm:grid-cols-2"><div className="min-w-0"><dt className="text-xs font-medium text-muted-foreground">Target reference</dt><dd className="mt-1 break-all">{entry.target}</dd></div><div><dt className="text-xs font-medium text-muted-foreground">Recorded outcome</dt><dd className="mt-1 break-words">{entry.outcome}</dd></div></dl>
      {entry.reason && <p className="whitespace-pre-wrap break-words border-t pt-3 text-sm">{entry.reason}</p>}
    </CardContent></Card></li>)}</ol> : <Card><CardContent className="space-y-2 p-6"><ClipboardList aria-hidden="true" className="size-8 text-primary" /><h2 className="font-semibold">{isLoading ? "Loading audit history" : error ? "Audit history unavailable" : "No matching audit events"}</h2><p className="text-sm text-muted-foreground">{error ? "Use Refresh logs to retry." : search || source !== "all" ? "Clear the search or choose All activity." : "Recorded activity available to your account will appear here."}</p></CardContent></Card>}
    {matches.length > PAGE_SIZE && <nav aria-label="Audit log pages" className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-muted-foreground">Page {currentPage} of {lastPage}</p><div className="flex gap-2"><Button variant="outline" disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)}>Previous</Button><Button variant="outline" disabled={currentPage >= lastPage} onClick={() => setPage(currentPage + 1)}>Next</Button></div></nav>}
    {isLoading && data && <p role="status" className="text-sm text-muted-foreground">Refreshing audit history…</p>}
  </section>;
}
