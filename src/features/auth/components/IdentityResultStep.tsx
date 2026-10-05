import { ArrowLeft, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { AccountRegistration } from '@/shared/services/accountRegistrationService';
import type { AccountRegistrationFlow } from '../hooks/useAccountRegistration';
import { useNameCorrection } from '../hooks/useNameCorrection';
import type { DraftListener } from '../hooks/useRegistrationDraft';

export function IdentityResultStep({ flow, state, onDraftChange }: { flow: AccountRegistrationFlow; state: AccountRegistration; onDraftChange?: DraftListener }) {
  const correction = useNameCorrection(flow, onDraftChange);
  const ready = state.state === 'ready';
  const namePending = state.state === 'name_pending';
  const worker = state.signupRole === 'worker';
  const nextAction = worker
    ? { href: state.providerSetupComplete ? '/worker/dashboard' : '/seller/onboarding', label: state.providerSetupComplete ? 'Open worker dashboard' : 'Offer services' }
    : { href: '/dashboard', label: 'Start booking services' };
  return (
    <section className="space-y-6">
      {namePending && <div className="space-y-2 rounded-lg bg-muted/60 p-4">
        <p className="text-xs font-medium text-muted-foreground">Complete legal name</p>
        <p className="break-words text-lg font-semibold leading-7">{state.legalName}</p>
        <p className="break-words text-sm text-muted-foreground">Document: {state.documentType}</p>
      </div>}
      {!ready && !namePending && <div className="space-y-3 text-sm leading-6">
        {state.nameIssue && <p className="break-words">{state.nameIssue}</p>}
        {state.legalName && <p className="break-words">Name from ID: {state.legalName}</p>}
        {state.requestedName && <p className="break-words">Requested correction: {state.requestedName}</p>}
        <p className="text-muted-foreground">You can return to this page to check the decision.</p>
      </div>}
      {!ready && state.sessionId && <div className="space-y-4 border-t pt-4">
        <Button variant="ghost" className="h-auto min-h-11 w-full justify-start whitespace-normal px-0 text-left text-primary" disabled={flow.busy}
          aria-expanded={correction.open} aria-controls="registration-name-correction" onClick={() => correction.setOpen(!correction.open)}>
          My legal name is missing or incorrect
        </Button>
        {correction.open && <form id="registration-name-correction" className="space-y-4" onSubmit={(event) => { event.preventDefault(); void correction.submit(); }}>
          <div className="space-y-2"><Label htmlFor="requested-name">Requested legal name</Label>
            <Input id="requested-name" required minLength={2} maxLength={200} disabled={flow.busy} value={correction.requested}
              placeholder="Enter your complete legal name"
              aria-describedby="requested-name-help" onChange={(event) => correction.setRequested(event.target.value)} />
            <p id="requested-name-help" className="text-xs leading-5 text-muted-foreground">Your correction stays separate from the name on your ID. It becomes verified only after human review.</p>
          </div>
          <div className="flex flex-col gap-2">
            <Button type="submit" className="h-auto min-h-11 flex-1 whitespace-normal py-3" isLoading={flow.busy}>Request name review</Button>
            <Button type="button" variant="ghost" disabled={flow.busy} onClick={() => correction.setOpen(false)}><ArrowLeft aria-hidden="true" />Previous</Button>
          </div>
        </form>}
      </div>}
      {!correction.open && (ready ? <div className="space-y-3">
        <p className="text-sm leading-6 text-muted-foreground">{worker ? 'Complete worker setup before publishing a gig.' : 'Enter a service address when you book.'} To use the other role, sign out and register a separate account with a different email.</p>
        {flow.completingSession ? <>
          <Button className="h-auto min-h-11 w-full whitespace-normal py-3" isLoading={!flow.error} disabled={flow.busy}
            onClick={() => void flow.refresh()}>{flow.error ? 'Retry finishing setup' : 'Finishing your account setup'}</Button>
          {flow.error && <Button asChild variant="ghost" className="w-full"><a href="/sign-in">Sign in to continue</a></Button>}
        </> : <Button asChild className="h-auto min-h-11 w-full whitespace-normal py-3">
          <a href={nextAction.href}>{nextAction.label}<ArrowRight aria-hidden="true" /></a>
        </Button>}
      </div> : <Button className="h-auto min-h-11 w-full whitespace-normal py-3" isLoading={flow.busy} onClick={() => void (namePending
        ? flow.identityAction('account-identity-name', { action: 'confirm_name', confirmed: true }) : flow.refresh())}>
        {namePending ? 'Confirm my legal name' : 'Refresh review status'}{namePending && <ArrowRight aria-hidden="true" />}
      </Button>)}
    </section>
  );
}
