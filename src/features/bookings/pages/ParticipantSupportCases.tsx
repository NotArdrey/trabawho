import { useState } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, Bell, CalendarCheck2, LifeBuoy, MessageCircle, RefreshCw } from "lucide-react";
import { paths } from "@/app/router/routes";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataPagination } from "@/components/ui/data-pagination";
import { SearchFilterBar } from "@/components/ui/search-filter-bar";
import { WorkflowEmptyState, WorkflowPanel } from "@/components/ui/workflow-panel";
import DashboardNavigation, { type DashboardNavigationProps } from "@/shared/components/DashboardNavigation";
import { useTemporaryTargetHighlight } from "@/shared/hooks/useTemporaryTargetHighlight";
import { useParticipantSupportCases } from "../hooks/useParticipantSupportCases";
import { ParticipantCaseDetail } from "../components/ParticipantCaseDetail";

const PAGE_SIZE = 8;

const visitDate = (value: string) => new Date(value).toLocaleDateString("en-PH", {
  timeZone: "Asia/Manila", weekday: "long", year: "numeric", month: "long", day: "numeric",
});
const visitTime = (value: string) => new Date(value).toLocaleTimeString("en-PH", {
  timeZone: "Asia/Manila", hour: "numeric", minute: "2-digit",
});

export function ParticipantSupportCases(props: DashboardNavigationProps) {
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  const [search, setSearch] = useState("");
  const { items, loading, error, refresh } = useParticipantSupportCases(props.sellerProfile?.userId || props.sellerProfile?.user_id);
  const filter = params.get("status") || "all";
  const selectedId = params.get("case");
  const selectedItem = selectedId ? items.find((item) => item.report.id === selectedId) : undefined;
  const selectedCaseId = selectedItem?.report.id;
  const highlightConversation = useTemporaryTargetHighlight(
    "case-conversation", Boolean(selectedCaseId && location.hash === "#case-conversation"), location.key, "start",
  );
  const visible = items.filter(({ report, serviceTitle, counterpartName }) => {
    if (filter === "active" && report.status === "closed" || filter === "closed" && report.status !== "closed") return false;
    const query = search.trim().toLowerCase();
    return !query || [report.id, report.booking_id, report.reason, serviceTitle, counterpartName].some((value) => value.toLowerCase().includes(query));
  });
  const pageCount = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const requestedPage = Number(params.get("page"));
  const currentPage = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? Math.min(requestedPage, pageCount) : 1;
  const pagedCases = visible.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const updateParams = (key: string, value: string | null) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value); else next.delete(key);
    setParams(next);
  };
  const changeFilter = (key: string, value: string | null) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value); else next.delete(key);
    next.delete("page");
    setParams(next);
  };
  return <div className="min-h-screen bg-background text-foreground">
    <DashboardNavigation {...props} currentView="support-cases" />
    <main className="min-w-0 px-4 pb-24 pt-24 sm:px-6 min-[881px]:ml-[248px] min-[881px]:pb-10">
      <div className="mx-auto max-w-5xl space-y-5">
        {selectedId && <Button type="button" variant="ghost" onClick={() => updateParams("case", null)}><ArrowLeft aria-hidden="true" />Back to support cases</Button>}
        {selectedId && !loading && !error && !selectedItem && <div role="alert" className="rounded-xl border bg-card p-6"><p className="font-semibold">This case is not available to your account.</p><p className="mt-1 text-sm text-muted-foreground">Check that you signed in with the account on the booking, or return to your cases.</p></div>}
        {selectedItem && <div className="grid gap-4"><header><h1 className="text-2xl font-bold">{selectedItem.serviceTitle} support case</h1><p className="mt-1 text-sm text-muted-foreground">{selectedItem.report.case_type.replaceAll("_", " ")} · Reported {new Date(selectedItem.report.created_at).toLocaleString("en-PH")}</p></header><ParticipantCaseDetail item={selectedItem} highlightConversation={highlightConversation} onUpdated={() => { void refresh(); }} /></div>}
        {!selectedId && <>
        <header className="flex flex-wrap items-start justify-between gap-3"><div><h1 className="text-3xl font-bold">Support cases</h1><p className="mt-2 text-sm text-muted-foreground">Track disputes and reported problems for services you booked or provided.</p></div><Button variant="outline" disabled={loading} onClick={() => { void refresh(); }}><RefreshCw aria-hidden="true" />Refresh cases</Button></header>
        <p className="text-sm text-muted-foreground">Open a case to review the report, support updates, rework steps, and refund progress.</p>
        {loading && !items.length && <p role="status" className="rounded-xl border bg-card p-5 text-sm text-muted-foreground">Loading support cases…</p>}
        {error && <div role="alert" className="grid gap-2 rounded-lg bg-destructive/10 p-4 text-sm text-destructive"><p>{error}</p><Button variant="outline" className="w-fit" onClick={() => { void refresh(); }}>Retry loading cases</Button></div>}
        <SearchFilterBar searchLabel="Search support cases" searchPlaceholder="Search service, participant or reference" searchValue={search} onSearchValueChange={(value) => { setSearch(value); changeFilter("page", null); }}
          activeValue={filter} onActiveValueChange={(value) => changeFilter("status", value)} options={[
            { value: "all", label: "All cases", count: items.length },
            { value: "active", label: "Active", count: items.filter((item) => item.report.status !== "closed").length },
            { value: "closed", label: "Closed", count: items.filter((item) => item.report.status === "closed").length },
          ]} resultLabel={`Showing ${visible.length ? (currentPage - 1) * PAGE_SIZE + 1 : 0}–${Math.min(currentPage * PAGE_SIZE, visible.length)} of ${visible.length} matching cases`} />
        {!loading && !error && !items.length && <WorkflowEmptyState className="rounded-xl border bg-card" title="No support cases yet" icon={LifeBuoy}
          description="Cases appear only for bookings on this signed-in account. If you reported from another account, switch accounts. To open a new case, choose Report a problem on the booking."
          action={<Button asChild><Link to={props.sellerProfile?.role === "worker" ? paths.workerBookings : paths.bookings}>View bookings<ArrowRight aria-hidden="true" /></Link></Button>} />}
        {items.length > 0 && !visible.length && <WorkflowEmptyState className="rounded-xl border bg-card" title="No matching support cases" icon={LifeBuoy} description="Try another search or case status." />}
        {pagedCases.map((item) => {
          const { report } = item;
          const selected = selectedId === report.id;
          const replacementStatus = report.resolution_status === "replacement_accepted"
            ? "Replacement visit confirmed"
            : report.resolution_status === "replacement_proposed" ? "Replacement time proposed" : null;
          return <WorkflowPanel key={report.id} title={item.serviceTitle} icon={LifeBuoy} tone={report.status === "closed" || report.resolution_status === "replacement_accepted" ? "success" : "primary"}
            className={item.unreadCount > 0 ? "border-primary/40" : undefined}
            description={`${item.viewerRole === "client" ? "Provider" : "Client"}: ${item.counterpartName}`} contentClassName="grid gap-4 p-4 sm:p-5"
            status={<div className="flex flex-col items-end gap-1 sm:flex-row sm:items-center sm:gap-2">{item.unreadCount > 0 && <Badge variant="brand">{item.unreadCount} new update{item.unreadCount === 1 ? "" : "s"}</Badge>}<Badge variant={report.status === "closed" || report.resolution_status === "replacement_accepted" ? "success" : report.status === "open" ? "warning" : "default"}>{replacementStatus || report.status.replaceAll("_", " ")}</Badge></div>}>
            {item.unreadCount > 0 && <div className="flex items-start gap-2 rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm font-medium text-primary"><Bell className="mt-0.5 size-4 shrink-0" aria-hidden="true" /><p>This case has {item.unreadCount} new update{item.unreadCount === 1 ? "" : "s"}. Open it to read what changed.</p></div>}
            <div className="grid gap-2"><p className="text-xs font-semibold capitalize text-muted-foreground">{report.case_type.replaceAll("_", " ")}</p><p className="whitespace-pre-wrap text-sm leading-6">{report.reason}</p>
              <p className="text-xs text-muted-foreground">Reported {new Date(report.created_at).toLocaleString("en-PH", { timeZone: "Asia/Manila", dateStyle: "medium", timeStyle: "short" })}</p>
              <p className="break-all text-xs text-muted-foreground">Booking reference: {report.booking_id}</p></div>
            {report.resolution_status === "replacement_accepted" && <section aria-label="Confirmed replacement visit" className="flex gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm dark:border-emerald-900 dark:bg-emerald-950/30">
              <CalendarCheck2 className="mt-0.5 size-5 shrink-0 text-emerald-700 dark:text-emerald-300" aria-hidden="true" />
              <div className="min-w-0"><h3 className="font-semibold text-emerald-900 dark:text-emerald-100">Your new visit</h3>
                {item.replacementSchedule ? <><p className="mt-1 font-semibold text-foreground">{visitDate(item.replacementSchedule.startAt)}</p><p className="font-semibold text-foreground">{visitTime(item.replacementSchedule.startAt)}–{visitTime(item.replacementSchedule.endAt)} PHT</p><p className="mt-1 text-muted-foreground">Both participants accepted this new schedule. No additional payment is due.</p></>
                  : <p className="mt-1 text-muted-foreground">Both participants accepted. The confirmed time could not be displayed right now; refresh cases to try again.</p>}
              </div>
            </section>}
            {report.resolution_status === "replacement_proposed" && <p className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm font-medium text-primary">A replacement time was proposed. Both participants need to accept before it is confirmed.</p>}
            {report.status === "closed" && <p className="text-sm font-medium">This support case is closed.</p>}
            <div className="flex flex-wrap gap-2"><Button aria-expanded={selected} onClick={() => updateParams("case", selected ? null : report.id)}>{selected ? "Hide case details" : "View support case"}<ArrowRight aria-hidden="true" /></Button>
              <Button asChild variant="outline"><Link to={`${paths.messages}/${report.booking_id}`}><MessageCircle aria-hidden="true" />Message {item.viewerRole === "client" ? "provider" : "client"}</Link></Button></div>
          </WorkflowPanel>;
        })}
        <DataPagination label="Support case pages" page={currentPage} pageCount={pageCount} onPageChange={(page) => updateParams("page", String(page))} />
        </>}
      </div>
    </main>
  </div>;
}
