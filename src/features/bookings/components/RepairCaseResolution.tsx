import { useEffect, useRef, useState } from "react";
import { CalendarClock, CheckCircle2, ClipboardCheck, Flag, LoaderCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { advanceRepairRework, type getBookingSupportCase, type RepairReworkAction } from "@/features/bookings/services/bookingTransactions";

type CaseRecord = NonNullable<Awaited<ReturnType<typeof getBookingSupportCase>>>;
type DialogKind = "appointment" | "escalate" | "proof" | "confirm" | null;

interface Props {
  bookingId: string;
  caseRecord: CaseRecord;
  viewerRole: "client" | "provider";
  onCaseChanged: (booking: unknown, updatedCase: CaseRecord) => void;
}

export function RepairCaseResolution({ bookingId, caseRecord, viewerRole, onCaseChanged }: Props) {
  const [dialog, setDialog] = useState<DialogKind>(null);
  const [appointment, setAppointment] = useState("");
  const [note, setNote] = useState("");
  const [workChecked, setWorkChecked] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [now, setNow] = useState(() => Date.now());
  const inFlight = useRef(false);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  if (caseRecord.policy_route !== "rework_request" || caseRecord.provider_response_action !== "offer_rework") return null;

  const state = caseRecord.rework_state;
  const appointmentAt = caseRecord.rework_appointment_at ? new Date(caseRecord.rework_appointment_at).getTime() : NaN;
  const proposedAt = Date.parse(appointment);
  const appointmentLabel = Number.isFinite(appointmentAt)
    ? new Date(appointmentAt).toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short" }) : "";
  const canSubmitProof = state === "appointment_accepted" && Number.isFinite(appointmentAt)
    && now >= appointmentAt - 30 * 60_000;
  const isClosed = state === "resolved_by_client";
  const isEscalated = state === "escalated";

  const openDialog = (kind: Exclude<DialogKind, null>) => {
    setError("");
    setSuccess("");
    setNote("");
    setWorkChecked(false);
    setDialog(kind);
  };
  const submit = async (action: RepairReworkAction) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setPending(true);
    setError("");
    try {
      const appointmentAt = action === "propose_appointment" && Number.isFinite(proposedAt) ? new Date(proposedAt).toISOString() : undefined;
      const result = await advanceRepairRework({
        bookingId, caseId: caseRecord.id, action,
        note: action === "escalate" || action === "submit_rework" ? note : undefined,
        appointmentAt,
      });
      if (result.case) onCaseChanged(result.booking, result.case);
      setDialog(null);
      setSuccess(action === "confirm_rework" ? "Rework confirmed. The case is closed."
        : action === "escalate" ? "Sent to support review. The case remains open."
          : action === "submit_rework" ? "Rework notes submitted for the client to review."
            : action === "accept_appointment" ? "Return visit accepted. The provider can see the appointment."
              : "Return visit proposed. Waiting for the client to accept or escalate.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not update this case. Try again.");
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  };

  return <section className="grid min-w-0 gap-3 rounded-lg border bg-card p-4 text-sm" aria-label="Repair case next steps">
    <div className="flex flex-wrap items-start gap-2">
      <ClipboardCheck className="size-5 shrink-0 text-primary" aria-hidden="true" />
      <div className="min-w-0"><h3 className="font-semibold">Repair case next step</h3>
        <p className="text-muted-foreground">{isClosed ? "The client confirmed the rework. This case is closed."
          : isEscalated ? "Support review requested. No remedy or refund has been approved."
            : state === "rework_delivered" ? viewerRole === "client" ? "Review the provider's rework notes, then confirm or escalate." : "Waiting for the client to review your rework."
              : state === "appointment_accepted" ? viewerRole === "provider" ? "Attend the accepted return visit and record what you did." : "Return visit accepted. Waiting for the provider's rework notes."
                : state === "appointment_proposed" ? viewerRole === "client" ? "Accept the proposed return visit or request support review." : "Waiting for the client to accept the return visit."
                  : viewerRole === "provider" ? "Propose a return visit for the client's approval." : "Waiting for the provider to propose a return visit."}</p>
      </div>
    </div>
    {appointmentLabel && <p className="flex items-center gap-2"><CalendarClock className="size-4 text-primary" aria-hidden="true" /><span>Return visit: <strong>{appointmentLabel}</strong></span></p>}
    {caseRecord.rework_evidence_note && <div className="rounded-md bg-muted p-3"><p className="font-semibold">Provider rework notes</p><p className="mt-1 whitespace-pre-wrap">{caseRecord.rework_evidence_note}</p></div>}
    {!isClosed && !isEscalated && <div className="flex flex-wrap gap-2">
      {viewerRole === "provider" && !state && <Button type="button" disabled={pending} onClick={() => openDialog("appointment")}><CalendarClock aria-hidden="true" />Propose return visit</Button>}
      {viewerRole === "client" && state === "appointment_proposed" && <Button type="button" disabled={pending || appointmentAt <= now} onClick={() => { void submit("accept_appointment"); }}><CheckCircle2 aria-hidden="true" />Accept return visit</Button>}
      {viewerRole === "provider" && canSubmitProof && <Button type="button" disabled={pending} onClick={() => openDialog("proof")}><ClipboardCheck aria-hidden="true" />Submit rework notes</Button>}
      {viewerRole === "client" && state === "rework_delivered" && <Button type="button" disabled={pending} onClick={() => openDialog("confirm")}><CheckCircle2 aria-hidden="true" />Confirm rework</Button>}
      {viewerRole === "client" && <Button type="button" variant="outline" disabled={pending} onClick={() => openDialog("escalate")}><Flag aria-hidden="true" />Request support review</Button>}
    </div>}
    {viewerRole === "provider" && state === "appointment_accepted" && !canSubmitProof && <p className="text-muted-foreground">Rework notes become available 30 minutes before the accepted visit.</p>}
    {viewerRole === "client" && state === "appointment_proposed" && appointmentAt <= now && <p className="text-muted-foreground">This proposed time has passed. Request support review so a new time can be arranged.</p>}
    {success && <p role="status" className="text-emerald-700 dark:text-emerald-300">{success}</p>}
    {error && !dialog && <p role="alert" className="text-destructive">{error}</p>}

    <Dialog open={dialog === "appointment"} onOpenChange={(open) => { if (!open && !pending) setDialog(null); }}>
      <DialogContent><DialogHeader><DialogTitle>Propose a return visit</DialogTitle><DialogDescription>The client must accept this time before you record rework. Choose a time at least 30 minutes from now.</DialogDescription></DialogHeader>
        <label className="grid gap-1 text-sm font-medium">Return visit date and time<input type="datetime-local" className="min-h-11 rounded-md border bg-background px-3" value={appointment} onChange={(event) => setAppointment(event.target.value)} /></label>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <DialogFooter><Button type="button" variant="outline" disabled={pending} onClick={() => setDialog(null)}>Cancel</Button><Button type="button" disabled={pending || !Number.isFinite(proposedAt) || proposedAt <= now + 30 * 60_000} onClick={() => { void submit("propose_appointment"); }}>{pending && <LoaderCircle className="animate-spin" aria-hidden="true" />}Propose visit</Button></DialogFooter>
      </DialogContent>
    </Dialog>

    <Dialog open={dialog === "proof"} onOpenChange={(open) => { if (!open && !pending) setDialog(null); }}>
      <DialogContent><DialogHeader><DialogTitle>Record the rework</DialogTitle><DialogDescription>Describe what you inspected or repaired. The client will review this before the case can close.</DialogDescription></DialogHeader>
        <div className="grid gap-3"><label className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" checked={workChecked} onChange={(event) => setWorkChecked(event.target.checked)} />I completed or explained the agreed rework to the client</label><label className="grid gap-1 text-sm font-medium">Rework notes<textarea className="min-h-28 rounded-md border bg-background p-3" value={note} onChange={(event) => setNote(event.target.value)} placeholder="Describe the repair or inspection (at least 20 characters)" /></label></div>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <DialogFooter><Button type="button" variant="outline" disabled={pending} onClick={() => setDialog(null)}>Cancel</Button><Button type="button" disabled={pending || !workChecked || note.trim().length < 20} onClick={() => { void submit("submit_rework"); }}>{pending && <LoaderCircle className="animate-spin" aria-hidden="true" />}Submit notes</Button></DialogFooter>
      </DialogContent>
    </Dialog>

    <Dialog open={dialog === "escalate"} onOpenChange={(open) => { if (!open && !pending) setDialog(null); }}>
      <DialogContent><DialogHeader><DialogTitle>Request support review</DialogTitle><DialogDescription>Tell support why the proposed visit or rework does not resolve your concern. This keeps the case open; it does not issue a refund.</DialogDescription></DialogHeader>
        <label className="grid gap-1 text-sm font-medium">Why do you need support?<textarea className="min-h-28 rounded-md border bg-background p-3" value={note} onChange={(event) => setNote(event.target.value)} placeholder="Explain the remaining issue (at least 20 characters)" /></label>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <DialogFooter><Button type="button" variant="outline" disabled={pending} onClick={() => setDialog(null)}>Cancel</Button><Button type="button" disabled={pending || note.trim().length < 20} onClick={() => { void submit("escalate"); }}>{pending && <LoaderCircle className="animate-spin" aria-hidden="true" />}Send to support</Button></DialogFooter>
      </DialogContent>
    </Dialog>

    <Dialog open={dialog === "confirm"} onOpenChange={(open) => { if (!open && !pending) setDialog(null); }}>
      <DialogContent><DialogHeader><DialogTitle>Confirm the rework?</DialogTitle><DialogDescription>This closes this repair case because you are satisfied with the rework. It does not change the original payment or create a new charge.</DialogDescription></DialogHeader>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <DialogFooter><Button type="button" variant="outline" disabled={pending} onClick={() => setDialog(null)}>Keep reviewing</Button><Button type="button" disabled={pending} onClick={() => { void submit("confirm_rework"); }}>{pending && <LoaderCircle className="animate-spin" aria-hidden="true" />}Confirm and close case</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  </section>;
}
