import { useState } from "react";
import { createRoot } from "react-dom/client";

import AdminCommentsSection from "@/features/admin/components/AdminCommentsSection";
import { AdminAuditEventCard } from "@/features/admin/components/AdminAuditEventCard";
import { DeleteReviewConfirmation } from "@/features/admin/components/DeleteReviewConfirmation";
import type { AdminComment } from "@/features/admin/types";
import type { AuditEntry } from "@/features/admin/types/admin-activity";
import "@/styles/globals.css";

const comments: AdminComment[] = [
  { id: 1, worker: "Andrea Mendoza Navarro", client: "Sofia Garcia Cruz", rating: 5,
    comment: "Service was absolute.", status: "published", createdAt: "2026-10-02T09:00:00Z" },
  { id: 2, worker: "Ramon De Leon Torres", client: "Sofia Garcia Cruz", rating: 2,
    comment: "", status: "review", createdAt: "2026-08-29T09:00:00Z" },
];
const entries: AuditEntry[] = [
  { id: "identity-1", source: "identity", actorId: null, actor: "Beatriz Dizon Ramos",
    action: "Identity review", target: "f99c1b80-1e58-433f-916a-ea93c96d4927",
    reason: "Verification evidence reviewed.", outcome: "Approved", createdAt: "2026-10-05T09:30:00Z", operationId: null },
  { id: "booking-1", source: "bookings", actorId: null, actor: "Carla Bautista Garcia",
    action: "Booking cancellation approved", target: "ab669ce7-10b2-4996-9215-4565f3212097",
    reason: "Client requested cancellation.", outcome: "confirmed → cancelled", createdAt: "2026-10-05T09:12:00Z", operationId: null },
  { id: "support-1", source: "support", actorId: null, actor: "Support agent",
    action: "Request information", target: "case-123", reason: "Awaiting the provider's response.",
    outcome: "Follow-up recorded", createdAt: "2026-10-05T08:00:00Z", operationId: null },
];

function TestPage() {
  const [target, setTarget] = useState<AdminComment | null>(null);
  const [confirmed, setConfirmed] = useState(0);
  return <main className="mx-auto grid min-h-screen max-w-6xl gap-10 bg-background p-4 sm:p-6">
    <AdminCommentsSection comments={comments} isLoading={false} error="" total={comments.length} page={1} pageSize={10}
      search="" status="all" rating="all" onSearchChange={() => undefined} onStatusChange={() => undefined}
      onRatingChange={() => undefined} onPageChange={() => undefined} onRetry={() => undefined}
      onOpenDeleteComment={setTarget} />
    <section aria-label="Audit card examples" className="grid gap-3"><h2 className="text-2xl font-semibold">Audit events</h2>
      {entries.map((entry) => <AdminAuditEventCard key={entry.id} entry={entry} />)}
    </section>
    <p data-testid="confirmed-count">{confirmed}</p>
    <DeleteReviewConfirmation review={target} saving={false} error="" onCancel={() => setTarget(null)}
      onConfirm={() => { setConfirmed((value) => value + 1); setTarget(null); }} />
  </main>;
}

createRoot(document.getElementById("root")!).render(<TestPage />);
