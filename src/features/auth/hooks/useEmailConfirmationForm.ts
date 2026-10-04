import { useState } from 'react';
import type { AccountRegistrationFlow } from './useAccountRegistration';
import { useRegistrationDraft, type DraftListener } from './useRegistrationDraft';

export function useEmailConfirmationForm(flow: AccountRegistrationFlow, email: string, onDraftChange?: DraftListener) {
  const [changingEmail, setChangingEmail] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [signInEmail, setSignInEmail] = useState(email);
  const [password, setPassword] = useState('');
  useRegistrationDraft(Boolean(password || newEmail), onDraftChange);
  const changeEmail = async () => {
    if (await flow.emailAction('change_email', newEmail)) {
      setSignInEmail(newEmail.trim()); setNewEmail(''); setChangingEmail(false);
    }
  };
  const resume = async () => { if (await flow.resume(signInEmail, password)) setPassword(''); };
  return { changingEmail, setChangingEmail, newEmail, setNewEmail, signInEmail, setSignInEmail, password, setPassword, changeEmail, resume };
}
