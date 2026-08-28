-- Work MVC schema alignment.
-- Keeps the existing profiles.id primary key while adding the compatibility
-- user_id surface expected by the current web app.

create extension if not exists pgcrypto with schema extensions;

alter table public.profiles add column if not exists user_id uuid;
alter table public.profiles add column if not exists first_name text;
alter table public.profiles add column if not exists middle_name text;
alter table public.profiles add column if not exists last_name text;
alter table public.profiles add column if not exists phone_number text;
alter table public.profiles add column if not exists profile_photo text;
alter table public.profiles add column if not exists province text;
alter table public.profiles add column if not exists city text;
alter table public.profiles add column if not exists barangay text;
alter table public.profiles add column if not exists is_client boolean;
alter table public.profiles add column if not exists is_worker boolean;
alter table public.profiles add column if not exists account_status text;
alter table public.profiles add column if not exists disabled_reason text;
alter table public.profiles add column if not exists suspended_reason text;
alter table public.profiles add column if not exists suspended_until timestamptz;
alter table public.profiles add column if not exists disabled_at timestamptz;
alter table public.profiles add column if not exists suspended_at timestamptz;
alter table public.profiles add column if not exists updated_at timestamptz;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'id'
  ) then
    execute 'update public.profiles set user_id = coalesce(user_id, id) where user_id is null';
  end if;
end $$;

update public.profiles
set
  first_name = coalesce(first_name, nullif(split_part(coalesce(full_name, ''), ' ', 1), '')),
  last_name = coalesce(last_name, nullif(regexp_replace(coalesce(full_name, ''), '^.*\s', ''), '')),
  is_client = coalesce(is_client, true),
  is_worker = coalesce(is_worker, false),
  account_status = coalesce(nullif(account_status, ''), 'active'),
  updated_at = coalesce(updated_at, created_at, now())
where first_name is null
   or last_name is null
   or is_client is null
   or is_worker is null
   or account_status is null
   or updated_at is null;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'contact_number'
  ) then
    execute 'update public.profiles set phone_number = coalesce(phone_number, contact_number) where phone_number is null';
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'avatar_url'
  ) then
    execute 'update public.profiles set profile_photo = coalesce(profile_photo, avatar_url) where profile_photo is null';
  end if;
end $$;

alter table public.profiles alter column user_id set not null;
alter table public.profiles alter column is_client set default true;
alter table public.profiles alter column is_client set not null;
alter table public.profiles alter column is_worker set default false;
alter table public.profiles alter column is_worker set not null;
alter table public.profiles alter column account_status set default 'active';
alter table public.profiles alter column account_status set not null;
alter table public.profiles alter column updated_at set default now();
alter table public.profiles alter column updated_at set not null;
alter table public.profiles alter column role set default 'client';

alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles
  add constraint profiles_role_check
  check (role in ('client', 'worker', 'admin', 'fan', 'musician', 'studio-owner', 'venue-owner', 'producer'));

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

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_user_id_fkey'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_user_id_fkey
      foreign key (user_id) references auth.users(id) on delete cascade;
  end if;
end $$;

create unique index if not exists profiles_user_id_key on public.profiles (user_id);
create index if not exists profiles_role_idx on public.profiles (role);
create index if not exists profiles_account_status_idx on public.profiles (account_status);

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
  project_rate numeric,
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

create table if not exists public.sellers (
  user_id uuid primary key references public.profiles (user_id) on delete cascade,
  display_name text,
  headline text,
  tagline text,
  about text,
  profile_photo text,
  avatar_url text,
  is_verified boolean not null default false,
  verification_status text not null default 'pending',
  response_time_minutes integer default 1440,
  languages text[] default array['en']::text[],
  default_currency text default 'PHP',
  business_hours jsonb,
  search_meta jsonb default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.services (
  id bigserial primary key,
  seller_id uuid not null references public.sellers (user_id) on delete cascade,
  title text not null,
  slug text not null,
  description text,
  short_description text,
  category_id integer,
  price_type text not null default 'fixed',
  base_price numeric(12, 2),
  currency text default 'PHP',
  duration_minutes integer,
  active boolean not null default true,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (seller_id, slug)
);

create table if not exists public.service_slots (
  id bigserial primary key,
  service_id bigint not null references public.services (id) on delete cascade,
  seller_id uuid not null references public.sellers (user_id) on delete cascade,
  start_ts timestamptz not null,
  end_ts timestamptz not null,
  capacity integer not null default 1,
  status text not null default 'available',
  note text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.worker_profiles add column if not exists project_rate numeric;
alter table public.sellers add column if not exists profile_photo text;
alter table public.sellers add column if not exists avatar_url text;
alter table public.sellers add column if not exists search_meta jsonb default '{}'::jsonb;
alter table public.services add column if not exists metadata jsonb default '{}'::jsonb;
alter table public.service_slots add column if not exists note text;
alter table public.service_slots add column if not exists metadata jsonb default '{}'::jsonb;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'worker_profiles_pricing_model_check'
      and conrelid = 'public.worker_profiles'::regclass
  ) then
    alter table public.worker_profiles
      add constraint worker_profiles_pricing_model_check
      check (pricing_model in ('fixed', 'hourly', 'daily', 'weekly', 'monthly', 'inquiry'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'worker_profiles_booking_mode_check'
      and conrelid = 'public.worker_profiles'::regclass
  ) then
    alter table public.worker_profiles
      add constraint worker_profiles_booking_mode_check
      check (booking_mode in ('with-slots', 'calendar-only'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'sellers_verification_status_check'
      and conrelid = 'public.sellers'::regclass
  ) then
    alter table public.sellers
      add constraint sellers_verification_status_check
      check (verification_status in ('pending', 'approved', 'rejected'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'services_price_type_check'
      and conrelid = 'public.services'::regclass
  ) then
    alter table public.services
      add constraint services_price_type_check
      check (price_type in ('fixed', 'hourly', 'custom', 'package'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'service_slots_capacity_check'
      and conrelid = 'public.service_slots'::regclass
  ) then
    alter table public.service_slots
      add constraint service_slots_capacity_check
      check (capacity > 0);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'service_slots_status_check'
      and conrelid = 'public.service_slots'::regclass
  ) then
    alter table public.service_slots
      add constraint service_slots_status_check
      check (status in ('available', 'booked', 'cancelled'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'service_slots_time_check'
      and conrelid = 'public.service_slots'::regclass
  ) then
    alter table public.service_slots
      add constraint service_slots_time_check
      check (end_ts > start_ts);
  end if;
end $$;

create index if not exists worker_profiles_user_id_idx on public.worker_profiles (user_id);
create index if not exists sellers_search_meta_idx on public.sellers using gin (search_meta);
create index if not exists sellers_languages_idx on public.sellers using gin (languages);
create index if not exists services_seller_idx on public.services (seller_id);
create index if not exists services_active_idx on public.services (active);
create index if not exists services_metadata_idx on public.services using gin (metadata);
create index if not exists services_fulltext_idx on public.services
  using gin (to_tsvector('english', coalesce(title, '') || ' ' || coalesce(short_description, '') || ' ' || coalesce(description, '')));
create index if not exists service_slots_service_idx on public.service_slots (service_id);
create index if not exists service_slots_seller_time_idx on public.service_slots (seller_id, start_ts, end_ts);
create index if not exists service_slots_status_idx on public.service_slots (status);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_touch_updated_at on public.profiles;
create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row execute function public.touch_updated_at();

drop trigger if exists worker_profiles_touch_updated_at on public.worker_profiles;
create trigger worker_profiles_touch_updated_at
  before update on public.worker_profiles
  for each row execute function public.touch_updated_at();

drop trigger if exists sellers_touch_updated_at on public.sellers;
create trigger sellers_touch_updated_at
  before update on public.sellers
  for each row execute function public.touch_updated_at();

drop trigger if exists services_touch_updated_at on public.services;
create trigger services_touch_updated_at
  before update on public.services
  for each row execute function public.touch_updated_at();

drop trigger if exists service_slots_touch_updated_at on public.service_slots;
create trigger service_slots_touch_updated_at
  before update on public.service_slots
  for each row execute function public.touch_updated_at();

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
    where p.user_id = (select auth.uid())
      and p.role = 'admin'
      and coalesce(p.account_status, 'active') = 'active'
  );
$$;

alter table public.profiles enable row level security;
alter table public.worker_profiles enable row level security;
alter table public.sellers enable row level security;
alter table public.services enable row level security;
alter table public.service_slots enable row level security;

drop policy if exists "Users can insert their own profile" on public.profiles;
drop policy if exists "Users can update own profile" on public.profiles;
drop policy if exists profiles_select_own_or_admin on public.profiles;
drop policy if exists profiles_insert_own on public.profiles;
drop policy if exists profiles_update_own_or_admin on public.profiles;

create policy profiles_select_own_or_admin
  on public.profiles
  for select
  to authenticated
  using ((select auth.uid()) = user_id or (select public.is_current_user_admin()));

create policy profiles_insert_own
  on public.profiles
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy profiles_update_own_or_admin
  on public.profiles
  for update
  to authenticated
  using ((select auth.uid()) = user_id or (select public.is_current_user_admin()))
  with check ((select auth.uid()) = user_id or (select public.is_current_user_admin()));

drop policy if exists worker_profiles_select_own on public.worker_profiles;
drop policy if exists worker_profiles_insert_own on public.worker_profiles;
drop policy if exists worker_profiles_update_own on public.worker_profiles;

create policy worker_profiles_select_own
  on public.worker_profiles
  for select
  to authenticated
  using ((select auth.uid()) = user_id or (select public.is_current_user_admin()));

create policy worker_profiles_insert_own
  on public.worker_profiles
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy worker_profiles_update_own
  on public.worker_profiles
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists sellers_select_public on public.sellers;
drop policy if exists sellers_insert_own on public.sellers;
drop policy if exists sellers_update_own on public.sellers;
drop policy if exists sellers_delete_own on public.sellers;

create policy sellers_select_public
  on public.sellers
  for select
  to anon, authenticated
  using (true);

create policy sellers_insert_own
  on public.sellers
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy sellers_update_own
  on public.sellers
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy sellers_delete_own
  on public.sellers
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists services_select_public_or_own on public.services;
drop policy if exists services_select_public on public.services;
drop policy if exists services_select_own on public.services;
drop policy if exists services_insert_own on public.services;
drop policy if exists services_update_own on public.services;
drop policy if exists services_delete_own on public.services;

create policy services_select_public_or_own
  on public.services
  for select
  to anon, authenticated
  using (active = true or (select auth.uid()) = seller_id);

create policy services_insert_own
  on public.services
  for insert
  to authenticated
  with check (
    (select auth.uid()) = seller_id
    and exists (
      select 1
      from public.sellers s
      where s.user_id = seller_id
        and s.user_id = (select auth.uid())
    )
  );

create policy services_update_own
  on public.services
  for update
  to authenticated
  using ((select auth.uid()) = seller_id)
  with check ((select auth.uid()) = seller_id);

create policy services_delete_own
  on public.services
  for delete
  to authenticated
  using ((select auth.uid()) = seller_id);

drop policy if exists service_slots_select_public_or_own on public.service_slots;
drop policy if exists service_slots_select_public on public.service_slots;
drop policy if exists service_slots_select_own on public.service_slots;
drop policy if exists service_slots_insert_own on public.service_slots;
drop policy if exists service_slots_update_own on public.service_slots;
drop policy if exists service_slots_delete_own on public.service_slots;

create policy service_slots_select_public_or_own
  on public.service_slots
  for select
  to anon, authenticated
  using (status = 'available' or (select auth.uid()) = seller_id);

create policy service_slots_insert_own
  on public.service_slots
  for insert
  to authenticated
  with check (
    (select auth.uid()) = seller_id
    and exists (
      select 1
      from public.services svc
      where svc.id = service_id
        and svc.seller_id = (select auth.uid())
    )
  );

create policy service_slots_update_own
  on public.service_slots
  for update
  to authenticated
  using ((select auth.uid()) = seller_id)
  with check ((select auth.uid()) = seller_id);

create policy service_slots_delete_own
  on public.service_slots
  for delete
  to authenticated
  using ((select auth.uid()) = seller_id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  raw_role text;
  normalized_role text;
  first_name text;
  middle_name text;
  last_name text;
  display_name text;
  has_profile_id boolean;
begin
  raw_role := lower(nullif(new.raw_user_meta_data ->> 'role', ''));
  normalized_role := case
    when raw_role in ('admin', 'worker', 'client') then raw_role
    when coalesce((new.raw_user_meta_data ->> 'is_worker')::boolean, false) then 'worker'
    else 'client'
  end;
  first_name := nullif(new.raw_user_meta_data ->> 'first_name', '');
  middle_name := nullif(new.raw_user_meta_data ->> 'middle_name', '');
  last_name := nullif(new.raw_user_meta_data ->> 'last_name', '');
  display_name := coalesce(
    nullif(new.raw_user_meta_data ->> 'full_name', ''),
    nullif(concat_ws(' ', first_name, middle_name, last_name), ''),
    nullif(new.raw_user_meta_data ->> 'name', ''),
    split_part(new.email, '@', 1),
    'TrabaWho User'
  );

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'id'
  ) into has_profile_id;

  if has_profile_id then
    execute $insert$
      insert into public.profiles (
        id,
        user_id,
        first_name,
        middle_name,
        last_name,
        full_name,
        email,
        role,
        account_status,
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
        $1, $1, $2, $3, $4, $5, $6, $7, 'active', $8, $9, $10, $11, $12, $13, $14, true, $15, now(), now()
      )
      on conflict (user_id) do update set
        email = excluded.email,
        first_name = coalesce(excluded.first_name, public.profiles.first_name),
        middle_name = coalesce(excluded.middle_name, public.profiles.middle_name),
        last_name = coalesce(excluded.last_name, public.profiles.last_name),
        full_name = coalesce(excluded.full_name, public.profiles.full_name),
        role = coalesce(public.profiles.role, excluded.role),
        account_status = coalesce(public.profiles.account_status, 'active'),
        updated_at = now()
    $insert$
    using
      new.id,
      first_name,
      middle_name,
      last_name,
      display_name,
      new.email,
      normalized_role,
      nullif(new.raw_user_meta_data ->> 'phone_number', ''),
      nullif(new.raw_user_meta_data ->> 'profile_photo', ''),
      nullif(new.raw_user_meta_data ->> 'bio', ''),
      nullif(new.raw_user_meta_data ->> 'province', ''),
      nullif(new.raw_user_meta_data ->> 'city', ''),
      nullif(new.raw_user_meta_data ->> 'barangay', ''),
      nullif(new.raw_user_meta_data ->> 'address', ''),
      normalized_role = 'worker';
  else
    execute $insert$
      insert into public.profiles (
        user_id,
        first_name,
        middle_name,
        last_name,
        full_name,
        email,
        role,
        account_status,
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
        $1, $2, $3, $4, $5, $6, $7, 'active', $8, $9, $10, $11, $12, $13, $14, true, $15, now(), now()
      )
      on conflict (user_id) do update set
        email = excluded.email,
        first_name = coalesce(excluded.first_name, public.profiles.first_name),
        middle_name = coalesce(excluded.middle_name, public.profiles.middle_name),
        last_name = coalesce(excluded.last_name, public.profiles.last_name),
        full_name = coalesce(excluded.full_name, public.profiles.full_name),
        role = coalesce(public.profiles.role, excluded.role),
        account_status = coalesce(public.profiles.account_status, 'active'),
        updated_at = now()
    $insert$
    using
      new.id,
      first_name,
      middle_name,
      last_name,
      display_name,
      new.email,
      normalized_role,
      nullif(new.raw_user_meta_data ->> 'phone_number', ''),
      nullif(new.raw_user_meta_data ->> 'profile_photo', ''),
      nullif(new.raw_user_meta_data ->> 'bio', ''),
      nullif(new.raw_user_meta_data ->> 'province', ''),
      nullif(new.raw_user_meta_data ->> 'city', ''),
      nullif(new.raw_user_meta_data ->> 'barangay', ''),
      nullif(new.raw_user_meta_data ->> 'address', ''),
      normalized_role = 'worker';
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
