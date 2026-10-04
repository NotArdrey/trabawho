import { useEffect } from 'react';

export type DraftListener = (dirty: boolean) => void;

export function useRegistrationDraft(dirty: boolean, onDraftChange?: DraftListener) {
  useEffect(() => {
    onDraftChange?.(dirty);
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (dirty) { event.preventDefault(); event.returnValue = ''; }
    };
    window.addEventListener('beforeunload', beforeUnload);
    return () => {
      window.removeEventListener('beforeunload', beforeUnload);
      onDraftChange?.(false);
    };
  }, [dirty, onDraftChange]);
}
