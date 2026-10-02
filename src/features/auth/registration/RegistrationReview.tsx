import { useRef } from 'react';
import { FileText, Upload, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { FieldError, RegistrationField } from './RegistrationField';
import { RegistrationConsent } from './RegistrationConsent';
import { todayInputValue } from './validation';
import type { RegistrationErrors, RegistrationValues, UpdateRegistration } from './types';

function ImageField({ id, name, label, file, error, update }: { id: string; name: 'frontImage' | 'backImage' | 'selfieImage'; label: string; file: File | null; error?: string; update: UpdateRegistration }) {
  const input = useRef<HTMLInputElement>(null);
  return <div className="grid min-w-0 gap-2">
    <Label htmlFor={name}>{label}</Label>
    <input ref={input} id={id} name={name} type="file" accept="image/jpeg,image/png,image/webp" hidden aria-label={label}
      onChange={(event) => update(name, event.target.files?.[0] ?? null)} />
    <Button id={name} type="button" variant="outline" className="h-auto min-h-12 min-w-0 justify-start gap-3 rounded-lg py-2 text-left"
      aria-invalid={Boolean(error)} aria-describedby={[file ? `${name}-file` : '', error ? `${name}-error` : ''].filter(Boolean).join(' ') || undefined} onClick={() => input.current?.click()}>
      <Upload aria-hidden="true" className="shrink-0 text-muted-foreground" /><span id={`${name}-file`} className="min-w-0 whitespace-normal break-all font-normal">{file ? file.name : 'Choose image'}</span>
    </Button>
    <FieldError id={name} error={error} />
  </div>;
}

export function RegistrationReview({ values, errors, update, document }: { values: RegistrationValues; errors: RegistrationErrors; update: UpdateRegistration; document: { mode: string; label: string } }) {
  return <>
    {document.mode !== 'didit' && <div className="grid gap-4" data-testid="manual-review-fields">
      <p className="flex items-start gap-2 rounded-lg border border-primary/30 bg-primary/10 p-3 text-sm text-foreground"><Upload className="mt-0.5 size-4 shrink-0 text-brand-highlight-foreground" aria-hidden="true" />Upload clear images for manual review. Your account remains pending until approval.</p>
      <RegistrationField id="manualFullName" name="manualFullName" label="Name on ID" icon={User} required value={values.manualFullName} error={errors.manualFullName} onChange={(event) => update('manualFullName', event.target.value)} placeholder="Juan Santos Dela Cruz" />
      <div className="grid gap-4 sm:grid-cols-2">
        <RegistrationField id="identityDocumentNumber" name="identityDocumentNumber" label="ID number" icon={FileText} required value={values.identityDocumentNumber} error={errors.identityDocumentNumber} onChange={(event) => update('identityDocumentNumber', event.target.value)} placeholder="ID number" />
        <RegistrationField id="idDocumentExpiry" name="idDocumentExpiry" label="ID expiry date" icon={FileText} type="date" required min={todayInputValue()} value={values.idDocumentExpiry} error={errors.idDocumentExpiry} onChange={(event) => update('idDocumentExpiry', event.target.value)} />
        <ImageField id="manual-front-image" name="frontImage" label="Front image" file={values.frontImage} error={errors.frontImage} update={update} />
        <ImageField id="manual-back-image" name="backImage" label="Back image" file={values.backImage} error={errors.backImage} update={update} />
      </div>
      <ImageField id="manual-selfie-image" name="selfieImage" label="Selfie image" file={values.selfieImage} error={errors.selfieImage} update={update} />
    </div>}
    <dl className="grid min-w-0 gap-4 rounded-lg bg-muted/50 p-4 text-sm sm:grid-cols-3" aria-label="Registration summary">
      <div><dt className="text-xs text-muted-foreground">Account</dt><dd className="mt-1 font-semibold">{values.accountRole === 'worker' ? 'Worker' : 'Client'}</dd></div>
      <div><dt className="text-xs text-muted-foreground">Document</dt><dd className="mt-1 font-semibold">{document.label}</dd></div>
      <div className="min-w-0"><dt className="text-xs text-muted-foreground">Location</dt><dd className="mt-1 break-words font-semibold">{[values.address, values.barangay, values.city, values.province].filter(Boolean).join(', ')}</dd></div>
    </dl>
    <RegistrationConsent values={values} update={update} errors={errors} />
  </>;
}
