export interface LocationOption {
  code: string;
  name: string;
}

export const metroManilaCode = '130000000';

export async function fetchLocationOptions(path: string, signal: AbortSignal): Promise<LocationOption[]> {
  const response = await fetch(`https://psgc.gitlab.io/api${path}`, {
    signal: AbortSignal.any([signal, AbortSignal.timeout(15000)]),
  });
  if (!response.ok) throw new Error('Location options could not be loaded.');
  const rows: unknown = await response.json();
  if (!Array.isArray(rows) || !rows.every((row: unknown): row is LocationOption =>
    typeof row === 'object' && row !== null && 'code' in row && typeof row.code === 'string'
    && 'name' in row && typeof row.name === 'string')) {
    throw new Error('Location options could not be loaded.');
  }
  const options = path === '/provinces/'
    ? [...rows, { code: metroManilaCode, name: 'Metro Manila' }]
    : rows;
  return options.sort((a, b) => a.name.localeCompare(b.name));
}
