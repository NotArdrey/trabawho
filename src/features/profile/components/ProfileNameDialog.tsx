import { LockKeyhole } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface ProfileNameDialogProps {
  firstName: string;
  isOpen: boolean;
  lastName: string;
  middleName: string;
  onOpenChange: (open: boolean) => void;
}

function ProfileNameDialog({ firstName, isOpen, lastName, middleName, onOpenChange }: ProfileNameDialogProps) {
  const name = [firstName, middleName, lastName].filter(Boolean).join(" ").trim();
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b border-border bg-muted/35 px-5 pb-5 pt-5 sm:px-6 sm:pt-6">
          <span className="mb-2 flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary" aria-hidden="true"><LockKeyhole className="size-5" /></span>
          <DialogTitle className="text-2xl">Profile name is protected</DialogTitle>
          <DialogDescription>Your account name cannot be changed here because it must stay consistent with identity verification.</DialogDescription>
        </DialogHeader>
        <div className="px-5 py-5 sm:px-6">
          <p className="text-sm text-muted-foreground">Name on your profile</p>
          <p className="mt-1 break-words font-semibold text-foreground">{name || "Name not available"}</p>
          <p className="mt-4 text-sm text-muted-foreground">Contact support if your legal name needs correction.</p>
        </div>
        <DialogFooter className="px-5 py-4 sm:px-6"><Button type="button" onClick={() => onOpenChange(false)}>Close</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export { ProfileNameDialog };
