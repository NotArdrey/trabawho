import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { AdminAccount } from "../types";

interface Props {
  isOpen: boolean;
  target: AdminAccount | null;
  mode: "disable" | "ban";
  reason: string;
  onReasonChange: (value: string) => void;
  durationValue: string;
  onDurationValueChange: (value: string) => void;
  durationUnit: "minutes" | "hours" | "days";
  onDurationUnitChange: (value: "minutes" | "hours" | "days") => void;
  onConfirm: () => void;
  onCancel: () => void;
  isSaving: boolean;
  error: string;
}

export default function AccessActionModal({ isOpen, target, mode, reason, onReasonChange, durationValue, onDurationValueChange, durationUnit, onDurationUnitChange, onConfirm, onCancel, isSaving, error }: Props) {
  const invalidDuration = mode === "ban" && (!Number.isFinite(Number(durationValue)) || Number(durationValue) <= 0);
  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open && !isSaving) onCancel(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{mode === "ban" ? "Suspend account" : "Disable account"}</DialogTitle>
          <DialogDescription>{mode === "ban" ? `Suspend ${target?.name || "this account"} for a set duration.` : `Disable ${target?.name || "this account"} until an admin restores access.`}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {error && <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
          <div className="space-y-2"><Label htmlFor="admin-access-reason">Reason</Label><textarea id="admin-access-reason" rows={4} value={reason} onChange={(event) => onReasonChange(event.target.value)} className="w-full rounded-lg border border-input bg-background p-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" placeholder="Explain this action" /></div>
          {mode === "ban" && <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2"><Label htmlFor="admin-duration">Duration</Label><Input id="admin-duration" type="number" min="1" value={durationValue} onChange={(event) => onDurationValueChange(event.target.value)} /></div>
            <div className="space-y-2"><Label id="admin-duration-unit-label">Unit</Label><Select value={durationUnit} onValueChange={(value) => onDurationUnitChange(value as Props["durationUnit"])}><SelectTrigger aria-labelledby="admin-duration-unit-label"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="minutes">Minutes</SelectItem><SelectItem value="hours">Hours</SelectItem><SelectItem value="days">Days</SelectItem></SelectContent></Select></div>
          </div>}
        </div>
        <DialogFooter><Button type="button" variant="outline" onClick={onCancel} disabled={isSaving}>Cancel</Button><Button type="button" variant="destructive" onClick={onConfirm} disabled={!reason.trim() || invalidDuration} isLoading={isSaving}>{mode === "ban" ? "Suspend account" : "Disable account"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
