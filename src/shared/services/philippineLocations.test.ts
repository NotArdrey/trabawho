import { afterEach, expect, it, vi } from 'vitest';
import { fetchLocationOptions } from './philippineLocations';

afterEach(() => { vi.unstubAllGlobals(); });

it('sorts the province list and includes Metro Manila', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve([
    { code: '2', name: 'Bulacan' }, { code: '1', name: 'Abra' },
  ]) }));
  expect(await fetchLocationOptions('/provinces/', new AbortController().signal)).toEqual([
    { code: '1', name: 'Abra' }, { code: '2', name: 'Bulacan' }, { code: '130000000', name: 'Metro Manila' },
  ]);
});

it('rejects malformed remote options rather than displaying invalid locations', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve([{ code: 2, name: 'Bulacan' }]) }));
  await expect(fetchLocationOptions('/provinces/', new AbortController().signal)).rejects.toThrow('could not be loaded');
});
