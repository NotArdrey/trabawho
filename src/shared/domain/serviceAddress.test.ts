import { describe, expect, it } from 'vitest';
import { readServiceAddress, serviceAddressValid, serviceMapsUrl, servicePinValid } from './serviceAddress';
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
  it('accepts optional finite coordinates and rejects invalid pins', () => {
    const address = { ...area, address: '12 Service Street' };
    expect(serviceAddressValid({ ...address, pin: { latitude: 14.83, longitude: 120.88 } })).toBe(true);
    for (const pin of [null, {}, { latitude: 91, longitude: 120 }, { latitude: 14, longitude: -181 },
      { latitude: NaN, longitude: 120 }, { latitude: 14, longitude: Infinity }, { latitude: '14', longitude: 120 }]) {
      expect(servicePinValid(pin)).toBe(false);
    }
    expect(serviceAddressValid({ ...address, pin: { latitude: 14, longitude: Infinity } })).toBe(false);
    expect(servicePinValid({ latitude: 0, longitude: 0 })).toBe(true);
  });
  it('links to exact coordinates and safely reads old or malformed stored addresses', () => {
    const address = { ...area, address: '12 Service Street' };
    const pin = { latitude: 14.83, longitude: 120.88 };
    expect(new URL(serviceMapsUrl({ ...address, pin })).searchParams.get('query')).toBe('14.83,120.88');
    expect(new URL(serviceMapsUrl(address)).searchParams.get('query')).toContain('12 Service Street, Poblacion');
    expect(readServiceAddress({ ...address, pin })).toEqual({ ...address, pin });
    expect(readServiceAddress({ ...address, pin: { latitude: 'bad', longitude: 120 } })).toEqual(address);
    expect(readServiceAddress({ ...address, province: 123 })).toBeNull();
    expect(readServiceAddress(null)).toBeNull();
  });
});
