import { BriefcaseBusiness, CalendarCheck } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import type { SignupRole } from '@/shared/services/accountRegistrationService';

interface Props {
  value: SignupRole | null;
  onChange: (value: SignupRole) => void;
  disabled: boolean;
  error?: string;
}

export function SignupRoleChoice({ value, onChange, disabled, error }: Props) {
  return (
    <fieldset disabled={disabled} className="space-y-3" aria-describedby={error ? 'registration-role-error' : 'registration-role-help'}>
      <legend className="text-sm font-semibold">How will you use TrabaWho?</legend>
      <div className="grid min-w-0 gap-3 sm:grid-cols-2">
        {([
          { role: 'client', label: 'Client', description: 'Book a service', icon: CalendarCheck },
          { role: 'worker', label: 'Worker', description: 'Offer services', icon: BriefcaseBusiness },
        ] as const).map(({ role, label, description, icon: Icon }) => (
          <label key={role} htmlFor={'registration-role-' + role} className={cn('flex min-h-20 min-w-0 cursor-pointer items-start gap-3 rounded-lg border p-3 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring',
            value === role ? 'border-primary bg-primary/5' : 'border-input', disabled && 'cursor-not-allowed opacity-50')}>
            <Input id={'registration-role-' + role} type="radio" name="signup-role" value={role} required
              className="mt-1 size-5 min-h-0 shrink-0 rounded-full accent-primary shadow-none"
              checked={value === role} onChange={() => onChange(role)} aria-label={label + ': ' + description}
              aria-invalid={Boolean(error)} aria-describedby={error ? 'registration-role-error' : 'registration-role-help'} />
            <span className="min-w-0 space-y-1">
              <span className="flex items-center gap-2 text-sm font-semibold"><Icon className="size-4 shrink-0 text-primary" aria-hidden="true" />{label}</span>
              <span className="block text-sm text-muted-foreground">{description}</span>
            </span>
          </label>
        ))}
      </div>
      <p id="registration-role-help" className="text-xs leading-5 text-muted-foreground">One account lets you book and offer services. Choose what you want to do first. Complete worker setup after email and identity verification.</p>
      {error && <p id="registration-role-error" role="alert" className="text-sm text-destructive">{error}</p>}
    </fieldset>
  );
}
