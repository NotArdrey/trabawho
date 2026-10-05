import { Button } from '@/components/ui/button';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

export function RegistrationTerms({ disabled }: { disabled: boolean }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button type="button" disabled={disabled} className="min-h-11 rounded-sm text-left text-sm text-primary underline underline-offset-4 disabled:opacity-50">
          Terms and Conditions
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Terms and Conditions</DialogTitle>
          <DialogDescription>Read these terms before agreeing to create your TrabaWho account.</DialogDescription>
        </DialogHeader>
        <p className="text-sm leading-6 text-muted-foreground">TrabaWho processes account, booking, contact, and verification information under the Data Privacy Act of 2012. You agree to provide accurate information and use the marketplace responsibly. Before ID capture or manual submission, the verification action explains how your ID and selfie are used to review access.</p>
        <DialogFooter><DialogClose asChild><Button variant="outline">Close terms</Button></DialogClose></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
