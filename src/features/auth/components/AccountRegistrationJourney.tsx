import { useState } from 'react';
import { ShieldCheck, Mail, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { useAccountRegistration } from '../hooks/useAccountRegistration';
import PasswordField from './PasswordField';
import { ManualAccountReview } from './ManualAccountReview';
import { baseAccountErrors, type BaseAccountErrors } from '../domain/baseAccountValidation';

export function AccountRegistrationJourney() {
  const flow = useAccountRegistration(); const state = flow.registration;
  const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [terms, setTerms] = useState(false);
  const [consent, setConsent] = useState(false); const [manual, setManual] = useState(false); const [requested, setRequested] = useState('');
  const [changeEmail, setChangeEmail] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<BaseAccountErrors>({});
  return <div className="space-y-5">
    <ol aria-label="Account verification steps" className="flex flex-wrap gap-2 text-xs text-muted-foreground"><li>1. Account</li><li>2. Confirm email</li><li>3. Verify identity</li><li>4. Confirm name</li></ol>
    {flow.error && <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{flow.error}</p>}
    {flow.message && <p role="status" className="rounded-lg bg-muted p-3 text-sm">{flow.message}</p>}
    {!state && <form noValidate className="space-y-4" onSubmit={(event) => {
      event.preventDefault(); const errors = baseAccountErrors({ email, password, acceptedTerms: terms }); setFieldErrors(errors);
      if (Object.keys(errors).length) { document.getElementById(errors.email ? 'registration-email' : errors.password ? 'registration-password' : 'account-terms')?.focus(); return; }
      void flow.create(email.trim(), password, terms).then(() => setPassword(''));
    }}>
      <div className="space-y-2"><Label htmlFor="registration-email">Email</Label><Input id="registration-email" type="email" autoComplete="email" required value={email} aria-invalid={Boolean(fieldErrors.email)} aria-describedby={fieldErrors.email ? 'registration-email-error' : undefined} onChange={(event) => setEmail(event.target.value)} />{fieldErrors.email && <p id="registration-email-error" role="alert" className="text-sm text-destructive">{fieldErrors.email}</p>}</div>
      <PasswordField id="registration-password" label="Password" error={fieldErrors.password} minLength={8} maxLength={128} autoComplete="new-password" required value={password} onChange={(event) => setPassword(event.target.value)} />
      <p className="text-sm text-muted-foreground">Use at least 8 characters. Everyone can book services after verification. You can set up offering services later.</p>
      <label htmlFor="account-terms" className="flex min-h-11 items-center gap-3 text-sm"><Checkbox id="account-terms" required checked={terms} aria-invalid={Boolean(fieldErrors.acceptedTerms)} aria-describedby={fieldErrors.acceptedTerms ? 'account-terms-error' : undefined} onChange={(event) => setTerms(event.target.checked)} />I agree to the Terms and Conditions</label>
      {fieldErrors.acceptedTerms && <p id="account-terms-error" role="alert" className="text-sm text-destructive">{fieldErrors.acceptedTerms}</p>}
      <details className="text-sm"><summary className="min-h-11 cursor-pointer py-3">Read Terms and Conditions</summary><p className="leading-6 text-muted-foreground">TrabaWho processes account, booking, contact, and verification information under the Data Privacy Act of 2012. You agree to provide accurate information and use the marketplace responsibly. Identity evidence is used to verify access; identity consent is requested separately before capture.</p></details>
      <Button type="submit" isLoading={flow.busy} className="w-full">Create account</Button>
    </form>}
    {state?.state === 'email_pending' && <section className="space-y-4" aria-label="Email confirmation">
      <Mail className="size-8 text-primary" aria-hidden="true" /><h2 className="text-xl font-semibold">Confirm your email</h2>
      <p className="break-words text-sm">Open the confirmation link sent to {state.email}. Check spam too. Identity verification starts after your email is confirmed.</p>
      <p className="text-sm text-muted-foreground">If the link has expired or delivery failed, request a new one. After confirming on another device, sign in below to resume this account.</p>
      <div className="flex flex-wrap gap-2"><Button variant="outline" disabled={flow.busy} onClick={() => void flow.emailAction('resend')}>Resend confirmation email</Button><Button variant="ghost" disabled={flow.busy} onClick={() => setChangeEmail(!changeEmail)}>Change email</Button></div>
      {changeEmail && <form className="space-y-3" onSubmit={(event) => { event.preventDefault(); void flow.emailAction('change_email', email); }}><Label htmlFor="change-email">New email address</Label><Input id="change-email" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} /><Button type="submit" disabled={flow.busy}>Save email and resend</Button></form>}
      <form className="space-y-3 border-t pt-4" onSubmit={(event) => { event.preventDefault(); void flow.resume(email || state.email || '', password).then(() => setPassword('')); }}><h3 className="font-semibold">I have confirmed my email</h3><Label htmlFor="resume-email">Email</Label><Input id="resume-email" type="email" required value={email || state.email || ''} onChange={(event) => setEmail(event.target.value)} /><PasswordField id="resume-password" label="Password" required autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} /><Button type="submit" isLoading={flow.busy}>Sign in and continue</Button></form>
    </section>}
    {(state?.state === 'identity_pending' || state?.state === 'declined') && <section className="space-y-4">
      <ShieldCheck className="size-8 text-primary" aria-hidden="true" /><h2 className="text-xl font-semibold">{state.state === 'declined' ? 'Verification needs another attempt' : 'Verify your identity'}</h2>
      <p className="text-sm">{state.state === 'declined' ? 'Your previous attempt was declined, abandoned, or expired. Access remains blocked. You can retry with valid evidence.' : 'Your email is confirmed. Didit will guide you through choosing a supported government ID, scanning it, and taking a selfie.'}</p>
      <label htmlFor="account-identity-consent" className="flex min-h-11 items-center gap-3 text-sm"><Checkbox id="account-identity-consent" checked={consent} onChange={(event) => setConsent(event.target.checked)} />I consent to identity verification using my ID and selfie.</label>
      <Button disabled={!consent || flow.busy} onClick={() => void flow.identityAction('account-didit-session', { acceptedIdentityTerms: consent })}>Start identity verification</Button>
      <Button variant="outline" disabled={!consent || flow.busy} onClick={() => setManual(!manual)}>Use manual identity review instead</Button>
      {manual && <ManualAccountReview busy={flow.busy} submit={(body) => flow.identityAction('account-manual-review', body)} />}
    </section>}
    {state?.state === 'identity_in_progress' && <section className="space-y-4"><h2 className="text-xl font-semibold">Identity verification in progress</h2><p className="text-sm">Continue the same session, including on another device. Return here to check the server-verified result.</p>{state.sessionUrl && <Button asChild><a href={state.sessionUrl}>Continue in Didit <ExternalLink className="size-4" aria-hidden="true" /></a></Button>}<Button variant="outline" isLoading={flow.busy} onClick={() => void flow.refresh()}>Check verification status</Button><Button variant="outline" disabled={flow.busy} onClick={() => setManual(!manual)}>Didit cannot verify my document</Button>{manual && <div className="space-y-3"><label htmlFor="fallback-identity-consent" className="flex min-h-11 items-center gap-3 text-sm"><Checkbox id="fallback-identity-consent" checked={consent} onChange={(event) => setConsent(event.target.checked)} />I consent to manual review of my ID and selfie.</label><ManualAccountReview busy={flow.busy} canSubmit={consent} submit={(body) => flow.identityAction('account-manual-review', body)} /></div>}</section>}
    {state?.state === 'name_pending' && <section className="space-y-4"><h2 className="text-xl font-semibold">Name on your verified ID</h2><p className="break-words rounded-lg bg-muted p-4 text-lg font-semibold">{state.legalName}</p><p className="text-sm">Document: {state.documentType}. Didit approved your checks. Confirm this complete legal name to finish registration.</p><Button isLoading={flow.busy} onClick={() => void flow.identityAction('account-identity-name', { action: 'confirm_name', confirmed: true })}>Confirm my legal name</Button></section>}
    {state?.state === 'identity_review' && <section className="space-y-3"><h2 className="text-xl font-semibold">Identity review pending</h2><p className="text-sm">An administrator must review your identity before you can access the marketplace. Allow up to seven days. {state.nameIssue}</p>{state.legalName && <p className="break-words text-sm">Name from ID: {state.legalName}</p>}{state.requestedName && <p className="break-words text-sm">Requested correction: {state.requestedName}</p>}<Button variant="outline" isLoading={flow.busy} onClick={() => void flow.refresh()}>Refresh review status</Button></section>}
    {(state?.state === 'name_pending' || state?.state === 'identity_review') && state.sessionId && <details className="space-y-3"><summary className="min-h-11 cursor-pointer py-3 text-sm">My legal name is missing or incorrect</summary><form className="space-y-3" onSubmit={(event) => { event.preventDefault(); void flow.identityAction('account-identity-name', { action: 'request_correction', requestedName: requested }); }}><Label htmlFor="requested-name">Requested legal name</Label><Input id="requested-name" required minLength={2} maxLength={200} value={requested} onChange={(event) => setRequested(event.target.value)} /><p className="text-sm text-muted-foreground">Your requested correction is kept separately. It becomes verified only after human review.</p><Button type="submit" disabled={flow.busy}>Request name review</Button></form></details>}
    {state?.state === 'ready' && <section className="space-y-4"><h2 className="text-xl font-semibold">Your account is ready</h2><p className="text-sm">Your email and identity are verified. Enter a service address when you book. To publish a gig, complete provider setup.</p><div className="flex flex-wrap gap-2"><Button asChild><a href="/dashboard">Start booking services</a></Button><Button variant="outline" asChild><a href="/seller/onboarding">Offer services</a></Button></div></section>}
  </div>;
}
