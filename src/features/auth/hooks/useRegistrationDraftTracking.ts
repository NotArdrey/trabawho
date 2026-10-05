import { useCallback, useRef } from 'react';
import type { DraftListener } from './useRegistrationDraft';

export function useRegistrationDraftTracking(onDraftChange?: DraftListener) {
  const drafts = useRef({ account: false, name: false, email: false, identity: false });
  const updateDraft = useCallback((step: 'account' | 'name' | 'email' | 'identity', dirty: boolean) => {
    drafts.current[step] = dirty;
    onDraftChange?.(Object.values(drafts.current).some(Boolean));
  }, [onDraftChange]);
  const account: DraftListener = useCallback((dirty) => updateDraft('account', dirty), [updateDraft]);
  const name: DraftListener = useCallback((dirty) => updateDraft('name', dirty), [updateDraft]);
  const email: DraftListener = useCallback((dirty) => updateDraft('email', dirty), [updateDraft]);
  const identity: DraftListener = useCallback((dirty) => updateDraft('identity', dirty), [updateDraft]);
  return { account, name, email, identity };
}
