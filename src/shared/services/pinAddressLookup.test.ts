import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { emptyServiceAddress } from '@/shared/domain/serviceAddress';

const options: Record<string, { code: string; name: string }[]> = {
  '/api/provinces/': [{ code: 'bulacan', name: 'Bulacan' }],
  '/api/provinces/bulacan/cities-municipalities/': [{ code: 'guiguinto', name: 'Guiguinto' }, { code: 'malolos', name: 'City of Malolos' }],
  '/api/cities-municipalities/guiguinto/barangays/': [{ code: 'poblacion', name: 'Poblacion' }],
  '/api/cities-municipalities/malolos/barangays/': [{ code: 'bulihan', name: 'Bulihan' }],
};
const parts = { countrycode: 'PH', state: 'Bulacan', city: 'Guiguinto', district: 'Barangay Poblacion', street: 'Main Street', housenumber: '42' };
const pin = { latitude: 14.833, longitude: 120.883 };
const signal = () => new AbortController().signal;
function mockLookup(properties: Record<string, string>) {
  const fetchMock = vi.fn((input: URL | string) => {
    const url = new URL(input);
    return Promise.resolve({ ok: true, json: () => Promise.resolve(url.hostname === 'photon.komoot.io'
      ? { features: [{ properties }] } : options[url.pathname] || []) });
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}
beforeEach(() => vi.resetModules());
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

it('fills an empty form with canonical options, street address and exact selected coordinates, caching repeat lookups', async () => {
  const fetchMock = mockLookup(parts);
  const { lookupPinAddress } = await import('./pinAddressLookup');
  const result = await lookupPinAddress(pin, emptyServiceAddress, signal());
  expect(result.value).toEqual({ province: 'Bulacan', city: 'Guiguinto', barangay: 'Poblacion', address: '42 Main Street', pin });
  await lookupPinAddress(pin, emptyServiceAddress, signal());
  const queries = fetchMock.mock.calls.map(([url]) => new URL(url)).filter(url => url.hostname === 'photon.komoot.io');
  expect(queries).toHaveLength(1);
  expect(queries[0].searchParams.get('lat')).toBe(String(pin.latitude));
  expect(queries[0].searchParams.has('q')).toBe(false);
});

it('clears a previous barangay when the pin moves to a different city with incomplete map data', async () => {
  mockLookup({ ...parts, city: 'Malolos', district: 'Unknown neighbourhood' });
  const { lookupPinAddress } = await import('./pinAddressLookup');
  const result = await lookupPinAddress(pin, { province: 'Bulacan', city: 'Guiguinto', barangay: 'Poblacion', address: 'Old Street' }, signal());
  expect(result.value).toMatchObject({ city: 'City of Malolos', barangay: '', address: '42 Main Street', pin });
  expect(result.notice).toContain('barangay');
});

it('keeps manual details and the pin when the provider fails, but discards cancellation', async () => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Unavailable')));
  const { lookupPinAddress } = await import('./pinAddressLookup');
  const result = await lookupPinAddress(pin, emptyServiceAddress, signal());
  expect(result.value).toEqual({ ...emptyServiceAddress, pin });
  expect(result.notice).toContain('manually');
  const controller = new AbortController(); controller.abort();
  await expect(lookupPinAddress(pin, emptyServiceAddress, controller.signal)).rejects.toThrow('Cancelled');
});
