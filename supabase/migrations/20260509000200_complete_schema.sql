-- TrabaWho Complete Schema - Consolidated
-- Run this complete file in Supabase SQL Editor to set up all necessary tables and RLS policies
-- This file includes: profiles, worker_profiles, sellers, services, and all related tables with RLS

-- ============================================================================
-- PHASE 1: Core Profile Tables
-- ============================================================================

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

create table if not exists public.worker_profiles (
  user_id uuid primary key references public.profiles (user_id) on delete cascade,
  service_type text,
  custom_service_type text,
  bio text,
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

-- ============================================================================
-- PHASE 2: Seller Tables
-- ============================================================================

create table if not exists public.sellers (
  user_id uuid primary key references public.profiles (user_id) on delete cascade,
  display_name text,
  headline text,
  tagline text,
  about text,
  is_verified boolean not null default false,
  verification_status text not null default 'pending' check (verification_status in ('pending','approved','rejected')),
  response_time_minutes int default 1440,
  languages text[],
  default_currency text default 'PHP',
  business_hours jsonb,
  search_meta jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists sellers_search_meta_idx on public.sellers using gin (search_meta);
create index if not exists sellers_languages_idx on public.sellers using gin (languages);

-- ============================================================================
-- PHASE 3: Services & Related Tables
-- ============================================================================

create table if not exists public.services (
  id bigserial primary key,
  seller_id uuid not null references public.sellers (user_id) on delete cascade,
  title text not null,
  slug text not null,
  description text,
  short_description text,
  category_id int,
  price_type text not null default 'fixed' check (price_type in ('fixed','hourly','custom','package')),
  base_price numeric(12,2),
  currency text default 'PHP',
  duration_minutes int,
  active boolean not null default true,
  metadata jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (seller_id, slug)
);

create index if not exists services_fulltext_idx on public.services using gin (to_tsvector('english', coalesce(title,'') || ' ' || coalesce(short_description,'') || ' ' || coalesce(description,'')));
create index if not exists services_seller_idx on public.services (seller_id);
create index if not exists services_active_idx on public.services (active);

create table if not exists public.service_categories (
  id serial primary key,
  name text not null,
  slug text not null unique,
  parent_id int references public.service_categories (id) on delete set null
);

create table if not exists public.service_photos (
  id bigserial primary key,
  service_id bigint not null references public.services (id) on delete cascade,
  storage_path text,
  public_url text,
  caption text,
  sort_order int default 0,
  created_at timestamptz not null default now()
);

create index if not exists service_photos_service_idx on public.service_photos (service_id);

create table if not exists public.portfolio_items (
  id bigserial primary key,
  seller_id uuid not null references public.sellers (user_id) on delete cascade,
  title text,
  description text,
  media jsonb,
  created_at timestamptz not null default now()
);

create index if not exists portfolio_items_seller_idx on public.portfolio_items (seller_id);

create table if not exists public.seller_certifications (
  id bigserial primary key,
  seller_id uuid not null references public.sellers (user_id) on delete cascade,
  name text not null,
  issuing_organization text,
  issue_date date,
  expiry_date date,
  document_path text,
  verified boolean default false,
  created_at timestamptz not null default now()
);

create index if not exists seller_certifications_seller_idx on public.seller_certifications (seller_id);

create table if not exists public.seller_availability (
  id bigserial primary key,
  seller_id uuid not null references public.sellers (user_id) on delete cascade,
  type text not null default 'recurring' check (type in ('recurring','oneoff','blocked')),
  day_of_week int check (day_of_week between 0 and 6),
  start_time time,
  end_time time,
  start_date date,
  end_date date,
  timezone text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists seller_availability_seller_idx on public.seller_availability (seller_id);

create table if not exists public.service_slots (
  id bigserial primary key,
  service_id bigint not null references public.services (id) on delete cascade,
  seller_id uuid not null references public.sellers (user_id) on delete cascade,
  start_ts timestamptz not null,
  end_ts timestamptz not null,
  capacity int default 1,
  status text not null default 'available' check (status in ('available','booked','cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists service_slots_time_idx on public.service_slots (seller_id, start_ts, end_ts);

-- ============================================================================
-- PHASE 4: Booking & Interaction Tables
-- ============================================================================

create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  service_id bigint not null references public.services (id) on delete restrict,
  seller_id uuid not null references public.sellers (user_id) on delete restrict,
  buyer_id uuid not null references public.profiles (user_id) on delete restrict,
  slot_id bigint references public.service_slots (id) on delete set null,
  start_ts timestamptz,
  end_ts timestamptz,
  status text not null default 'pending' check (status in ('pending','confirmed','in_progress','completed','cancelled','refunded')),
  total_amount numeric(12,2),
  currency text default 'PHP',
  payment_reference text,
  metadata jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists bookings_seller_idx on public.bookings (seller_id);
create index if not exists bookings_buyer_idx on public.bookings (buyer_id);

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid references public.bookings (id) on delete set null,
  seller_id uuid references public.sellers (user_id) on delete cascade,
  buyer_id uuid references public.profiles (user_id) on delete cascade,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create index if not exists conversations_seller_idx on public.conversations (seller_id);
create index if not exists conversations_buyer_idx on public.conversations (buyer_id);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_id uuid not null references public.profiles (user_id) on delete cascade,
  body text,
  attachments jsonb,
  read_by jsonb default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists messages_conversation_idx on public.messages (conversation_id, created_at);

create table if not exists public.reviews (
  id bigserial primary key,
  seller_id uuid not null references public.sellers (user_id) on delete cascade,
  reviewer_id uuid not null references public.profiles (user_id) on delete cascade,
  booking_id uuid references public.bookings (id) on delete set null,
  rating smallint not null check (rating >= 1 and rating <= 5),
  title text,
  body text,
  helpful_count int default 0,
  published boolean default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists reviews_seller_idx on public.reviews (seller_id);
create index if not exists reviews_rating_idx on public.reviews (seller_id, rating);

create table if not exists public.seller_rating_aggregates (
  seller_id uuid primary key references public.sellers (user_id) on delete cascade,
  avg_rating numeric(3,2) default 0,
  rating_count int default 0,
  updated_at timestamptz not null default now()
);

-- ============================================================================
-- PHASE 5: Enable Row Level Security
-- ============================================================================

alter table public.profiles enable row level security;
alter table public.worker_profiles enable row level security;
alter table public.sellers enable row level security;
alter table public.services enable row level security;
alter table public.service_photos enable row level security;
alter table public.service_categories enable row level security;
alter table public.portfolio_items enable row level security;
alter table public.seller_certifications enable row level security;
alter table public.seller_availability enable row level security;
alter table public.service_slots enable row level security;
alter table public.bookings enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.reviews enable row level security;

-- ============================================================================
-- PHASE 6: RLS Policies
-- ============================================================================

-- Profiles policies
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

-- Worker profiles policies
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

-- Sellers policies
drop policy if exists "sellers_select_public" on public.sellers;
create policy "sellers_select_public"
  on public.sellers
  for select
  using (true);

drop policy if exists "sellers_insert_own" on public.sellers;
create policy "sellers_insert_own"
  on public.sellers
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "sellers_update_own" on public.sellers;
create policy "sellers_update_own"
  on public.sellers
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "sellers_delete_own" on public.sellers;
create policy "sellers_delete_own"
  on public.sellers
  for delete
  using (auth.uid() = user_id);

-- Services policies
drop policy if exists "services_select_public" on public.services;
create policy "services_select_public"
  on public.services
  for select
  using (active = true);

drop policy if exists "services_select_own" on public.services;
create policy "services_select_own"
  on public.services
  for select
  using (auth.uid() = seller_id);

drop policy if exists "services_insert_own" on public.services;
create policy "services_insert_own"
  on public.services
  for insert
  with check (
    auth.uid() = seller_id
    and exists (select 1 from public.sellers s where s.user_id = auth.uid() and s.user_id = seller_id)
  );

drop policy if exists "services_update_own" on public.services;
create policy "services_update_own"
  on public.services
  for update
  using (auth.uid() = seller_id)
  with check (auth.uid() = seller_id);

drop policy if exists "services_delete_own" on public.services;
create policy "services_delete_own"
  on public.services
  for delete
  using (auth.uid() = seller_id);

-- Service photos policies
drop policy if exists "service_photos_select_public" on public.service_photos;
create policy "service_photos_select_public"
  on public.service_photos
  for select
  using (true);

drop policy if exists "service_photos_insert_own" on public.service_photos;
create policy "service_photos_insert_own"
  on public.service_photos
  for insert
  with check (
    exists (
      select 1 from public.services svc
      where svc.id = service_id
        and svc.seller_id = auth.uid()
    )
  );

drop policy if exists "service_photos_update_own" on public.service_photos;
create policy "service_photos_update_own"
  on public.service_photos
  for update
  using (
    exists (
      select 1 from public.services svc
      where svc.id = service_id
        and svc.seller_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.services svc
      where svc.id = service_id
        and svc.seller_id = auth.uid()
    )
  );

-- Portfolio items policies
drop policy if exists "portfolio_items_select_public" on public.portfolio_items;
create policy "portfolio_items_select_public"
  on public.portfolio_items
  for select
  using (true);

drop policy if exists "portfolio_items_insert_own" on public.portfolio_items;
create policy "portfolio_items_insert_own"
  on public.portfolio_items
  for insert
  with check (auth.uid() = seller_id);

drop policy if exists "portfolio_items_update_own" on public.portfolio_items;
create policy "portfolio_items_update_own"
  on public.portfolio_items
  for update
  using (auth.uid() = seller_id)
  with check (auth.uid() = seller_id);

drop policy if exists "portfolio_items_delete_own" on public.portfolio_items;
create policy "portfolio_items_delete_own"
  on public.portfolio_items
  for delete
  using (auth.uid() = seller_id);

-- Service slots policies
drop policy if exists "service_slots_select_public" on public.service_slots;
create policy "service_slots_select_public"
  on public.service_slots
  for select
  using (status = 'available');

drop policy if exists "service_slots_select_own" on public.service_slots;
create policy "service_slots_select_own"
  on public.service_slots
  for select
  using (auth.uid() = seller_id);

drop policy if exists "service_slots_insert_own" on public.service_slots;
create policy "service_slots_insert_own"
  on public.service_slots
  for insert
  with check (auth.uid() = seller_id);

drop policy if exists "service_slots_update_own" on public.service_slots;
create policy "service_slots_update_own"
  on public.service_slots
  for update
  using (auth.uid() = seller_id)
  with check (auth.uid() = seller_id);

drop policy if exists "service_slots_delete_own" on public.service_slots;
create policy "service_slots_delete_own"
  on public.service_slots
  for delete
  using (auth.uid() = seller_id);

-- Bookings policies
drop policy if exists "bookings_select_own_seller" on public.bookings;
create policy "bookings_select_own_seller"
  on public.bookings
  for select
  using (auth.uid() = seller_id);

drop policy if exists "bookings_select_own_buyer" on public.bookings;
create policy "bookings_select_own_buyer"
  on public.bookings
  for select
  using (auth.uid() = buyer_id);

drop policy if exists "bookings_insert_buyer" on public.bookings;
create policy "bookings_insert_buyer"
  on public.bookings
  for insert
  with check (auth.uid() = buyer_id);

drop policy if exists "bookings_update_seller" on public.bookings;
create policy "bookings_update_seller"
  on public.bookings
  for update
  using (auth.uid() = seller_id)
  with check (auth.uid() = seller_id);

drop policy if exists "bookings_update_buyer" on public.bookings;
create policy "bookings_update_buyer"
  on public.bookings
  for update
  using (auth.uid() = buyer_id)
  with check (auth.uid() = buyer_id);

-- Conversations policies
drop policy if exists "conversations_select_own" on public.conversations;
create policy "conversations_select_own"
  on public.conversations
  for select
  using (auth.uid() = seller_id or auth.uid() = buyer_id);

drop policy if exists "conversations_insert_own" on public.conversations;
create policy "conversations_insert_own"
  on public.conversations
  for insert
  with check (auth.uid() = seller_id or auth.uid() = buyer_id);

drop policy if exists "conversations_update_own" on public.conversations;
create policy "conversations_update_own"
  on public.conversations
  for update
  using (auth.uid() = seller_id or auth.uid() = buyer_id)
  with check (auth.uid() = seller_id or auth.uid() = buyer_id);

-- Messages policies
drop policy if exists "messages_select_participants" on public.messages;
create policy "messages_select_participants"
  on public.messages
  for select
  using (
    exists (
      select 1 from public.conversations c
      where c.id = conversation_id
        and (c.seller_id = auth.uid() or c.buyer_id = auth.uid())
    )
  );

drop policy if exists "messages_insert_own" on public.messages;
create policy "messages_insert_own"
  on public.messages
  for insert
  with check (auth.uid() = sender_id);

-- Reviews policies
drop policy if exists "reviews_select_public" on public.reviews;
create policy "reviews_select_public"
  on public.reviews
  for select
  using (published = true);

drop policy if exists "reviews_insert_buyer" on public.reviews;
create policy "reviews_insert_buyer"
  on public.reviews
  for insert
  with check (auth.uid() = reviewer_id);

-- Seller certifications policies
drop policy if exists "certifications_select_public" on public.seller_certifications;
create policy "certifications_select_public"
  on public.seller_certifications
  for select
  using (true);

drop policy if exists "certifications_insert_own" on public.seller_certifications;
create policy "certifications_insert_own"
  on public.seller_certifications
  for insert
  with check (auth.uid() = seller_id);

drop policy if exists "certifications_update_own" on public.seller_certifications;
create policy "certifications_update_own"
  on public.seller_certifications
  for update
  using (auth.uid() = seller_id)
  with check (auth.uid() = seller_id);

-- Seller availability policies
drop policy if exists "seller_availability_select_own" on public.seller_availability;
create policy "seller_availability_select_own"
  on public.seller_availability
  for select
  using (auth.uid() = seller_id);

drop policy if exists "seller_availability_insert_own" on public.seller_availability;
create policy "seller_availability_insert_own"
  on public.seller_availability
  for insert
  with check (auth.uid() = seller_id);

drop policy if exists "seller_availability_update_own" on public.seller_availability;
create policy "seller_availability_update_own"
  on public.seller_availability
  for update
  using (auth.uid() = seller_id)
  with check (auth.uid() = seller_id);

drop policy if exists "seller_availability_delete_own" on public.seller_availability;
create policy "seller_availability_delete_own"
  on public.seller_availability
  for delete
  using (auth.uid() = seller_id);

-- ============================================================================
-- PHASE 7: Triggers for Auto-Profile Creation (optional, depends on existing triggers)
-- ============================================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (
    user_id,
    full_name,
    email,
    role,
    account_status,
    is_client,
    is_worker
  ) values (
    new.id,
    coalesce(
      new.raw_user_meta_data ->> 'full_name',
      split_part(new.email, '@', 1)
    ),
    new.email,
    'client',
    'active',
    true,
    false
  ) on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================================================
-- COMPLETE: Run this file in Supabase SQL editor to initialize all tables
-- ============================================================================
