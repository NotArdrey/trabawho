import { FileCheck, Upload } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { evidenceLabels } from '../domain/manualReviewValidation';
import { useManualAccountReview } from '../hooks/useManualAccountReview';
import type { DraftListener } from '../hooks/useRegistrationDraft';
import { RegistrationStepHeader } from './RegistrationStepHeader';

interface Props {
  busy: boolean; canSubmit?: boolean; consentContent?: ReactNode; onDraftChange?: DraftListener;
  submit: (body: Record<string, unknown>) => Promise<void>;
}

export function ManualAccountReview({ busy, submit, canSubmit = true, consentContent, onDraftChange }: Props) {
  const form = useManualAccountReview(submit, onDraftChange);
  const disabled = busy || form.encoding;
  return (
    <form noValidate className="space-y-6" onSubmit={(event) => {
      event.preventDefault(); if (disabled || !canSubmit) return;
      void form.send().then((id) => { if (id) document.getElementById(id)?.focus(); });
    }}>
      <RegistrationStepHeader icon={FileCheck} title="Manual identity review"
        description="An administrator reviews your ID and selfie before you can access the marketplace. Allow up to seven days." />
      <fieldset className="space-y-4" disabled={disabled}>
        <legend className="mb-4 text-lg font-semibold">Document details</legend>
        {([{ key: 'name', label: 'Name on ID', placeholder: 'Complete name as shown on your ID' },
          { key: 'document', label: 'Government document type', placeholder: 'For example, Passport or Postal ID' },
          { key: 'number', label: 'ID number', placeholder: 'Number printed on your ID' }] as const).map(({ key, label, placeholder }) => (
          <div key={key} className="space-y-2">
            <Label htmlFor={'manual-' + key}>{label}</Label>
            <Input id={'manual-' + key} value={form.fields[key]} maxLength={200} required placeholder={placeholder}
              aria-invalid={Boolean(form.errors[key])} aria-describedby={form.errors[key] ? 'manual-' + key + '-error' : undefined}
              onChange={(event) => form.update(key, event.target.value)} />
            {form.errors[key] && <p id={'manual-' + key + '-error'} className="text-sm text-destructive">{form.errors[key]}</p>}
          </div>
        ))}
        <div className="space-y-2"><Label htmlFor="manual-expiry">ID expiry date (if shown)</Label>
          <Input id="manual-expiry" type="date" disabled={form.fields.noExpiration} value={form.fields.expiry} aria-invalid={Boolean(form.errors.expiry)} aria-describedby={form.errors.expiry ? 'manual-expiry-error' : undefined} onChange={(event) => form.update('expiry', event.target.value)} />
          {form.errors.expiry && <p id="manual-expiry-error" className="text-sm text-destructive">{form.errors.expiry}</p>}
          <label htmlFor="manual-no-expiration" className="flex min-h-11 cursor-pointer items-center gap-3 text-sm"><Checkbox id="manual-no-expiration" checked={Boolean(form.fields.noExpiration)} onChange={(event) => form.setOption('noExpiration', event.target.checked)} />My ID has no expiration date</label>
        </div>
      </fieldset>
      <fieldset className="space-y-4 border-t pt-6" disabled={disabled} aria-describedby="manual-evidence-help">
        <legend className="mb-3 pt-6 text-lg font-semibold">Identity evidence</legend>
        <p id="manual-evidence-help" className="text-xs leading-5 text-muted-foreground">Use clear JPEG, PNG, or WebP images, up to 7 MB each. Include the back if your ID has one.</p>
        <label htmlFor="manual-no-back" className="flex min-h-11 cursor-pointer items-center gap-3 text-sm"><Checkbox id="manual-no-back" checked={Boolean(form.fields.backNotApplicable)} onChange={(event) => form.setOption('backNotApplicable', event.target.checked)} />My ID has no back side</label>
        {(['front', 'back', 'selfie'] as const).map((slot) => (
          <div key={slot} hidden={slot === 'back' && form.fields.backNotApplicable} className="space-y-2">
            <Label htmlFor={'manual-' + slot + '-image'} className="flex items-center gap-2"><Upload className="size-4 text-muted-foreground" aria-hidden="true" />{evidenceLabels[slot]}</Label>
            <Input id={'manual-' + slot + '-image'} type="file" accept="image/jpeg,image/png,image/webp" required
              className="h-auto min-h-12 min-w-0 py-3 text-xs file:mr-3 file:rounded-md file:border-0 file:bg-muted file:px-3 file:py-1 file:font-medium file:text-foreground"
              aria-invalid={Boolean(form.errors[slot])} aria-describedby={form.errors[slot] ? 'manual-' + slot + '-error' : 'manual-evidence-help'}
              onChange={(event) => form.setFile(slot, event.target.files?.[0] || null)} />
            {form.errors[slot] && <p id={'manual-' + slot + '-error'} className="text-sm text-destructive">{form.errors[slot]}</p>}
          </div>
        ))}
      </fieldset>
      {consentContent}
      {!canSubmit && <p className="text-xs leading-5 text-muted-foreground">Select the identity consent checkbox before submitting your evidence.</p>}
      {form.error && <p role="alert" className="text-sm text-destructive">{form.error}</p>}
      <Button type="submit" className="h-auto min-h-11 w-full whitespace-normal py-3" disabled={!canSubmit} isLoading={disabled}>Submit for human review</Button>
    </form>
  );
}
