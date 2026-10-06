import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AccountRegistration } from '@/shared/services/accountRegistrationService';
import { registrationProgress } from '../domain/registrationProgress';

const steps = ['Account Details', 'Email Verification', 'Identity Verification', 'Identity Review'];

export function RegistrationProgress({ registration, step }: { registration: AccountRegistration | null; step?: number }) {
  const current = step ?? registrationProgress(registration);
  const ready = registration?.state === 'ready';
  return (
    <div className="space-y-3 border-b pb-4">
      <p className="flex items-center justify-between gap-3 text-xs font-medium" aria-live="polite">
        <span className="text-primary">{ready ? 'Registration complete' : 'Step ' + current + ' of 4'}</span>
      </p>
      <ol aria-label="Account verification steps" className="grid grid-cols-4 gap-2">
        {steps.map((label, index) => {
          const complete = ready || index + 1 < current;
          const active = !ready && index + 1 === current;
          return (
            <li key={label} aria-current={active ? 'step' : undefined} className="flex min-w-0 flex-col items-center gap-2">
              <span className={cn('flex size-8 items-center justify-center rounded-full text-sm font-semibold',
                active ? 'bg-primary text-primary-foreground' : complete ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground')}>
                {complete ? <Check className="size-4" aria-hidden="true" /> : index + 1}
              </span>
              <span className={cn('text-center text-xs font-medium', active || complete ? 'text-primary' : 'text-muted-foreground')}>
                {label}<span className="sr-only">{complete ? ', complete' : active ? ', current step' : ', upcoming'}</span>
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
