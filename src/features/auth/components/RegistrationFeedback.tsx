import { CircleAlert, CircleCheck, LoaderCircle } from 'lucide-react';

export function RegistrationFeedback({ error, message, busy }: { error: string; message: string; busy: boolean }) {
  return (
    <>
      {error && <div role="alert" className="flex items-start gap-3 rounded-lg bg-destructive/10 p-4 text-sm leading-6 text-destructive">
        <CircleAlert className="mt-1 size-4 shrink-0" aria-hidden="true" /><p className="min-w-0 break-words">{error}</p>
      </div>}
      {message && !busy && <div role="status" className="flex items-start gap-3 rounded-lg bg-primary/10 p-4 text-sm leading-6">
        <CircleCheck className="mt-1 size-4 shrink-0 text-primary" aria-hidden="true" /><p className="min-w-0 break-words">{message}</p>
      </div>}
      {busy && <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
        <LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />Saving your progress…
      </p>}
    </>
  );
}
