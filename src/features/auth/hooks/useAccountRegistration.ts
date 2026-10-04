import { useCallback, useEffect, useRef, useState } from 'react';
import { pendingAccount, registrationRequest, resumeRegistration, savePendingAccount, signInForRegistration,
  type AccountRegistration, type PendingAccount } from '@/shared/services/accountRegistrationService';

export function useAccountRegistration() {
  const [registration, setRegistration] = useState<AccountRegistration | null>(null);
  const [pending, setPending] = useState<PendingAccount | null>(() => pendingAccount());
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const [message, setMessage] = useState(''); const working = useRef(false);
  const run = useCallback(async (action: () => Promise<void>) => {
    if (working.current) return;
    working.current = true; setBusy(true); setError(''); setMessage('');
    try { await action(); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Registration could not be completed. Retry.'); }
    finally { working.current = false; setBusy(false); }
  }, []);
  const refresh = useCallback(() => run(async () => {
    const state = await resumeRegistration();
    if (state?.state === 'identity_in_progress') setRegistration(await registrationRequest('account-didit-session', { action: 'get_session' }));
    else if (state && state.state !== 'legacy') setRegistration(state);
  }), [run]);
  useEffect(() => {
    let mounted = true;
    void Promise.resolve().then(async () => {
      if (!mounted) return; await refresh();
      if (mounted && new URLSearchParams(window.location.hash.slice(1)).has('error'))
        setError('The confirmation link expired or could not be used. Request a new confirmation email from Sign in.');
    });
    return () => { mounted = false; };
  }, [refresh]);
  const create = (email: string, password: string, acceptedTerms: boolean) => run(async () => {
    const result = await registrationRequest('account-registration', { action: 'create', email, password, acceptedTerms });
    if (!result.pendingAccount) throw new Error('Account recovery information is unavailable. Use sign in to resume.');
    const account = { ...result.pendingAccount, email: result.email || email };
    savePendingAccount(account); setPending(account); setRegistration(result);
    if (!result.emailDelivery?.sent) setError('Your account was created, but the confirmation email could not be sent. Use Resend confirmation email.');
  });
  const emailAction = (action: 'resend' | 'change_email', email?: string) => run(async () => {
    if (!pending) throw new Error('Sign in to resume or resend your confirmation link.');
    const result = await registrationRequest('account-registration', { action, ...pending, email: email || pending.email });
    const account = { ...pending, email: result.email || pending.email }; savePendingAccount(account); setPending(account);
    setRegistration(result);
    if (!result.emailDelivery?.sent) throw new Error('The confirmation email could not be sent. Wait one minute and retry.');
    setMessage('Confirmation email requested. Check your inbox and spam folder.');
  });
  const identityAction = (name: string, body: Record<string, unknown>) => run(async () => setRegistration(await registrationRequest(name, body)));
  const resume = (email: string, password: string) => run(async () => {
    const state = await signInForRegistration(email, password);
    if (state.state === 'legacy') throw new Error('This account uses the existing verification flow. Sign in from the login page.');
    setRegistration(state); setPending(null);
  });
  return { registration: registration || (pending ? { state: 'email_pending' as const, email: pending.email } : null), busy, error, message,
    create, emailAction, identityAction, resume, refresh };
}
