import { useEffect, useRef } from 'react';
import { ArrowRight, ScanFace } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { AccountRegistration } from '@/shared/services/accountRegistrationService';
import type { AccountRegistrationFlow } from '../hooks/useAccountRegistration';
import { useDiditVerification } from '../hooks/useDiditVerification';
import { DiditVerificationDialog } from './DiditVerificationDialog';

export function IdentityVerificationStep({ flow, state, active = true }: { flow: AccountRegistrationFlow; state: AccountRegistration; active?: boolean }) {
  const didit = useDiditVerification(flow.finishDiditAttempt, flow.busy);
  const container = useRef<HTMLElement>(null);
  const inProgress = state.state === 'identity_in_progress';
  useEffect(() => {
    if (!active) return;
    const heading = container.current?.closest('[data-registration-journey]')?.querySelector<HTMLElement>('[data-registration-heading]');
    heading?.focus();
  }, [active]);
  return (
    <section ref={container} className="space-y-6">
      <div className="space-y-4 rounded-lg border bg-primary/5 p-4 sm:p-5">
        <h3 className="flex items-center gap-2 text-lg font-semibold"><ScanFace className="size-5 text-primary" aria-hidden="true" />Automatic Verification</h3>
        <p className="text-sm leading-6 text-muted-foreground">Scan your government-issued ID and take a selfie. Didit reads the legal name on your ID, then an administrator reviews your registration.</p>
        {inProgress ? <>
          {state.sessionUrl && <Button disabled={flow.busy} className="h-auto min-h-11 w-full whitespace-normal py-3" onClick={() => didit.open(state.sessionUrl!)}>Continue in Didit<ArrowRight aria-hidden="true" /></Button>}
          <p className="text-xs leading-5 text-muted-foreground">Complete the scan here. Exiting before you finish resets registration.</p>
          <Button variant="outline" disabled={flow.busy} className="w-full" onClick={() => void flow.refresh()}>Check verification status</Button>
        </> : <>
          <p className="text-xs leading-5 text-muted-foreground">By choosing Verify with Didit, you agree to ID and selfie processing for identity verification.</p>
          <Button disabled={flow.busy} className="w-full"
            onClick={() => void flow.identityAction('account-didit-session', { acceptedIdentityTerms: true })}>Verify with Didit<ArrowRight aria-hidden="true" /></Button>
        </>}
      </div>
      <DiditVerificationDialog url={didit.url} frame={didit.frame} close={didit.close} />
    </section>
  );
}
