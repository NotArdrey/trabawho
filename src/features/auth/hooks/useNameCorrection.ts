import { useState } from 'react';
import type { AccountRegistrationFlow } from './useAccountRegistration';
import { useRegistrationDraft, type DraftListener } from './useRegistrationDraft';

export function useNameCorrection(flow: AccountRegistrationFlow, onDraftChange?: DraftListener) {
  const [requested, setRequested] = useState('');
  const [open, setOpen] = useState(false);
  useRegistrationDraft(Boolean(requested), onDraftChange);
  const submit = async () => {
    if (await flow.identityAction('account-identity-name', { action: 'request_correction', requestedName: requested })) {
      setRequested(''); setOpen(false);
    }
  };
  return { requested, setRequested, open, setOpen, submit };
}
