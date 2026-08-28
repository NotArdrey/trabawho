const { createClient } = require('@supabase/supabase-js');
const { requireEnv } = require('./env');

const DEMO_CLIENT_EMAIL = 'demo.user@trabawho.test';
const DEMO_ADMIN_EMAIL = 'demo.admin@trabawho.test';
const DEMO_WORKER_EMAIL = 'demo.worker@trabawho.test';
const DEMO_PASSWORD = 'pass123';

function createTestSupabaseClient() {
  return createClient(
    requireEnv('REACT_APP_SUPABASE_URL'),
    requireEnv('REACT_APP_SUPABASE_ANON_KEY'),
    {
      auth: {
        autoRefreshToken: false,
        detectSessionInUrl: false,
        persistSession: false,
      },
    }
  );
}

async function mustRun(query, label) {
  const { data, error } = await query;
  if (error) {
    throw new Error(`${label}: ${error.message}`);
  }
  return data;
}

async function prepareWorkerDemoData({ bookingMode = 'with-slots' } = {}) {
  const supabase = createTestSupabaseClient();
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: DEMO_CLIENT_EMAIL,
    password: DEMO_PASSWORD,
  });

  if (authError) {
    throw new Error(`Unable to sign in demo client for setup: ${authError.message}`);
  }

  const userId = authData.user.id;
  const fullName = 'Demo User';
  const serviceType = bookingMode === 'calendar-only' ? 'Calendar E2E Service' : 'Slot E2E Service';

  await mustRun(
    supabase.from('service_slots').delete().eq('seller_id', userId),
    'clear demo service slots'
  );
  await mustRun(
    supabase.from('services').delete().eq('seller_id', userId),
    'clear demo services'
  );

  await mustRun(
    supabase
      .from('worker_profiles')
      .upsert({
        user_id: userId,
        service_type: serviceType,
        bio: 'Prepared by Playwright for Work MVC coverage.',
        pricing_model: 'fixed',
        fixed_price: 500,
        booking_mode: bookingMode,
        rate_basis: 'per-project',
        payment_advance: false,
        payment_after_service: true,
        after_service_payment_type: 'both',
        gcash_number: '09054891105',
      }, { onConflict: 'user_id' }),
    'upsert demo worker profile'
  );

  await mustRun(
    supabase
      .from('sellers')
      .upsert({
        user_id: userId,
        display_name: fullName,
        headline: serviceType,
        tagline: 'Playwright demo seller',
        about: 'Seller profile used by Work E2E tests.',
        is_verified: false,
        verification_status: 'pending',
        response_time_minutes: 1440,
        languages: ['en'],
        default_currency: 'PHP',
        search_meta: {
          name: fullName,
          service_type: serviceType,
          booking_mode: bookingMode,
          location: {
            barangay: 'Sabang',
            city: 'Baliwag',
            province: 'Bulacan',
          },
        },
      }, { onConflict: 'user_id' }),
    'upsert demo seller'
  );

  await supabase.auth.signOut();
  return { userId };
}

module.exports = {
  DEMO_ADMIN_EMAIL,
  DEMO_CLIENT_EMAIL,
  DEMO_WORKER_EMAIL,
  DEMO_PASSWORD,
  createTestSupabaseClient,
  prepareWorkerDemoData,
};
