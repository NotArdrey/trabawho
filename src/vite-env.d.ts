/// <reference types="vite/client" />
/// <reference types="google.maps" />

interface ImportMetaEnv {
  readonly VITE_GOOGLE_MAPS_API_KEY?: string;
  readonly VITE_MAP_TILE_URL?: string;
  readonly VITE_REVERSE_GEOCODING_URL?: string;
  readonly VITE_AD_BOOST_DAILY_RATE_PHP?: string;
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  readonly REACT_APP_SUPABASE_URL?: string;
  readonly REACT_APP_SUPABASE_ANON_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
