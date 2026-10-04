import { describe, expect, it } from 'vitest';
import { serviceAddressValid } from './serviceAddress';
describe('purpose-specific service addresses', () => {
  const area = { province: 'Bulacan', city: 'Guiguinto', barangay: 'Poblacion', address: '' };
  it('allows a provider area while requiring the precise destination for a booking', () => {
    expect(serviceAddressValid(area, false)).toBe(true);
    expect(serviceAddressValid(area)).toBe(false);
    expect(serviceAddressValid({ ...area, address: '12 Service Street' })).toBe(true);
  });
  it('rejects blank and excessively long location fields', () => {
    expect(serviceAddressValid({ ...area, city: ' ', address: '12 Street' })).toBe(false);
    expect(serviceAddressValid({ ...area, address: 'x'.repeat(501) })).toBe(false);
  });
});
