import type { LucideIcon } from 'lucide-react';

export function RegistrationStepHeader({ icon: Icon, title, description, page = false }: { icon: LucideIcon; title: string; description: string; page?: boolean }) {
  const Heading = page ? 'h1' : 'h2';
  return (
    <div className="space-y-3">
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-brand-highlight-soft text-brand-highlight-foreground">
          <Icon className="size-5" aria-hidden="true" />
        </span>
        <Heading tabIndex={-1} data-registration-heading className={page ? 'min-w-0 text-3xl font-semibold leading-tight tracking-tight focus:outline-none sm:text-4xl' : 'min-w-0 text-2xl font-semibold leading-tight tracking-tight focus:outline-none'}>{title}</Heading>
      </div>
      <p className="min-w-0 break-words text-sm leading-6 text-muted-foreground">{description}</p>
    </div>
  );
}
