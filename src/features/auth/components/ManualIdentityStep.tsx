import { Camera, FileImage, FileText, Upload, UserRound } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getTodayInputValue } from "@/features/auth/domain/registration";
import type { RegistrationErrors, RegistrationFormValues } from "@/features/auth/types";
import { cn } from "@/lib/utils";

interface ManualIdentityStepProps {
  documentLabel: string;
  values: RegistrationFormValues;
  errors: RegistrationErrors;
  onChange: <Field extends keyof RegistrationFormValues>(
    field: Field,
    value: RegistrationFormValues[Field],
  ) => void;
}

interface TextFieldProps {
  id: "manualFullName" | "identityDocumentNumber" | "idDocumentExpiry";
  label: string;
  type?: "text" | "date";
  value: string;
  placeholder?: string;
  error?: string;
  icon: typeof UserRound;
  onChange: (value: string) => void;
}

function TextField({ id, label, type = "text", value, placeholder, error, icon: Icon, onChange }: TextFieldProps) {
  const errorId = error ? `${id}-error` : undefined;
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Icon className="pointer-events-none absolute left-3 top-3.5 size-4 text-muted-foreground" aria-hidden="true" />
        <Input
          id={id}
          type={type}
          min={type === "date" ? getTodayInputValue() : undefined}
          value={value}
          onChange={(event) => onChange(event.target.value)}
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

interface ImageFieldProps {
  id: "frontImage" | "backImage" | "selfieImage";
  label: string;
  file: File | null;
  error?: string;
  capture: "user" | "environment";
  icon: typeof FileImage;
  onChange: (file: File | null) => void;
}

function ImageField({ id, label, file, error, capture, icon: Icon, onChange }: ImageFieldProps) {
  const errorId = error ? `${id}-error` : undefined;
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      <label htmlFor={id} className={cn(
        "flex min-h-24 cursor-pointer items-center gap-3 rounded-lg border border-dashed bg-muted/30 p-4 hover:border-primary/60",
        error && "border-destructive",
      )}>
        <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary"><Icon className="size-5" aria-hidden="true" /></span>
        <span className="min-w-0 text-sm">
          <span className="block font-semibold">{file ? file.name : `Choose ${label.toLowerCase()}`}</span>
          <span className="mt-1 block text-xs text-muted-foreground">JPG, PNG, or WebP · up to 7 MB</span>
        </span>
        <Upload className="ml-auto size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      </label>
      <Input
        id={id}
        name={id}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        capture={capture}
        onChange={(event) => onChange(event.target.files?.[0] ?? null)}
        aria-invalid={Boolean(error)}
        aria-describedby={errorId}
        className="sr-only"
      />
      {error ? <p id={errorId} role="alert" className="text-sm font-medium text-destructive">{error}</p> : null}
    </div>
  );
}

export function ManualIdentityStep({ documentLabel, values, errors, onChange }: ManualIdentityStepProps) {
  return (
    <section aria-labelledby="manual-identity-heading" data-testid="manual-review-fields" className="grid gap-6">
      <div>
        <p className="mb-1 text-xs font-bold uppercase tracking-[0.16em] text-[var(--brand-orange)]">Manual identity review</p>
        <h2 id="manual-identity-heading" tabIndex={-1} className="text-2xl font-bold tracking-tight">Submit your {documentLabel}</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">Upload clear, uncropped images. Your account will remain pending until an administrator approves the review.</p>
      </div>

      <TextField id="manualFullName" label="Name on ID" value={values.manualFullName} placeholder="Enter the full name shown on the ID" error={errors.manualFullName} icon={UserRound} onChange={(value) => onChange("manualFullName", value)} />

      <div className="grid gap-5 sm:grid-cols-2">
        <TextField id="identityDocumentNumber" label="ID number" value={values.identityDocumentNumber} placeholder="Enter the document number" error={errors.identityDocumentNumber} icon={FileText} onChange={(value) => onChange("identityDocumentNumber", value)} />
        <TextField id="idDocumentExpiry" label="ID expiry date" type="date" value={values.idDocumentExpiry} error={errors.idDocumentExpiry} icon={FileText} onChange={(value) => onChange("idDocumentExpiry", value)} />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <ImageField id="frontImage" label="Front ID image" file={values.frontImage} error={errors.frontImage} capture="environment" icon={FileImage} onChange={(file) => onChange("frontImage", file)} />
        <ImageField id="backImage" label="Back ID image" file={values.backImage} error={errors.backImage} capture="environment" icon={FileImage} onChange={(file) => onChange("backImage", file)} />
      </div>

      <ImageField id="selfieImage" label="Selfie image" file={values.selfieImage} error={errors.selfieImage} capture="user" icon={Camera} onChange={(file) => onChange("selfieImage", file)} />
    </section>
  );
}
