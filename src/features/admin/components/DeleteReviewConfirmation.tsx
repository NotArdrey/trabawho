import { ConfirmActionModal } from "@/shared/components";
import type { AdminComment } from "../types";

interface Props {
  review: AdminComment | null;
  saving: boolean;
  error: string;
  onCancel: () => void;
  onConfirm: (id: AdminComment["id"]) => void;
}

export function DeleteReviewConfirmation({ review, saving, error, onCancel, onConfirm }: Props) {
  return <ConfirmActionModal
    isOpen={Boolean(review)}
    title="Delete this review?"
    description="This permanently removes the review from TrabaWho. It cannot be undone."
    variant="destructive"
    confirmLabel="Delete review"
    isConfirming={saving}
    onCancel={onCancel}
    onConfirm={() => { if (review) onConfirm(review.id); }}
  >
    <div className="min-w-0 space-y-2">
      <p className="font-semibold text-foreground">Review by {review?.client} for {review?.worker}</p>
      <p className="whitespace-pre-wrap break-words text-muted-foreground">{review?.comment || "No written comment"}</p>
      {error && <p role="alert" className="text-destructive">{error}</p>}
    </div>
  </ConfirmActionModal>;
}
