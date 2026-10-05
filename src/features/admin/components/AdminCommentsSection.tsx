import { MessageSquareText, Star, Trash2 } from "lucide-react";
import { SelectField } from "@/components/forms";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DataPagination } from "@/components/ui/data-pagination";
import { SearchFilterBar } from "@/components/ui/search-filter-bar";
import type { AdminComment, ReviewRatingFilter, ReviewStatusFilter } from "../types";

interface Props {
  comments: AdminComment[];
  isLoading: boolean;
  error: string;
  total: number;
  page: number;
  pageSize: number;
  search: string;
  status: ReviewStatusFilter;
  rating: ReviewRatingFilter;
  onSearchChange: (value: string) => void;
  onStatusChange: (value: ReviewStatusFilter) => void;
  onRatingChange: (value: ReviewRatingFilter) => void;
  onPageChange: (page: number) => void;
  onRetry: () => void;
  onOpenDeleteComment: (comment: AdminComment) => void;
}

const ratingOptions = [
  { value: "all", label: "All ratings" },
  { value: "5", label: "5 stars" },
  { value: "4", label: "4 stars" },
  { value: "3", label: "3 stars" },
  { value: "2", label: "2 stars" },
  { value: "1", label: "1 star" },
] as const;

function ReviewCard({ comment, onOpenDeleteComment }: Pick<Props, "onOpenDeleteComment"> & { comment: AdminComment }) {
  const published = comment.status === "published";
  const date = comment.createdAt ? new Date(comment.createdAt).toLocaleDateString("en-PH", {
    timeZone: "Asia/Manila", year: "numeric", month: "short", day: "numeric",
  }) : null;
  return <Card><CardContent className="grid min-w-0 gap-4 p-4 sm:p-5">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="flex min-w-0 items-start gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><MessageSquareText className="size-5" aria-hidden="true" /></span>
        <div className="min-w-0"><p className="text-xs font-semibold uppercase tracking-wide text-primary">Review for</p><h2 className="break-words font-semibold text-foreground">{comment.worker}</h2><p className="mt-1 break-words text-sm text-muted-foreground">By {comment.client}{date ? ` · ${date}` : ""}</p></div>
      </div>
      <div className="flex flex-wrap items-center gap-2"><Badge variant="outline" className="gap-1"><Star className="size-3.5 fill-brand-highlight text-brand-highlight" aria-hidden="true" /><span>{comment.rating} / 5 stars</span></Badge><Badge variant={published ? "success" : "warning"}>{published ? "Published" : "Unpublished"}</Badge></div>
    </div>
    <div className="rounded-lg bg-primary/5 px-4 py-3 text-sm leading-6 text-foreground dark:bg-primary/10">
      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-primary">Client feedback</p>
      <p className="whitespace-pre-wrap break-words">{comment.comment || <span className="italic text-muted-foreground">No written comment</span>}</p>
    </div>
    <div className="flex justify-end border-t border-border pt-3"><Button type="button" variant="outline" className="border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => onOpenDeleteComment(comment)}><Trash2 aria-hidden="true" />Delete review</Button></div>
  </CardContent></Card>;
}

export default function AdminCommentsSection({ comments, isLoading, error, total, page, pageSize, search, status, rating, onSearchChange, onStatusChange, onRatingChange, onPageChange, onRetry, onOpenDeleteComment }: Props) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const first = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, total);
  const hasFilters = Boolean(search.trim()) || status !== "all" || rating !== "all";
  const clearFilters = () => { onSearchChange(""); onStatusChange("all"); onRatingChange("all"); };

  return <section className="space-y-5">
    <div><p className="text-sm font-semibold text-primary">Admin workspace</p><h1 className="mt-1 text-3xl font-bold">Reviews</h1><p className="mt-2 text-muted-foreground">Find and review feedback. User reports are not available yet.</p></div>
    <SearchFilterBar searchLabel="Search written review comments" searchPlaceholder="Search written comments…" searchValue={search} onSearchValueChange={onSearchChange} activeValue={status} onActiveValueChange={(value) => onStatusChange(value as ReviewStatusFilter)} options={[{ value: "all", label: "All" }, { value: "published", label: "Published" }, { value: "unpublished", label: "Unpublished" }]} resultLabel={isLoading ? "Loading reviews…" : error ? "Reviews unavailable" : `Showing ${first}–${last} of ${total} reviews`} endControl={<SelectField id="admin-review-rating" label="Rating" labelClassName="sr-only" value={rating} onValueChange={(value) => onRatingChange(value as ReviewRatingFilter)} options={ratingOptions} className="w-full lg:w-40" />} />
    {error && <div role="alert" className="flex flex-wrap items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive"><span>{error}</span><Button type="button" variant="outline" onClick={onRetry}>Try again</Button></div>}
    {isLoading ? <Card><CardContent className="p-6 text-sm text-muted-foreground" role="status">Loading reviews…</CardContent></Card> : !error && comments.length === 0 ? <Card><CardContent className="space-y-3 p-6"><MessageSquareText className="size-8 text-muted-foreground" aria-hidden="true" /><h2 className="font-semibold">{hasFilters ? "No matching reviews" : "No reviews yet"}</h2><p className="text-sm text-muted-foreground">{hasFilters ? "Try another search or clear the filters." : "Reviews will appear here when clients submit them."}</p>{hasFilters && <Button type="button" variant="outline" onClick={clearFilters}>Clear filters</Button>}</CardContent></Card> : !error && <div className="grid gap-3">{comments.map((comment) => <ReviewCard key={comment.id} comment={comment} onOpenDeleteComment={onOpenDeleteComment} />)}</div>}
    {!isLoading && !error && <DataPagination label="Review pages" page={page} pageCount={pageCount} onPageChange={onPageChange} />}
  </section>;
}
