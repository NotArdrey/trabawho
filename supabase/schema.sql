-- TrabaWho Supabase schema
-- Run this in the Supabase SQL editor or via the CLI after linking the project.

create table if not exists public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  first_name text,
  middle_name text,
  last_name text,
  full_name text not null,
  email text not null unique,
  role text not null default 'client' check (role in ('client', 'worker', 'admin')),
  account_status text not null default 'active' check (account_status in ('active', 'disabled', 'suspended')),
  disabled_reason text,
  suspended_reason text,
  suspended_until timestamptz,
  disabled_at timestamptz,
  suspended_at timestamptz,
  phone_number text,
  profile_photo text,
  bio text,
  province text,
  city text,
  barangay text,
  address text,
  is_client boolean not null default true,
  is_worker boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles add column if not exists first_name text;
alter table public.profiles add column if not exists middle_name text;
alter table public.profiles add column if not exists last_name text;
alter table public.profiles add column if not exists role text;
alter table public.profiles add column if not exists profile_photo text;
alter table public.profiles add column if not exists account_status text;
alter table public.profiles add column if not exists disabled_reason text;
alter table public.profiles add column if not exists suspended_reason text;
alter table public.profiles add column if not exists suspended_until timestamptz;
alter table public.profiles add column if not exists disabled_at timestamptz;
alter table public.profiles add column if not exists suspended_at timestamptz;

update public.profiles
set account_status = coalesce(nullif(account_status, ''), 'active')
where account_status is null or account_status = '';

alter table public.profiles
  alter column account_status set default 'active';

alter table public.profiles
  alter column account_status set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_account_status_check'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_account_status_check
      check (account_status in ('active', 'disabled', 'suspended'));
  end if;
end $$;

update public.profiles
set
  first_name = coalesce(first_name, nullif(split_part(full_name, ' ', 1), '')),
  last_name = coalesce(last_name, nullif(regexp_replace(full_name, '^.*\s', ''), '')),
  middle_name = coalesce(
    middle_name,
    nullif(
      regexp_replace(
        regexp_replace(full_name, '^\s*\S+\s*', ''),
        '\s*\S+\s*$',
        ''
      ),
      ''
    )
  ),
  role = coalesce(role, case when is_worker then 'worker' else 'client' end)
where full_name is not null;

alter table public.profiles
  alter column role set default 'client';

alter table public.profiles
  alter column role set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_role_check'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_role_check
      check (role in ('client', 'worker', 'admin'));
  end if;
end $$;

create table if not exists public.worker_profiles (
  user_id uuid primary key references public.profiles (user_id) on delete cascade,
  service_type text,
  custom_service_type text,
  bio text,
  age integer,
  experience_years integer,
  pricing_model text not null default 'fixed',
  fixed_price numeric,
  hourly_rate numeric,
  daily_rate numeric,
  weekly_rate numeric,
  monthly_rate numeric,
  booking_mode text not null default 'with-slots',
  rate_basis text not null default 'per-hour',
  payment_advance boolean not null default false,
  payment_after_service boolean not null default true,
  after_service_payment_type text not null default 'both',
  gcash_number text,
  qr_file_name text,
  verification_status text not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.worker_profiles add column if not exists age integer;
alter table public.worker_profiles add column if not exists experience_years integer;

alter table public.profiles enable row level security;
alter table public.worker_profiles enable row level security;

create or replace function public.is_current_user_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.user_id = auth.uid()
      and p.role = 'admin'
      and coalesce(p.account_status, 'active') = 'active'
  );
$$;

drop policy if exists "profiles_select_admin" on public.profiles;
create policy "profiles_select_admin"
  on public.profiles
  for select
  using (auth.uid() = user_id or public.is_current_user_admin());

drop policy if exists "profiles_update_admin" on public.profiles;
create policy "profiles_update_admin"
  on public.profiles
  for update
  using (auth.uid() = user_id or public.is_current_user_admin())
  with check (auth.uid() = user_id or public.is_current_user_admin());

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
  on public.profiles
  for select
  using (auth.uid() = user_id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
  on public.profiles
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "worker_profiles_select_own" on public.worker_profiles;
create policy "worker_profiles_select_own"
  on public.worker_profiles
  for select
  using (auth.uid() = user_id);

drop policy if exists "worker_profiles_insert_own" on public.worker_profiles;
create policy "worker_profiles_insert_own"
  on public.worker_profiles
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "worker_profiles_update_own" on public.worker_profiles;
create policy "worker_profiles_update_own"
  on public.worker_profiles
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (
    user_id,
    first_name,
    middle_name,
    last_name,
    full_name,
    email,
    role,
    account_status,
    disabled_reason,
    suspended_reason,
    suspended_until,
    disabled_at,
    suspended_at,
    phone_number,
    profile_photo,
    bio,
    province,
    city,
    barangay,
    address,
    is_client,
    is_worker,
    created_at,
    updated_at
  ) values (
    new.id,
    nullif(new.raw_user_meta_data ->> 'first_name', ''),
    nullif(new.raw_user_meta_data ->> 'middle_name', ''),
    nullif(new.raw_user_meta_data ->> 'last_name', ''),
    coalesce(
      nullif(new.raw_user_meta_data ->> 'full_name', ''),
      concat_ws(' ', nullif(new.raw_user_meta_data ->> 'first_name', ''), nullif(new.raw_user_meta_data ->> 'middle_name', ''), nullif(new.raw_user_meta_data ->> 'last_name', '')),
      nullif(new.raw_user_meta_data ->> 'name', ''),
      split_part(new.email, '@', 1)
    ),
    new.email,
    coalesce(
      nullif(lower(new.raw_user_meta_data ->> 'role'), ''),
      case when coalesce((new.raw_user_meta_data ->> 'is_worker')::boolean, false) then 'worker' else 'client' end
    ),
    'active',
    null,
    null,
    null,
    null,
    null,
    nullif(new.raw_user_meta_data ->> 'phone_number', ''),
    nullif(new.raw_user_meta_data ->> 'profile_photo', ''),
    nullif(new.raw_user_meta_data ->> 'bio', ''),
    nullif(new.raw_user_meta_data ->> 'province', ''),
    nullif(new.raw_user_meta_data ->> 'city', ''),
    nullif(new.raw_user_meta_data ->> 'barangay', ''),
    nullif(new.raw_user_meta_data ->> 'address', ''),
    true,
    false,
    now(),
    now()
  ) on conflict (user_id) do update set
    first_name = excluded.first_name,
    middle_name = excluded.middle_name,
    last_name = excluded.last_name,
    full_name = excluded.full_name,
    email = excluded.email,
    role = coalesce(public.profiles.role, excluded.role),
    account_status = coalesce(public.profiles.account_status, excluded.account_status),
    disabled_reason = coalesce(public.profiles.disabled_reason, excluded.disabled_reason),
    suspended_reason = coalesce(public.profiles.suspended_reason, excluded.suspended_reason),
    suspended_until = coalesce(public.profiles.suspended_until, excluded.suspended_until),
    disabled_at = coalesce(public.profiles.disabled_at, excluded.disabled_at),
    suspended_at = coalesce(public.profiles.suspended_at, excluded.suspended_at),
    phone_number = excluded.phone_number,
    profile_photo = excluded.profile_photo,
    bio = excluded.bio,
    province = excluded.province,
    city = excluded.city,
    barangay = excluded.barangay,
    address = excluded.address,
    updated_at = now();

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
