import type { FormEvent } from "react";
import { UserRoundPen } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface ProfileNameDialogProps {
  error?: string;
  firstName: string;
  isOpen: boolean;
  isSaving: boolean;
  lastName: string;
  middleName: string;
  onFirstNameChange: (value: string) => void;
  onLastNameChange: (value: string) => void;
  onMiddleNameChange: (value: string) => void;
  onOpenChange: (open: boolean) => void;
  onSave: () => void | Promise<void>;
}

function ProfileNameDialog({
  error,
  firstName,
  isOpen,
  isSaving,
  lastName,
  middleName,
  onFirstNameChange,
  onLastNameChange,
  onMiddleNameChange,
  onOpenChange,
  onSave,
}: ProfileNameDialogProps) {
  const canSave = firstName.trim().length > 0 && lastName.trim().length > 0;
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (canSave) void onSave();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!isSaving) onOpenChange(open); }}>
      <DialogContent className="max-w-lg gap-0 overflow-hidden p-0">
        <form onSubmit={handleSubmit}>
          <DialogHeader className="border-b border-border bg-muted/35 px-5 pb-5 pt-5 sm:px-6 sm:pt-6">
            <span className="mb-2 flex size-11 items-center justify-center rounded-xl bg-primary text-primary-foreground" aria-hidden="true">
              <UserRoundPen className="size-5" />
            </span>
            <DialogTitle className="text-2xl">Edit profile name</DialogTitle>
            <DialogDescription>Use the name clients should see across your profile and bookings.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 px-5 py-5 sm:grid-cols-2 sm:px-6">
            <div className="space-y-2">
              <Label htmlFor="profile-first-name">First name</Label>
              <Input id="profile-first-name" value={firstName} onChange={(event) => onFirstNameChange(event.target.value)} autoComplete="given-name" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="profile-last-name">Last name</Label>
              <Input id="profile-last-name" value={lastName} onChange={(event) => onLastNameChange(event.target.value)} autoComplete="family-name" required />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <div className="flex items-baseline justify-between gap-3">
                <Label htmlFor="profile-middle-name">Middle name</Label>
                <span className="text-xs text-muted-foreground">Optional</span>
              </div>
              <Input id="profile-middle-name" value={middleName} onChange={(event) => onMiddleNameChange(event.target.value)} autoComplete="additional-name" />
            </div>
            {error ? <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive sm:col-span-2" role="alert">{error}</p> : null}
          </div>

          <DialogFooter className="px-5 py-4 sm:px-6">
            <Button type="button" variant="outline" disabled={isSaving} onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={!canSave} isLoading={isSaving}>{isSaving ? "Saving name…" : "Save changes"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export { ProfileNameDialog };
