-- Additional aligned worker accounts for marketplace coverage.
-- Password for seeded auth users: pass123

create extension if not exists pgcrypto with schema extensions;

with desired_workers as (
  select *
  from (
    values
      ('00000000-0000-4000-8000-000000000104'::uuid, 'demo.worker.cleaning@trabawho.test'::text, 'Maria Teresa Cruz'::text, 'Maria Teresa'::text, null::text, 'Cruz'::text, 'Apartment Cleaning & Organization'::text, 'Apartment Cleaning & Organization'::text, 'Cleans small apartments, organizes rooms, wipes surfaces, and prepares units for guests or move-ins.'::text, 900::numeric, 'per-project'::text, 'with-slots'::text, '09271230001'::text, 'Bulacan'::text, 'Malolos'::text, 'Tikay'::text, 'Tikay, Malolos, Bulacan'::text, 31::int, 6::int),
      ('00000000-0000-4000-8000-000000000105'::uuid, 'demo.worker.appliance@trabawho.test'::text, 'Jose Miguel Ramos'::text, 'Jose Miguel'::text, null::text, 'Ramos'::text, 'Appliance Installation & Repair'::text, 'Appliance Installation & Repair'::text, 'Installs and troubleshoots small household appliances, fans, outlets, and basic kitchen equipment.'::text, 850::numeric, 'per-project'::text, 'with-slots'::text, '09271230002'::text, 'Bulacan'::text, 'Baliuag'::text, 'San Roque'::text, 'San Roque, Baliuag, Bulacan'::text, 36::int, 9::int),
      ('00000000-0000-4000-8000-000000000106'::uuid, 'demo.worker.laundry@trabawho.test'::text, 'Carla Bautista Garcia'::text, 'Carla'::text, 'Bautista'::text, 'Garcia'::text, 'Laundry Pickup & Folding'::text, 'Laundry Pickup & Folding'::text, 'Handles laundry pickup coordination, sorting, folding, and tidy delivery for busy households.'::text, 550::numeric, 'per-project'::text, 'with-slots'::text, '09271230003'::text, 'Bulacan'::text, 'Meycauayan'::text, 'Poblacion'::text, 'Poblacion, Meycauayan, Bulacan'::text, 28::int, 4::int),
      ('00000000-0000-4000-8000-000000000107'::uuid, 'demo.worker.garden@trabawho.test'::text, 'Ramon De Leon Torres'::text, 'Ramon'::text, 'De Leon'::text, 'Torres'::text, 'Garden Cleanup & Yard Work'::text, 'Garden Cleanup & Yard Work'::text, 'Clears leaves, trims small plants, hauls light garden waste, and tidies outdoor areas.'::text, 950::numeric, 'per-project'::text, 'with-slots'::text, '09271230004'::text, 'Bulacan'::text, 'Marilao'::text, 'Lias'::text, 'Lias, Marilao, Bulacan'::text, 42::int, 11::int),
      ('00000000-0000-4000-8000-000000000108'::uuid, 'demo.worker.events@trabawho.test'::text, 'Nina Mercado Flores'::text, 'Nina'::text, 'Mercado'::text, 'Flores'::text, 'Event Setup & Cleanup'::text, 'Event Setup & Cleanup'::text, 'Sets up tables, chairs, simple decor, and post-event cleanup for small home gatherings.'::text, 1100::numeric, 'per-project'::text, 'with-slots'::text, '09271230005'::text, 'Bulacan'::text, 'Plaridel'::text, 'Banga 1st'::text, 'Banga 1st, Plaridel, Bulacan'::text, 33::int, 7::int),
      ('00000000-0000-4000-8000-000000000109'::uuid, 'demo.worker.plumbing@trabawho.test'::text, 'Arnold Lim Castillo'::text, 'Arnold'::text, 'Lim'::text, 'Castillo'::text, 'Plumbing Leak Repair'::text, 'Plumbing Leak Repair'::text, 'Repairs minor sink leaks, replaces faucets, clears simple clogs, and checks basic pipe fittings.'::text, 800::numeric, 'per-project'::text, 'with-slots'::text, '09271230006'::text, 'Bulacan'::text, 'Guiguinto'::text, 'Tabang'::text, 'Tabang, Guiguinto, Bulacan'::text, 39::int, 10::int)
  ) as rows(
    target_id,
    email,
    full_name,
    first_name,
    middle_name,
    last_name,
    service_type,
    service_title,
    service_description,
    base_price,
    rate_basis,
    booking_mode,
    gcash_number,
    province,
    city,
    barangay,
    address,
    age,
    experience_years
  )
),
resolved_workers as (
  select
    coalesce(existing.id, desired_workers.target_id) as id,
    desired_workers.*
  from desired_workers
  left join auth.users existing
    on lower(existing.email::text) = lower(desired_workers.email)
)
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
    'role', 'worker',
    'email_verified', true,
    'profile_photo', public.default_profile_image_url(id),
    'avatar_url', public.default_profile_image_url(id)
  ),
  now(),
  now(),
  false,
  false,
  false
from resolved_workers
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
  is_anonymous = false;

with desired_workers as (
  select *
  from (
    values
      ('00000000-0000-4000-8000-000000000204'::uuid, 'demo.worker.cleaning@trabawho.test'::text, 'Maria Teresa Cruz'::text),
      ('00000000-0000-4000-8000-000000000205'::uuid, 'demo.worker.appliance@trabawho.test'::text, 'Jose Miguel Ramos'::text),
      ('00000000-0000-4000-8000-000000000206'::uuid, 'demo.worker.laundry@trabawho.test'::text, 'Carla Bautista Garcia'::text),
      ('00000000-0000-4000-8000-000000000207'::uuid, 'demo.worker.garden@trabawho.test'::text, 'Ramon De Leon Torres'::text),
      ('00000000-0000-4000-8000-000000000208'::uuid, 'demo.worker.events@trabawho.test'::text, 'Nina Mercado Flores'::text),
      ('00000000-0000-4000-8000-000000000209'::uuid, 'demo.worker.plumbing@trabawho.test'::text, 'Arnold Lim Castillo'::text)
  ) as rows(identity_id, email, full_name)
),
identity_rows as (
  select
    coalesce(existing_identity.id, desired_workers.identity_id) as identity_id,
    users.id,
    users.email,
    desired_workers.full_name
  from desired_workers
  join auth.users users
    on lower(users.email::text) = lower(desired_workers.email)
  left join auth.identities existing_identity
    on existing_identity.provider = 'email'
   and existing_identity.provider_id = users.id::text
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
    'role', 'worker'
  ),
  'email',
  now(),
  now(),
  now()
from identity_rows
on conflict (provider_id, provider) do update set
  user_id = excluded.user_id,
  identity_data = excluded.identity_data,
  updated_at = now();

with desired_workers as (
  select *
  from (
    values
      ('demo.worker.cleaning@trabawho.test'::text, 'Maria Teresa Cruz'::text, 'Maria Teresa'::text, null::text, 'Cruz'::text, 'Apartment Cleaning & Organization'::text, 'Cleans small apartments, organizes rooms, wipes surfaces, and prepares units for guests or move-ins.'::text, 'Bulacan'::text, 'Malolos'::text, 'Tikay'::text, 'Tikay, Malolos, Bulacan'::text),
      ('demo.worker.appliance@trabawho.test'::text, 'Jose Miguel Ramos'::text, 'Jose Miguel'::text, null::text, 'Ramos'::text, 'Appliance Installation & Repair'::text, 'Installs and troubleshoots small household appliances, fans, outlets, and basic kitchen equipment.'::text, 'Bulacan'::text, 'Baliuag'::text, 'San Roque'::text, 'San Roque, Baliuag, Bulacan'::text),
      ('demo.worker.laundry@trabawho.test'::text, 'Carla Bautista Garcia'::text, 'Carla'::text, 'Bautista'::text, 'Garcia'::text, 'Laundry Pickup & Folding'::text, 'Handles laundry pickup coordination, sorting, folding, and tidy delivery for busy households.'::text, 'Bulacan'::text, 'Meycauayan'::text, 'Poblacion'::text, 'Poblacion, Meycauayan, Bulacan'::text),
      ('demo.worker.garden@trabawho.test'::text, 'Ramon De Leon Torres'::text, 'Ramon'::text, 'De Leon'::text, 'Torres'::text, 'Garden Cleanup & Yard Work'::text, 'Clears leaves, trims small plants, hauls light garden waste, and tidies outdoor areas.'::text, 'Bulacan'::text, 'Marilao'::text, 'Lias'::text, 'Lias, Marilao, Bulacan'::text),
      ('demo.worker.events@trabawho.test'::text, 'Nina Mercado Flores'::text, 'Nina'::text, 'Mercado'::text, 'Flores'::text, 'Event Setup & Cleanup'::text, 'Sets up tables, chairs, simple decor, and post-event cleanup for small home gatherings.'::text, 'Bulacan'::text, 'Plaridel'::text, 'Banga 1st'::text, 'Banga 1st, Plaridel, Bulacan'::text),
      ('demo.worker.plumbing@trabawho.test'::text, 'Arnold Lim Castillo'::text, 'Arnold'::text, 'Lim'::text, 'Castillo'::text, 'Plumbing Leak Repair'::text, 'Repairs minor sink leaks, replaces faucets, clears simple clogs, and checks basic pipe fittings.'::text, 'Bulacan'::text, 'Guiguinto'::text, 'Tabang'::text, 'Tabang, Guiguinto, Bulacan'::text)
  ) as rows(email, full_name, first_name, middle_name, last_name, service_type, service_description, province, city, barangay, address)
),
profile_rows as (
  select
    users.id,
    users.email,
    desired_workers.full_name,
    desired_workers.first_name,
    desired_workers.middle_name,
    desired_workers.last_name,
    desired_workers.service_type,
    desired_workers.service_description,
    desired_workers.province,
    desired_workers.city,
    desired_workers.barangay,
    desired_workers.address
  from desired_workers
  join auth.users users
    on lower(users.email::text) = lower(desired_workers.email)
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
  profile_photo,
  bio,
  province,
  city,
  barangay,
  address,
  identity_required,
  identity_role,
  is_verified,
  verification_status,
  id_verified_at,
  created_at,
  updated_at
)
select
  id,
  lower(email),
  first_name,
  middle_name,
  last_name,
  full_name,
  'worker',
  'active',
  true,
  true,
  public.default_profile_image_url(id),
  service_description,
  province,
  city,
  barangay,
  address,
  false,
  null,
  true,
  'APPROVED',
  now(),
  now(),
  now()
from profile_rows
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
  profile_photo = excluded.profile_photo,
  bio = excluded.bio,
  province = excluded.province,
  city = excluded.city,
  barangay = excluded.barangay,
  address = excluded.address,
  identity_required = excluded.identity_required,
  identity_role = excluded.identity_role,
  is_verified = excluded.is_verified,
  verification_status = excluded.verification_status,
  id_verified_at = coalesce(public.profiles.id_verified_at, excluded.id_verified_at),
  updated_at = now();

with worker_service_map as (
  select users.id as user_id, seed.*
  from (
    values
      ('demo.worker.cleaning@trabawho.test'::text, 'Apartment Cleaning & Organization'::text, 'Cleans small apartments, organizes rooms, wipes surfaces, and prepares units for guests or move-ins.'::text, 900::numeric, 'per-project'::text, 'with-slots'::text, '09271230001'::text, 31::int, 6::int),
      ('demo.worker.appliance@trabawho.test'::text, 'Appliance Installation & Repair'::text, 'Installs and troubleshoots small household appliances, fans, outlets, and basic kitchen equipment.'::text, 850::numeric, 'per-project'::text, 'with-slots'::text, '09271230002'::text, 36::int, 9::int),
      ('demo.worker.laundry@trabawho.test'::text, 'Laundry Pickup & Folding'::text, 'Handles laundry pickup coordination, sorting, folding, and tidy delivery for busy households.'::text, 550::numeric, 'per-project'::text, 'with-slots'::text, '09271230003'::text, 28::int, 4::int),
      ('demo.worker.garden@trabawho.test'::text, 'Garden Cleanup & Yard Work'::text, 'Clears leaves, trims small plants, hauls light garden waste, and tidies outdoor areas.'::text, 950::numeric, 'per-project'::text, 'with-slots'::text, '09271230004'::text, 42::int, 11::int),
      ('demo.worker.events@trabawho.test'::text, 'Event Setup & Cleanup'::text, 'Sets up tables, chairs, simple decor, and post-event cleanup for small home gatherings.'::text, 1100::numeric, 'per-project'::text, 'with-slots'::text, '09271230005'::text, 33::int, 7::int),
      ('demo.worker.plumbing@trabawho.test'::text, 'Plumbing Leak Repair'::text, 'Repairs minor sink leaks, replaces faucets, clears simple clogs, and checks basic pipe fittings.'::text, 800::numeric, 'per-project'::text, 'with-slots'::text, '09271230006'::text, 39::int, 10::int)
  ) as seed(email, service_type, service_description, base_price, rate_basis, booking_mode, gcash_number, age, experience_years)
  join auth.users users on lower(users.email::text) = lower(seed.email)
)
insert into public.worker_profiles (
  user_id,
  service_type,
  custom_service_type,
  bio,
  pricing_model,
  fixed_price,
  project_rate,
  booking_mode,
  rate_basis,
  payment_advance,
  payment_after_service,
  after_service_payment_type,
  gcash_number,
  verification_status,
  age,
  experience_years,
  created_at,
  updated_at
)
select
  user_id,
  service_type,
  null,
  service_description,
  'fixed',
  base_price,
  base_price,
  booking_mode,
  rate_basis,
  false,
  true,
  'both',
  gcash_number,
  'approved',
  age,
  experience_years,
  now(),
  now()
from worker_service_map
on conflict (user_id) do update set
  service_type = excluded.service_type,
  custom_service_type = excluded.custom_service_type,
  bio = excluded.bio,
  pricing_model = excluded.pricing_model,
  fixed_price = excluded.fixed_price,
  project_rate = excluded.project_rate,
  booking_mode = excluded.booking_mode,
  rate_basis = excluded.rate_basis,
  payment_advance = excluded.payment_advance,
  payment_after_service = excluded.payment_after_service,
  after_service_payment_type = excluded.after_service_payment_type,
  gcash_number = excluded.gcash_number,
  verification_status = excluded.verification_status,
  age = excluded.age,
  experience_years = excluded.experience_years,
  updated_at = now();

with worker_service_map as (
  select users.id as user_id, seed.*
  from (
    values
      ('demo.worker.cleaning@trabawho.test'::text, 'Maria Teresa Cruz'::text, 'Apartment Cleaning & Organization'::text, 'Cleans small apartments, organizes rooms, wipes surfaces, and prepares units for guests or move-ins.'::text, 'with-slots'::text, 'Bulacan'::text, 'Malolos'::text, 'Tikay'::text),
      ('demo.worker.appliance@trabawho.test'::text, 'Jose Miguel Ramos'::text, 'Appliance Installation & Repair'::text, 'Installs and troubleshoots small household appliances, fans, outlets, and basic kitchen equipment.'::text, 'with-slots'::text, 'Bulacan'::text, 'Baliuag'::text, 'San Roque'::text),
      ('demo.worker.laundry@trabawho.test'::text, 'Carla Bautista Garcia'::text, 'Laundry Pickup & Folding'::text, 'Handles laundry pickup coordination, sorting, folding, and tidy delivery for busy households.'::text, 'with-slots'::text, 'Bulacan'::text, 'Meycauayan'::text, 'Poblacion'::text),
      ('demo.worker.garden@trabawho.test'::text, 'Ramon De Leon Torres'::text, 'Garden Cleanup & Yard Work'::text, 'Clears leaves, trims small plants, hauls light garden waste, and tidies outdoor areas.'::text, 'with-slots'::text, 'Bulacan'::text, 'Marilao'::text, 'Lias'::text),
      ('demo.worker.events@trabawho.test'::text, 'Nina Mercado Flores'::text, 'Event Setup & Cleanup'::text, 'Sets up tables, chairs, simple decor, and post-event cleanup for small home gatherings.'::text, 'with-slots'::text, 'Bulacan'::text, 'Plaridel'::text, 'Banga 1st'::text),
      ('demo.worker.plumbing@trabawho.test'::text, 'Arnold Lim Castillo'::text, 'Plumbing Leak Repair'::text, 'Repairs minor sink leaks, replaces faucets, clears simple clogs, and checks basic pipe fittings.'::text, 'with-slots'::text, 'Bulacan'::text, 'Guiguinto'::text, 'Tabang'::text)
  ) as seed(email, full_name, service_type, service_description, booking_mode, province, city, barangay)
  join auth.users users on lower(users.email::text) = lower(seed.email)
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
  profile_photo,
  avatar_url,
  created_at,
  updated_at
)
select
  user_id,
  full_name,
  service_type,
  service_description,
  service_description,
  true,
  'approved',
  120,
  array['en', 'fil']::text[],
  'PHP',
  jsonb_build_object(
    'name', full_name,
    'service_type', service_type,
    'bio', service_description,
    'booking_mode', booking_mode,
    'location', jsonb_build_object(
      'barangay', barangay,
      'city', city,
      'province', province
    )
  ),
  public.default_profile_image_url(user_id),
  public.default_profile_image_url(user_id),
  now(),
  now()
from worker_service_map
on conflict (user_id) do update set
  display_name = excluded.display_name,
  headline = excluded.headline,
  tagline = excluded.tagline,
  about = excluded.about,
  is_verified = true,
  verification_status = 'approved',
  response_time_minutes = excluded.response_time_minutes,
  languages = excluded.languages,
  default_currency = excluded.default_currency,
  search_meta = excluded.search_meta,
  profile_photo = excluded.profile_photo,
  avatar_url = excluded.avatar_url,
  updated_at = now();

with worker_service_map as (
  select users.id as user_id, seed.*
  from (
    values
      ('demo.worker.cleaning@trabawho.test'::text, 'Apartment Cleaning & Organization'::text, 'Cleans small apartments, organizes rooms, wipes surfaces, and prepares units for guests or move-ins.'::text, 900::numeric, 'per-project'::text, 'with-slots'::text),
      ('demo.worker.appliance@trabawho.test'::text, 'Appliance Installation & Repair'::text, 'Installs and troubleshoots small household appliances, fans, outlets, and basic kitchen equipment.'::text, 850::numeric, 'per-project'::text, 'with-slots'::text),
      ('demo.worker.laundry@trabawho.test'::text, 'Laundry Pickup & Folding'::text, 'Handles laundry pickup coordination, sorting, folding, and tidy delivery for busy households.'::text, 550::numeric, 'per-project'::text, 'with-slots'::text),
      ('demo.worker.garden@trabawho.test'::text, 'Garden Cleanup & Yard Work'::text, 'Clears leaves, trims small plants, hauls light garden waste, and tidies outdoor areas.'::text, 950::numeric, 'per-project'::text, 'with-slots'::text),
      ('demo.worker.events@trabawho.test'::text, 'Event Setup & Cleanup'::text, 'Sets up tables, chairs, simple decor, and post-event cleanup for small home gatherings.'::text, 1100::numeric, 'per-project'::text, 'with-slots'::text),
      ('demo.worker.plumbing@trabawho.test'::text, 'Plumbing Leak Repair'::text, 'Repairs minor sink leaks, replaces faucets, clears simple clogs, and checks basic pipe fittings.'::text, 800::numeric, 'per-project'::text, 'with-slots'::text)
  ) as seed(email, service_title, service_description, base_price, rate_basis, booking_mode)
  join auth.users users on lower(users.email::text) = lower(seed.email)
),
upserted_services as (
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
    rate_basis,
    metadata,
    created_at,
    updated_at
  )
  select
    user_id,
    service_title,
    lower(regexp_replace(service_title || '-' || user_id::text, '[^a-z0-9]+', '-', 'g')),
    service_description,
    service_description,
    'fixed',
    base_price,
    'PHP',
    null,
    true,
    rate_basis,
    jsonb_build_object(
      'available', true,
      'pricing_model', 'fixed',
      'rate_basis', rate_basis,
      'booking_mode', booking_mode,
      'service_type', service_title,
      'seed_batch', 'more-worker-users-20260514'
    ),
    now(),
    now()
  from worker_service_map
  on conflict (seller_id, slug) do update set
    title = excluded.title,
    description = excluded.description,
    short_description = excluded.short_description,
    price_type = excluded.price_type,
    base_price = excluded.base_price,
    currency = excluded.currency,
    duration_minutes = excluded.duration_minutes,
    active = true,
    rate_basis = excluded.rate_basis,
    metadata = excluded.metadata,
    updated_at = now()
  returning id, seller_id
),
cleared_seed_slots as (
  delete from public.service_slots slot
  using upserted_services
  where slot.service_id = upserted_services.id
    and slot.metadata ->> 'seed_batch' = 'more-worker-users-20260514'
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
  upserted_services.id,
  upserted_services.seller_id,
  date_trunc('day', now()) + (slot_plan.day_offset * interval '1 day') + (slot_plan.start_hour * interval '1 hour'),
  date_trunc('day', now()) + (slot_plan.day_offset * interval '1 day') + (slot_plan.end_hour * interval '1 hour'),
  3,
  'available',
  slot_plan.note,
  jsonb_build_object('seed_batch', 'more-worker-users-20260514'),
  now(),
  now()
from upserted_services
cross join (
  values
    (2, 9, 10, 'Seeded morning slot'),
    (4, 13, 14, 'Seeded afternoon slot'),
    (6, 16, 17, 'Seeded late-day slot')
) as slot_plan(day_offset, start_hour, end_hour, note);

with new_workers as (
  select users.id as seller_id, row_number() over (order by users.email) as seller_idx
  from auth.users users
  where lower(users.email::text) in (
    'demo.worker.cleaning@trabawho.test',
    'demo.worker.appliance@trabawho.test',
    'demo.worker.laundry@trabawho.test',
    'demo.worker.garden@trabawho.test',
    'demo.worker.events@trabawho.test',
    'demo.worker.plumbing@trabawho.test'
  )
),
deleted_seed_reviews as (
  delete from public.reviews review
  using new_workers
  where review.seller_id = new_workers.seller_id
    and review.body like 'Seeded marketplace review:%'
  returning review.id
),
reviewers as (
  select
    p.user_id,
    row_number() over (order by p.created_at, p.user_id) as reviewer_idx,
    count(*) over () as reviewer_count
  from public.profiles p
  where p.role <> 'worker'
    and coalesce(p.is_worker, false) = false
),
review_slots as (
  select
    new_workers.seller_id,
    reviewer.user_id as reviewer_id,
    slot.n,
    new_workers.seller_idx
  from new_workers
  cross join generate_series(1, 3) as slot(n)
  join reviewers reviewer
    on reviewer.reviewer_idx = (((new_workers.seller_idx + slot.n - 2)::int % greatest(1, reviewer.reviewer_count)) + 1)
)
insert into public.reviews (
  seller_id,
  reviewer_id,
  booking_id,
  rating,
  title,
  body,
  helpful_count,
  published,
  created_at,
  updated_at
)
select
  seller_id,
  reviewer_id,
  null,
  case when n = 3 then 4 else 5 end,
  case n
    when 1 then 'Reliable local worker'
    when 2 then 'Clear and professional'
    else 'Helpful service support'
  end,
  case n
    when 1 then 'Seeded marketplace review: arrived on time and handled the work carefully.'
    when 2 then 'Seeded marketplace review: communicated clearly and kept the service area tidy.'
    else 'Seeded marketplace review: practical, polite, and easy to book for household tasks.'
  end,
  n - 1,
  true,
  now() - ((seller_idx * 3 + n)::int * interval '1 day'),
  now() - ((seller_idx * 3 + n)::int * interval '1 day')
from review_slots;

insert into public.seller_rating_aggregates (
  seller_id,
  avg_rating,
  rating_count,
  updated_at
)
select
  seller.user_id,
  coalesce(avg(review.rating), 0)::numeric(3, 2),
  count(review.id)::int,
  now()
from public.sellers seller
left join public.reviews review
  on review.seller_id = seller.user_id
 and review.published is not false
group by seller.user_id
on conflict (seller_id) do update set
  avg_rating = excluded.avg_rating,
  rating_count = excluded.rating_count,
  updated_at = excluded.updated_at;
