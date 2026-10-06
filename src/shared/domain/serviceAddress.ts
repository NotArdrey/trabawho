import type { UserLocation } from '@/types/application';
export interface ServicePin { latitude: number; longitude: number }
export interface ServiceAddress extends UserLocation { pin?: ServicePin }
export const emptyServiceAddress: ServiceAddress = { province: '', city: '', barangay: '', address: '' };
export function serviceAddressValid(value: ServiceAddress, precise = true) {
  return (precise ? [value.province, value.city, value.barangay, value.address] : [value.province, value.city, value.barangay])
    .every((part) => part.trim().length > 0 && part.trim().length <= 500)
    && (value.pin === undefined || servicePinValid(value.pin));
}

export function servicePinValid(value: unknown): value is ServicePin {
  if (!value || typeof value !== 'object' || !('latitude' in value) || !('longitude' in value)) return false;
  return typeof value.latitude === 'number' && Number.isFinite(value.latitude) && Math.abs(value.latitude) <= 90
    && typeof value.longitude === 'number' && Number.isFinite(value.longitude) && Math.abs(value.longitude) <= 180;
}

export function serviceAddressText(value: ServiceAddress) {
  return [value.address, value.barangay, value.city, value.province, 'Philippines'].filter(Boolean).join(', ');
}

export function serviceMapsUrl(value: ServiceAddress) {
  const query = servicePinValid(value.pin) ? `${value.pin.latitude},${value.pin.longitude}` : serviceAddressText(value);
  return `https://www.google.com/maps/search/?${new URLSearchParams({ api: '1', query })}`;
}

export function readServiceAddress(value: unknown): ServiceAddress | null {
  if (!value || typeof value !== 'object') return null;
  const fields = ['province', 'city', 'barangay', 'address'] as const;
  if (!fields.every((key) => key in value && typeof value[key as keyof typeof value] === 'string')) return null;
  const address = value as UserLocation & { pin?: unknown };
  const result: ServiceAddress = { province: address.province, city: address.city, barangay: address.barangay, address: address.address };
  if (servicePinValid(address.pin)) result.pin = address.pin;
  return serviceAddressValid(result, false) ? result : null;
}
