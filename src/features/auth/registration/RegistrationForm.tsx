import type { FormEventHandler } from 'react';
import { Check, ChevronLeft, ChevronRight, Home, Mail, ShieldCheck, Upload } from 'lucide-react';
import { SelectField } from '@/components/forms';
import { Button } from '@/components/ui/button';
import PasswordField from '@/features/auth/components/PasswordField';
import { IDENTITY_DOCUMENT_TYPES, getDocumentType } from '@/shared/services/identityRegistrationService';
import { cn } from '@/lib/utils';
import { RegistrationField } from './RegistrationField';
import { RegistrationReview } from './RegistrationReview';
import { REGISTRATION_STEPS, validateRegistrationStep } from './validation';
import { useRegistrationLocations } from './useRegistrationLocations';
import { useRegistrationFlow } from './useRegistrationFlow';
import type { RegistrationValues, UpdateRegistration } from './types';

interface RegistrationFormProps {
  values: RegistrationValues;
  onUpdate: UpdateRegistration;
  onSubmit: FormEventHandler<HTMLFormElement>;
  submitError: string;
  clearSubmitError: () => void;
  isSubmitting: boolean;
}

const STEP_COPY = [
  ['Choose your account', 'Select how you plan to use TrabaWho.'],
  ['Secure your account', 'Use an email you can access for verification.'],
  ['Add your service location', 'Used to match you with nearby providers in the Philippines.'],
  ['Review and consent', 'Confirm how identity and account information will be handled.'],
];

export function RegistrationForm({ values, onUpdate, onSubmit, submitError, clearSubmitError, isSubmitting }: RegistrationFormProps) {
  const { step, errors, move, next, validateAll, update } = useRegistrationFlow(values, onUpdate, clearSubmitError);
  const locations = useRegistrationLocations(values);
  const document = getDocumentType(values.documentTypeKey);
  const usesDidit = document.mode === 'didit';
  const locationError = locations.provinces.error || locations.cities.error || locations.barangays.error;
  const submit: FormEventHandler<HTMLFormElement> = (event) => {
    event.preventDefault();
    if (isSubmitting) return;
    if (step < 4) next();
    else if (validateAll()) onSubmit(event);
  };
  return <form className="mt-[22px] grid gap-4" noValidate onSubmit={submit} aria-busy={isSubmitting}>
    <nav aria-label="Registration progress" className="rounded-xl bg-muted/50 p-4">
      <ol className="grid grid-cols-4">
        {REGISTRATION_STEPS.map((label, index) => {
          const number = index + 1;
          const complete = number < step && Object.keys(validateRegistrationStep(values, number)).length === 0;
          return <li key={label} className="relative min-w-0">
            {index < 3 && <span aria-hidden="true" className="absolute left-[calc(50%+17px)] right-[calc(-50%+17px)] top-4 h-0.5 bg-border" />}
            <button type="button" aria-current={number === step ? 'step' : undefined} aria-label={`${label}${complete ? ', complete' : ''}`}
              disabled={number >= step || isSubmitting} onClick={() => move(number)} className="relative flex min-h-14 w-full flex-col items-center gap-1 rounded-md text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <span className={cn('flex size-8 items-center justify-center rounded-full border-2 bg-background', complete ? 'border-primary bg-primary text-primary-foreground' : number === step ? 'border-primary text-primary' : 'border-input text-muted-foreground')}>
                {complete ? <Check className="size-4" aria-hidden="true" /> : number === step ? <span className="size-2 rounded-full bg-primary" /> : null}
              </span>
              <span className={cn('font-semibold', number === step ? 'text-foreground' : 'text-muted-foreground')}>{label}</span>
            </button>
          </li>;
        })}
      </ol>
      <span className="sr-only" role="status">Step {step} of 4</span>
    </nav>
    <div id="registration-step-heading" tabIndex={-1} className="mt-1 flex items-center gap-3 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand-highlight-strong text-sm font-bold text-white">{step}</span>
      <div><h2 className="text-sm font-bold">{STEP_COPY[step - 1][0]}</h2><p className="mt-0.5 text-xs text-muted-foreground">{STEP_COPY[step - 1][1]}</p></div>
    </div>
    {step === 1 && <>
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField id="accountRole" name="accountRole" label="Account Type" required value={values.accountRole} error={errors.accountRole} onValueChange={(value) => update('accountRole', value)} options={[{ value: 'client', label: 'Client' }, { value: 'worker', label: 'Worker' }]} triggerClassName="min-h-12" />
        <SelectField id="documentTypeKey" name="documentTypeKey" label="Identity document" required value={values.documentTypeKey} error={errors.documentTypeKey} onValueChange={(value) => update('documentTypeKey', value)} options={IDENTITY_DOCUMENT_TYPES.map((item) => ({ value: item.key, label: item.label }))} triggerClassName="min-h-12" />
      </div>
      <p className="flex items-start gap-2 rounded-lg border border-primary/30 bg-primary/10 p-3 text-sm"><ShieldCheck className="mt-0.5 size-4 shrink-0 text-brand-highlight-foreground" aria-hidden="true" />{document.label} {usesDidit ? 'uses Didit for ID scan, liveness, and face match before account creation.' : 'uses manual review. You will add the document details on the final step.'}</p>
    </>}
    {step === 2 && <>
      <RegistrationField id="email" name="email" label="Email" icon={Mail} type="email" required value={values.email} error={errors.email} onChange={(event) => update('email', event.target.value)} placeholder="you@example.com" autoComplete="email" />
      <PasswordField id="password" name="password" label="Password" required value={values.password} error={errors.password} onChange={(event) => update('password', event.target.value)} placeholder="Enter at least 8 characters" autoComplete="new-password" />
      <PasswordField id="confirmPassword" name="confirmPassword" label="Confirm Password" required value={values.confirmPassword} error={errors.confirmPassword} onChange={(event) => update('confirmPassword', event.target.value)} placeholder="Confirm your password" autoComplete="new-password" />
    </>}
    {step === 3 && <>
      <SelectField id="province" name="province" label="Province" required value={locations.provinceCode} error={errors.province} disabled={locations.provinces.loading}
        onValueChange={(value) => { update('province', locations.provinces.options.find((item) => item.code === value)?.name ?? ''); onUpdate('city', ''); onUpdate('barangay', ''); }}
        options={locations.provinces.options.map((item) => ({ value: item.code, label: item.name }))} placeholder={locations.provinces.loading ? 'Loading provinces...' : 'Select a province'} triggerClassName="min-h-12" />
      <SelectField id="city" name="city" label="City/Municipality" required value={locations.cityCode} error={errors.city} disabled={!locations.provinceCode || locations.cities.loading}
        onValueChange={(value) => { update('city', locations.cities.options.find((item) => item.code === value)?.name ?? ''); onUpdate('barangay', ''); }}
        options={locations.cities.options.map((item) => ({ value: item.code, label: item.name }))} placeholder={locations.cities.loading ? 'Loading cities...' : !locations.provinceCode ? 'Select province first' : 'Select city/municipality'} triggerClassName="min-h-12" />
      <SelectField id="barangay" name="barangay" label="Barangay" required value={locations.barangays.options.find((item) => item.name === values.barangay)?.code ?? ''} error={errors.barangay} disabled={!locations.cityCode || locations.barangays.loading}
        onValueChange={(value) => update('barangay', locations.barangays.options.find((item) => item.code === value)?.name ?? '')}
        options={locations.barangays.options.map((item) => ({ value: item.code, label: item.name }))} placeholder={locations.barangays.loading ? 'Loading barangays...' : !locations.cityCode ? 'Select city first' : 'Select barangay'} triggerClassName="min-h-12" />
      <RegistrationField id="address" name="address" label="Specific Address" icon={Home} required maxLength={500} value={values.address} error={errors.address} onChange={(event) => update('address', event.target.value)} placeholder="Block, street, house number" autoComplete="street-address" />
      {locationError && <div role="alert" className="text-sm text-destructive">{locationError}<Button type="button" variant="ghost" onClick={locations.retry}>Try again</Button></div>}
    </>}
    {step === 4 && <RegistrationReview values={values} update={update} errors={errors} document={document} />}
    {submitError && <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{submitError}</p>}
    <nav aria-label="Registration step controls" className="flex items-center justify-between gap-3">
      {step > 1 && <Button type="button" variant="ghost" disabled={isSubmitting} onClick={() => move(step - 1)} aria-label="Go to previous page"><ChevronLeft aria-hidden="true" />Previous</Button>}
      {step < 4 ? <Button className="ml-auto" type="submit" aria-label="Go to next page">Next<ChevronRight aria-hidden="true" /></Button> :
        <Button className="h-auto min-h-12 flex-1 whitespace-normal py-2" type="submit" isLoading={isSubmitting}>{usesDidit ? <ShieldCheck aria-hidden="true" /> : <Upload aria-hidden="true" />}{isSubmitting ? 'Submitting...' : usesDidit ? 'Start Didit Verification' : 'Submit Manual Review'}</Button>}
    </nav>
  </form>;
}
