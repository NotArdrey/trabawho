-- Dedicated worker demo account for development and E2E runs.
-- Email: demo.worker@trabawho.test
-- Password: pass123

create extension if not exists pgcrypto with schema extensions;

with desired_user as (
  select
    '00000000-0000-4000-8000-000000000103'::uuid as target_id,
    'demo.worker@trabawho.test'::text as email,
    'Demo Worker'::text as full_name,
    'worker'::text as app_role,
    'Demo'::text as first_name,
    null::text as middle_name,
    'Worker'::text as last_name
),
resolved_user as (
  select
    coalesce(existing.id, desired_user.target_id) as id,
    desired_user.email,
    desired_user.full_name,
    desired_user.app_role,
    desired_user.first_name,
    desired_user.middle_name,
    desired_user.last_name
  from desired_user
  left join auth.users existing
    on lower(existing.email::text) = lower(desired_user.email)
),
upserted_user as (
  insert into auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    confirmation_token,
    recovery_token,
    email_change,
    email_change_token_new,
    email_change_token_current,
    email_change_confirm_status,
    phone_change,
    phone_change_token,
    reauthentication_token,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    is_super_admin,
    is_sso_user,
    is_anonymous
  )
  select
    '00000000-0000-0000-0000-000000000000'::uuid,
    id,
    'authenticated',
    'authenticated',
    email,
    extensions.crypt('pass123', extensions.gen_salt('bf')),
    now(),
    '',
    '',
    '',
    '',
    '',
    0,
    '',
    '',
    '',
    jsonb_build_object('provider', 'email', 'providers', array['email']),
    jsonb_build_object(
      'full_name', full_name,
      'first_name', first_name,
      'middle_name', middle_name,
      'last_name', last_name,
      'role', app_role,
      'email_verified', true
    ),
    now(),
    now(),
    false,
    false,
    false
  from resolved_user
  on conflict (id) do update set
    aud = excluded.aud,
    role = excluded.role,
    email = excluded.email,
    encrypted_password = excluded.encrypted_password,
    email_confirmed_at = excluded.email_confirmed_at,
    confirmation_token = excluded.confirmation_token,
    recovery_token = excluded.recovery_token,
    email_change = excluded.email_change,
    email_change_token_new = excluded.email_change_token_new,
    email_change_token_current = excluded.email_change_token_current,
    email_change_confirm_status = excluded.email_change_confirm_status,
    phone_change = excluded.phone_change,
    phone_change_token = excluded.phone_change_token,
    reauthentication_token = excluded.reauthentication_token,
    raw_app_meta_data = excluded.raw_app_meta_data,
    raw_user_meta_data = excluded.raw_user_meta_data,
    updated_at = now(),
    is_sso_user = false,
    is_anonymous = false
  returning id, email
),
identity_row as (
  select
    coalesce(existing_identity.id, '00000000-0000-4000-8000-000000000203'::uuid) as identity_id,
    resolved_user.id,
    resolved_user.email,
    resolved_user.full_name,
    resolved_user.app_role
  from resolved_user
  left join auth.identities existing_identity
    on existing_identity.provider = 'email'
   and existing_identity.provider_id = resolved_user.id::text
)
insert into auth.identities (
  id,
  provider_id,
  user_id,
  identity_data,
  provider,
  last_sign_in_at,
  created_at,
  updated_at
)
select
  identity_id,
  id::text,
  id,
  jsonb_build_object(
    'sub', id::text,
    'email', email,
    'email_verified', true,
    'full_name', full_name,
    'role', app_role
  ),
  'email',
  now(),
  now(),
  now()
from identity_row
on conflict (provider_id, provider) do update set
  user_id = excluded.user_id,
  identity_data = excluded.identity_data,
  updated_at = now();

do $$
declare
  has_profile_id boolean;
begin
  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'id'
  ) into has_profile_id;

  if has_profile_id then
    execute $profiles$
      with profile_row as (
        select
          users.id,
          users.email,
          'Demo Worker'::text as full_name,
          'worker'::text as app_role,
          'Demo'::text as first_name,
          null::text as middle_name,
          'Worker'::text as last_name
        from auth.users users
        where lower(users.email::text) = 'demo.worker@trabawho.test'
      )
      insert into public.profiles (
        id,
        user_id,
        email,
        first_name,
        middle_name,
        last_name,
        full_name,
        role,
        account_status,
        is_client,
        is_worker,
        province,
        city,
        barangay,
        address,
        created_at,
        updated_at
      )
      select
        id,
        id,
        email,
        first_name,
        middle_name,
        last_name,
        full_name,
        app_role,
        'active',
        true,
        true,
        'Bulacan',
        'Baliwag',
        'Sabang',
        'Demo Worker Address',
        now(),
        now()
      from profile_row
      on conflict (user_id) do update set
        email = excluded.email,
        first_name = excluded.first_name,
        middle_name = excluded.middle_name,
        last_name = excluded.last_name,
        full_name = excluded.full_name,
        role = excluded.role,
        account_status = 'active',
        is_client = true,
        is_worker = true,
        province = excluded.province,
        city = excluded.city,
        barangay = excluded.barangay,
        address = excluded.address,
        updated_at = now()
    $profiles$;
  else
    execute $profiles$
      with profile_row as (
        select
          users.id,
          users.email,
          'Demo Worker'::text as full_name,
          'worker'::text as app_role,
          'Demo'::text as first_name,
          null::text as middle_name,
          'Worker'::text as last_name
        from auth.users users
        where lower(users.email::text) = 'demo.worker@trabawho.test'
      )
      insert into public.profiles (
        user_id,
        email,
        first_name,
        middle_name,
        last_name,
        full_name,
        role,
        account_status,
        is_client,
        is_worker,
        province,
        city,
        barangay,
        address,
        created_at,
        updated_at
      )
      select
        id,
        email,
        first_name,
        middle_name,
        last_name,
        full_name,
        app_role,
        'active',
        true,
        true,
        'Bulacan',
        'Baliwag',
        'Sabang',
        'Demo Worker Address',
        now(),
        now()
      from profile_row
      on conflict (user_id) do update set
        email = excluded.email,
        first_name = excluded.first_name,
        middle_name = excluded.middle_name,
        last_name = excluded.last_name,
        full_name = excluded.full_name,
        role = excluded.role,
        account_status = 'active',
        is_client = true,
        is_worker = true,
        province = excluded.province,
        city = excluded.city,
        barangay = excluded.barangay,
        address = excluded.address,
        updated_at = now()
    $profiles$;
  end if;
end $$;

with worker_user as (
  select id
  from auth.users
  where lower(email::text) = 'demo.worker@trabawho.test'
)
insert into public.worker_profiles (
  user_id,
  service_type,
  bio,
  pricing_model,
  fixed_price,
  booking_mode,
  rate_basis,
  payment_advance,
  payment_after_service,
  after_service_payment_type,
  gcash_number,
  verification_status,
  created_at,
  updated_at
)
select
  id,
  'Demo Worker Service',
  'Prepared demo worker account for marketplace and My Work testing.',
  'fixed',
  500,
  'with-slots',
  'per-project',
  false,
  true,
  'both',
  '09054891105',
  'pending',
  now(),
  now()
from worker_user
on conflict (user_id) do update set
  service_type = excluded.service_type,
  bio = excluded.bio,
  pricing_model = excluded.pricing_model,
  fixed_price = excluded.fixed_price,
  booking_mode = excluded.booking_mode,
  rate_basis = excluded.rate_basis,
  payment_advance = excluded.payment_advance,
  payment_after_service = excluded.payment_after_service,
  after_service_payment_type = excluded.after_service_payment_type,
  gcash_number = excluded.gcash_number,
  verification_status = excluded.verification_status,
  updated_at = now();

with worker_user as (
  select id
  from auth.users
  where lower(email::text) = 'demo.worker@trabawho.test'
)
insert into public.sellers (
  user_id,
  display_name,
  headline,
  tagline,
  about,
  is_verified,
  verification_status,
  response_time_minutes,
  languages,
  default_currency,
  search_meta,
  created_at,
  updated_at
)
select
  id,
  'Demo Worker',
  'Demo Worker Service',
  'Bookable demo seller account',
  'Seller profile for the dedicated worker demo account.',
  false,
  'pending',
  1440,
  array['en']::text[],
  'PHP',
  jsonb_build_object(
    'name', 'Demo Worker',
    'service_type', 'Demo Worker Service',
    'booking_mode', 'with-slots',
    'location', jsonb_build_object(
      'barangay', 'Sabang',
      'city', 'Baliwag',
      'province', 'Bulacan'
    )
  ),
  now(),
  now()
from worker_user
on conflict (user_id) do update set
  display_name = excluded.display_name,
  headline = excluded.headline,
  tagline = excluded.tagline,
  about = excluded.about,
  is_verified = excluded.is_verified,
  verification_status = excluded.verification_status,
  response_time_minutes = excluded.response_time_minutes,
  languages = excluded.languages,
  default_currency = excluded.default_currency,
  search_meta = excluded.search_meta,
  updated_at = now();

with worker_user as (
  select id
  from auth.users
  where lower(email::text) = 'demo.worker@trabawho.test'
),
worker_service as (
  insert into public.services (
    seller_id,
    title,
    slug,
    description,
    short_description,
    price_type,
    base_price,
    currency,
    duration_minutes,
    active,
    metadata,
    created_at,
    updated_at
  )
  select
    id,
    'Demo Worker Service',
    'demo-worker-service',
    'Prepared service listing for the dedicated worker demo account.',
    'Bookable demo worker service.',
    'fixed',
    500,
    'PHP',
    60,
    true,
    jsonb_build_object(
      'pricing_model', 'fixed',
      'booking_mode', 'with-slots',
      'rate_basis', 'per-project',
      'seed_account', 'demo.worker@trabawho.test'
    ),
    now(),
    now()
  from worker_user
  on conflict (seller_id, slug) do update set
    title = excluded.title,
    description = excluded.description,
    short_description = excluded.short_description,
    price_type = excluded.price_type,
    base_price = excluded.base_price,
    currency = excluded.currency,
    duration_minutes = excluded.duration_minutes,
    active = true,
    metadata = excluded.metadata,
    updated_at = now()
  returning id, seller_id
),
cleared_seed_slots as (
  delete from public.service_slots slot
  using worker_service
  where slot.service_id = worker_service.id
    and slot.metadata ->> 'seed_account' = 'demo.worker@trabawho.test'
  returning slot.id
)
insert into public.service_slots (
  service_id,
  seller_id,
  start_ts,
  end_ts,
  capacity,
  status,
  note,
  metadata,
  created_at,
  updated_at
)
select
  worker_service.id,
  worker_service.seller_id,
  date_trunc('day', now()) + (slot_plan.day_offset * interval '1 day') + (slot_plan.start_hour * interval '1 hour'),
  date_trunc('day', now()) + (slot_plan.day_offset * interval '1 day') + (slot_plan.end_hour * interval '1 hour'),
  3,
  'available',
  slot_plan.note,
  jsonb_build_object('seed_account', 'demo.worker@trabawho.test'),
  now(),
  now()
from worker_service
cross join (
  values
    (2, 9, 10, 'Demo worker morning slot'),
    (3, 14, 15, 'Demo worker afternoon slot')
) as slot_plan(day_offset, start_hour, end_hour, note);
