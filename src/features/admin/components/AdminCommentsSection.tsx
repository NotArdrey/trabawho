import { MessageSquareWarning, Star, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { AdminComment } from "@/features/admin/types";

interface AdminCommentsSectionProps {
  comments: AdminComment[];
  commentsError: string;
  onOpenDeleteComment: (comment: AdminComment) => void;
}

export default function AdminCommentsSection({
  comments,
  commentsError,
  onOpenDeleteComment,
}: AdminCommentsSectionProps) {
  return (
    <section aria-labelledby="moderation-title">
      <Card className="shadow-none">
        <CardHeader className="border-b border-border">
          <div className="flex items-start gap-4">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-200">
              <MessageSquareWarning className="size-5" aria-hidden="true" />
            </span>
            <div>
              <CardTitle id="moderation-title" className="text-2xl">Content moderation</CardTitle>
              <CardDescription className="mt-2 max-w-2xl leading-6">
                Review service-provider comments and remove entries that violate platform policy.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="py-6">
          {commentsError ? (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive" role="alert">
              <p className="font-semibold">Moderation records could not be loaded</p>
              <p className="mt-1 leading-5">{commentsError}</p>
            </div>
          ) : comments.length > 0 ? (
            <ul className="grid gap-4 lg:grid-cols-2">
              {comments.map((comment) => (
                <li key={comment.id} className="flex min-w-0 flex-col rounded-lg border border-border p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold">{comment.worker}</p>
                      <p className="mt-1 text-xs text-muted-foreground">Review by {comment.client}</p>
                    </div>
                    <span className="flex items-center gap-1 text-sm font-semibold" aria-label={`${comment.rating} out of 5 stars`}>
                      <Star className="size-4 fill-[var(--brand-orange)] text-[var(--brand-orange)]" aria-hidden="true" />
                      {comment.rating}/5
                    </span>
                  </div>
                  <p className="my-4 flex-1 text-sm leading-6 text-foreground">{comment.comment || "No written comment."}</p>
                  <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
                    <Badge variant={comment.status === "flagged" ? "destructive" : comment.status === "review" ? "warning" : "success"}>
                      {comment.status}
                    </Badge>
                    <Button type="button" size="sm" variant="destructive" onClick={() => onOpenDeleteComment(comment)}>
                      <Trash2 aria-hidden="true" />
                      Delete comment
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="rounded-lg border border-dashed border-border bg-muted/30 p-5">
              <p className="font-semibold">No comments to moderate</p>
              <p className="mt-1 text-sm text-muted-foreground">Review comments will appear here when records are available.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
