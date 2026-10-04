import { MessageSquareText, Star } from "lucide-react";
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
  return <Card><CardContent className="space-y-4 p-5">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0"><h2 className="font-semibold text-foreground">{comment.worker}</h2><p className="text-sm text-muted-foreground">Review by {comment.client}{comment.createdAt ? ` · ${new Date(comment.createdAt).toLocaleDateString()}` : ""}</p></div>
      <div className="flex items-center gap-2"><Badge variant="secondary"><Star className="mr-1 size-3 fill-current" aria-hidden="true" />{comment.rating} / 5</Badge><Badge variant={comment.status === "published" ? "success" : "warning"}>{comment.status === "published" ? "Published" : "Unpublished"}</Badge></div>
    </div>
    <p className="whitespace-pre-wrap text-sm leading-6 text-foreground">{comment.comment || "No written comment"}</p>
    <div className="flex justify-end border-t border-border pt-3"><Button type="button" variant="outline" className="border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => onOpenDeleteComment(comment)}>Delete review</Button></div>
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
