import { useEffect, useState } from "react";
import { AlertCircle, ArrowRight, CircleCheck, Clock3, Eye, Inbox, RefreshCw } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SearchFilterBar } from "@/components/ui/search-filter-bar";
import { WorkflowPanel } from "@/components/ui/workflow-panel";
import { caseNextActor } from "@/features/admin/domain/caseNextActor";
import { AdminCaseDetailDialog } from "@/features/admin/components/AdminCaseDetailDialog";
import { listSupportCases, openSupportEvidence, type SupportCase } from "@/features/admin/services/adminSupportService";

function SupportCaseCard({ item, onViewEvidence, onOpen }: { item: SupportCase; onViewEvidence: (path: string) => void; onOpen: () => void }) {
  const closed = item.status === "closed";
  const nextStep = closed ? "Case closed" : item.status === "under_review" ? "Support review in progress"
    : item.policy_route === "rework_request" ? "Provider rework requested" : "Support review needed";
  const action = <Button type="button" variant={closed ? "outline" : "primary"} onClick={onOpen}>{closed ? "View case" : "Review case"}<ArrowRight aria-hidden="true" /></Button>;
  return <WorkflowPanel className="min-w-0 shadow-sm" contentClassName="space-y-4 p-4 sm:p-5"
    title={<span className="capitalize">{item.case_type.replaceAll("_", " ")}</span>}
    description={`Reported ${new Date(item.created_at).toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short" })}`}
    tone={item.status === "open" ? "highlight" : closed ? "success" : "primary"}
    icon={item.status === "open" ? AlertCircle : closed ? CircleCheck : Clock3}
    status={<Badge variant={item.status === "open" ? "warning" : closed ? "success" : "default"}>{item.status.replaceAll("_", " ")}</Badge>}
    action={action}>
    <section className="rounded-lg bg-brand-highlight-soft/60 p-3 sm:p-4" aria-label="Reported issue">
      <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-brand-highlight-foreground">
        <AlertCircle className="size-4" aria-hidden="true" />Reported issue
      </p>
      <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-foreground">{item.reason}</p>
    </section>
    <div className="flex min-w-0 items-start gap-3 rounded-lg bg-primary/5 p-3 text-sm">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><ArrowRight className="size-4" aria-hidden="true" /></span>
      <div className="min-w-0"><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{closed ? "Current state" : "Next step"}</p>
        <p className="mt-0.5 font-semibold text-primary">{nextStep}</p>
        <p className="mt-1 text-muted-foreground">{closed ? "No further action is required." : <>Next actor: <strong className="text-foreground">{caseNextActor(item)}</strong></>}</p></div>
    </div>
    {item.policy_reason && <p className="text-xs leading-5 text-muted-foreground">{item.policy_reason}</p>}
    {item.provider_response_action && <div className="space-y-1 border-t pt-3 text-sm"><p className="font-semibold">{item.provider_response_action === "offer_rework" ? "Provider offered rework" : "Provider requested support review"}</p><p className="whitespace-pre-wrap">{item.provider_response_text}</p><p className="text-xs text-muted-foreground">{item.provider_responded_at ? new Date(item.provider_responded_at).toLocaleString("en-PH") : ""} · No remedy or payment was automatically approved.</p></div>}
    {item.rework_appointment_at && <p className="text-sm">Return visit: <strong>{new Date(item.rework_appointment_at).toLocaleString("en-PH")}</strong></p>}
    {item.rework_evidence_note && <div className="space-y-1 border-t pt-3 text-sm"><p className="font-semibold">Rework notes</p><p className="whitespace-pre-wrap">{item.rework_evidence_note}</p></div>}
    {item.storage_path && <Button type="button" variant="outline" onClick={() => onViewEvidence(item.storage_path || "")}><Eye aria-hidden="true" />View evidence</Button>}
  </WorkflowPanel>;
}

export default function AdminSupportCases() {
  const [cases, setCases] = useState<SupportCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [evidenceError, setEvidenceError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [selected, setSelected] = useState<SupportCase | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "active" | "closed">("active");

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const result = await listSupportCases();
        if (active) { setCases(result); setError(""); }
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : "Could not load support cases.");
      } finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, [refresh]);

  const openEvidence = async (path: string) => {
    setEvidenceError("");
    try { window.open(await openSupportEvidence(path), "_blank", "noopener,noreferrer"); }
    catch (cause) { setEvidenceError(cause instanceof Error ? cause.message : "The private evidence image could not be opened."); }
  };

  const visible = cases.filter((item) => {
    if (filter === "active" && item.status === "closed") return false;
    if (filter === "closed" && item.status !== "closed") return false;
    const query = search.trim().toLowerCase();
    return !query || [item.booking_id, item.case_type, item.reason].some((value) => value.toLowerCase().includes(query));
  });

  return <section className="space-y-4" aria-labelledby="support-cases-title">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h1 id="support-cases-title" className="text-2xl font-bold">Booking support cases</h1><p className="mt-1 text-sm text-muted-foreground">Review booking history and record support follow-up. Refunds and payouts are not executed here.</p></div><Button variant="outline" onClick={() => { setLoading(true); setRefresh((value) => value + 1); }}><RefreshCw aria-hidden="true" />Refresh</Button></div>
    {loading && <p role="status" className="rounded-xl border bg-card p-6 text-sm text-muted-foreground">Loading support cases…</p>}
    {error && <div role="alert" className="flex gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive"><AlertCircle className="size-4 shrink-0" aria-hidden="true" />{error}</div>}
    {evidenceError && <p role="alert" className="text-sm text-destructive">{evidenceError}</p>}
    {!loading && !error && cases.length === 0 && <div className="rounded-xl border bg-card p-8 text-center"><Inbox className="mx-auto size-8 text-muted-foreground" aria-hidden="true" /><p className="mt-2 font-semibold">No support cases yet</p><p className="text-sm text-muted-foreground">Reports submitted from booking cards will appear here.</p></div>}
    {!loading && !error && cases.length > 0 && <>
      <SearchFilterBar
        searchLabel="Search loaded support cases"
        searchPlaceholder="Search booking ID, issue or reason"
        searchValue={search}
        onSearchValueChange={setSearch}
        activeValue={filter}
        onActiveValueChange={(value) => setFilter(value as typeof filter)}
        options={[
          { value: "active", label: "Active", count: cases.filter((item) => item.status !== "closed").length },
          { value: "all", label: "All", count: cases.length },
          { value: "closed", label: "Closed", count: cases.filter((item) => item.status === "closed").length },
        ]}
        resultLabel={`Showing ${visible.length} of ${cases.length} loaded cases`}
      />
      <p className="text-xs text-muted-foreground">Search applies to loaded cases only.</p>
      {visible.length ? <div className="grid gap-3">{visible.map((item) => <SupportCaseCard key={item.id} item={item} onViewEvidence={(path) => { void openEvidence(path); }} onOpen={() => setSelected(item)} />)}</div> : <p className="rounded-xl border bg-card p-6 text-sm text-muted-foreground">No cases match this search or status.</p>}
    </>}
    <AdminCaseDetailDialog key={selected?.id || "none"} item={selected} onClose={() => setSelected(null)} onSaved={() => { setRefresh((value) => value + 1); }} />
  </section>;
}
