import { BadgeCheck, Clock3, Mail, ShieldX } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { IdentityReview } from "./types";

const statusDisplay = {
  APPROVED: {
    label: "Approved",
    icon: BadgeCheck,
    badge: "success" as const,
    header: "bg-emerald-50/80 dark:bg-emerald-950/30",
    iconClass: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
  },
  PENDING_REVIEW: {
    label: "Pending review",
    icon: Clock3,
    badge: "warning" as const,
    header: "bg-amber-50/80 dark:bg-amber-950/30",
    iconClass: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
  },
  DECLINED: {
    label: "Rejected",
    icon: ShieldX,
    badge: "destructive" as const,
    header: "bg-destructive/5",
    iconClass: "bg-destructive/10 text-destructive",
  },
};

function formatReviewDate(value: string): string {
  return `${new Intl.DateTimeFormat("en-PH", { timeZone: "Asia/Manila", dateStyle: "medium", timeStyle: "short" }).format(new Date(value))} PHT`;
}

interface Props {
  review: IdentityReview;
  onOpen: (id: string) => void;
}

export function IdentityReviewCard({ review, onOpen }: Props) {
  const display = statusDisplay[review.status];
  const Icon = display.icon;
  const isPending = review.status === "PENDING_REVIEW";
  const emailStatus = review.email_delivery_status.replaceAll("_", " ");

  return <article className="min-w-0">
    <Card className="h-full overflow-hidden shadow-none">
      <header className={`flex flex-wrap items-start justify-between gap-3 border-b px-4 py-4 sm:px-5 ${display.header}`}>
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <span className={`flex size-11 shrink-0 items-center justify-center rounded-lg ${display.iconClass}`}><Icon className="size-5" aria-hidden="true" /></span>
          <div className="min-w-0">
            <h2 className="break-words text-lg font-semibold leading-6 text-foreground">{review.verified_full_legal_name || "Applicant"}</h2>
            <p className="mt-1 break-all text-sm text-muted-foreground">{review.submitted_by_email}</p>
          </div>
        </div>
        <Badge variant={display.badge}>{display.label}</Badge>
      </header>
      <CardContent className="min-w-0 p-4 sm:p-5">
        <dl className="grid min-w-0 gap-x-4 gap-y-3 text-sm sm:grid-cols-2">
          <div className="min-w-0"><dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Identity document</dt><dd className="mt-1 break-words font-medium text-foreground">{review.document_type} · {review.source === "MANUAL_UPLOAD" ? "Manual upload" : "Didit"}</dd></div>
          <div className="min-w-0"><dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Submitted</dt><dd className="mt-1 font-medium text-foreground"><time dateTime={review.created_at}>{formatReviewDate(review.created_at)}</time></dd></div>
          {review.reviewed_at && <div className="min-w-0"><dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Decision recorded</dt><dd className="mt-1 font-medium text-foreground"><time dateTime={review.reviewed_at}>{formatReviewDate(review.reviewed_at)}</time></dd></div>}
          {review.status === "APPROVED" && <div className="min-w-0"><dt className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground"><Mail className="size-3.5" aria-hidden="true" />Confirmation email</dt><dd className="mt-1"><Badge variant={review.email_delivery_status === "sent" ? "success" : "warning"} className="capitalize">{emailStatus}</Badge></dd></div>}
        </dl>
        {review.duplicate_reason && <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">Duplicate identity needs review</p>}
      </CardContent>
      <footer className="border-t px-4 py-3 sm:px-5"><Button className="w-full sm:w-auto" onClick={() => onOpen(review.id)}>{isPending ? "Review identity" : "View identity decision"}</Button></footer>
    </Card>
  </article>;
}
