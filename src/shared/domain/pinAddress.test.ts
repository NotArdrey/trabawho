import { describe, expect, it } from 'vitest';
import { matchPinLocation, readPhotonAddress } from './pinAddress';

describe('addresses from service pins', () => {
  it('matches official PSGC names without selecting ambiguous aliases', () => {
    expect(matchPinLocation([{ code: '1', name: 'City of Malolos (Capital)' }], ['Malolos'])?.code).toBe('1');
    expect(matchPinLocation([{ code: '2', name: 'Poblacion' }], ['Barangay Poblacion'])?.code).toBe('2');
    expect(matchPinLocation([{ code: '1', name: 'City of San Jose' }, { code: '2', name: 'San Jose City' }], ['San Jose'])).toBeUndefined();
    expect(matchPinLocation([{ code: '1', name: 'Poblacion' }], ['Unknown neighbourhood'])).toBeUndefined();
  });
  it('extracts Philippine address parts and recognizes NCR', () => {
    expect(readPhotonAddress({ features: [{ properties: { countrycode: 'PH', state: 'National Capital Region', city: 'Quezon City',
      district: 'Alicia', street: 'Main Street', housenumber: '12' } }] })).toMatchObject({
      provinces: ['Metro Manila', 'National Capital Region'], cities: ['Quezon City'], barangays: ['Alicia'], address: '12 Main Street',
    });
    for (const value of [null, {}, { features: [] }, { features: [null] }, { features: [{ properties: { countrycode: 'US' } }] }]) {
      expect(readPhotonAddress(value)).toBeNull();
    }
  });
});
