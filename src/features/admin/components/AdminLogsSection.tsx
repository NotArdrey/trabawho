import { useMemo, useState } from "react";
import { ClipboardList, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DataPagination } from "@/components/ui/data-pagination";
import { SearchFilterBar } from "@/components/ui/search-filter-bar";
import { fetchAdminAuditFeed } from "../services/adminAuditService";
import { useAdminResource } from "../hooks/useAdminResource";
import { AdminAuditEventCard } from "./AdminAuditEventCard";

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
    {entries.length ? <ol className="space-y-3">{entries.map((entry) => <li key={entry.id}><AdminAuditEventCard entry={entry} /></li>)}</ol> : <Card><CardContent className="space-y-2 p-6"><ClipboardList aria-hidden="true" className="size-8 text-primary" /><h2 className="font-semibold">{isLoading ? "Loading audit history" : error ? "Audit history unavailable" : "No matching audit events"}</h2><p className="text-sm text-muted-foreground">{error ? "Use Refresh logs to retry." : search || source !== "all" ? "Clear the search or choose All activity." : "Recorded activity available to your account will appear here."}</p></CardContent></Card>}
    <DataPagination label="Audit log pages" page={currentPage} pageCount={lastPage} onPageChange={setPage} />
    {isLoading && data && <p role="status" className="text-sm text-muted-foreground">Refreshing audit history…</p>}
  </section>;
}
