import { useEffect, useState } from "react";
import { RotateCcw } from "lucide-react";

import { SelectField } from "@/components/forms";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { WorkflowPanel } from "@/components/ui/workflow-panel";
import { decideCaseReview, getCaseReviewRequests, requestCaseReview,
  type CaseReviewRequest } from "@/features/bookings/services/caseWorkflow";

export function CaseReviewPanel({ caseId, viewerRole, closed, readOnly = false, onChanged }: {
  caseId: string; viewerRole: "admin" | "client" | "provider"; closed: boolean; readOnly?: boolean; onChanged: () => void;
}) {
  const [requests, setRequests] = useState<CaseReviewRequest[]>([]);
  const [reason, setReason] = useState("");
  const [decision, setDecision] = useState<"upheld" | "reopened">("upheld");
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  useEffect(() => {
    let active = true;
    void getCaseReviewRequests(caseId).then((rows) => { if (active) { setRequests(rows); setError(""); } })
      .catch((cause: unknown) => { if (active) setError(cause instanceof Error ? cause.message : "Review requests could not be loaded."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [caseId]);
  const save = async (requestId?: string) => {
    if (pending) return;
    setPending(true); setError(""); setSuccess("");
    try {
      if (requestId) await decideCaseReview(requestId, decision, reason);
      else await requestCaseReview(caseId, reason);
      setRequests(await getCaseReviewRequests(caseId));
      setSuccess(requestId ? "Review decision recorded and sent to the requester." : "Further review requested. Support can see your explanation.");
      setReason(""); setConfirming(false); onChanged();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Review request could not be saved."); }
    finally { setPending(false); }
  };
  const pendingRequest = requests.find((item) => item.status === "pending");
  if (viewerRole !== "admin" && !closed && !error && !requests.length) return null;
  return <WorkflowPanel icon={RotateCcw} title="Further review" description="Ask support to reconsider a closed case or track a review request." tone="neutral" contentClassName="grid gap-3 p-4 text-sm sm:p-5">
    {loading && <p role="status">Loading review requests…</p>}
    {error && <p role="alert" className="text-destructive">{error}</p>}
    {requests.map((item) => <div key={item.id} className="border-t pt-2"><p className="font-medium capitalize">{item.status === "pending" ? "Awaiting support review" : item.status.replaceAll("_", " ")}</p><p className="mt-1 whitespace-pre-wrap">{item.reason}</p>{item.decision_reason && <p className="mt-2 whitespace-pre-wrap text-muted-foreground">Support decision: {item.decision_reason}</p>}</div>)}
    {closed && !loading && viewerRole !== "admin" && !requests.length && <><p>Disagree with this outcome? Tell support what should be reviewed. Requesting review does not reverse a payment or refund.</p><label className="grid gap-1 font-medium">Why do you need further review?<textarea className="min-h-24 rounded-md border border-input bg-background p-3 font-normal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" value={reason} disabled={pending} onChange={(event) => setReason(event.target.value)} placeholder="Explain new or overlooked information (at least 20 characters)" /></label><Button type="button" className="w-fit" disabled={pending || reason.trim().length < 20} onClick={() => { void save(); }}>Request further review</Button></>}
    {viewerRole === "admin" && !readOnly && pendingRequest && <><SelectField label="Review outcome" value={decision} disabled={pending} onValueChange={(value) => setDecision(value as "upheld" | "reopened")} options={[{ value: "upheld", label: "Keep the prior outcome" }, { value: "reopened", label: "Reopen for support review" }]} /><label className="grid gap-1 font-medium">Reason shared with requester<textarea className="min-h-24 rounded-md border border-input bg-background p-3 font-normal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" value={reason} disabled={pending} onChange={(event) => setReason(event.target.value)} placeholder="Explain the evidence and next step (at least 20 characters)" /></label><Button type="button" className="w-fit" disabled={pending || reason.trim().length < 20} onClick={() => setConfirming(true)}>Review decision</Button><AlertDialog open={confirming} onOpenChange={setConfirming}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>{decision === "reopened" ? "Reopen this support case?" : "Keep the prior outcome?"}</AlertDialogTitle><AlertDialogDescription>The requester will see the decision and reason in the case. This action does not refund or charge money.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={pending}>Go back</AlertDialogCancel><AlertDialogAction disabled={pending} onClick={(event) => { event.preventDefault(); void save(pendingRequest.id); }}>{pending ? "Saving…" : "Confirm decision"}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog></>}
    {success && <p role="status" className="text-emerald-700 dark:text-emerald-300">{success}</p>}
  </WorkflowPanel>;
}
