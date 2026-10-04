import { useRef, useState } from 'react';

export function useAuthPageNavigation() {
  const [dirty, setDirty] = useState(false);
  const [pending, setPending] = useState<{ action: () => void } | null>(null);
  const trigger = useRef<HTMLElement | null>(null);
  const request = (action: () => void) => {
    if (dirty) {
      trigger.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      setPending({ action });
    }
    else action();
  };
  const confirm = () => {
    const action = pending?.action;
    setPending(null); setDirty(false); action?.();
  };
  const restoreFocus = () => { if (trigger.current?.isConnected) trigger.current.focus(); };
  return { setDirty, pending, request, confirm, restoreFocus, cancel: () => setPending(null) };
}
