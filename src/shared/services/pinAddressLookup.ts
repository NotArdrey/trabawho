import { matchPinLocation, readPhotonAddress, type PinAddressParts } from '@/shared/domain/pinAddress';
import { servicePinValid, type ServiceAddress, type ServicePin } from '@/shared/domain/serviceAddress';
import { fetchLocationOptions, metroManilaCode } from './philippineLocations';

export interface PinAddressResult { value: ServiceAddress; notice: string }
const cache = new Map<string, PinAddressParts>();

async function reversePin(pin: ServicePin, signal: AbortSignal): Promise<PinAddressParts | null> {
  const endpoint = import.meta.env.VITE_REVERSE_GEOCODING_URL?.trim() || 'https://photon.komoot.io/reverse';
  const key = `${endpoint}:${pin.latitude.toFixed(6)},${pin.longitude.toFixed(6)}`;
  const existing = cache.get(key);
  if (existing) return existing;
  const url = new URL(endpoint);
  url.search = new URLSearchParams({ lat: String(pin.latitude), lon: String(pin.longitude), lang: 'en', limit: '1', radius: '0.2' }).toString();
  const response = await fetch(url, { signal: AbortSignal.any([signal, AbortSignal.timeout(10000)]) });
  if (!response.ok) throw new Error('Address lookup unavailable.');
  const result = readPhotonAddress(await response.json());
  if (result) {
    const oldest = cache.keys().next().value;
    if (cache.size >= 30 && oldest) cache.delete(oldest);
    cache.set(key, result);
  }
  return result;
}

export async function lookupPinAddress(pin: ServicePin, previous: ServiceAddress, signal: AbortSignal): Promise<PinAddressResult> {
  if (!servicePinValid(pin)) throw new Error('Choose a valid service pin.');
  const fallback = { value: { ...previous, pin }, notice: 'Pin saved. Address lookup was unavailable; check or enter your address manually.' };
  const requestSignal = AbortSignal.any([signal, AbortSignal.timeout(12000)]);
  try {
    const parts = await reversePin(pin, requestSignal);
    if (!parts) return { ...fallback, notice: 'Pin saved. No Philippine address was found here; check or enter your address manually.' };
    const province = matchPinLocation(await fetchLocationOptions('/provinces/', requestSignal), parts.provinces);
    if (!province) return { ...fallback, notice: 'Pin saved. The area could not be matched; check or enter your address manually.' };
    const cities = await fetchLocationOptions(`/${province.code === metroManilaCode ? 'regions' : 'provinces'}/${province.code}/cities-municipalities/`, requestSignal);
    const city = matchPinLocation(cities, parts.cities);
    const sameProvince = province.name === previous.province;
    const sameCity = sameProvince && city?.name === previous.city;
    const barangay = city ? matchPinLocation(await fetchLocationOptions(`/cities-municipalities/${city.code}/barangays/`, requestSignal), parts.barangays) : undefined;
    const value: ServiceAddress = { province: province.name, city: city?.name || (sameProvince ? previous.city : ''),
      barangay: barangay?.name || (sameCity ? previous.barangay : ''), address: parts.address || (sameCity ? previous.address : ''), pin };
    const missing = [!city && 'city/municipality', !barangay && 'barangay', !parts.address && 'street address'].filter(Boolean);
    return { value, notice: missing.length ? `Pin saved and available address details filled. Check ${missing.join(', ')} and add your house or unit number.`
      : 'Address filled from your pin. Check the details and add your house or unit number if needed.' };
  } catch {
    if (signal.aborted) throw new DOMException('Cancelled', 'AbortError');
    return fallback;
  }
}
