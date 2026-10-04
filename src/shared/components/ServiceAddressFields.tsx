import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { ServiceAddress } from '@/shared/domain/serviceAddress';
export function ServiceAddressFields({ value, onChange, precise = true, disabled = false, prefix = 'service' }: {
  value: ServiceAddress; onChange: (value: ServiceAddress) => void; precise?: boolean; disabled?: boolean; prefix?: string;
}) {
  const fields: { key: keyof ServiceAddress; label: string }[] = [
    { key: 'province', label: 'Province' }, { key: 'city', label: 'City/Municipality' },
    { key: 'barangay', label: 'Barangay' }, ...(precise ? [{ key: 'address' as const, label: 'Specific service address' }] : []),
  ];
  return <fieldset className="space-y-3" disabled={disabled}><legend className="mb-2 font-semibold">{precise ? 'Where will the service take place?' : 'Your service area'}</legend>
    <p className="text-sm text-muted-foreground">{precise ? 'Provide the destination for this booking, including street and house or unit number.' : 'Choose the area where you offer services. Your exact home address is not required.'}</p>
    <div className="grid gap-3 sm:grid-cols-2">{fields.map(({ key, label }) => <div key={key} className="space-y-2"><Label htmlFor={`${prefix}-${key}`}>{label}</Label><Input id={`${prefix}-${key}`} value={value[key]} maxLength={500} required onChange={(event) => onChange({ ...value, [key]: event.target.value })} /></div>)}</div>
  </fieldset>;
}
