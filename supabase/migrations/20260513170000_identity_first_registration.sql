-- Identity-first registration support for the dcz TrabaWho project.
-- Existing marketplace auth/data flows remain compatible with the current profiles.user_id shape.

create extension if not exists pgcrypto;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'identity-manual',
  'identity-manual',
  false,
  7340032,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

alter table public.profiles add column if not exists identity_required boolean not null default false;
alter table public.profiles add column if not exists identity_role text;
alter table public.profiles add column if not exists is_verified boolean not null default false;
alter table public.profiles add column if not exists verification_status text not null default 'LEGACY';
alter table public.profiles add column if not exists didit_session_id text;
alter table public.profiles add column if not exists id_document_expiry date;
alter table public.profiles add column if not exists id_verified_at timestamptz;
alter table public.profiles add column if not exists identity_reviewed_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_identity_role_check'
  ) then
    alter table public.profiles
      add constraint profiles_identity_role_check
      check (identity_role is null or identity_role in ('fan', 'musician'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'profiles_identity_verification_status_check'
  ) then
    alter table public.profiles
      add constraint profiles_identity_verification_status_check
      check (verification_status in (
        'LEGACY',
        'UNVERIFIED',
        'PENDING',
        'PENDING_REVIEW',
        'APPROVED',
        'DECLINED',
        'ABANDONED',
        'EXPIRED',
        'SUPERSEDED'
      ));
  end if;
end $$;

create table if not exists public.verification_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  session_ref text not null unique,
  status text not null default 'PENDING',
  verification_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.manual_identity_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  submitted_by_email text not null,
  submitted_role text,
  document_type text not null,
  document_type_key text,
  document_country text not null default 'PHL',
  source text not null default 'MANUAL_UPLOAD',
  status text not null default 'PENDING_REVIEW',
  front_image_path text,
  back_image_path text,
  selfie_image_path text,
  review_notes text,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  decision_email_sent_at timestamptz,
  expected_decision_by timestamptz not null default (now() + interval '7 days'),
  submitted_app_role text,
  didit_session_id text,
  document_fingerprint text,
  duplicate_reason text,
  duplicate_match_count integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  verified_full_legal_name text,
  normalized_full_legal_name text,
  birth_date date,
  review_reason text,
  matched_on text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint manual_identity_reviews_source_check
    check (source in ('MANUAL_UPLOAD', 'DIDIT_PENDING', 'DIDIT_DUPLICATE')),
  constraint manual_identity_reviews_status_check
    check (status in ('PENDING_REVIEW', 'APPROVED', 'DECLINED')),
  constraint manual_identity_reviews_role_check
    check (submitted_role is null or submitted_role in ('fan', 'musician')),
  constraint manual_identity_reviews_app_role_check
    check (submitted_app_role is null or submitted_app_role in ('client', 'worker'))
);

create table if not exists public.identity_document_claims (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  role text not null,
  app_role text,
  document_fingerprint text,
  document_type text,
  document_type_key text,
  document_country text not null default 'PHL',
  source text not null default 'DIDIT',
  status text not null default 'APPROVED',
  didit_session_id text,
  manual_review_id uuid references public.manual_identity_reviews(id) on delete set null,
  original_user_id uuid,
  normalized_email text,
  claim_metadata jsonb not null default '{}'::jsonb,
  deleted_profile_at timestamptz,
  verified_full_legal_name text,
  normalized_full_legal_name text,
  birth_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  constraint identity_document_claims_role_check check (role in ('fan', 'musician')),
  constraint identity_document_claims_app_role_check check (app_role is null or app_role in ('client', 'worker')),
  constraint identity_document_claims_source_check
    check (source in ('DIDIT', 'MANUAL_UPLOAD', 'DIDIT_PENDING', 'DIDIT_DUPLICATE')),
  constraint identity_document_claims_status_check
    check (status in ('APPROVED', 'PENDING_REVIEW', 'DECLINED', 'REVOKED'))
);

create table if not exists public.didit_webhook_events (
  event_key text primary key,
  session_id text,
  status text,
  payload_hash text not null,
  processed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.registration_attempts (
  id uuid primary key default gen_random_uuid(),
  action text not null,
  email_hash text,
  ip_hash text,
  device_hash text,
  user_id uuid references auth.users(id) on delete set null,
  didit_session_id text,
  blocked boolean not null default false,
  success boolean not null default false,
  reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint registration_attempts_action_check
    check (action in (
      'create_didit_session',
      'create_unverified_user',
      'manual_identity_review',
      'resend_confirmation_email'
    ))
);

create index if not exists profiles_identity_required_idx
  on public.profiles (identity_required, verification_status);
create index if not exists profiles_didit_session_id_idx
  on public.profiles (didit_session_id);
create index if not exists verification_sessions_status_idx
  on public.verification_sessions (status, created_at desc);
create index if not exists verification_sessions_email_idx
  on public.verification_sessions ((lower(verification_data->>'email')));
create index if not exists manual_identity_reviews_status_idx
  on public.manual_identity_reviews (status, created_at desc);
create index if not exists identity_document_claims_duplicate_idx
  on public.identity_document_claims (document_fingerprint, role, status)
  where document_fingerprint is not null;
create unique index if not exists identity_document_claims_user_document_role_uidx
  on public.identity_document_claims (user_id, document_fingerprint, role)
  where user_id is not null and document_fingerprint is not null;
create index if not exists registration_attempts_rate_email_idx
  on public.registration_attempts (action, email_hash, created_at desc)
  where email_hash is not null;
create index if not exists registration_attempts_rate_ip_idx
  on public.registration_attempts (action, ip_hash, created_at desc)
  where ip_hash is not null;

alter table public.verification_sessions enable row level security;
alter table public.manual_identity_reviews enable row level security;
alter table public.identity_document_claims enable row level security;
alter table public.didit_webhook_events enable row level security;
alter table public.registration_attempts enable row level security;

create or replace function public.identity_touch_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists verification_sessions_touch_updated_at on public.verification_sessions;
create trigger verification_sessions_touch_updated_at
before update on public.verification_sessions
for each row execute function public.identity_touch_updated_at();

drop trigger if exists manual_identity_reviews_touch_updated_at on public.manual_identity_reviews;
create trigger manual_identity_reviews_touch_updated_at
before update on public.manual_identity_reviews
for each row execute function public.identity_touch_updated_at();

drop trigger if exists identity_document_claims_touch_updated_at on public.identity_document_claims;
create trigger identity_document_claims_touch_updated_at
before update on public.identity_document_claims
for each row execute function public.identity_touch_updated_at();

create or replace function public.promote_identity_profile_after_email_confirm()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if old.email_confirmed_at is null and new.email_confirmed_at is not null then
    update public.profiles
    set
      is_verified = true,
      id_verified_at = coalesce(id_verified_at, now()),
      updated_at = now()
    where user_id = new.id
      and identity_required = true
      and verification_status = 'APPROVED';
  end if;

  return new;
end;
$$;

drop trigger if exists promote_identity_profile_after_email_confirm on auth.users;
create trigger promote_identity_profile_after_email_confirm
after update of email_confirmed_at on auth.users
for each row execute function public.promote_identity_profile_after_email_confirm();

revoke execute on function public.promote_identity_profile_after_email_confirm() from public, anon, authenticated;
