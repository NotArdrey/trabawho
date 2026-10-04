import { useCallback, useEffect, useState } from "react";
import { CalendarClock, Check, FileCheck2, Play, RefreshCw, X } from "lucide-react";

import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { FilePicker } from "@/components/ui/file-picker";
import { WorkflowPanel } from "@/components/ui/workflow-panel";
import { useBookingActivity } from "@/features/bookings/hooks/useBookingActivity";
import { confirmReplacement, deliverReplacement, getLatestReplacement, openCaseImage,
  respondReplacement, startReplacement } from "@/features/bookings/services/caseWorkflow";

type VisitDetail = Awaited<ReturnType<typeof getLatestReplacement>>;

export function ReplacementVisitActions({ caseId, bookingId, viewerRole, onChanged }: {
  caseId: string; bookingId: string; viewerRole: "client" | "provider"; onChanged: () => void;
}) {
  const [detail, setDetail] = useState<VisitDetail>(null);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [decision, setDecision] = useState<"accept" | "decline" | "start" | "confirm" | null>(null);
  const [note, setNote] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const load = useCallback(async (showLoading = false) => {
    if (showLoading) setLoading(true);
    try { setDetail(await getLatestReplacement(caseId)); setError(""); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Visit could not be loaded."); }
    finally { setLoading(false); }
  }, [caseId]);
  const refresh = useCallback(() => load(), [load]);
  useEffect(() => { queueMicrotask(() => { void load(true); }); }, [load]);
  useBookingActivity(refresh, true, 15_000, "support");
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 30_000); return () => window.clearInterval(timer); }, []);
  const run = async (action: () => Promise<unknown>) => {
    if (pending) return;
    setPending(true); setError("");
    try { await action(); setDecision(null); await load(); onChanged(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Visit could not be updated."); }
    finally { setPending(false); }
  };
  const visit = detail?.visit;
  const accepted = viewerRole === "client" ? visit?.client_accepted_at : visit?.provider_accepted_at;
  const clientAccepted = Boolean(visit?.client_accepted_at);
  const providerAccepted = Boolean(visit?.provider_accepted_at);
  const canStart = viewerRole === "provider" && visit?.status === "accepted" && !visit.started_at
    && detail?.slot && now >= new Date(detail.slot.start_ts).getTime() - 30 * 60_000;
  return <WorkflowPanel icon={CalendarClock} title="Replacement visit" description="A new time requires both participants to agree." tone="primary" action={<Button type="button" variant="outline" size="sm" className="min-h-11" disabled={loading} onClick={() => { void load(true); }}><RefreshCw aria-hidden="true" />Refresh</Button>} contentClassName="grid gap-3 p-4 text-sm sm:p-5">
    {loading && <p role="status">Loading visit…</p>}
    {error && <p role="alert" className="text-destructive">{error}</p>}
    {!loading && !visit && <p>No replacement visit has been proposed. Support may offer one after reviewing this case.</p>}
    {visit && <div aria-live="polite" className="grid gap-3"><p className="font-semibold capitalize text-primary">{visit.status === "accepted" ? "Replacement time confirmed" : visit.status.replaceAll("_", " ")}{detail.slot && ` · ${new Date(detail.slot.start_ts).toLocaleString("en-PH", { timeZone: "Asia/Manila", dateStyle: "full", timeStyle: "short" })}`}</p><p className="text-muted-foreground">{visit.reason}</p>
      {visit.status === "proposed" && <div className="grid gap-1 rounded-lg bg-muted/50 p-3"><p>Client: {clientAccepted ? "Accepted" : "Awaiting response"}</p><p>Provider: {providerAccepted ? "Accepted" : "Awaiting response"}</p></div>}
      {visit.status === "proposed" && <><p>{accepted ? "You accepted. Waiting for the other participant." : "This time is not reserved yet. Both participants must accept; availability is checked on the second acceptance."}</p>{!accepted && <div className="flex flex-wrap gap-2"><Button type="button" onClick={() => setDecision("accept")}><Check aria-hidden="true" />Accept time</Button><Button type="button" variant="outline" onClick={() => setDecision("decline")}><X aria-hidden="true" />Decline</Button></div>}</>}
      {visit.status === "accepted" && <p className="rounded-lg bg-primary/5 p-3 font-medium">Both participants accepted. This is the confirmed visit time; the original appointment remains in booking history.{visit.started_at ? " The provider has started replacement work." : " The provider can start work near this time."}</p>}
      {canStart && <Button type="button" className="w-fit" onClick={() => setDecision("start")}><Play aria-hidden="true" />Start replacement work</Button>}
      {viewerRole === "provider" && visit.status === "accepted" && visit.started_at && <div className="grid gap-3"><label className="grid gap-1 font-medium">Completed work notes<textarea className="min-h-24 rounded-md border border-input bg-background p-3 font-normal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" value={note} disabled={pending} onChange={(event) => setNote(event.target.value)} placeholder="Describe the work completed (at least 20 characters)" /></label><FilePicker accept="image/jpeg,image/png,image/webp" file={image} disabled={pending} hint="Optional JPEG, PNG, or WebP, under 5 MB" label="Work photo" onChange={setImage} /><Button type="button" className="w-fit" disabled={pending || note.trim().length < 20} onClick={() => { void run(() => deliverReplacement(visit.id, bookingId, note, image)); }}><FileCheck2 aria-hidden="true" />Submit replacement work</Button></div>}
      {visit.status === "delivered" && <div className="grid gap-2"><p className="whitespace-pre-wrap">{visit.delivery_note}</p>{visit.delivery_storage_path && <Button type="button" variant="outline" className="w-fit" onClick={() => { void openCaseImage(visit.delivery_storage_path || "").then((url) => window.open(url, "_blank", "noopener,noreferrer")).catch(() => setError("Work photo could not be opened.")); }}>View work photo</Button>}{viewerRole === "client" ? <Button type="button" className="w-fit" onClick={() => setDecision("confirm")}>Confirm completed visit</Button> : <p>Waiting for client confirmation.</p>}</div>}
      {visit.status === "unavailable" && <p role="status">This time became unavailable. Support needs to offer another time.</p>}
      {visit.status === "completed" && <p role="status">The client confirmed this visit. The case is resolved.</p>}
    </div>}
    <AlertDialog open={decision !== null} onOpenChange={(open) => { if (!open && !pending) setDecision(null); }}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>{decision === "accept" ? "Accept this replacement time?" : decision === "decline" ? "Decline this time?" : decision === "start" ? "Start replacement work?" : "Confirm the replacement is complete?"}</AlertDialogTitle><AlertDialogDescription>{decision === "accept" ? "The time will be checked for availability when both participants have accepted. No additional payment is collected." : decision === "decline" ? "Support will review another option. The case stays open." : decision === "start" ? "The client will see that you started the accepted replacement visit." : "This records that you accepted the completed work and closes the no-show case. Review the notes and photo first."}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={pending}>Go back</AlertDialogCancel><AlertDialogAction disabled={pending || !visit} onClick={(event) => { event.preventDefault(); if (!visit) return; void run(() => decision === "accept" ? respondReplacement(visit.id, true) : decision === "decline" ? respondReplacement(visit.id, false) : decision === "start" ? startReplacement(visit.id) : confirmReplacement(visit.id)); }}>{pending ? "Saving…" : "Confirm"}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </WorkflowPanel>;
}
