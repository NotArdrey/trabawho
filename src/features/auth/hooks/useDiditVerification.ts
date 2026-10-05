import { useEffect, useRef, useState } from 'react';

type Completion = 'cancelled' | 'completed';

function messageType(data: unknown): string | null {
  try {
    const message: unknown = typeof data === 'string' ? JSON.parse(data) : data;
    if (typeof message !== 'object' || !message || !('type' in message)) return null;
    return typeof message.type === 'string' ? message.type : null;
  } catch { return null; }
}

export function useDiditVerification(finish: (closed: boolean) => Promise<boolean>, busy: boolean) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [completion, setCompletion] = useState<Completion | null>(null);
  const finishRef = useRef(finish);
  const finishing = useRef(false);
  useEffect(() => { finishRef.current = finish; }, [finish]);

  useEffect(() => {
    if (!url) return;
    const onMessage = (event: MessageEvent<unknown>) => {
      if (event.source !== frame.current?.contentWindow) return;
      const type = messageType(event.data);
      const providerOrigin = new URL(url).origin;
      const returned = event.origin === window.location.origin && type === 'trabawho.didit-return';
      const exited = event.origin === window.location.origin && type === 'trabawho.didit-exit';
      if (!returned && !exited && event.origin !== providerOrigin) return;
      // Messages only trigger a server lookup. Provider/browser status never approves an account.
      if (returned || type === 'didit:completed') {
        setUrl(null); setCompletion('completed');
      } else if (exited || type === 'didit:cancelled' || type === 'didit:close_request') {
        setUrl(null); setCompletion('cancelled');
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [url]);

  useEffect(() => {
    if (!completion || busy || finishing.current) return;
    finishing.current = true;
    void Promise.resolve().then(async () => {
      setCompletion(null);
      await finishRef.current(completion === 'cancelled');
    }).finally(() => { finishing.current = false; });
  }, [completion, busy]);

  return {
    frame, url,
    open: (nextUrl: string) => setUrl(nextUrl),
    close: () => { setUrl(null); setCompletion('cancelled'); },
  };
}
