import { BriefcaseBusiness, FileCheck2, ShieldCheck, UserRound } from "lucide-react";

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { IDENTITY_DOCUMENTS } from "@/features/auth/domain/registration";
import type {
  AccountType,
  IdentityDocumentOption,
  RegistrationErrors,
  RegistrationFormValues,
} from "@/features/auth/types";
import { cn } from "@/lib/utils";

interface RegistrationAccountStepProps {
  values: RegistrationFormValues;
  errors: RegistrationErrors;
  selectedDocument: IdentityDocumentOption | null;
  onAccountChange: (value: AccountType) => void;
  onDocumentChange: (value: string) => void;
}

const accountTypes = [
  {
    value: "client",
    label: "Client",
    description: "Find and book local services.",
    icon: UserRound,
  },
  {
    value: "worker",
    label: "Worker",
    description: "Offer services and manage work.",
    icon: BriefcaseBusiness,
  },
] as const;

export function RegistrationAccountStep({
  values,
  errors,
  selectedDocument,
  onAccountChange,
  onDocumentChange,
}: RegistrationAccountStepProps) {
  const diditDocuments = IDENTITY_DOCUMENTS.filter((document) => document.method === "DIDIT");
  const manualDocuments = IDENTITY_DOCUMENTS.filter((document) => document.method === "MANUAL");

  return (
    <section aria-labelledby="registration-step-heading" className="grid gap-6">
      <div>
        <p className="mb-1 text-xs font-bold uppercase tracking-[0.16em] text-[var(--brand-orange)]">Step 1</p>
        <h2 id="registration-step-heading" tabIndex={-1} className="text-2xl font-bold tracking-tight">
          Choose your account
        </h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Account type and identity verification are separate choices. Both clients and workers complete the same identity checks.
        </p>
      </div>

      <fieldset className="grid gap-3" aria-describedby={errors.accountRole ? "account-role-error" : undefined}>
        <legend className="mb-2 text-sm font-semibold">Account type</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          {accountTypes.map((account) => {
            const Icon = account.icon;
            const selected = values.accountRole === account.value;
            return (
              <Label
                key={account.value}
                htmlFor={`account-role-${account.value}`}
                className={cn(
                  "flex min-h-24 cursor-pointer items-start gap-3 rounded-lg border bg-card p-4 transition-colors hover:border-primary/60",
                  selected && "border-primary bg-primary/5 ring-1 ring-primary",
                )}
              >
                <input
                  id={`account-role-${account.value}`}
                  type="radio"
                  name="accountRole"
                  value={account.value}
                  checked={selected}
                  onChange={() => onAccountChange(account.value)}
                  className="mt-1 size-4 accent-[var(--brand-blue)]"
                />
                <span className="min-w-0">
                  <span className="flex items-center gap-2 font-semibold"><Icon className="size-4 text-primary" aria-hidden="true" />{account.label}</span>
                  <span className="mt-1 block text-sm leading-5 text-muted-foreground">{account.description}</span>
                </span>
              </Label>
            );
          })}
        </div>
        {errors.accountRole ? <p id="account-role-error" role="alert" className="text-sm font-medium text-destructive">{errors.accountRole}</p> : null}
      </fieldset>

      <div className="grid gap-2">
        <label htmlFor="identity-document" className="text-sm font-semibold">Identity document</label>
        <Select value={values.documentTypeKey} onValueChange={onDocumentChange}>
          <SelectTrigger
            id="identity-document"
            aria-invalid={Boolean(errors.documentTypeKey)}
            aria-describedby={errors.documentTypeKey ? "identity-document-error" : "identity-document-description"}
            className={cn("min-h-11 w-full", errors.documentTypeKey && "border-destructive")}
          >
            <SelectValue placeholder="Choose a government-issued ID" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectLabel>Automatic Didit verification</SelectLabel>
              {diditDocuments.map((document) => <SelectItem key={document.key} value={document.key}>{document.label}</SelectItem>)}
            </SelectGroup>
            <SelectGroup>
              <SelectLabel>Manual identity review</SelectLabel>
              {manualDocuments.map((document) => <SelectItem key={document.key} value={document.key}>{document.label}</SelectItem>)}
            </SelectGroup>
          </SelectContent>
        </Select>
        <p id="identity-document-description" className="text-sm leading-5 text-muted-foreground">
          Didit supports National ID, passport, and driver&apos;s license. Other listed IDs go to a human reviewer.
        </p>
        {errors.documentTypeKey ? <p id="identity-document-error" role="alert" className="text-sm font-medium text-destructive">{errors.documentTypeKey}</p> : null}
      </div>

      {selectedDocument ? (
        <div className="flex gap-3 rounded-lg border bg-muted/50 p-4 text-sm leading-5">
          {selectedDocument.method === "DIDIT"
            ? <ShieldCheck className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
            : <FileCheck2 className="mt-0.5 size-5 shrink-0 text-[var(--brand-orange)]" aria-hidden="true" />}
          <p>
            <strong>{selectedDocument.label}</strong> will use {selectedDocument.method === "DIDIT"
              ? "automatic Didit document validation, liveness detection, and face matching."
              : "manual identity review after you review and consent to registration."}
          </p>
        </div>
      ) : null}
    </section>
  );
}
