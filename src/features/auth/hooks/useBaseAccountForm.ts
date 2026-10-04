import { useState } from 'react';
import { baseAccountErrors, type BaseAccountErrors } from '../domain/baseAccountValidation';
import { useRegistrationDraft, type DraftListener } from './useRegistrationDraft';

export function useBaseAccountForm(create: (email: string, password: string, terms: boolean) => Promise<boolean>, onDraftChange?: DraftListener) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [terms, setTerms] = useState(false);
  const [errors, setErrors] = useState<BaseAccountErrors>({});
  useRegistrationDraft(Boolean(email || password || confirmPassword || terms), onDraftChange);
  const submit = async () => {
    const issues = baseAccountErrors({ email, password, confirmPassword, acceptedTerms: terms });
    setErrors(issues);
    if (Object.keys(issues).length) return issues.email ? 'registration-email' : issues.password ? 'registration-password'
      : issues.confirmPassword ? 'registration-confirm-password' : 'account-terms';
    if (await create(email.trim(), password, terms)) { setPassword(''); setConfirmPassword(''); }
    return null;
  };
  return { email, setEmail, password, setPassword, confirmPassword, setConfirmPassword, terms, setTerms, errors, submit };
}
