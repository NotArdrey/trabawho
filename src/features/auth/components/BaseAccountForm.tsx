import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useBaseAccountForm } from '../hooks/useBaseAccountForm';
import type { AccountRegistrationFlow } from '../hooks/useAccountRegistration';
import type { DraftListener } from '../hooks/useRegistrationDraft';
import PasswordField from './PasswordField';
import { SignupRoleChoice } from './SignupRoleChoice';
import { RegistrationTerms } from './RegistrationTerms';

export function BaseAccountForm({ flow, onDraftChange }: { flow: AccountRegistrationFlow; onDraftChange?: DraftListener }) {
  const form = useBaseAccountForm(flow.create, onDraftChange);
  return (
    <form noValidate className="space-y-4" onSubmit={(event) => {
      event.preventDefault();
      void form.submit().then((id) => { if (id) document.getElementById(id)?.focus(); });
    }}>
      <SignupRoleChoice value={form.signupRole} onChange={form.setSignupRole} disabled={flow.busy} error={form.errors.signupRole} />
      <div className="space-y-2">
        <Label htmlFor="registration-email">Email</Label>
        <Input id="registration-email" type="email" autoComplete="email" required disabled={flow.busy} value={form.email}
          placeholder="you@example.com" aria-invalid={Boolean(form.errors.email)}
          aria-describedby={form.errors.email ? 'registration-email-error' : undefined} onChange={(event) => form.setEmail(event.target.value)} />
        {form.errors.email && <p id="registration-email-error" role="alert" className="text-sm text-destructive">{form.errors.email}</p>}
      </div>
      <div className="space-y-2"><PasswordField id="registration-password" label="Password" error={form.errors.password} minLength={8} maxLength={128}
        placeholder="Create a password"
        autoComplete="new-password" required disabled={flow.busy} value={form.password} aria-describedby="registration-password-help"
        onChange={(event) => form.setPassword(event.target.value)} />
      <p id="registration-password-help" className="text-xs leading-5 text-muted-foreground">Use at least 8 characters, with no spaces at the start or end.</p></div>
      <PasswordField id="registration-confirm-password" label="Confirm password" error={form.errors.confirmPassword}
        placeholder="Re-enter your password" autoComplete="new-password" required disabled={flow.busy} value={form.confirmPassword}
        onChange={(event) => form.setConfirmPassword(event.target.value)} />
      <div className="space-y-2">
        <div className="flex min-h-11 items-center gap-3 text-sm leading-5">
          <Checkbox id="account-terms" aria-label="I agree to the Terms and Conditions" required disabled={flow.busy} checked={form.terms} aria-invalid={Boolean(form.errors.acceptedTerms)}
            aria-describedby={form.errors.acceptedTerms ? 'account-terms-error' : undefined} onChange={(event) => form.setTerms(event.target.checked)} />
          <div className="flex flex-wrap items-center gap-x-1"><label htmlFor="account-terms" className="flex min-h-11 cursor-pointer items-center">I agree to the</label><RegistrationTerms disabled={flow.busy} /></div>
        </div>
        {form.errors.acceptedTerms && <p id="account-terms-error" role="alert" className="text-sm text-destructive">{form.errors.acceptedTerms}</p>}
      </div>
      <Button type="submit" isLoading={flow.busy} className="h-auto min-h-11 w-full whitespace-normal py-3">Continue<ArrowRight aria-hidden="true" /></Button>
      <p className="text-xs leading-5 text-muted-foreground">We send an email confirmation link first. After confirming your email, complete identity verification and wait for administrator review.</p>
    </form>
  );
}
