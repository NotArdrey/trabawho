import { useState } from 'react';
import type { SignupRole } from '@/shared/services/accountRegistrationService';
import { baseAccountErrors, type BaseAccountErrors } from '../domain/baseAccountValidation';
import { useRegistrationDraft, type DraftListener } from './useRegistrationDraft';

export function useBaseAccountForm(create: (email: string, password: string, terms: boolean, signupRole: SignupRole) => Promise<boolean>, onDraftChange?: DraftListener) {
  const [signupRole, setSignupRole] = useState<SignupRole | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [terms, setTerms] = useState(false);
  const [errors, setErrors] = useState<BaseAccountErrors>({});
  useRegistrationDraft(Boolean(signupRole || email || password || confirmPassword || terms), onDraftChange);
  const submit = async () => {
    const issues = baseAccountErrors({ signupRole, email, password, confirmPassword, acceptedTerms: terms });
    setErrors(issues);
    if (Object.keys(issues).length) return issues.signupRole ? 'registration-role-client' : issues.email ? 'registration-email' : issues.password ? 'registration-password'
      : issues.confirmPassword ? 'registration-confirm-password' : 'account-terms';
    if (signupRole && await create(email.trim(), password, terms, signupRole)) { setPassword(''); setConfirmPassword(''); }
    return null;
  };
  return { signupRole, setSignupRole, email, setEmail, password, setPassword, confirmPassword, setConfirmPassword, terms, setTerms, errors, submit };
}
