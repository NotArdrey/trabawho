import { useEffect, useRef } from 'react';
import { LoaderCircle } from 'lucide-react';
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

export function AccountRegistrationJourney({ onDraftChange }: { onDraftChange?: DraftListener }) {
  const flow = useAccountRegistration();
  const state = flow.registration;
  const currentState = state?.state;
  const container = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!flow.initializing && currentState) container.current?.querySelector<HTMLElement>('[data-registration-heading]')?.focus();
  }, [currentState, flow.initializing]);
  return (
    <div ref={container} className="min-w-0 space-y-6">
      <RegistrationHeader registration={state} />
      <RegistrationProgress registration={state} />
      {flow.initializing ? <p role="status" className="flex min-h-40 items-center justify-center gap-3 text-sm text-muted-foreground">
        <LoaderCircle className="size-5 animate-spin motion-reduce:animate-none" aria-hidden="true" />Loading your registration…
      </p> : <>
        <RegistrationFeedback error={flow.error} message={flow.message} busy={flow.busy} />
        {flow.restoreFailed ? <div className="space-y-4">
          <p className="text-sm leading-6 text-muted-foreground">Your registration could not be restored. Check your connection and try again.</p>
          <Button className="w-full" onClick={() => void flow.retryRestore()}>Retry loading registration</Button>
        </div> : !state ? <BaseAccountForm flow={flow} onDraftChange={onDraftChange} />
          : state.state === 'email_pending' ? <EmailConfirmationStep flow={flow} email={state.email || ''} onDraftChange={onDraftChange} />
            : ['identity_pending', 'identity_in_progress', 'declined'].includes(state.state)
              ? <IdentityVerificationStep flow={flow} state={state} onDraftChange={onDraftChange} />
              : <IdentityResultStep flow={flow} state={state} onDraftChange={onDraftChange} />}
      </>}
    </div>
  );
}
