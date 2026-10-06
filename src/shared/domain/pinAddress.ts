import type { LocationOption } from '@/shared/services/philippineLocations';

export interface PinAddressParts {
  provinces: string[];
  cities: string[];
  barangays: string[];
  address: string;
}

function locationKey(name: string) {
  return name.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
    .replace(/\([^)]*\)/g, '').replace(/\b(city of|municipality of|barangay|brgy\.?|city)\b/g, '')
    .replace(/[^a-z0-9]/g, '');
}

export function matchPinLocation(options: LocationOption[], names: string[]): LocationOption | undefined {
  for (const name of names) {
    const exact = options.filter(option => option.name.toLowerCase() === name.toLowerCase());
    if (exact.length === 1) return exact[0];
    const matches = options.filter(option => locationKey(option.name) === locationKey(name));
    if (matches.length === 1) return matches[0];
  }
}

export function readPhotonAddress(value: unknown): PinAddressParts | null {
  if (!value || typeof value !== 'object' || !('features' in value) || !Array.isArray(value.features)) return null;
  const feature: unknown = value.features[0];
  if (!feature || typeof feature !== 'object' || !('properties' in feature)
    || !feature.properties || typeof feature.properties !== 'object') return null;
  const properties = feature.properties;
  const text = (key: string) => {
    const value: unknown = properties[key as keyof typeof properties];
    return typeof value === 'string' ? value.trim().slice(0, 500) : '';
  };
  if (text('countrycode').toUpperCase() !== 'PH') return null;
  const provinces = [text('state'), text('county')].filter(Boolean);
  if (provinces.some(name => /metro(?:politan)? manila|national capital region|^ncr$/i.test(name))) provinces.unshift('Metro Manila');
  return {
    provinces, cities: [text('city'), text('town'), text('municipality')].filter(Boolean),
    barangays: [text('district'), text('suburb'), text('locality')].filter(Boolean),
    address: (text('street') ? [text('housenumber'), text('street')].filter(Boolean).join(' ') : text('name')).slice(0, 500),
  };
}
