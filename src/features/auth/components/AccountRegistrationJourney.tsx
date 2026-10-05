import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, LoaderCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAccountRegistration } from '../hooks/useAccountRegistration';
import type { DraftListener } from '../hooks/useRegistrationDraft';
import { BaseAccountForm } from './BaseAccountForm';
import { EmailConfirmationStep } from './EmailConfirmationStep';
import { IdentityResultStep } from './IdentityResultStep';
import { IdentityVerificationStep } from './IdentityVerificationStep';
import { RegistrationFeedback } from './RegistrationFeedback';
import { RegistrationProgress } from './RegistrationProgress';
import { RegistrationHeader } from './RegistrationHeader';
import { registrationProgress } from '../domain/registrationProgress';
import { SignupNameStep } from './SignupNameStep';
import { RegistrationStepSummary } from './RegistrationStepSummary';
import { useRegistrationDraftTracking } from '../hooks/useRegistrationDraftTracking';

export function AccountRegistrationJourney({ onDraftChange }: { onDraftChange?: DraftListener }) {
  const flow = useAccountRegistration();
  const drafts = useRegistrationDraftTracking(onDraftChange);
  const state = flow.registration;
  const currentState = state?.state;
  const [view, setView] = useState<{ step: number; state: typeof currentState } | null>(null);
  const step = view && view.state === currentState ? view.step : registrationProgress(state);
  const goTo = (next: number) => setView({ step: next, state: currentState });
  const container = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!flow.initializing) container.current?.querySelector<HTMLElement>('[data-registration-heading]')?.focus();
  }, [currentState, step, flow.initializing]);
  return (
    <div ref={container} data-registration-journey className="min-w-0 space-y-6">
      <RegistrationHeader registration={state} step={step} />
      <RegistrationProgress registration={state} step={step} />
      {flow.initializing ? <p role="status" className="flex min-h-40 items-center justify-center gap-3 text-sm text-muted-foreground">
        <LoaderCircle className="size-5 animate-spin motion-reduce:animate-none" aria-hidden="true" />Loading your registration…
      </p> : <>
        <RegistrationFeedback error={flow.error} message={flow.message} busy={flow.busy} />
        {flow.restoreFailed ? <div className="space-y-4">
          <p className="text-sm leading-6 text-muted-foreground">Your registration could not be restored. Check your connection and try again.</p>
          <Button className="w-full" onClick={() => void flow.retryRestore()}>Retry loading registration</Button>
        </div> : !state ? <BaseAccountForm flow={flow} onDraftChange={drafts.account} /> : <>
          {state.state !== 'ready' && step > 1 && <Button variant="ghost" disabled={flow.busy} onClick={() => goTo(step - 1)}><ArrowLeft aria-hidden="true" />Back</Button>}
          <div hidden={step !== 1}><RegistrationStepSummary state={state} step="account" busy={flow.busy} onContinue={() => goTo(2)} /></div>
          <div hidden={step !== 2}><SignupNameStep flow={flow} state={state} onContinue={() => goTo(3)} onDraftChange={drafts.name} /></div>
          <div hidden={step !== 3}>
            {state.state === 'email_pending' ? <EmailConfirmationStep flow={flow} email={state.email || ''} onDraftChange={drafts.email} />
              : <RegistrationStepSummary state={state} step="email" busy={flow.busy} onContinue={() => setView(null)} />}
          </div>
          <div hidden={step !== 4}>
            {state.state !== 'email_pending' && (['identity_pending', 'identity_in_progress', 'declined'].includes(state.state)
              ? <IdentityVerificationStep flow={flow} state={state} active={step === 4} onDraftChange={drafts.identity} />
              : <IdentityResultStep flow={flow} state={state} onDraftChange={drafts.identity} />)}
          </div>
          <Button variant="ghost" disabled={flow.busy} className="h-auto min-h-11 w-full whitespace-normal text-primary" onClick={() => void flow.startNewRegistration()}>
            {state.state === 'email_pending' ? 'Register another account' : 'Sign out and register another account'}
          </Button>
        </>}
      </>}
    </div>
  );
}
