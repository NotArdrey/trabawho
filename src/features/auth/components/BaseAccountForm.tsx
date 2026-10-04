import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useBaseAccountForm } from '../hooks/useBaseAccountForm';
import type { AccountRegistrationFlow } from '../hooks/useAccountRegistration';
import type { DraftListener } from '../hooks/useRegistrationDraft';
import PasswordField from './PasswordField';

export function BaseAccountForm({ flow, onDraftChange }: { flow: AccountRegistrationFlow; onDraftChange?: DraftListener }) {
  const form = useBaseAccountForm(flow.create, onDraftChange);
  return (
    <form noValidate className="space-y-4" onSubmit={(event) => {
      event.preventDefault();
      void form.submit().then((id) => { if (id) document.getElementById(id)?.focus(); });
    }}>
      <div className="space-y-2">
        <Label htmlFor="registration-email">Email</Label>
        <Input id="registration-email" type="email" autoComplete="email" required disabled={flow.busy} value={form.email}
          placeholder="you@example.com" aria-invalid={Boolean(form.errors.email)}
          aria-describedby={form.errors.email ? 'registration-email-error' : undefined} onChange={(event) => form.setEmail(event.target.value)} />
        {form.errors.email && <p id="registration-email-error" role="alert" className="text-sm text-destructive">{form.errors.email}</p>}
      </div>
      <div className="space-y-2"><PasswordField id="registration-password" label="Password" error={form.errors.password} minLength={8} maxLength={128}
        autoComplete="new-password" required disabled={flow.busy} value={form.password} aria-describedby="registration-password-help"
        onChange={(event) => form.setPassword(event.target.value)} />
      <p id="registration-password-help" className="text-xs leading-5 text-muted-foreground">Use at least 8 characters, with no spaces at the start or end.</p></div>
      <div className="space-y-2">
        <label htmlFor="account-terms" className="flex min-h-11 cursor-pointer items-start gap-3 py-3 text-sm leading-5">
          <Checkbox id="account-terms" required disabled={flow.busy} checked={form.terms} aria-invalid={Boolean(form.errors.acceptedTerms)}
            aria-describedby={form.errors.acceptedTerms ? 'account-terms-error' : undefined} onChange={(event) => form.setTerms(event.target.checked)} />
          I agree to the Terms and Conditions
        </label>
        {form.errors.acceptedTerms && <p id="account-terms-error" role="alert" className="text-sm text-destructive">{form.errors.acceptedTerms}</p>}
        <details>
          <summary className="min-h-11 cursor-pointer rounded-lg py-3 text-sm font-medium text-primary">Read Terms and Conditions</summary>
          <p className="pb-3 text-sm leading-6 text-muted-foreground">TrabaWho processes account, booking, contact, and verification information under the Data Privacy Act of 2012. You agree to provide accurate information and use the marketplace responsibly. Identity evidence is used to verify access; identity consent is requested separately before capture.</p>
        </details>
      </div>
      <Button type="submit" isLoading={flow.busy} className="h-auto min-h-11 w-full whitespace-normal py-3">Create account<ArrowRight aria-hidden="true" /></Button>
      <p className="text-xs leading-5 text-muted-foreground">Everyone can book after verification. Set up offering services when you’re ready.</p>
    </form>
  );
}
