import { useRef, useState } from 'react';
import { resendFromSignIn, signInForRegistration } from '@/shared/services/accountRegistrationService';
import { canResendRegistrationEmail } from '../domain/registrationEmailStatus';
export interface AuthPageProps {
  mode?: 'login' | 'register' | 'forgot'; onModeChange?: (mode: 'login' | 'register' | 'forgot') => void;
  onBack?: () => void; onSubmit?: (...args: unknown[]) => unknown;
  onForgotPasswordSubmit?: (...args: unknown[]) => unknown; onResendVerification?: (...args: unknown[]) => unknown;
}
export function useAuthPageController({ mode = 'login', onSubmit, onForgotPasswordSubmit }: AuthPageProps) {
  const [email, updateEmail] = useState(''); const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [message, setMessage] = useState('');
  const [confirmationRequired, setConfirmationRequired] = useState(false);
  const setEmail = (value: string) => {
    updateEmail(value); setConfirmationRequired(false); setError(''); setMessage('');
  };
  const working = useRef(false);
  const run = async (action: () => Promise<void>) => {
    if (working.current) return; working.current = true; setBusy(true); setError(''); setMessage('');
    try { await action(); } catch (cause) {
      const failure = cause instanceof Error ? cause.message : 'Authentication failed. Please retry.';
      setError(failure);
      if (canResendRegistrationEmail(mode, failure, '')) setConfirmationRequired(true);
    }
    finally { working.current = false; setBusy(false); }
  };
  const submit = () => run(async () => {
    setConfirmationRequired(false);
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
    setMessage('Confirmation requested. If your identity is approved, check your inbox and open the link to finish registration.');
  });
  const canResend = mode === 'login' && confirmationRequired;
  return { email, setEmail, password, setPassword, busy, error, message, canResend, submit, resend };
}
