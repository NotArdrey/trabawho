import { useState } from "react";
import { RefreshCw, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DataPagination } from "@/components/ui/data-pagination";
import { SearchFilterBar } from "@/components/ui/search-filter-bar";
import { WorkflowEmptyState } from "@/components/ui/workflow-panel";
import { useIdentityReviews } from "@/features/admin/hooks/useIdentityReviews";
import { IdentityReviewCard } from "./IdentityReviewCard";
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
    <form aria-label="Search identity reviews" onSubmit={(event) => { event.preventDefault(); setQuery((current) => ({ ...current, page: 1, search: search.trim() })); }}>
      <SearchFilterBar searchLabel="Search applicant email" showSearchLabel searchPlaceholder="Search applicant email…" searchValue={search}
        onSearchValueChange={(value) => { setSearch(value); if (!value) setQuery((current) => ({ ...current, page: 1, search: "" })); }}
        activeValue={query.status} onActiveValueChange={(value) => setQuery((current) => ({ ...current, status: value as IdentityFilter, page: 1 }))}
        filterLabel="Review status" options={[{ value: "PENDING_REVIEW", label: "Pending review" }, { value: "APPROVED", label: "Approved" }, { value: "DECLINED", label: "Rejected" }, { value: "all", label: "All reviews" }]}
        resultLabel={state.loading ? "Loading reviews…" : state.error ? "Reviews unavailable" : result ? `${result.total} ${result.total === 1 ? "review" : "reviews"} found` : undefined}
        endControl={<Button type="submit" className="w-full lg:w-auto">Search reviews</Button>} />
    </form>
    {state.loading && <p role="status">Loading identity reviews…</p>}
    {state.error && <div role="alert" className="space-y-3 rounded-lg border border-destructive/30 p-4"><p>{state.error}</p><Button onClick={state.refresh}>Retry loading queue</Button></div>}
    {result && <>
      {!result.items.length && <Card className="overflow-hidden shadow-none"><WorkflowEmptyState icon={ShieldCheck} tone="primary" className="bg-primary/5" title="No matching identity reviews" description={query.status === "PENDING_REVIEW" && !query.search ? "New manual uploads and flagged Didit registrations will appear here. Choose another status to review past decisions." : "No reviews match this email and status. Try another status or email."} /></Card>}
      <div className="grid gap-4 lg:grid-cols-2">{result.items.map((item) => <IdentityReviewCard key={item.id} review={item} onOpen={setSelected} />)}</div>
      <DataPagination label="Identity review pages" page={query.page} pageCount={Math.max(1, Math.ceil(result.total / result.pageSize))} onPageChange={(page) => setQuery((current) => ({ ...current, page }))} />
    </>}
    {selected && <IdentityReviewDialog key={selected} reviewId={selected} onClose={() => setSelected(null)} onSaved={state.refresh} />}
  </section>;
}
