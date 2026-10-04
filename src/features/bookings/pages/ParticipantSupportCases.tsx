import { useEffect, useState } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, LifeBuoy, MessageCircle, RefreshCw } from "lucide-react";
import { paths } from "@/app/router/routes";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SearchFilterBar } from "@/components/ui/search-filter-bar";
import { WorkflowEmptyState, WorkflowPanel } from "@/components/ui/workflow-panel";
import DashboardNavigation, { type DashboardNavigationProps } from "@/shared/components/DashboardNavigation";
import { useParticipantSupportCases } from "../hooks/useParticipantSupportCases";
import { ParticipantCaseDetail } from "../components/ParticipantCaseDetail";

export function ParticipantSupportCases(props: DashboardNavigationProps) {
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  const [search, setSearch] = useState("");
  const { items, loading, error, refresh } = useParticipantSupportCases(props.sellerProfile?.userId || props.sellerProfile?.user_id);
  const filter = params.get("status") || "all";
  const selectedId = params.get("case");
  const selectedItem = selectedId ? items.find((item) => item.report.id === selectedId) : undefined;
  const selectedCaseId = selectedItem?.report.id;
  useEffect(() => {
    if (!selectedCaseId || location.hash !== "#case-conversation") return;
    const frame = window.requestAnimationFrame(() => {
      const target = document.getElementById("case-conversation");
      target?.scrollIntoView({ block: "start" });
      target?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [selectedCaseId, location.hash, location.key]);
  const visible = items.filter(({ report, serviceTitle, counterpartName }) => {
    if (filter === "active" && report.status === "closed" || filter === "closed" && report.status !== "closed") return false;
    const query = search.trim().toLowerCase();
    return !query || [report.id, report.booking_id, report.reason, serviceTitle, counterpartName].some((value) => value.toLowerCase().includes(query));
  });
  const updateParams = (key: string, value: string | null) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value); else next.delete(key);
    setParams(next);
  };
  return <div className="min-h-screen bg-background text-foreground">
    <DashboardNavigation {...props} currentView="support-cases" />
    <main className="min-w-0 px-4 pb-24 pt-24 sm:px-6 min-[881px]:ml-[248px] min-[881px]:pb-10">
      <div className="mx-auto max-w-5xl space-y-5">
        {selectedId && <Button type="button" variant="ghost" onClick={() => updateParams("case", null)}><ArrowLeft aria-hidden="true" />Back to support cases</Button>}
        {selectedId && !loading && !error && !selectedItem && <div role="alert" className="rounded-xl border bg-card p-6"><p className="font-semibold">This case is not available to your account.</p><p className="mt-1 text-sm text-muted-foreground">Check that you signed in with the account on the booking, or return to your cases.</p></div>}
        {selectedItem && <div className="grid gap-4"><header><h1 className="text-2xl font-bold">{selectedItem.serviceTitle} support case</h1><p className="mt-1 text-sm text-muted-foreground">{selectedItem.report.case_type.replaceAll("_", " ")} · Reported {new Date(selectedItem.report.created_at).toLocaleString("en-PH")}</p></header><ParticipantCaseDetail item={selectedItem} onUpdated={() => { void refresh(); }} /></div>}
        {!selectedId && <>
        <header className="flex flex-wrap items-start justify-between gap-3"><div><h1 className="text-3xl font-bold">Support cases</h1><p className="mt-2 text-sm text-muted-foreground">Track disputes and reported problems for services you booked or provided.</p></div><Button variant="outline" disabled={loading} onClick={() => { void refresh(); }}><RefreshCw aria-hidden="true" />Refresh cases</Button></header>
        <p className="text-sm text-muted-foreground">Open a case to review the report, support updates, rework steps, and refund progress.</p>
        {loading && !items.length && <p role="status" className="rounded-xl border bg-card p-5 text-sm text-muted-foreground">Loading support cases…</p>}
        {error && <div role="alert" className="grid gap-2 rounded-lg bg-destructive/10 p-4 text-sm text-destructive"><p>{error}</p><Button variant="outline" className="w-fit" onClick={() => { void refresh(); }}>Retry loading cases</Button></div>}
        <SearchFilterBar searchLabel="Search support cases" searchPlaceholder="Search service, participant or reference" searchValue={search} onSearchValueChange={setSearch}
          activeValue={filter} onActiveValueChange={(value) => updateParams("status", value)} options={[
            { value: "all", label: "All cases", count: items.length },
            { value: "active", label: "Active", count: items.filter((item) => item.report.status !== "closed").length },
            { value: "closed", label: "Closed", count: items.filter((item) => item.report.status === "closed").length },
          ]} resultLabel={`Showing ${visible.length} of ${items.length} cases`} />
        {!loading && !error && !items.length && <WorkflowEmptyState className="rounded-xl border bg-card" title="No support cases yet" icon={LifeBuoy}
          description="Cases appear only for bookings on this signed-in account. If you reported from another account, switch accounts. To open a new case, choose Report a problem on the booking."
          action={<Button asChild><Link to={props.sellerProfile?.role === "worker" ? paths.workerBookings : paths.bookings}>View bookings<ArrowRight aria-hidden="true" /></Link></Button>} />}
        {items.length > 0 && !visible.length && <WorkflowEmptyState className="rounded-xl border bg-card" title="No matching support cases" icon={LifeBuoy} description="Try another search or case status." />}
        {visible.map((item) => {
          const { report } = item;
          const selected = selectedId === report.id;
          return <WorkflowPanel key={report.id} title={item.serviceTitle} icon={LifeBuoy} tone={report.status === "closed" ? "success" : "primary"}
            description={`${item.viewerRole === "client" ? "Provider" : "Client"}: ${item.counterpartName}`} contentClassName="grid gap-4 p-4 sm:p-5"
            status={<div className="flex items-center gap-2">{item.unreadCount > 0 && <Badge variant="brand">{item.unreadCount} new update{item.unreadCount === 1 ? "" : "s"}</Badge>}<Badge variant={report.status === "closed" ? "success" : report.status === "open" ? "warning" : "default"}>{report.status.replaceAll("_", " ")}</Badge></div>}>
            <div className="grid gap-2"><p className="text-xs font-semibold capitalize text-muted-foreground">{report.case_type.replaceAll("_", " ")}</p><p className="whitespace-pre-wrap text-sm leading-6">{report.reason}</p>
              <p className="text-xs text-muted-foreground">Reported {new Date(report.created_at).toLocaleString("en-PH", { timeZone: "Asia/Manila", dateStyle: "medium", timeStyle: "short" })}</p>
              <p className="break-all text-xs text-muted-foreground">Booking reference: {report.booking_id}</p></div>
            {report.status === "closed" && <p className="text-sm font-medium">This support case is closed.</p>}
            <div className="flex flex-wrap gap-2"><Button aria-expanded={selected} onClick={() => updateParams("case", selected ? null : report.id)}>{selected ? "Hide case details" : "View support case"}<ArrowRight aria-hidden="true" /></Button>
              <Button asChild variant="outline"><Link to={`${paths.messages}/${report.booking_id}`}><MessageCircle aria-hidden="true" />Message {item.viewerRole === "client" ? "provider" : "client"}</Link></Button></div>
          </WorkflowPanel>;
        })}
        </>}
      </div>
    </main>
  </div>;
}
