import { useRef, useState } from 'react';
import { resendFromSignIn, signInForRegistration } from '@/shared/services/accountRegistrationService';
export interface AuthPageProps {
  mode?: 'login' | 'register' | 'forgot'; onModeChange?: (mode: 'login' | 'register' | 'forgot') => void;
  onBack?: () => void; onSubmit?: (...args: unknown[]) => unknown;
  onForgotPasswordSubmit?: (...args: unknown[]) => unknown; onResendVerification?: (...args: unknown[]) => unknown;
}
export function useAuthPageController({ mode = 'login', onSubmit, onForgotPasswordSubmit }: AuthPageProps) {
  const [email, setEmail] = useState(''); const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [message, setMessage] = useState('');
  const working = useRef(false);
  const run = async (action: () => Promise<void>) => {
    if (working.current) return; working.current = true; setBusy(true); setError(''); setMessage('');
    try { await action(); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Authentication failed. Please retry.'); }
    finally { working.current = false; setBusy(false); }
  };
  const submit = () => run(async () => {
    if (mode === 'forgot') {
      await onForgotPasswordSubmit?.(email);
      setMessage('If this email has an account, a reset link has been requested.'); return;
    }
    const registration = await signInForRegistration(email, password);
    if (!['legacy', 'ready'].includes(registration.state)) { window.location.assign('/register'); return; }
    await onSubmit?.({ email, password }, true);
  });
  const resend = () => run(async () => {
    await resendFromSignIn(email);
    setMessage('Confirmation requested. Check your inbox, then open the link to resume registration.');
  });
  return { email, setEmail, password, setPassword, busy, error, message, submit, resend };
}
