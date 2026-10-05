import { useEffect, useRef } from 'react';
import { ArrowLeft, ArrowRight, ExternalLink, FileCheck, ScanFace } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import type { AccountRegistration } from '@/shared/services/accountRegistrationService';
import type { AccountRegistrationFlow } from '../hooks/useAccountRegistration';
import { useIdentityStep } from '../hooks/useIdentityStep';
import type { DraftListener } from '../hooks/useRegistrationDraft';
import { ManualAccountReview } from './ManualAccountReview';

export function IdentityVerificationStep({ flow, state, onDraftChange, active = true }: { flow: AccountRegistrationFlow; state: AccountRegistration; onDraftChange?: DraftListener; active?: boolean }) {
  const controls = useIdentityStep();
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
        {!inProgress && <label htmlFor="account-identity-consent" className="flex min-h-11 cursor-pointer items-start gap-3 py-3 text-sm leading-5">
          <Checkbox id="account-identity-consent" disabled={flow.busy} checked={controls.consent}
            onChange={(event) => controls.setConsent(event.target.checked)} />
          I consent to identity verification using my ID and selfie.
        </label>}
        <div className="space-y-3 rounded-lg border p-4">
          <p className="text-xs font-semibold text-primary">Recommended</p>
          <h3 className="flex items-center gap-2 text-lg font-semibold"><ScanFace className="size-5 text-primary" aria-hidden="true" />Automatic Verification</h3>
          <p className="text-sm leading-6 text-muted-foreground">Verify securely using your government-issued ID and a selfie. Didit extracts your legal name from your ID.</p>
          {inProgress ? <>
            {state.sessionUrl && <Button asChild className="h-auto min-h-11 w-full whitespace-normal py-3"><a href={state.sessionUrl}>Continue in Didit<ExternalLink aria-hidden="true" /></a></Button>}
            <Button variant="outline" disabled={flow.busy} className="w-full" onClick={() => void flow.refresh()}>Check verification status</Button>
          </> : <Button disabled={!controls.consent || flow.busy} className="w-full"
            onClick={() => void flow.identityAction('account-didit-session', { acceptedIdentityTerms: controls.consent })}>Verify with Didit<ArrowRight aria-hidden="true" /></Button>}
        </div>
        <p className="text-center text-sm text-muted-foreground">or</p>
        <div className="space-y-3 rounded-lg border p-4">
          <h3 className="flex items-center gap-2 text-lg font-semibold"><FileCheck className="size-5 text-primary" aria-hidden="true" />Manual Verification</h3>
          <p className="text-sm leading-6 text-muted-foreground">Submit your ID and a selfie holding it for an administrator to review.</p>
          <Button variant="outline" className="w-full" disabled={flow.busy}
            onClick={() => controls.setManual(true)}>Submit manually</Button>
        </div>
      </div>
      <div data-manual-review hidden={!controls.manual} className="space-y-6">
        <ManualAccountReview busy={flow.busy} canSubmit={controls.consent} onDraftChange={onDraftChange}
          submit={async (body) => { await flow.identityAction('account-manual-review', body); }}
          consentContent={<label htmlFor="fallback-identity-consent" className="flex min-h-11 cursor-pointer items-start gap-3 py-3 text-sm leading-5">
            <Checkbox id="fallback-identity-consent" disabled={flow.busy} checked={controls.consent} onChange={(event) => controls.setConsent(event.target.checked)} />
            I consent to manual review of my ID and selfie.
          </label>} />
        <Button variant="ghost" className="w-full" disabled={flow.busy} onClick={() => controls.setManual(false)}><ArrowLeft aria-hidden="true" />Back to verification options</Button>
      </div>
    </section>
  );
}
