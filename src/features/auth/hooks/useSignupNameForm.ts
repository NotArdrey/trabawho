import { useState } from 'react';
import type { AccountRegistration } from '@/shared/services/accountRegistrationService';
import { signupNameError } from '../domain/signupNameValidation';
import type { AccountRegistrationFlow } from './useAccountRegistration';
import { useRegistrationDraft, type DraftListener } from './useRegistrationDraft';

export function useSignupNameForm(flow: AccountRegistrationFlow, state: AccountRegistration, onContinue: () => void, onDraftChange?: DraftListener) {
  const [name, setName] = useState(state.signupName || '');
  const [error, setError] = useState('');
  const editable = state.state === 'email_pending' || state.state === 'identity_pending';
  useRegistrationDraft(editable && name !== (state.signupName || ''), onDraftChange);
  const submit = async () => {
    if (!editable) { onContinue(); return; }
    const issue = signupNameError(name);
    setError(issue);
    if (issue) { document.getElementById('registration-name')?.focus(); return; }
    if (name.trim() === state.signupName) { onContinue(); return; }
    if (await flow.saveName(name.trim())) onContinue();
  };
  return { name, setName, error, editable, submit };
}
