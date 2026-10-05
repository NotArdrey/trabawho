import { useEffect } from 'react';
import { Button } from '@/components/ui/button';

export function DiditReturn() {
  useEffect(() => {
    const status = new URLSearchParams(window.location.search).get('status')?.toLowerCase().replace(/[ _-]/g, '');
    // The hint controls exit behavior only; the parent fetches the authoritative server result.
    const completed = status && ['approved', 'inreview', 'pendingreview', 'completed'].includes(status);
    if (window.parent !== window) window.parent.postMessage({ type: completed ? 'trabawho.didit-return' : 'trabawho.didit-exit' }, window.location.origin);
  }, []);
  return <main className="flex min-h-dvh items-center justify-center bg-background p-6">
    <section className="max-w-md space-y-4 rounded-lg border bg-card p-6 text-card-foreground">
      <h1 className="text-2xl font-semibold">Return to registration</h1>
      <p className="text-sm leading-6 text-muted-foreground">Your verification result is being checked. If you left before finishing, start your registration again.</p>
      <Button className="w-full" asChild><a href="/register">Start registration</a></Button>
    </section>
  </main>;
}
