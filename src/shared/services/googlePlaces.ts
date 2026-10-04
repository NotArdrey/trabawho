let libraryPromise: Promise<google.maps.PlacesLibrary> | undefined;

declare global {
  interface Window { trabawhoMapsReady?: () => void }
}

function loadPlaces(): Promise<google.maps.PlacesLibrary> {
  const key = import.meta.env.VITE_GOOGLE_MAPS_API_KEY?.trim();
  if (!key) return Promise.reject(new Error('Address suggestions are unavailable.'));
  libraryPromise ??= (async () => {
    if (typeof google === 'undefined' || !google.maps?.importLibrary) {
      await new Promise<void>((resolve, reject) => {
        const script = document.createElement('script');
        const timeout = window.setTimeout(fail, 15000);
        function fail() {
          window.clearTimeout(timeout);
          delete window.trabawhoMapsReady;
          script.remove();
          reject(new Error('Address suggestions are unavailable.'));
        }
        window.trabawhoMapsReady = () => {
          window.clearTimeout(timeout);
          delete window.trabawhoMapsReady;
          resolve();
        };
        const params = new URLSearchParams({ key, loading: 'async', v: 'weekly', callback: 'trabawhoMapsReady' });
        script.src = `https://maps.googleapis.com/maps/api/js?${params.toString()}`;
        script.async = true;
        script.onerror = fail;
        document.head.append(script);
      });
    }
    return await google.maps.importLibrary('places');
  })().catch((error: unknown) => { libraryPromise = undefined; throw error; });
  return libraryPromise;
}

export interface AddressSuggestion {
  id: string;
  label: string;
  resolve: () => Promise<string>;
}

export async function createAddressSearch() {
  const { AutocompleteSessionToken, AutocompleteSuggestion } = await loadPlaces();
  let sessionToken = new AutocompleteSessionToken();
  return async (input: string): Promise<AddressSuggestion[]> => {
    const { suggestions } = await AutocompleteSuggestion.fetchAutocompleteSuggestions({
      input, sessionToken, includedRegionCodes: ['ph'], language: 'en', region: 'ph',
    });
    return suggestions.flatMap(({ placePrediction }) => placePrediction ? [{
      id: placePrediction.placeId,
      label: placePrediction.text.toString(),
      resolve: async () => {
        const place = placePrediction.toPlace();
        await place.fetchFields({ fields: ['formattedAddress'] });
        sessionToken = new AutocompleteSessionToken();
        return place.formattedAddress || placePrediction.text.toString();
      },
    }] : []);
  };
}
