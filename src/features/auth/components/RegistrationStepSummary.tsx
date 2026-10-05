import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { AccountRegistration } from '@/shared/services/accountRegistrationService';

export function RegistrationStepSummary({ state, step, busy, onContinue }: {
  state: AccountRegistration; step: 'account' | 'email'; busy: boolean; onContinue: () => void;
}) {
  return <div className="space-y-4">
    <p className="break-words text-sm leading-6">{state.email}</p>
    {step === 'account' && <p className="text-sm leading-6 text-muted-foreground">Your account already exists. You can correct its email on the email confirmation step.</p>}
    <Button disabled={busy} className="w-full" onClick={onContinue}>
      {step === 'account' ? 'Continue to name' : 'Continue to identity'}<ArrowRight aria-hidden="true" />
    </Button>
  </div>;
}
