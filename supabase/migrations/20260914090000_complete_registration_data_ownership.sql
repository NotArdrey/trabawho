-- Persist the canonical registration choices on the profile while keeping
-- manual identity evidence in the restricted manual review domain.

alter table public.profiles add column if not exists identity_document_type text;
alter table public.profiles add column if not exists verification_method text;
alter table public.profiles add column if not exists identity_verification_consent boolean not null default false;
alter table public.profiles add column if not exists data_privacy_consent boolean not null default false;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'profiles_verification_method_check'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_verification_method_check
      check (verification_method is null or verification_method in ('DIDIT', 'MANUAL'));
  end if;
end $$;

alter table public.manual_identity_reviews add column if not exists name_on_id text;
alter table public.manual_identity_reviews add column if not exists id_number text;
alter table public.manual_identity_reviews add column if not exists id_expiry_date date;

alter table public.profiles drop constraint if exists profiles_identity_verification_status_check;
alter table public.profiles
  add constraint profiles_identity_verification_status_check
  check (verification_status in (
    'LEGACY', 'UNVERIFIED', 'PENDING', 'PENDING_REVIEW', 'APPROVED',
    'DECLINED', 'RESUBMISSION_REQUIRED', 'ABANDONED', 'EXPIRED', 'SUPERSEDED'
  ));

alter table public.manual_identity_reviews drop constraint if exists manual_identity_reviews_status_check;
alter table public.manual_identity_reviews
  add constraint manual_identity_reviews_status_check
  check (status in ('PENDING_REVIEW', 'APPROVED', 'DECLINED', 'RESUBMISSION_REQUIRED'));

comment on column public.profiles.identity_document_type is 'Government document key selected during registration.';
comment on column public.profiles.verification_method is 'Identity path selected by document support: DIDIT or MANUAL.';
comment on column public.profiles.identity_verification_consent is 'Whether identity verification consent was accepted during registration.';
comment on column public.profiles.data_privacy_consent is 'Whether RA 10173 data privacy terms were accepted during registration.';
comment on column public.manual_identity_reviews.id_number is 'ID number supplied for restricted administrator identity review.';
