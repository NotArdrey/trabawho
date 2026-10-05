-- Isolated PostgreSQL fixture for account/identity migrations; never deploy.
create schema auth;
create role anon;
create role authenticated;
create role service_role;
create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('test.uid',true),'')::uuid $$;
create function auth.role() returns text language sql as $$ select current_setting('test.role',true) $$;
create function public.is_current_user_admin() returns boolean language sql as $$ select auth.role()='service_role' $$;
create table auth.users (
  id uuid primary key, email text unique, email_confirmed_at timestamptz,
  raw_app_meta_data jsonb default '{}', raw_user_meta_data jsonb default '{}',
  confirmation_token text default '', email_change text default '', email_change_token_new text default '',
  updated_at timestamptz default now()
);
create table auth.identities (user_id uuid, identity_data jsonb default '{}', updated_at timestamptz);
create table public.profiles (
  user_id uuid primary key references auth.users(id), email text, full_name text default '',
  first_name text, middle_name text, last_name text, role text default 'client',
  is_client boolean default true, is_worker boolean default false, identity_role text,
  identity_required boolean default true, verification_status text default 'UNVERIFIED',
  is_verified boolean default false, account_status text default 'active', id_document_expiry date,
  disabled_reason text, suspended_reason text, suspended_until timestamptz, disabled_at timestamptz, suspended_at timestamptz,
  id_verified_at timestamptz, identity_reviewed_at timestamptz, didit_session_id text,
  province text, city text, barangay text, address text, updated_at timestamptz default now()
);
create table public.worker_profiles (
  user_id uuid primary key references auth.users(id), service_type text, bio text,
  pricing_model text, fixed_price numeric, booking_mode text, rate_basis text,
  payment_advance boolean, payment_after_service boolean, after_service_payment_type text,
  gcash_number text, qr_file_name text, updated_at timestamptz default now()
);
create table public.sellers (
  user_id uuid primary key references auth.users(id), display_name text, headline text,
  about text, tagline text, search_meta jsonb, updated_at timestamptz default now()
);
create table public.services (
  id bigint generated always as identity primary key, seller_id uuid, title text, slug text,
  description text, short_description text, price_type text, base_price numeric,
  metadata jsonb, active boolean default true, updated_at timestamptz default now()
);
create table public.bookings (
  id uuid primary key default gen_random_uuid(), buyer_id uuid, seller_id uuid,
  metadata jsonb default '{}', service_id bigint
);
create table public.conversations (id uuid primary key default gen_random_uuid(), buyer_id uuid, seller_id uuid);
-- Payment-provider internals are outside these role/identity contracts.
create function public.start_booking_checkout(p_booking_id uuid default null,p_service_id bigint default null,
  p_slot_id bigint default null,p_quote_version integer default null,p_payment_plan text default 'downpayment',p_operation_id text default null)
returns jsonb language sql as $$ select jsonb_build_object('booking',jsonb_build_object('id',p_booking_id),'allowed',true) $$;
