import { CheckCircle2, ExternalLink, FileText, Mail, MapPin, ShieldCheck, UserRound } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import type {
  IdentityDocumentOption,
  RegistrationErrors,
  RegistrationFormValues,
  RegistrationStep,
} from "@/features/auth/types";
import { cn } from "@/lib/utils";

interface RegistrationReviewStepProps {
  values: RegistrationFormValues;
  errors: RegistrationErrors;
  selectedDocument: IdentityDocumentOption;
  onConsentChange: (field: "acceptedIdentityTerms" | "acceptedRaTerms", checked: boolean) => void;
  onEditStep: (step: RegistrationStep) => void;
}

interface SummaryRowProps {
  icon: typeof Mail;
  label: string;
  value: string;
  editStep: RegistrationStep;
  onEditStep: (step: RegistrationStep) => void;
}

function SummaryRow({ icon: Icon, label, value, editStep, onEditStep }: SummaryRowProps) {
  return (
    <div className="flex min-w-0 items-start gap-3 border-b py-3 last:border-b-0">
      <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary"><Icon className="size-4" aria-hidden="true" /></span>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <p className="mt-0.5 break-words text-sm font-semibold">{value}</p>
      </div>
      <Button type="button" variant="ghost" size="sm" onClick={() => onEditStep(editStep)} aria-label={`Edit ${label.toLowerCase()}`}>Edit</Button>
    </div>
  );
}

interface ConsentProps {
  id: "acceptedIdentityTerms" | "acceptedRaTerms";
  label: string;
  description: string;
  checked: boolean;
  error?: string;
  onChange: (checked: boolean) => void;
}

function Consent({ id, label, description, checked, error, onChange }: ConsentProps) {
  const errorId = error ? `${id}-error` : undefined;
  return (
    <div className="grid gap-2">
      <Label htmlFor={id} className={cn("flex min-h-16 cursor-pointer items-start gap-3 rounded-lg border bg-card p-4", checked && "border-primary/60 bg-primary/5", error && "border-destructive")}>
        <input
          id={id}
          name={id}
          type="checkbox"
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
          aria-describedby={errorId}
          aria-invalid={Boolean(error)}
          className="mt-1 size-4 shrink-0 accent-[var(--brand-blue)]"
        />
        <span>
          <span className="flex items-center gap-2 text-sm font-semibold"><CheckCircle2 className="size-4 text-primary" aria-hidden="true" />{label}</span>
          <span className="mt-1 block text-sm leading-5 text-muted-foreground">{description}</span>
        </span>
      </Label>
      {error ? <p id={errorId} role="alert" className="text-sm font-medium text-destructive">{error}</p> : null}
    </div>
  );
}

export function RegistrationReviewStep({
  values,
  errors,
  selectedDocument,
  onConsentChange,
  onEditStep,
}: RegistrationReviewStepProps) {
  const accountLabel = values.accountRole === "worker" ? "Worker" : "Client";
  const verificationLabel = selectedDocument.method === "DIDIT" ? "Automatic Didit verification" : "Manual identity review";
  const locationLabel = [values.barangay, values.city, values.province].filter(Boolean).join(", ");

  return (
    <section aria-labelledby="registration-step-heading" className="grid gap-6">
      <div>
        <p className="mb-1 text-xs font-bold uppercase tracking-[0.16em] text-[var(--brand-orange)]">Step 4</p>
        <h2 id="registration-step-heading" tabIndex={-1} className="text-2xl font-bold tracking-tight">Review and consent</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">Check your registration information before beginning the selected identity verification path.</p>
      </div>

      <div aria-label="Registration summary" className="rounded-lg border bg-muted/20 px-4">
        <SummaryRow icon={UserRound} label="Account type" value={accountLabel} editStep={1} onEditStep={onEditStep} />
        <SummaryRow icon={FileText} label="Identity document" value={`${selectedDocument.label} · ${verificationLabel}`} editStep={1} onEditStep={onEditStep} />
        <SummaryRow icon={Mail} label="Email" value={values.email} editStep={2} onEditStep={onEditStep} />
        <SummaryRow icon={MapPin} label="Service location" value={locationLabel} editStep={3} onEditStep={onEditStep} />
      </div>

      <div className="flex gap-3 rounded-lg border bg-primary/5 p-4 text-sm leading-5">
        <ShieldCheck className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
        <p>Your specific address is securely included with your service location. It is not repeated here for privacy.</p>
      </div>

      {selectedDocument.method === "DIDIT" ? (
        <div className="grid gap-2 rounded-lg border bg-muted/30 p-4 text-sm leading-5">
          <p><strong>Didit powers the automatic verification.</strong> TrabaWho requests the check, while Didit processes your ID document, selfie or liveness capture, biometric comparison, and fraud signals for this purpose.</p>
          <p className="flex flex-wrap gap-x-4 gap-y-2">
            <a className="inline-flex min-h-11 items-center gap-1 font-semibold text-primary underline-offset-4 hover:underline" href="https://didit.me/terms/verification-privacy-notice/" target="_blank" rel="noreferrer">Didit verification privacy notice <ExternalLink className="size-3.5" aria-hidden="true" /></a>
            <a className="inline-flex min-h-11 items-center gap-1 font-semibold text-primary underline-offset-4 hover:underline" href="https://didit.me/terms/identity-verification/" target="_blank" rel="noreferrer">Didit end-user terms <ExternalLink className="size-3.5" aria-hidden="true" /></a>
          </p>
        </div>
      ) : null}

      <div className="grid gap-3">
        <Consent
          id="acceptedIdentityTerms"
          label="Identity verification consent"
          description={selectedDocument.method === "DIDIT"
            ? "I consent to Didit processing my identity document and biometric or liveness data for TrabaWho identity verification before account access."
            : "I consent to document validation and identity checks by an authorized TrabaWho reviewer before account access."}
          checked={values.acceptedIdentityTerms}
          error={errors.acceptedIdentityTerms}
          onChange={(checked) => onConsentChange("acceptedIdentityTerms", checked)}
        />
        <Consent
          id="acceptedRaTerms"
          label="RA 10173 Terms and Conditions"
          description="I agree to the collection and processing of my registration, identity, location, booking, and contact information under the Data Privacy Act of 2012."
          checked={values.acceptedRaTerms}
          error={errors.acceptedRaTerms}
          onChange={(checked) => onConsentChange("acceptedRaTerms", checked)}
        />
      </div>
    </section>
  );
}
