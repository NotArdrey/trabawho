import { useState, type FormEvent } from "react";
import { Ban, ShieldOff } from "lucide-react";

import { SelectField } from "@/components/forms";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { AdminAccount } from "@/features/admin/types";

interface AccessActionModalProps {
  isOpen: boolean;
  target: AdminAccount | null;
  mode: "disable" | "ban";
  reason: string;
  onReasonChange: (value: string) => void;
  durationValue: string;
  onDurationValueChange: (value: string) => void;
  durationUnit: string;
  onDurationUnitChange: (value: string) => void;
  onConfirm: () => Promise<void> | void;
  onCancel: () => void;
}

const durationOptions = [
  { value: "minutes", label: "Minutes" },
  { value: "hours", label: "Hours" },
  { value: "days", label: "Days" },
] as const;

export default function AccessActionModal({
  isOpen,
  target,
  mode,
  reason,
  onReasonChange,
  durationValue,
  onDurationValueChange,
  durationUnit,
  onDurationUnitChange,
  onConfirm,
  onCancel,
}: AccessActionModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const trimmedReason = reason.trim();
  const durationIsValid = mode !== "ban" || Number(durationValue) >= 1;
  const formIsValid = trimmedReason.length > 0 && durationIsValid;
  const Icon = mode === "ban" ? Ban : ShieldOff;

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!formIsValid || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await onConfirm();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen && Boolean(target)} onOpenChange={(open) => { if (!open && !isSubmitting) onCancel(); }}>
      <DialogContent>
        <DialogHeader>
          <span className="mb-2 flex size-11 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
            <Icon className="size-5" aria-hidden="true" />
          </span>
          <DialogTitle>{mode === "ban" ? "Suspend account" : "Disable account"}</DialogTitle>
          <DialogDescription>
            {mode === "ban"
              ? `Temporarily suspend ${target?.name ?? "this account"}. Access can be restored later.`
              : `Disable ${target?.name ?? "this account"} until an administrator restores access.`}
          </DialogDescription>
        </DialogHeader>

        <form id="admin-access-action-form" className="grid gap-5" onSubmit={(event) => { void submit(event); }}>
          <div className="grid gap-2">
            <Label htmlFor="admin-access-reason">Reason</Label>
            <textarea
              id="admin-access-reason"
              value={reason}
              onChange={(event) => onReasonChange(event.target.value)}
              rows={4}
              required
              aria-describedby="admin-access-reason-help"
              className="w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              placeholder="Explain why access is being restricted"
            />
            <p id="admin-access-reason-help" className="text-xs leading-5 text-muted-foreground">
              This reason is saved with the account restriction.
            </p>
          </div>

          {mode === "ban" ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="admin-suspension-duration">Duration</Label>
                <Input
                  id="admin-suspension-duration"
                  type="number"
                  min="1"
                  value={durationValue}
                  onChange={(event) => onDurationValueChange(event.target.value)}
                  aria-invalid={!durationIsValid}
                  required
                />
                {!durationIsValid ? <p className="text-xs text-destructive">Enter a duration of at least 1.</p> : null}
              </div>
              <SelectField
                id="admin-suspension-unit"
                label="Unit"
                value={durationUnit}
                onValueChange={onDurationUnitChange}
                options={durationOptions}
              />
            </div>
          ) : null}
        </form>

        <DialogFooter>
          <Button type="button" variant="outline" disabled={isSubmitting} onClick={onCancel}>Cancel</Button>
          <Button
            type="submit"
            form="admin-access-action-form"
            variant="destructive"
            disabled={!formIsValid}
            isLoading={isSubmitting}
          >
            {mode === "ban" ? "Suspend account" : "Disable account"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
