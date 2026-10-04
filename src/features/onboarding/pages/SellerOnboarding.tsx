import { ArrowLeft, BriefcaseBusiness } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { ServiceAddressFields } from '@/shared/components/ServiceAddressFields';
import { useProviderSetup } from '../hooks/useProviderSetup';
interface Props {
  onBack?: () => void; onComplete?: (data: Record<string, unknown>, destination?: string) => unknown;
  userLocation?: unknown; isFloating?: boolean; appTheme?: string; verifiedName?: string;
}
export default function SellerOnboarding({ onBack, onComplete, verifiedName }: Props) {
  const flow = useProviderSetup(onComplete); const values = flow.values;
  return <section className="mx-auto w-full max-w-2xl space-y-6 p-4 sm:p-6" aria-label="Provider setup">
    <Button variant="ghost" disabled={flow.busy} onClick={() => flow.step === 1 ? onBack?.() : flow.setStep(flow.step - 1)}><ArrowLeft className="size-4" aria-hidden="true" />Back</Button>
    <div className="space-y-2"><BriefcaseBusiness className="size-8 text-primary" aria-hidden="true" /><h1 className="text-2xl font-bold">Offer services</h1><p className="text-sm text-muted-foreground">Step {flow.step} of 3. Set up your service area and first gig before publishing.</p>{verifiedName && <p className="break-words text-sm">Verified legal name: <strong>{verifiedName}</strong></p>}</div>
    {flow.error && <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{flow.error}</p>}
    <form className="space-y-5" onSubmit={(event) => { event.preventDefault(); if (flow.step < 3) flow.next(); else void flow.save(); }}>
      {flow.step === 1 && <>
        <div className="space-y-2"><Label htmlFor="provider-service">Service type</Label><Input id="provider-service" required maxLength={100} value={values.serviceType} onChange={(event) => flow.update('serviceType', event.target.value)} placeholder="For example, plumbing or cleaning" /></div>
        {values.serviceType === 'Others' && <div className="space-y-2"><Label htmlFor="provider-custom">Custom service type</Label><Input id="provider-custom" required value={values.customServiceType} onChange={(event) => flow.update('customServiceType', event.target.value)} /></div>}
        <div className="space-y-2"><Label htmlFor="provider-bio">Describe your service</Label><Textarea id="provider-bio" required maxLength={2000} value={values.bio} onChange={(event) => flow.update('bio', event.target.value)} /></div>
        <div className="grid gap-3 sm:grid-cols-2">{([{ key: 'age', label: 'Age' }, { key: 'experienceYears', label: 'Years of experience' }] as const).map(({ key, label }) => <div key={key} className="space-y-2"><Label htmlFor={`provider-${key}`}>{label}</Label><Input id={`provider-${key}`} type="number" min={key === 'age' ? 1 : 0} max={119} value={values[key]} onChange={(event) => flow.update(key, event.target.value)} /></div>)}</div>
        <ServiceAddressFields value={flow.area} onChange={flow.setArea} precise={false} prefix="provider-area" />
        <div className="space-y-2"><Label htmlFor="provider-portfolio">Portfolio images (optional)</Label><Input id="provider-portfolio" type="file" accept="image/*" multiple /><p className="text-xs text-muted-foreground">Add published portfolio photos in My Work after setup.</p></div>
      </>}
      {flow.step === 2 && <>
        <fieldset className="space-y-2"><legend className="font-semibold">Pricing model</legend>{['fixed', 'inquiry'].map((pricing) => <label key={pricing} className="flex min-h-11 items-center gap-3 text-sm"><input type="radio" name="pricing-model" checked={values.pricingModel === pricing} onChange={() => flow.update('pricingModel', pricing)} />{pricing === 'fixed' ? 'Fixed price' : 'Quote after inquiry'}</label>)}</fieldset>
        {values.pricingModel === 'fixed' && <div className="space-y-2"><Label htmlFor="provider-price">Service price (PHP)</Label><Input id="provider-price" type="number" min="1" step="0.01" required value={values.fixedPrice} onChange={(event) => flow.update('fixedPrice', event.target.value)} /></div>}
        <div className="space-y-2"><Label htmlFor="provider-rate">Rate basis</Label><select id="provider-rate" className="h-11 w-full rounded-lg border bg-background px-3" value={values.rateBasis} onChange={(event) => flow.update('rateBasis', event.target.value)}>{['per-hour', 'per-day', 'per-week', 'per-month', 'per-project'].map((basis) => <option key={basis} value={basis}>{basis.replace('per-', 'Per ')}</option>)}</select></div>
        <label htmlFor="provider-advance" className="flex min-h-11 items-center gap-3 text-sm"><Checkbox id="provider-advance" checked={values.paymentAdvance} onChange={(event) => flow.update('paymentAdvance', event.target.checked)} />Allow advance payment</label>
        <div className="space-y-2"><Label htmlFor="provider-payment">After-service payment option</Label><select id="provider-payment" className="h-11 w-full rounded-lg border bg-background px-3" value={values.afterServicePaymentType} onChange={(event) => flow.update('afterServicePaymentType', event.target.value)}><option value="both">Cash or GCash</option><option value="cash">Cash</option><option value="gcash">GCash</option></select></div>
        {values.afterServicePaymentType !== 'cash' && <div className="space-y-2"><Label htmlFor="provider-gcash">GCash number (optional)</Label><Input id="provider-gcash" value={values.gcashNumber} onChange={(event) => flow.update('gcashNumber', event.target.value)} /></div>}
        {values.afterServicePaymentType !== 'cash' && <div className="space-y-2"><Label htmlFor="provider-qr">GCash QR image (optional)</Label><Input id="provider-qr" type="file" accept="image/*" onChange={(event) => flow.update('qrFileName', event.target.files?.[0]?.name || '')} /></div>}
      </>}
      {flow.step === 3 && <>
        <fieldset className="space-y-2"><legend className="font-semibold">Booking mode</legend>{['with-slots', 'calendar-only'].map((mode) => <label key={mode} className="flex min-h-11 items-center gap-3 text-sm"><input type="radio" name="booking-mode" checked={values.bookingMode === mode} onChange={() => flow.update('bookingMode', mode)} />{mode === 'with-slots' ? 'Scheduled time slots' : 'Arrange a schedule through chat'}</label>)}</fieldset>
        <p className="text-sm text-muted-foreground">You can configure available dates and time slots in My Work after saving. Booking remains available as a client too.</p>
        <dl className="space-y-2 rounded-lg bg-muted p-4 text-sm"><dt className="font-semibold">Service area</dt><dd>{[flow.area.barangay, flow.area.city, flow.area.province].join(', ')}</dd><dt className="font-semibold">First gig</dt><dd>{values.serviceType}</dd><dt className="font-semibold">Pricing</dt><dd>{values.pricingModel === 'fixed' ? `PHP ${values.fixedPrice} ${values.rateBasis}` : 'Quote after inquiry'}</dd></dl>
      </>}
      <Button type="submit" isLoading={flow.busy} className="w-full">{flow.step < 3 ? 'Continue' : 'Save provider setup and publish gig'}</Button>
    </form>
  </section>;
}
