import { Check, LockKeyhole, Mail } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { RegistrationErrors, RegistrationFormValues } from "@/features/auth/types";
import { cn } from "@/lib/utils";

interface RegistrationSecurityStepProps {
  values: RegistrationFormValues;
  errors: RegistrationErrors;
  onChange: <Field extends "email" | "password" | "confirmPassword">(
    field: Field,
    value: RegistrationFormValues[Field],
  ) => void;
}

interface SecurityFieldProps {
  id: "email" | "password" | "confirmPassword";
  label: string;
  type: "email" | "password";
  value: string;
  autoComplete: string;
  placeholder: string;
  error?: string;
  icon: typeof Mail;
  onChange: (value: string) => void;
}

function SecurityField({ id, label, type, value, autoComplete, placeholder, error, icon: Icon, onChange }: SecurityFieldProps) {
  const errorId = error ? `${id}-error` : undefined;
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Icon className="pointer-events-none absolute left-3 top-3.5 size-4 text-muted-foreground" aria-hidden="true" />
        <Input
          id={id}
          type={type}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          autoComplete={autoComplete}
          placeholder={placeholder}
          aria-invalid={Boolean(error)}
          aria-describedby={errorId}
          className={cn("pl-10", error && "border-destructive")}
        />
      </div>
      {error ? <p id={errorId} role="alert" className="text-sm font-medium text-destructive">{error}</p> : null}
    </div>
  );
}

export function RegistrationSecurityStep({ values, errors, onChange }: RegistrationSecurityStepProps) {
  const passwordChecks = [
    { label: "At least 8 characters", met: values.password.length >= 8 },
    { label: "One uppercase letter", met: /[A-Z]/.test(values.password) },
    { label: "One number", met: /[0-9]/.test(values.password) },
  ];

  return (
    <section aria-labelledby="registration-step-heading" className="grid gap-5">
      <div>
        <p className="mb-1 text-xs font-bold uppercase tracking-[0.16em] text-[var(--brand-orange)]">Step 2</p>
        <h2 id="registration-step-heading" tabIndex={-1} className="text-2xl font-bold tracking-tight">Secure your account</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">Use an email you can access for account confirmation and review updates.</p>
      </div>

      <SecurityField id="email" label="Email" type="email" value={values.email} autoComplete="email" placeholder="you@example.com" error={errors.email} icon={Mail} onChange={(value) => onChange("email", value)} />
      <SecurityField id="password" label="Password" type="password" value={values.password} autoComplete="new-password" placeholder="Create a password" error={errors.password} icon={LockKeyhole} onChange={(value) => onChange("password", value)} />

      <ul aria-label="Password requirements" className="grid gap-1.5 rounded-md bg-muted/60 p-3 text-xs">
        {passwordChecks.map((check) => (
          <li key={check.label} className={cn("flex items-center gap-2", check.met ? "text-foreground" : "text-muted-foreground")}>
            <span className={cn("flex size-4 items-center justify-center rounded-full border", check.met && "border-primary bg-primary text-primary-foreground")} aria-hidden="true">
              {check.met ? <Check className="size-3" /> : null}
            </span>
            {check.label}{check.met ? <span className="sr-only"> met</span> : <span className="sr-only"> not met</span>}
          </li>
        ))}
      </ul>

      <SecurityField id="confirmPassword" label="Confirm password" type="password" value={values.confirmPassword} autoComplete="new-password" placeholder="Re-enter your password" error={errors.confirmPassword} icon={LockKeyhole} onChange={(value) => onChange("confirmPassword", value)} />
    </section>
  );
}
