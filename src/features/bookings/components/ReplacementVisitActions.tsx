import { useCallback, useEffect, useState } from "react";
import { CalendarClock, Check, CheckCircle2, FileCheck2, Image, Play, RefreshCw, X } from "lucide-react";
import { toast } from "sonner";

import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FilePicker } from "@/components/ui/file-picker";
import { WorkflowPanel } from "@/components/ui/workflow-panel";
import { useBookingActivity } from "@/features/bookings/hooks/useBookingActivity";
import {
  confirmReplacement, deliverReplacement, getLatestReplacement, openCaseImage,
  respondReplacement, startReplacement,
} from "@/features/bookings/services/caseWorkflow";

type VisitDetail = Awaited<ReturnType<typeof getLatestReplacement>>;
type Decision = "accept" | "decline" | "start" | "deliver" | "confirm";

const dialogCopy: Record<Decision, { title: string; description: string; action: string }> = {
  accept: {
    title: "Accept this replacement time?",
    description: "Both participants must accept before the time is confirmed. No additional payment is collected.",
    action: "Accept visit time",
  },
  decline: {
    title: "Decline this replacement time?",
    description: "This time will be declined and support can review another option. The case will stay open.",
    action: "Decline time",
  },
  start: {
    title: "Start replacement work?",
    description: "The client will see that work has started on the confirmed replacement visit.",
    action: "Start work",
  },
  deliver: {
    title: "Submit completed work?",
    description: "Your work notes and optional photo will be sent to the client. They will review the work before the booking can be completed.",
    action: "Submit work",
  },
  confirm: {
    title: "Confirm this visit is complete?",
    description: "Confirm only if the replacement work is complete. This marks the booking Completed and closes the no-show support case.",
    action: "Confirm completion",
  },
};

function visitStatus(status: string, started: boolean) {
  if (status === "proposed") return { label: "Awaiting agreement", variant: "warning" as const };
  if (status === "accepted") return started
    ? { label: "Work in progress", variant: "default" as const }
    : { label: "Visit confirmed", variant: "default" as const };
  if (status === "delivered") return { label: "Client review needed", variant: "warning" as const };
  if (status === "completed") return { label: "Completed", variant: "success" as const };
  return { label: status.replaceAll("_", " "), variant: "secondary" as const };
}

export function ReplacementVisitActions({ caseId, bookingId, viewerRole, funded, showVisitTime = true, onChanged }: {
  caseId: string; bookingId: string; viewerRole: "client" | "provider"; funded: boolean;
  showVisitTime?: boolean; onChanged: () => void;
}) {
  const [detail, setDetail] = useState<VisitDetail>(null);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [decision, setDecision] = useState<Decision | null>(null);
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
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const visit = detail?.visit;
  const slot = detail?.slot;
  const accepted = viewerRole === "client" ? visit?.client_accepted_at : visit?.provider_accepted_at;
  const startAvailableAt = slot ? new Date(slot.start_ts).getTime() - 30 * 60_000 : NaN;
  const canStart = viewerRole === "provider" && funded && visit?.status === "accepted" && !visit.started_at
    && Number.isFinite(startAvailableAt) && now >= startAvailableAt;
  const startTimeReason = Number.isFinite(startAvailableAt) && now < startAvailableAt
    ? `Start work becomes available 30 minutes before the visit, at ${new Date(startAvailableAt).toLocaleString("en-PH", { timeZone: "Asia/Manila", dateStyle: "medium", timeStyle: "short" })} PHT.`
    : "";
  const startBlockReason = !funded
    ? `Payment verification is incomplete. Do not begin work; contact support if the client has already paid.${startTimeReason ? ` ${startTimeReason}` : ""}`
    : !Number.isFinite(startAvailableAt)
      ? "The replacement time is unavailable. Refresh this visit or contact support."
      : startTimeReason;
  const status = visit ? visitStatus(visit.status, Boolean(visit.started_at)) : null;
  const visitTime = slot ? new Date(slot.start_ts).toLocaleString("en-PH", {
    timeZone: "Asia/Manila", dateStyle: "full", timeStyle: "short",
  }) : null;
  const endTime = slot ? new Date(slot.end_ts).toLocaleTimeString("en-PH", {
    timeZone: "Asia/Manila", hour: "numeric", minute: "2-digit",
  }) : null;

  const run = async (action: () => Promise<unknown>, successMessage: string) => {
    if (pending) return;
    setPending(true);
    setError("");
    try {
      await action();
      setDecision(null);
      await load();
      onChanged();
      toast.success(successMessage);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Visit could not be updated.");
    } finally {
      setPending(false);
    }
  };

  const confirmDecision = () => {
    if (!visit || !decision) return;
    switch (decision) {
      case "accept": void run(() => respondReplacement(visit.id, true), "Replacement time accepted."); break;
      case "decline": void run(() => respondReplacement(visit.id, false), "Replacement time declined. Support will review the case."); break;
      case "start": void run(() => startReplacement(visit.id), "Replacement work started."); break;
      case "deliver": void run(() => deliverReplacement(visit.id, bookingId, note, image), "Replacement work sent to the client for confirmation."); break;
      case "confirm": void run(() => confirmReplacement(visit.id), "Replacement visit completed. The booking is now in Completed."); break;
    }
  };

  return <WorkflowPanel
    icon={CalendarClock}
    title="Replacement visit"
    description={visit?.status === "delivered"
      ? viewerRole === "client" ? "Review the work, then confirm if it is complete." : "Work sent to the client for confirmation."
      : visit?.status === "completed" ? "This replacement visit is complete."
        : visit?.status === "accepted" ? "Both participants agreed to this time."
          : "A new time requires both participants to agree."}
    tone={visit?.status === "completed" ? "success" : "primary"}
    status={status && <Badge variant={status.variant} className="hidden sm:inline-flex">{status.label}</Badge>}
    action={<Button type="button" variant="outline" size="sm" disabled={loading || pending}
      onClick={() => { void load(true); }}><RefreshCw aria-hidden="true" />Refresh</Button>}
    contentClassName="grid gap-4 p-4 text-sm sm:p-5"
  >
    {loading && <p role="status">Loading visit…</p>}
    {error && <p role="alert" className="text-destructive">{error}</p>}
    {!loading && !visit && <p>No replacement visit has been proposed. Support may offer one after reviewing this case.</p>}

    {visit && <div aria-live="polite" className="grid min-w-0 gap-4">
      {(showVisitTime || visit.status === "completed") && <div className="grid min-w-0 gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
        <div className="min-w-0">
          {showVisitTime && <>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{visit.status === "proposed" ? "Proposed visit time" : "Replacement visit time"}</p>
            <p className="mt-1 text-base font-semibold text-foreground">{visitTime || "Time unavailable"}{endTime && `–${endTime} PHT`}</p>
          </>}
          {visit.status === "completed" && <p className="text-emerald-800 dark:text-emerald-200">The client confirmed this visit. The case is resolved.</p>}
        </div>
        {status && <Badge variant={status.variant} className="w-fit sm:hidden">{status.label}</Badge>}
      </div>}
      {!showVisitTime && visit.status !== "completed" && status &&
        <Badge variant={status.variant} className="w-fit sm:hidden">{status.label}</Badge>}

      {visit.reason && <details className="text-muted-foreground">
        <summary className="w-fit cursor-pointer font-medium text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Why this visit was arranged</summary>
        <p className="mt-2 whitespace-pre-wrap">{visit.reason}</p>
      </details>}

      {visit.status === "proposed" && <div className="grid gap-3 border-t pt-4">
        <div className="flex flex-wrap gap-x-5 gap-y-1">
          <p>Client: {visit.client_accepted_at ? "Accepted" : "Awaiting response"}</p>
          <p>Provider: {visit.provider_accepted_at ? "Accepted" : "Awaiting response"}</p>
        </div>
        <p className="text-muted-foreground">{accepted ? "You accepted. Waiting for the other participant." : "This time is not reserved yet. Both participants must accept; availability is checked on the second acceptance."}</p>
        {!accepted && <div className="flex flex-col gap-2 sm:flex-row">
          <Button type="button" disabled={pending} onClick={() => setDecision("accept")}><Check aria-hidden="true" />Accept time</Button>
          <Button type="button" variant="outline" disabled={pending} onClick={() => setDecision("decline")}><X aria-hidden="true" />Decline time</Button>
        </div>}
      </div>}

      {visit.status === "accepted" && <div className="grid gap-3 border-t pt-4">
        <p className="text-muted-foreground">Both participants accepted. The original appointment remains in booking history.</p>
        {visit.started_at && <p className="font-medium text-primary">The provider has started replacement work.</p>}
        {viewerRole === "client" && !visit.started_at && <p className="font-medium text-primary">The provider can start work near the visit time.</p>}
        {viewerRole === "provider" && !visit.started_at && <div className="grid gap-2">
          <Button type="button" className="min-h-11 w-full sm:w-fit" disabled={pending || !canStart}
            aria-describedby={startBlockReason ? `replacement-start-${visit.id}` : undefined}
            onClick={() => setDecision("start")}><Play aria-hidden="true" />Start replacement work</Button>
          {startBlockReason && <p id={`replacement-start-${visit.id}`} role="status" className="text-muted-foreground">{startBlockReason}</p>}
        </div>}
        {viewerRole === "provider" && funded && visit.started_at && <div className="grid gap-3">
          <label className="grid gap-1 font-medium">Completed work notes
            <textarea className="min-h-24 rounded-md border border-input bg-background p-3 font-normal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={note} disabled={pending} onChange={(event) => setNote(event.target.value)}
              placeholder="Describe the work completed (at least 20 characters)" />
          </label>
          <FilePicker accept="image/jpeg,image/png,image/webp" file={image} disabled={pending}
            hint="Optional JPEG, PNG, or WebP, under 5 MB" label="Work photo" onChange={setImage} />
          <Button type="button" className="w-full sm:w-fit" disabled={pending || note.trim().length < 20}
            onClick={() => setDecision("deliver")}><FileCheck2 aria-hidden="true" />Review and submit work</Button>
        </div>}
      </div>}

      {!funded && visit.status === "delivered" && <p role="status"
        className="rounded-lg bg-amber-50 p-3 text-amber-950 dark:bg-amber-950/30 dark:text-amber-100">
        Work completion is paused until this booking shows full verified payment. No new payment is requested here; contact support if the booking was already paid.
      </p>}

      {visit.status === "delivered" && <div className="grid gap-3 border-t pt-4">
        <div><p className="font-semibold">Work submitted by provider</p>
          <p className="mt-2 whitespace-pre-wrap break-words text-foreground">{visit.delivery_note}</p></div>
        {visit.delivery_storage_path && <Button type="button" variant="outline" className="w-full sm:w-fit"
          onClick={() => { void openCaseImage(visit.delivery_storage_path || "")
            .then((url) => window.open(url, "_blank", "noopener,noreferrer"))
            .catch(() => setError("Work photo could not be opened.")); }}><Image aria-hidden="true" />View work photo</Button>}
        {viewerRole === "client" && funded && <div className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-muted-foreground">Confirm only when the agreed replacement work is complete.</p>
          <Button type="button" className="w-full sm:w-auto" disabled={pending} onClick={() => setDecision("confirm")}>
            <CheckCircle2 aria-hidden="true" />Confirm completed visit
          </Button>
        </div>}
        {viewerRole === "provider" && <p role="status" className="font-medium text-primary">Waiting for client confirmation.</p>}
      </div>}

      {visit.status === "unavailable" && <p role="status">This time became unavailable. Support needs to offer another time.</p>}
    </div>}

    <AlertDialog open={decision !== null} onOpenChange={(open) => { if (!open && !pending) setDecision(null); }}>
      <AlertDialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto">
        <AlertDialogHeader>
          <AlertDialogTitle>{decision ? dialogCopy[decision].title : "Confirm action"}</AlertDialogTitle>
          <AlertDialogDescription>{decision ? dialogCopy[decision].description : ""}</AlertDialogDescription>
        </AlertDialogHeader>
        {(decision === "accept" || decision === "decline") && visitTime &&
          <p className="rounded-lg bg-muted/50 p-3 text-sm font-semibold">{visitTime}{endTime && `–${endTime} PHT`}</p>}
        {decision === "deliver" && <div className="grid gap-1 rounded-lg bg-muted/50 p-3 text-sm">
          <p className="font-semibold">Work notes to send</p>
          <p className="max-h-32 overflow-y-auto whitespace-pre-wrap break-words">{note.trim()}</p>
          {image && <p className="text-muted-foreground">Photo: {image.name}</p>}
        </div>}
        {decision === "confirm" && visit?.delivery_note && <div className="grid gap-1 rounded-lg bg-muted/50 p-3 text-sm">
          <p className="font-semibold">Work submitted by provider</p>
          <p className="max-h-32 overflow-y-auto whitespace-pre-wrap break-words">{visit.delivery_note}</p>
          {visit.delivery_storage_path && <p className="text-muted-foreground">A work photo is attached. View it in the booking card before confirming.</p>}
        </div>}
        <AlertDialogFooter>
          <AlertDialogCancel asChild><Button type="button" variant="outline" disabled={pending}>Go back</Button></AlertDialogCancel>
          <AlertDialogAction asChild><Button type="button" variant={decision === "decline" ? "destructive" : "primary"}
            disabled={pending || !visit} isLoading={pending}
            onClick={(event) => { event.preventDefault(); confirmDecision(); }}>
            {decision ? dialogCopy[decision].action : "Confirm"}
          </Button></AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </WorkflowPanel>;
}
