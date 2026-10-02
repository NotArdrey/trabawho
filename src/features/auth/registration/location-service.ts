import type { LocationOption } from './types';

export async function fetchLocationOptions(path: string, signal: AbortSignal): Promise<LocationOption[]> {
  const response = await fetch(`https://psgc.gitlab.io/api/${path}/`, { signal });
  if (!response.ok) throw new Error('Location lookup failed.');
  const data: unknown = await response.json();
  if (!Array.isArray(data)) throw new Error('Unexpected location response.');
  return data.flatMap((item: unknown) => {
    if (!item || typeof item !== 'object' || !('code' in item) || !('name' in item)) return [];
    return typeof item.code === 'string' && typeof item.name === 'string' ? [{ code: item.code, name: item.name }] : [];
  }).sort((a, b) => a.name.localeCompare(b.name));
}
