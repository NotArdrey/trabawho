import { useState } from "react";
import { RefreshCw, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataPagination } from "@/components/ui/data-pagination";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useIdentityReviews } from "@/features/admin/hooks/useIdentityReviews";
import { IdentityReviewDialog } from "./IdentityReviewDialog";
import type { IdentityFilter, IdentityQuery } from "./types";

export default function AdminIdentityReviews() {
  const [query, setQuery] = useState<IdentityQuery>({ page: 1, status: "PENDING_REVIEW", search: "" });
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const state = useIdentityReviews(query);
  const result = state.data;
  return <section aria-labelledby="identity-reviews-title" className="space-y-5">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h1 id="identity-reviews-title" className="text-3xl font-bold">Identity reviews</h1><p className="mt-2 text-sm text-muted-foreground">Review manual uploads and Didit cases awaiting an identity decision.</p></div><Button variant="outline" onClick={state.refresh}><RefreshCw aria-hidden="true" />Refresh queue</Button></div>
    <form className="flex flex-wrap items-end gap-3 rounded-lg border p-4" onSubmit={(event) => { event.preventDefault(); setQuery((current) => ({ ...current, page: 1, search: search.trim() })); }}>
      <div className="min-w-0 flex-1 space-y-2"><Label htmlFor="identity-search">Search applicant email</Label><Input id="identity-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Email address" /></div>
      <div className="w-full space-y-2 sm:w-48"><Label htmlFor="identity-status">Review status</Label><Select value={query.status} onValueChange={(status: IdentityFilter) => setQuery((current) => ({ ...current, status, page: 1 }))}><SelectTrigger id="identity-status"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="PENDING_REVIEW">Pending review</SelectItem><SelectItem value="APPROVED">Approved</SelectItem><SelectItem value="DECLINED">Rejected</SelectItem><SelectItem value="all">All reviews</SelectItem></SelectContent></Select></div><Button type="submit">Search reviews</Button>
    </form>
    {state.loading && <p role="status">Loading identity reviews…</p>}
    {state.error && <div role="alert" className="space-y-3 rounded-lg border border-destructive/30 p-4"><p>{state.error}</p><Button onClick={state.refresh}>Retry loading queue</Button></div>}
    {result && <>
      <p className="text-sm text-muted-foreground">{result.total} {result.total === 1 ? "review" : "reviews"} found</p>
      {!result.items.length && <div className="space-y-2 rounded-lg border p-6"><ShieldCheck aria-hidden="true" className="text-primary" /><h2 className="text-lg font-semibold">No matching identity reviews</h2><p className="text-sm text-muted-foreground">New manual uploads and flagged Didit registrations will appear here. Try another status or email.</p></div>}
      <div className="grid gap-4 lg:grid-cols-2">{result.items.map((item) => <article key={item.id} className="min-w-0 space-y-3 rounded-xl border bg-background p-4">
        <div className="flex flex-wrap items-start justify-between gap-2"><h2 className="min-w-0 break-words text-lg font-semibold">{item.verified_full_legal_name || "Applicant"}</h2><Badge variant={item.status === "APPROVED" ? "success" : item.status === "DECLINED" ? "destructive" : "warning"}>{item.status.replaceAll("_", " ").toLowerCase()}</Badge></div>
        <p className="break-all text-sm">{item.submitted_by_email}</p><p className="text-sm">{item.document_type} · {item.source === "MANUAL_UPLOAD" ? "Manual upload" : "Didit"}</p><p className="text-xs text-muted-foreground">Submitted {new Date(item.created_at).toLocaleString("en-PH")}</p>
        {item.duplicate_reason && <p className="text-sm font-semibold">Duplicate identity needs review</p>}
        {item.status === "APPROVED" && <p className="text-sm">Confirmation email: {item.email_delivery_status.replaceAll("_", " ")}</p>}
        <Button className="w-full sm:w-auto" onClick={() => setSelected(item.id)}>{item.status === "PENDING_REVIEW" ? "Review identity" : "View identity decision"}</Button>
      </article>)}</div>
      <DataPagination label="Identity review pages" page={query.page} pageCount={Math.max(1, Math.ceil(result.total / result.pageSize))} onPageChange={(page) => setQuery((current) => ({ ...current, page }))} />
    </>}
    {selected && <IdentityReviewDialog key={selected} reviewId={selected} onClose={() => setSelected(null)} onSaved={state.refresh} />}
  </section>;
}
