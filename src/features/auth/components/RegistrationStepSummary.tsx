import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { AccountRegistration } from '@/shared/services/accountRegistrationService';

export function RegistrationStepSummary({ state, step, busy, onContinue }: {
  state: AccountRegistration; step: 'account'; busy: boolean; onContinue: () => void;
}) {
  return <div className="space-y-4">
    <p className="break-words text-sm leading-6">{state.email}</p>
    <p className="text-sm leading-6 text-muted-foreground">{step === 'account' && 'Your account details are saved.'} Continue with identity verification. Email confirmation follows administrator approval.</p>
    <Button disabled={busy} className="w-full" onClick={onContinue}>
      Continue to identity<ArrowRight aria-hidden="true" />
    </Button>
  </div>;
}
