import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { AccountRegistrationFlow } from '../hooks/useAccountRegistration';
import { useEmailConfirmationForm } from '../hooks/useEmailConfirmationForm';
import type { DraftListener } from '../hooks/useRegistrationDraft';
import PasswordField from './PasswordField';
import { ResendConfirmationButton } from './ResendConfirmationButton';

export function EmailConfirmationStep({ flow, email, onDraftChange }: { flow: AccountRegistrationFlow; email: string; onDraftChange?: DraftListener }) {
  const form = useEmailConfirmationForm(flow, email, onDraftChange);
  return (
    <section className="space-y-6" aria-label="Email confirmation">
      <div className="space-y-3">
        <p className="break-words text-sm leading-6">Check {email} for the email titled “TrabaWho: Confirm your email”. Click “Confirm my email” in that email. Check your spam folder too.</p>
        {flow.registration?.emailDelivery?.sent === false && <p role="status" className="text-sm leading-6">Your account is saved, but the confirmation email could not be sent. Request another email below.</p>}
        <Button className="h-auto min-h-11 w-full whitespace-normal py-3" isLoading={flow.busy} onClick={() => void flow.refresh()}>Check email verification<ArrowRight aria-hidden="true" /></Button>
        <p className="text-xs leading-5 text-muted-foreground">Your identity review is complete. Confirm your email to activate account access.</p>
      </div>
      <div className="space-y-2">
        <p className="text-sm leading-6 text-muted-foreground">No email or an expired link? Request another confirmation or correct your email.</p>
        <div className="grid gap-2">
          <ResendConfirmationButton disabled={flow.busy} onClick={() => void flow.emailAction('resend')} />
          <Button variant="ghost" disabled={flow.busy} aria-expanded={form.changingEmail} aria-controls="registration-change-email"
            onClick={() => form.setChangingEmail(!form.changingEmail)}>Change email</Button>
        </div>
      </div>
      {form.changingEmail && <form id="registration-change-email" className="space-y-4 border-t pt-6" onSubmit={(event) => { event.preventDefault(); void form.changeEmail(); }}>
        <div className="space-y-2"><Label htmlFor="change-email">New email address</Label>
          <Input id="change-email" type="email" autoComplete="email" required disabled={flow.busy} value={form.newEmail}
            placeholder="you@example.com"
            aria-describedby="change-email-help" onChange={(event) => form.setNewEmail(event.target.value)} />
          <p id="change-email-help" className="text-xs leading-5 text-muted-foreground">Your old confirmation link will stop working. We’ll send a new one to this address.</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button type="button" variant="ghost" disabled={flow.busy} onClick={() => form.setChangingEmail(false)}>Previous</Button>
          <Button type="submit" variant="outline" disabled={flow.busy}>Save email and resend</Button>
        </div>
      </form>}
      <form className="space-y-4 border-t pt-6" onSubmit={(event) => { event.preventDefault(); void form.resume(); }}>
        <div className="space-y-2"><h3 className="text-lg font-semibold">I have confirmed my email</h3>
          <p className="text-sm leading-6 text-muted-foreground">Sign in to continue here, even if you opened the link on another device.</p>
        </div>
        <div className="space-y-2"><Label htmlFor="resume-email">Email</Label>
          <Input id="resume-email" type="email" autoComplete="email" required disabled={flow.busy} value={form.signInEmail}
            placeholder="you@example.com"
            onChange={(event) => form.setSignInEmail(event.target.value)} />
        </div>
        <PasswordField id="resume-password" label="Password" required autoComplete="current-password" disabled={flow.busy}
          value={form.password} onChange={(event) => form.setPassword(event.target.value)} />
        <Button type="submit" isLoading={flow.busy} className="h-auto min-h-11 w-full whitespace-normal py-3">Sign in and continue<ArrowRight aria-hidden="true" /></Button>
      </form>
    </section>
  );
}
