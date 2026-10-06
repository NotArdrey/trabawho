import { useCallback, useEffect, useRef, useState } from 'react';
import { clearPendingAccount, pendingAccount, registrationRequest, RegistrationRequestError, registrationSignOut, resumeRegistration, savePendingAccount, signInForRegistration, subscribeToRegistrationAuth,
  type AccountRegistration, type PendingAccount, type SignupRole } from '@/shared/services/accountRegistrationService';

export function useAccountRegistration() {
  const [registration, setRegistration] = useState<AccountRegistration | null>(null);
  const [pending, setPending] = useState<PendingAccount | null>(() => pendingAccount());
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const [message, setMessage] = useState(''); const working = useRef(false);
  const [initializing, setInitializing] = useState(true);
  const [restoreFailed, setRestoreFailed] = useState(false);
  const [restoreNeedsSignIn, setRestoreNeedsSignIn] = useState(false);
  const authEpoch = useRef(0);
  useEffect(() => () => { authEpoch.current += 1; clearPendingAccount(); }, []);
  useEffect(() => subscribeToRegistrationAuth(() => {
    authEpoch.current += 1;
    setRegistration(null); setPending(null); setError(''); setMessage(''); setRestoreFailed(false); setRestoreNeedsSignIn(false);
  }, () => setPending(null)), []);
  const run = useCallback(async (action: () => Promise<void>) => {
    if (working.current) return false;
    const epoch = authEpoch.current;
    working.current = true; setBusy(true); setError(''); setMessage('');
    try { await action(); return true; } catch (cause) {
      if (epoch !== authEpoch.current) return true;
      setError(cause instanceof Error ? cause.message : 'Registration could not be completed. Retry.'); return false;
    }
    finally { working.current = false; setBusy(false); }
  }, []);
  const refresh = useCallback(() => run(async () => {
    const epoch = authEpoch.current;
    setRestoreNeedsSignIn(false);
    try {
      const state = await resumeRegistration();
      if (epoch !== authEpoch.current) return;
      if (state && !pendingAccount()) setPending(null);
      else setPending(pendingAccount());
      if (state?.state === 'identity_in_progress') {
        const result = await registrationRequest('account-didit-session', { action: 'get_session', ...pendingAccount() });
        if (epoch !== authEpoch.current) return;
        setRegistration({ ...result, signupRole: result.signupRole ?? state.signupRole });
      }
      else setRegistration(state && state.state !== 'legacy' ? state : null);
      setRestoreFailed(false);
    } catch (cause) {
      if (epoch === authEpoch.current) setRestoreNeedsSignIn(
        (cause instanceof RegistrationRequestError && cause.status === 401) ||
        (cause instanceof Error && /sign in/i.test(cause.message)),
      );
      throw cause;
    }
  }), [run]);
  useEffect(() => {
    let mounted = true;
    void Promise.resolve().then(async () => {
      if (!mounted) return;
      const restored = await refresh();
      if (!mounted) return;
      setRestoreFailed(!restored); setInitializing(false);
      if (mounted && new URLSearchParams(window.location.hash.slice(1)).has('error'))
        setError('The confirmation link expired or could not be used. Request a new confirmation email from Sign in.');
    });
    return () => { mounted = false; };
  }, [refresh]);
  const retryRestore = async () => {
    setInitializing(true);
    const restored = await refresh();
    setRestoreFailed(!restored); setInitializing(false);
  };
  const create = (email: string, password: string, acceptedTerms: boolean, signupRole: SignupRole) => run(async () => {
    const result = await registrationRequest('account-registration', { action: 'create', registrationVersion: 4, email, password, acceptedTerms, signupRole });
    if (!result.pendingAccount) throw new Error('Account recovery information is unavailable. Use sign in to resume.');
    const account = { ...result.pendingAccount, email: result.email || email };
    savePendingAccount(account); setPending(account); setRegistration(result);
  });
  const emailAction = (action: 'resend' | 'change_email', email?: string) => run(async () => {
    if (!pending) throw new Error('Sign in to resume or resend your confirmation link.');
    const result = await registrationRequest('account-registration', { action, ...pending, email: email || pending.email });
    const account = { ...pending, email: result.email || pending.email }; savePendingAccount(account); setPending(account);
    setRegistration((previous) => ({ ...result, signupRole: result.signupRole ?? previous?.signupRole, signupName: result.signupName ?? previous?.signupName }));
    if (!result.emailDelivery?.sent) throw new Error('The confirmation email could not be sent. Wait one minute and retry.');
    setMessage('Confirmation email requested. Check your inbox and spam folder.');
  });
  const saveName = (signupName: string) => run(async () => {
    const result = await registrationRequest('account-registration', { action: 'save_name', ...pending, signupName });
    if (pending) {
      const account = { ...pending, signupName: result.signupName || signupName };
      savePendingAccount(account); setPending(account);
    }
    setRegistration((previous) => ({ ...previous, ...result, signupRole: result.signupRole ?? previous?.signupRole }));
  });
  const identityAction = (name: string, body: Record<string, unknown>) => run(async () => {
    const epoch = authEpoch.current;
    const result = await registrationRequest(name, { ...body, ...pending });
    if (epoch !== authEpoch.current) return;
    setRegistration((previous) => ({ ...result, signupRole: result.signupRole ?? previous?.signupRole, signupName: result.signupName ?? previous?.signupName }));
    if (result.state === 'ready' && pending) {
      const resumed = await resumeRegistration();
      if (resumed) setRegistration((previous) => ({ ...resumed, signupRole: resumed.signupRole ?? previous?.signupRole }));
      setPending(pendingAccount());
    }
  });
  const finishDiditAttempt = (closed: boolean) => run(async () => {
    const epoch = authEpoch.current;
    const result = await registrationRequest('account-didit-session', { action: 'get_session', ...pending }).catch((cause: unknown) => {
      if (closed && pending) return null;
      throw cause;
    });
    if (epoch !== authEpoch.current) return;
    if (closed && pending && (!result || ['identity_pending', 'identity_in_progress', 'declined'].includes(result.state))) {
      const discarded = await registrationRequest('account-registration', { action: 'discard', ...pending }).catch(() => null);
      if (epoch !== authEpoch.current) return;
      if (discarded && discarded.state !== 'identity_pending') { setRegistration(discarded); return; }
      clearPendingAccount(); setPending(null); setRegistration(null); setRestoreFailed(false);
      setMessage(result ? 'Verification was not completed. Your account is saved. Sign in to resume identity verification.'
        : 'The form was reset. Sign in to resume, or check your inbox for the identity review decision if you completed verification.');
    } else if (result) setRegistration((previous) => ({ ...result, signupRole: result.signupRole ?? previous?.signupRole }));
  });
  const resume = (email: string, password: string) => run(async () => {
    const state = await signInForRegistration(email, password);
    if (state.state === 'legacy') throw new Error('This account uses the existing verification flow. Sign in from the login page.');
    setRegistration(state); setPending(null); setRestoreFailed(false); setRestoreNeedsSignIn(false);
  });
  const startNewRegistration = () => run(async () => {
    await registrationSignOut();
    setRegistration(null); setPending(null); setRestoreFailed(false); setRestoreNeedsSignIn(false);
  });
  const registrationState = registration?.state;
  useEffect(() => {
    if (!registrationState || !['identity_in_progress', 'identity_review', 'email_pending', 'ready'].includes(registrationState)) return;
    if (registrationState === 'ready' && !pending) return;
    const check = () => { if (document.visibilityState === 'visible') void refresh(); };
    const timer = window.setInterval(check, 5000);
    window.addEventListener('focus', check);
    document.addEventListener('visibilitychange', check);
    if (registrationState === 'ready') check();
    return () => { window.clearInterval(timer); window.removeEventListener('focus', check); document.removeEventListener('visibilitychange', check); };
  }, [registrationState, pending, refresh]);
  return { registration: registration || (pending ? { state: 'email_pending' as const, email: pending.email, signupName: pending.signupName || '' } : null), busy, error, message,
    completingSession: registrationState === 'ready' && Boolean(pending),
    create, saveName, emailAction, identityAction, finishDiditAttempt, resume, refresh, startNewRegistration, initializing, restoreFailed, restoreNeedsSignIn, retryRestore };
}

export type AccountRegistrationFlow = ReturnType<typeof useAccountRegistration>;
