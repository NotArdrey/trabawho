import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { AccountRegistration } from '@/shared/services/accountRegistrationService';

export function RegistrationStepSummary({ state, step, busy, onContinue }: {
  state: AccountRegistration; step: 'account' | 'email'; busy: boolean; onContinue: () => void;
}) {
  return <div className="space-y-4">
    <p className="break-words text-sm leading-6">{state.email}</p>
    <p className="text-sm leading-6 text-muted-foreground">{step === 'account' ? 'Your account details are saved.' : 'Your email is confirmed.'} {state.state === 'email_pending' ? 'Confirm your email before verifying your identity.' : 'Continue with identity verification to finish registration.'}</p>
    <Button disabled={busy} className="w-full" onClick={onContinue}>
      {state.state === 'email_pending' ? 'Continue to email verification' : 'Continue to identity'}<ArrowRight aria-hidden="true" />
    </Button>
  </div>;
}
