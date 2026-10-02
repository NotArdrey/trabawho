import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { FieldError } from './RegistrationField';
import type { RegistrationErrors, RegistrationValues, UpdateRegistration } from './types';

export function RegistrationConsent({ values, update, errors }: { values: RegistrationValues; update: UpdateRegistration; errors: RegistrationErrors }) {
  return <div className="grid gap-2">
    <div>
      <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm" htmlFor="acceptedIdentityTerms">
        <Checkbox id="acceptedIdentityTerms" name="acceptedIdentityTerms" checked={values.acceptedIdentityTerms}
          onChange={(event) => update('acceptedIdentityTerms', event.target.checked)} required
          aria-invalid={Boolean(errors.acceptedIdentityTerms)} aria-describedby={errors.acceptedIdentityTerms ? 'acceptedIdentityTerms-error' : undefined} />
        I consent to identity verification before account access.
      </label>
      <FieldError id="acceptedIdentityTerms" error={errors.acceptedIdentityTerms} />
    </div>
    <div>
      <div className="flex min-h-11 flex-wrap items-center gap-x-1">
        <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm" htmlFor="acceptedRaTerms">
          <Checkbox id="acceptedRaTerms" name="acceptedRaTerms" checked={values.acceptedRaTerms}
            aria-label="I agree to the Terms and Conditions"
            onChange={(event) => update('acceptedRaTerms', event.target.checked)} required
            aria-invalid={Boolean(errors.acceptedRaTerms)} aria-describedby={errors.acceptedRaTerms ? 'acceptedRaTerms-error' : undefined} />
          I agree to the
        </label>
        <Dialog>
          <DialogTrigger asChild><Button type="button" variant="ghost" className="px-1 text-primary underline underline-offset-4">Terms and Conditions</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Terms and Conditions</DialogTitle>
              <DialogDescription>Registration and privacy consent</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 text-sm leading-6">
              <p>I agree to TrabaWho collecting and processing my registration, identity, location, booking, and contact information under Republic Act No. 10173, the Data Privacy Act of 2012.</p>
              <p>I consent to identity verification before account access. Documents supported by Didit use ID scanning, liveness, and face matching. Other documents are submitted for manual review, and account access remains pending until approval.</p>
              <p>Close this window and select the checkboxes to confirm your consent.</p>
            </div>
            <DialogFooter><DialogClose asChild><Button type="button">Close terms</Button></DialogClose></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      <FieldError id="acceptedRaTerms" error={errors.acceptedRaTerms} />
    </div>
  </div>;
}
