import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;
const missingConfigMessage = 'Supabase is not configured. Add REACT_APP_SUPABASE_URL and REACT_APP_SUPABASE_ANON_KEY to .env.local, then restart npm run dev.';

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

const createMissingConfigError = () => new Error(missingConfigMessage);

const createMissingQuery = () => {
  const query = {
    select: () => query,
    insert: () => query,
    update: () => query,
    upsert: () => query,
    delete: () => query,
    eq: () => query,
    neq: () => query,
    in: () => query,
    is: () => query,
    order: () => query,
    limit: () => query,
    range: () => query,
    single: async () => ({ data: null, error: createMissingConfigError() }),
    maybeSingle: async () => ({ data: null, error: createMissingConfigError() }),
    then: (resolve, reject) => Promise
      .resolve({ data: null, error: createMissingConfigError() })
      .then(resolve, reject),
    catch: (reject) => Promise
      .resolve({ data: null, error: createMissingConfigError() })
      .catch(reject),
  };

  return query;
};

const createMissingSupabaseClient = () => ({
  auth: {
    getSession: async () => ({ data: { session: null }, error: null }),
    getUser: async () => ({ data: { user: null }, error: createMissingConfigError() }),
    signInWithPassword: async () => ({ data: null, error: createMissingConfigError() }),
    signUp: async () => ({ data: null, error: createMissingConfigError() }),
    signOut: async () => ({ error: null }),
    resend: async () => ({ error: createMissingConfigError() }),
    resetPasswordForEmail: async () => ({ error: createMissingConfigError() }),
    updateUser: async () => ({ data: null, error: createMissingConfigError() }),
    onAuthStateChange: () => ({
      data: {
        subscription: {
          unsubscribe: () => {},
        },
      },
    }),
  },
  channel: () => ({
    on() {
      return this;
    },
    subscribe() {
      return this;
    },
    unsubscribe: () => {},
  }),
  removeChannel: () => {},
  getChannels: () => [],
  from: () => createMissingQuery(),
  rpc: async () => ({ data: null, error: createMissingConfigError() }),
  functions: {
    invoke: async () => ({ data: null, error: createMissingConfigError() }),
  },
  storage: {
    from: () => ({
      upload: async () => ({ data: null, error: createMissingConfigError() }),
      getPublicUrl: () => ({ data: { publicUrl: '' } }),
    }),
  },
});

if (!isSupabaseConfigured) {
  console.warn(missingConfigMessage);
}

export const supabase = isSupabaseConfigured ? createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
  global: {
    headers: {
      'X-Client-Info': 'trabawho-app',
    },
  },
}) : createMissingSupabaseClient();
