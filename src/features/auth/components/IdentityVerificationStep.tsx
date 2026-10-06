import { useEffect, useRef } from 'react';
import { ArrowLeft, ArrowRight, FileCheck, ScanFace } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { AccountRegistration } from '@/shared/services/accountRegistrationService';
import type { AccountRegistrationFlow } from '../hooks/useAccountRegistration';
import { useIdentityStep } from '../hooks/useIdentityStep';
import { useDiditVerification } from '../hooks/useDiditVerification';
import type { DraftListener } from '../hooks/useRegistrationDraft';
import { ManualAccountReview } from './ManualAccountReview';
import { DiditVerificationDialog } from './DiditVerificationDialog';

export function IdentityVerificationStep({ flow, state, onDraftChange, active = true }: { flow: AccountRegistrationFlow; state: AccountRegistration; onDraftChange?: DraftListener; active?: boolean }) {
  const controls = useIdentityStep();
  const didit = useDiditVerification(flow.finishDiditAttempt, flow.busy);
  const container = useRef<HTMLElement>(null);
  const inProgress = state.state === 'identity_in_progress';
  useEffect(() => {
    if (!active) return;
    const heading = controls.manual ? container.current?.querySelector<HTMLElement>('[data-manual-review] [data-registration-heading]')
      : container.current?.closest('[data-registration-journey]')?.querySelector<HTMLElement>('[data-registration-heading]');
    heading?.focus();
  }, [controls.manual, active]);
  return (
    <section ref={container} className="space-y-6">
      <div data-identity-choice hidden={controls.manual} className="space-y-6">
        <div className="space-y-4 rounded-lg border bg-primary/5 p-4 sm:p-5">
          <p className="text-xs font-semibold text-primary">Recommended</p>
          <h3 className="flex items-center gap-2 text-lg font-semibold"><ScanFace className="size-5 text-primary" aria-hidden="true" />Automatic Verification</h3>
          <p className="text-sm leading-6 text-muted-foreground">Scan your government-issued ID and take a selfie. Didit reads the legal name on your ID, then an administrator reviews your registration.</p>
          {inProgress ? <>
            {state.sessionUrl && <Button disabled={flow.busy} className="h-auto min-h-11 w-full whitespace-normal py-3" onClick={() => didit.open(state.sessionUrl!)}>Continue in Didit<ArrowRight aria-hidden="true" /></Button>}
            <p className="text-xs leading-5 text-muted-foreground">Complete the scan here. Exiting before you finish resets registration.</p>
          </> : <>
            <p className="text-xs leading-5 text-muted-foreground">By choosing Verify with Didit, you agree to ID and selfie processing for identity verification.</p>
            <Button disabled={flow.busy} className="w-full"
              onClick={() => void flow.identityAction('account-didit-session', { acceptedIdentityTerms: true })}>Verify with Didit<ArrowRight aria-hidden="true" /></Button>
          </>}
        </div>
        <p className="text-center text-sm text-muted-foreground">or</p>
        <div className="space-y-3 rounded-lg border p-4">
          <h3 className="flex items-center gap-2 text-lg font-semibold"><FileCheck className="size-5 text-primary" aria-hidden="true" />Manual Verification</h3>
          <p className="text-sm leading-6 text-muted-foreground">Enter your ID details and upload photos of your ID and a selfie holding it. An administrator reviews your submission.</p>
          <Button variant="outline" className="w-full" disabled={flow.busy}
            onClick={() => controls.setManual(true)}>Submit manually</Button>
        </div>
      </div>
      <div data-manual-review hidden={!controls.manual} className="space-y-6">
        <ManualAccountReview busy={flow.busy} onDraftChange={onDraftChange}
          submit={async (body) => { await flow.identityAction('account-manual-review', body); }}
          consentContent={<p className="text-xs leading-5 text-muted-foreground">By submitting, you agree to an administrator reviewing your ID and selfie for identity verification.</p>} />
        <Button variant="ghost" className="w-full" disabled={flow.busy} onClick={() => controls.setManual(false)}><ArrowLeft aria-hidden="true" />Back to verification options</Button>
      </div>
      <DiditVerificationDialog url={didit.url} frame={didit.frame} close={didit.close} />
    </section>
  );
}
