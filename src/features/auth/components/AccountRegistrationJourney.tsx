import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, LoaderCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useAccountRegistration } from '../hooks/useAccountRegistration';
import type { DraftListener } from '../hooks/useRegistrationDraft';
import { BaseAccountForm } from './BaseAccountForm';
import { IdentityResultStep } from './IdentityResultStep';
import { IdentityVerificationStep } from './IdentityVerificationStep';
import { RegistrationFeedback } from './RegistrationFeedback';
import { RegistrationProgress } from './RegistrationProgress';
import { RegistrationHeader } from './RegistrationHeader';
import { registrationProgress } from '../domain/registrationProgress';
import { SignupNameStep } from './SignupNameStep';
import { RegistrationStepSummary } from './RegistrationStepSummary';
import { useRegistrationDraftTracking } from '../hooks/useRegistrationDraftTracking';

export function AccountRegistrationJourney({ onDraftChange, onStartedChange }: { onDraftChange?: DraftListener; onStartedChange?: (started: boolean) => void }) {
  const flow = useAccountRegistration();
  const drafts = useRegistrationDraftTracking(onDraftChange);
  const state = flow.registration;
  const currentState = state?.state;
  const [view, setView] = useState<{ step: number; state: typeof currentState } | null>(null);
  const step = view && view.state === currentState ? view.step : registrationProgress(state);
  const goTo = (next: number) => setView({ step: next, state: currentState });
  const container = useRef<HTMLDivElement>(null);
  useEffect(() => { onStartedChange?.(Boolean(state)); }, [state, onStartedChange]);
  useEffect(() => {
    if (!flow.initializing) container.current?.querySelector<HTMLElement>('[data-registration-heading]')?.focus();
  }, [currentState, step, flow.initializing]);
  return (
    <div ref={container} data-registration-journey className="min-w-0 space-y-4">
      <RegistrationHeader registration={state} step={step} />
      <RegistrationProgress registration={state} step={step} />
      {flow.initializing ? <p role="status" className="flex min-h-40 items-center justify-center gap-3 text-sm text-muted-foreground">
        <LoaderCircle className="size-5 animate-spin motion-reduce:animate-none" aria-hidden="true" />Loading your registration…
      </p> : <>
        <RegistrationFeedback error={flow.error} message={flow.message} busy={flow.busy} />
        {flow.restoreFailed ? <div className="space-y-4">
          {state && step < 3 ? <>
            <p className="break-words text-sm leading-6">{step === 1 ? state.email : state.signupName || 'Your name has not been saved yet.'}</p>
            <p className="text-sm leading-6 text-muted-foreground">Your saved details are kept. Restore your registration to make changes or continue verification.</p>
            <Button variant="outline" className="w-full" onClick={() => goTo(step + 1)}>{step === 1 ? 'Continue to name' : 'Continue to identity'}</Button>
          </> : null}
          <p className="text-sm leading-6 text-muted-foreground">{flow.restoreNeedsSignIn
            ? 'Sign in with your existing account to resume registration. Your saved details will be restored.'
            : 'Your registration could not be restored. Check your connection and try again.'}</p>
          {flow.restoreNeedsSignIn ? <Button asChild className="w-full"><Link to="/sign-in">Sign in to continue</Link></Button>
            : <Button className="w-full" disabled={flow.busy} onClick={() => void flow.retryRestore()}>Retry loading registration</Button>}
          {state && step > 1 ? <Button variant="ghost" className="w-full" disabled={flow.busy} onClick={() => goTo(step - 1)}><ArrowLeft aria-hidden="true" />Back</Button>
            : <Button asChild variant="ghost" className="w-full"><Link to="/sign-in"><ArrowLeft aria-hidden="true" />Back</Link></Button>}
        </div> : !state ? <BaseAccountForm flow={flow} onDraftChange={drafts.account} /> : <>
          <div hidden={step !== 1}><RegistrationStepSummary state={state} step="account" busy={flow.busy} onContinue={() => goTo(2)} /></div>
          <div hidden={step !== 2}><SignupNameStep flow={flow} state={state} onContinue={() => goTo(3)} onDraftChange={drafts.name} /></div>
          <div hidden={step !== 3}>
            {['email_pending', 'identity_pending', 'identity_in_progress', 'declined'].includes(state.state)
              ? <IdentityVerificationStep flow={flow} state={state} active={step === 3} onDraftChange={drafts.identity} />
              : <IdentityResultStep flow={flow} state={state} onDraftChange={drafts.identity} />}
          </div>
          {state.state !== 'ready' && step > 1 && <Button variant="ghost" className="w-full" disabled={flow.busy} onClick={() => goTo(step - 1)}><ArrowLeft aria-hidden="true" />Back</Button>}
          {step === 1 && <Button variant="ghost" disabled={flow.busy} className="h-auto min-h-11 w-full whitespace-normal text-primary" onClick={() => void flow.startNewRegistration()}>Use a different account</Button>}
        </>}
      </>}
    </div>
  );
}
