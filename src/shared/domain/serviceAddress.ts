import type { UserLocation } from '@/types/application';
export type ServiceAddress = UserLocation;
export const emptyServiceAddress: ServiceAddress = { province: '', city: '', barangay: '', address: '' };
export function serviceAddressValid(value: ServiceAddress, precise = true) {
  return (precise ? [value.province, value.city, value.barangay, value.address] : [value.province, value.city, value.barangay])
    .every((part) => part.trim().length > 0 && part.trim().length <= 500);
}
