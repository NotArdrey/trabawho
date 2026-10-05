import { useEffect, useRef } from 'react';
import { ArrowLeft, ArrowRight, ExternalLink } from 'lucide-react';
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
        {!inProgress && <div className="space-y-3">
          <ol className="space-y-3 text-sm leading-6">
            {['Have your government ID ready. Upload an existing ID photo if Didit offers that option, or capture your ID with your camera.', 'Use good lighting and a camera-enabled device for the selfie check.', 'Check the complete name from your ID afterwards.'].map((item, index) =>
              <li key={item} className="flex items-start gap-3"><span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">{index + 1}</span>{item}</li>)}
          </ol>
          <p className="text-xs leading-5 text-muted-foreground">If you cannot use Didit, manual review lets you upload your ID photos and selfie for an administrator to check.</p>
          <label htmlFor="account-identity-consent" className="flex min-h-11 cursor-pointer items-start gap-3 py-3 text-sm leading-5">
            <Checkbox id="account-identity-consent" disabled={flow.busy} checked={controls.consent} aria-describedby="identity-consent-help"
              onChange={(event) => controls.setConsent(event.target.checked)} />
            I consent to identity verification using my ID and selfie.
          </label>
          <p id="identity-consent-help" className="text-xs leading-5 text-muted-foreground">Select the consent checkbox to start verification or choose manual review.</p>
        </div>}
        <div className="space-y-3">
          <Button variant="outline" className="h-auto min-h-11 w-full whitespace-normal py-3" disabled={flow.busy || (!inProgress && !controls.consent)}
            onClick={() => controls.setManual(true)}>{inProgress ? 'Didit cannot verify my document' : 'Use manual identity review instead'}</Button>
          {inProgress ? <>
            <Button variant="outline" disabled={flow.busy} className="h-auto min-h-11 w-full whitespace-normal py-3" onClick={() => void flow.refresh()}>Check verification status</Button>
            {state.sessionUrl && <Button asChild className="h-auto min-h-11 w-full whitespace-normal py-3"><a href={state.sessionUrl}>Continue in Didit<ExternalLink aria-hidden="true" /></a></Button>}
          </> : <Button disabled={!controls.consent || flow.busy} className="h-auto min-h-11 w-full whitespace-normal py-3"
            onClick={() => void flow.identityAction('account-didit-session', { acceptedIdentityTerms: controls.consent })}>Start identity verification<ArrowRight aria-hidden="true" /></Button>}
        </div>
      </div>
      <div data-manual-review hidden={!controls.manual} className="space-y-6">
        <Button variant="ghost" disabled={flow.busy} onClick={() => controls.setManual(false)}><ArrowLeft aria-hidden="true" />Previous</Button>
        <ManualAccountReview busy={flow.busy} canSubmit={controls.consent} onDraftChange={onDraftChange}
          submit={async (body) => { await flow.identityAction('account-manual-review', body); }}
          consentContent={<label htmlFor="fallback-identity-consent" className="flex min-h-11 cursor-pointer items-start gap-3 py-3 text-sm leading-5">
            <Checkbox id="fallback-identity-consent" disabled={flow.busy} checked={controls.consent} onChange={(event) => controls.setConsent(event.target.checked)} />
            I consent to manual review of my ID and selfie.
          </label>} />
      </div>
    </section>
  );
}
