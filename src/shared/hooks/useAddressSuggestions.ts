import { useEffect, useRef, useState } from 'react';
import { createAddressSearch, type AddressSuggestion } from '@/shared/services/googlePlaces';

interface SearchState {
  query: string;
  options: AddressSuggestion[];
  error: boolean;
}

export function useAddressSuggestions(query: string, enabled: boolean) {
  const search = useRef<ReturnType<typeof createAddressSearch> | undefined>(undefined);
  const [state, setState] = useState<SearchState>({ query: '', options: [], error: false });
  useEffect(() => {
    if (!enabled || !query) return;
    let active = true;
    const timeout = window.setTimeout(() => {
      search.current ??= createAddressSearch();
      void search.current.then((fetchSuggestions) => fetchSuggestions(query)).then(
        (options) => { if (active) setState({ query, options, error: false }); },
        () => {
          search.current = undefined;
          if (active) setState({ query, options: [], error: true });
        },
      );
    }, 300);
    return () => { active = false; window.clearTimeout(timeout); };
  }, [query, enabled]);
  return {
    options: enabled && state.query === query ? state.options : [],
    loading: Boolean(enabled && query && state.query !== query),
    error: Boolean(enabled && query && state.query === query && state.error),
  };
}
