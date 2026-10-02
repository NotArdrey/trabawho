import { useEffect, useState } from 'react';
import { fetchLocationOptions } from './location-service';
import type { LocationOption, RegistrationValues } from './types';

function useLocationOptions(path: string | null, retry: number) {
  const requestKey = `${retry}/${path ?? ''}`;
  const [result, setResult] = useState<{ requestKey: string; options: LocationOption[]; loading: boolean; error: string }>({ requestKey: '', options: [], loading: false, error: '' });
  useEffect(() => {
    if (!path) return;
    const controller = new AbortController();
    void fetchLocationOptions(path, controller.signal).then((options) => {
      if (!controller.signal.aborted) setResult({ requestKey, options, loading: false, error: '' });
    }).catch(() => {
      if (!controller.signal.aborted) setResult({ requestKey, options: [], loading: false, error: 'Could not load locations. Check your connection and try again.' });
    });
    return () => controller.abort();
  }, [path, requestKey]);
  if (!path) return { options: [], loading: false, error: '' };
  if (result.requestKey !== requestKey) return { options: [], loading: true, error: '' };
  return result;
}

export function useRegistrationLocations(values: RegistrationValues) {
  const [retry, setRetry] = useState(0);
  const provinces = useLocationOptions('provinces', retry);
  const provinceCode = provinces.options.find((option) => option.name === values.province)?.code ?? '';
  const cities = useLocationOptions(provinceCode ? `provinces/${provinceCode}/cities-municipalities` : null, retry);
  const cityCode = cities.options.find((option) => option.name === values.city)?.code ?? '';
  const barangays = useLocationOptions(cityCode ? `cities-municipalities/${cityCode}/barangays` : null, retry);
  return { provinces, cities, barangays, provinceCode, cityCode, retry: () => setRetry((count) => count + 1) };
}
