import { useEffect, useState } from 'react';
import { fetchLocationOptions, type LocationOption } from '@/shared/services/philippineLocations';

interface LocationState {
  path: string;
  options: LocationOption[];
  error: boolean;
}

export function useLocationOptions(path: string, retry: number) {
  const requestKey = `${retry}:${path}`;
  const [state, setState] = useState<LocationState>({ path: '', options: [], error: false });
  useEffect(() => {
    if (!path) return;
    const controller = new AbortController();
    void fetchLocationOptions(path, controller.signal).then(
      (options) => { if (!controller.signal.aborted) setState({ path: requestKey, options, error: false }); },
      () => { if (!controller.signal.aborted) setState({ path: requestKey, options: [], error: true }); },
    );
    return () => controller.abort();
  }, [path, requestKey]);
  return {
    options: path && state.path === requestKey ? state.options : [],
    loading: Boolean(path && state.path !== requestKey),
    error: Boolean(path && state.path === requestKey && state.error),
  };
}
