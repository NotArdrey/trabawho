import { Eye, EyeOff, Lock } from "lucide-react";
import { useState, type InputHTMLAttributes } from "react";
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface PasswordFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "id" | "type"> {
  id: string;
  label: string;
  error?: string;
}

export default function PasswordField({ id, label, error, placeholder = 'Enter your password', 'aria-describedby': description, ...inputProps }: PasswordFieldProps) {
  const [isVisible, setIsVisible] = useState(false);
  const visibilityLabel = `${isVisible ? "Hide" : "Show"} ${label.toLowerCase()}`;

  return (
    <div className="grid min-w-0 gap-2">
      <label className="text-[13px] font-bold text-foreground" htmlFor={id}>{label}</label>
      <div className="relative flex min-w-0 items-center">
        <Lock className="pointer-events-none absolute left-3 text-muted-foreground" size={18} aria-hidden="true" />
        <Input id={id} type={isVisible ? "text" : "password"} placeholder={placeholder} aria-invalid={Boolean(error)} aria-describedby={[description, error ? `${id}-error` : null].filter(Boolean).join(' ') || undefined}
          className={cn('h-12 rounded-lg pl-10 pr-12 text-base leading-6', error && 'border-destructive')} {...inputProps} />
        <button
          type="button"
          className="absolute right-0 flex size-12 items-center justify-center rounded-r-[10px] text-muted-foreground hover:text-foreground focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
          aria-label={visibilityLabel}
          aria-pressed={isVisible}
          disabled={inputProps.disabled}
          onClick={() => setIsVisible((visible) => !visible)}
        >
          {isVisible ? <EyeOff size={19} aria-hidden="true" /> : <Eye size={19} aria-hidden="true" />}
        </button>
      </div>
      {error && <p id={`${id}-error`} role="alert" className="text-sm font-medium text-destructive">{error}</p>}
    </div>
  );
}
