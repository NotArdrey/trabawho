import type { InputHTMLAttributes } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

export function FieldError({ id, error }: { id: string; error?: string }) {
  return error ? <p id={`${id}-error`} role="alert" className="text-sm font-medium text-destructive">{error}</p> : null;
}

interface RegistrationFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  id: string;
  label: string;
  icon: LucideIcon;
  error?: string;
}

export function RegistrationField({ id, label, icon: Icon, error, className, ...props }: RegistrationFieldProps) {
  return <div className="grid min-w-0 gap-2">
    <Label htmlFor={id}>{label}</Label>
    <div className="relative flex min-w-0 items-center">
      <Icon className="pointer-events-none absolute left-3 size-[18px] text-muted-foreground" aria-hidden="true" />
      <Input id={id} aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : undefined}
        className={cn('block h-12 rounded-lg pl-10 text-base leading-6', error && 'border-destructive', className)} {...props} />
    </div>
    <FieldError id={id} error={error} />
  </div>;
}
