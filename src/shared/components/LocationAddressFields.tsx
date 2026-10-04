import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SelectField } from '@/components/forms/select-field';
import { useLocationOptions } from '@/shared/hooks/useLocationOptions';
import { metroManilaCode } from '@/shared/services/philippineLocations';
import type { ServiceAddress } from '@/shared/domain/serviceAddress';
import { SpecificAddressField } from './SpecificAddressField';

export interface LocationAddressFieldsProps {
  value: ServiceAddress;
  onChange: (value: ServiceAddress) => void;
  disabled: boolean;
  prefix: string;
}

export function LocationAddressFields({ value, onChange, disabled, prefix }: LocationAddressFieldsProps) {
  const [retry, setRetry] = useState(0);
  const [manual, setManual] = useState(false);
  const provinces = useLocationOptions('/provinces/', retry);
  const provinceCode = provinces.options.find((option) => option.name === value.province)?.code;
  const cities = useLocationOptions(provinceCode
    ? `/${provinceCode === metroManilaCode ? 'regions' : 'provinces'}/${provinceCode}/cities-municipalities/` : '', retry);
  const cityCode = cities.options.find((option) => option.name === value.city)?.code;
  const barangays = useLocationOptions(cityCode ? `/cities-municipalities/${cityCode}/barangays/` : '', retry);
  const locationError = provinces.error || cities.error || barangays.error;
  const fields = [
    { key: 'province', label: 'Province', list: provinces, placeholder: 'Select province', available: true },
    { key: 'city', label: 'City/Municipality', list: cities, placeholder: provinceCode ? 'Select city/municipality' : 'Select province first', available: Boolean(provinceCode) },
    { key: 'barangay', label: 'Barangay', list: barangays, placeholder: cityCode ? 'Select barangay' : 'Select city/municipality first', available: Boolean(cityCode) },
  ] as const;

  function selectLocation(key: 'province' | 'city' | 'barangay', name: string) {
    onChange({ ...value, [key]: name,
      ...(key === 'province' ? { city: '', barangay: '', address: '' } : {}),
      ...(key === 'city' ? { barangay: '', address: '' } : {}),
      ...(key === 'barangay' ? { address: '' } : {}),
    });
  }

  return <fieldset className="space-y-3" disabled={disabled}>
    <legend className="mb-2 font-semibold">Where will the service take place?</legend>
    <p className="text-sm text-muted-foreground">Select your province, city or municipality, and barangay. Then enter the street and house or unit number.</p>
    <div className="grid items-start gap-3 sm:grid-cols-2">
      {fields.map(({ key, label, list, placeholder, available }) => manual
        ? <div key={key} className="min-w-0 space-y-2"><Label htmlFor={`${prefix}-${key}`}>{label}</Label>
          <Input id={`${prefix}-${key}`} value={value[key]} required maxLength={500} onChange={(event) => selectLocation(key, event.target.value)} /></div>
        : <SelectField key={key} id={`${prefix}-${key}`} label={label} value={value[key]} required
          className="min-w-0" placeholder={list.loading ? `Loading ${label.toLowerCase()}…` : placeholder}
          disabled={disabled || !available || list.loading || list.error}
          options={list.options.map((option) => ({ value: option.name, label: option.name }))}
          onValueChange={(name) => selectLocation(key, name)} />)}
      <SpecificAddressField key={[value.province, value.city, value.barangay].join('|')} value={value} onChange={(address) => onChange({ ...value, address })}
        disabled={disabled} prefix={prefix} />
    </div>
    {locationError && !manual && <div className="space-y-2">
      <p role="alert" className="text-sm text-destructive">Location options could not be loaded. Retry or enter your location manually.</p>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" disabled={disabled} onClick={() => setRetry((attempt) => attempt + 1)}>Retry locations</Button>
        <Button type="button" variant="ghost" disabled={disabled} onClick={() => setManual(true)}>Enter location manually</Button>
      </div>
    </div>}
    {manual && <p role="status" className="text-sm text-muted-foreground">Enter your location manually to continue with this booking.</p>}
  </fieldset>;
}
