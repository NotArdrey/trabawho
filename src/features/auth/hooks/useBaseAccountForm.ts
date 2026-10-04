import { useState } from 'react';
import { baseAccountErrors, type BaseAccountErrors } from '../domain/baseAccountValidation';
import { useRegistrationDraft, type DraftListener } from './useRegistrationDraft';

export function useBaseAccountForm(create: (email: string, password: string, terms: boolean) => Promise<boolean>, onDraftChange?: DraftListener) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [terms, setTerms] = useState(false);
  const [errors, setErrors] = useState<BaseAccountErrors>({});
  useRegistrationDraft(Boolean(email || password || terms), onDraftChange);
  const submit = async () => {
    const issues = baseAccountErrors({ email, password, acceptedTerms: terms });
    setErrors(issues);
    if (Object.keys(issues).length) return issues.email ? 'registration-email' : issues.password ? 'registration-password' : 'account-terms';
    if (await create(email.trim(), password, terms)) setPassword('');
    return null;
  };
  return { email, setEmail, password, setPassword, terms, setTerms, errors, submit };
}
