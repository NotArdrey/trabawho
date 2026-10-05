import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { AccountRegistration } from '@/shared/services/accountRegistrationService';
import type { AccountRegistrationFlow } from '../hooks/useAccountRegistration';
import type { DraftListener } from '../hooks/useRegistrationDraft';
import { useSignupNameForm } from '../hooks/useSignupNameForm';

export function SignupNameStep({ flow, state, onContinue, onDraftChange }: {
  flow: AccountRegistrationFlow; state: AccountRegistration; onContinue: () => void; onDraftChange?: DraftListener;
}) {
  const form = useSignupNameForm(flow, state, onContinue, onDraftChange);
  return (
    <form className="space-y-4" noValidate onSubmit={(event) => { event.preventDefault(); void form.submit(); }}>
      {form.editable ? <div className="space-y-2">
        <Label htmlFor="registration-name">Complete name</Label>
        <Input id="registration-name" autoComplete="name" required maxLength={200} value={form.name} disabled={flow.busy}
          placeholder="Enter your complete name" aria-invalid={Boolean(form.error)} aria-describedby={form.error ? 'registration-name-error registration-name-help' : 'registration-name-help'}
          onChange={(event) => form.setName(event.target.value)} />
        {form.error && <p id="registration-name-error" role="alert" className="text-sm text-destructive">{form.error}</p>}
        <p id="registration-name-help" className="text-xs leading-5 text-muted-foreground">Use the name on your ID. Entering it here does not verify your identity.</p>
      </div> : <p className="break-words text-sm leading-6">{state.signupName || 'Your complete legal name will be checked during identity verification.'}</p>}
      <Button type="submit" isLoading={flow.busy} className="w-full">Continue to identity<ArrowRight aria-hidden="true" /></Button>
    </form>
  );
}
