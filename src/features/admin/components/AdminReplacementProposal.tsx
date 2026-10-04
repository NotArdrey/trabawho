import { useEffect, useState } from "react";
import { CalendarClock, RefreshCw } from "lucide-react";

import { SelectField } from "@/components/forms";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { listReplacementSlots, proposeReplacement } from "@/features/bookings/services/caseWorkflow";

export function AdminReplacementProposal({ caseId, serviceId, providerId, onSaved }: {
  caseId: string; serviceId: number; providerId: string; onSaved: () => void;
}) {
  const [slots, setSlots] = useState<Awaited<ReturnType<typeof listReplacementSlots>>>([]);
  const [slotId, setSlotId] = useState("");
  const [reason, setReason] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    void listReplacementSlots(serviceId, providerId).then((rows) => { if (active) { setSlots(rows); setError(""); } })
      .catch((cause: unknown) => { if (active) setError(cause instanceof Error ? cause.message : "Times could not be loaded."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [serviceId, providerId]);
  const submit = async () => {
    if (!slotId || pending) return;
    setPending(true); setError("");
    try { await proposeReplacement(caseId, Number(slotId), reason); setConfirming(false); setReason(""); setSlotId(""); onSaved(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Visit could not be proposed."); }
    finally { setPending(false); }
  };
  return <section aria-label="Propose replacement visit" className="grid gap-3 rounded-lg bg-primary/5 p-4 text-sm">
    <div><h3 className="flex items-center gap-2 font-semibold text-primary"><CalendarClock className="size-4" aria-hidden="true" />Offer a replacement visit</h3><p className="mt-1 text-muted-foreground">Both participants must accept. The time is checked again when the second person accepts; no new payment is charged.</p></div>
    {loading && <p role="status">Loading available times…</p>}
    {!loading && !slots.length && <p>No available future times. Ask the provider to publish a new slot, then refresh this case.</p>}
    {slots.length > 0 && <SelectField label="Proposed time" value={slotId} onValueChange={setSlotId} disabled={pending} options={slots.map((slot) => ({ value: String(slot.id), label: new Date(slot.start_ts).toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short" }) }))} />}
    <label className="grid gap-1 font-medium">Reason for replacement<textarea className="min-h-24 rounded-md border border-input bg-background p-3 font-normal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" value={reason} disabled={pending} onChange={(event) => setReason(event.target.value)} placeholder="Explain why this visit is being offered (at least 20 characters)" /></label>
    {error && <p role="alert" className="text-destructive">{error}</p>}
    <Button type="button" className="w-fit" disabled={pending || !slotId || reason.trim().length < 20} onClick={() => setConfirming(true)}>Review visit proposal</Button>
    <AlertDialog open={confirming} onOpenChange={setConfirming}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Offer this replacement visit?</AlertDialogTitle><AlertDialogDescription>Both participants will see the proposed time and reason. The original appointment remains on record. This proposal does not reserve the new slot or move money.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={pending}>Keep editing</AlertDialogCancel><AlertDialogAction disabled={pending} onClick={(event) => { event.preventDefault(); void submit(); }}>{pending && <RefreshCw className="animate-spin" aria-hidden="true" />}Offer visit</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </section>;
}
