-- Account details are a private draft, not an Auth user. Existing accounts retain
-- their decisions and recovery capabilities. Only V3 requires inbox confirmation.
alter table public.account_registrations add column confirmation_delivery_status text not null default 'pending'
  check (confirmation_delivery_status in ('pending','sent','failed'));
create table public.registration_drafts (
  id uuid primary key,
  email text not null,
  account_role text not null check (account_role in ('client','worker')),
  password_ciphertext text,
  nonce_hash text not null,
  expires_at timestamptz not null default now()+interval '14 days',
  terms_accepted_at timestamptz not null default now(),
  identity_consent_at timestamptz,
  session_id text unique,
  session_url text,
  provider_status text not null default 'UNVERIFIED',
  document jsonb not null default '{}',
  fingerprint text,
  payload jsonb not null default '{}',
  evidence jsonb,
  event_timestamp bigint not null default 0,
  creation_lease uuid,
  creation_started_at timestamptz,
  finalized_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.registration_drafts enable row level security;
revoke all on public.registration_drafts from public,anon,authenticated;
grant all on public.registration_drafts to service_role;

create function public.claim_registration_draft(p_id uuid,p_lease uuid,p_operation text)
returns boolean language plpgsql security definer set search_path='' as $$
declare v public.registration_drafts%rowtype;
begin
  if auth.role()<>'service_role' then raise exception 'Service access required' using errcode='42501'; end if;
  select * into v from public.registration_drafts where id=p_id for update;
  if not found or v.expires_at<now() or v.finalized_at is not null then return false; end if;
  if v.creation_started_at>now()-interval '2 minutes' then return false; end if;
  if p_operation='session' and (v.provider_status in ('APPROVED','PENDING_REVIEW') or
    (v.session_id is not null and v.provider_status='PENDING')) then return false; end if;
  if p_operation='finalize' and v.provider_status not in ('APPROVED','PENDING_REVIEW') then return false; end if;
  if p_operation not in ('session','finalize','manual') then return false; end if;
  update public.registration_drafts set creation_lease=p_lease,creation_started_at=now() where id=p_id;
  return true;
end; $$;

create function public.finalize_registration_draft(p_id uuid,p_lease uuid)
returns void language plpgsql security definer set search_path='' as $$
declare v public.registration_drafts%rowtype; v_role text; v_session_lease uuid:=gen_random_uuid();
begin
  if auth.role()<>'service_role' then raise exception 'Service access required' using errcode='42501'; end if;
  select * into v from public.registration_drafts where id=p_id for update;
  if v.finalized_at is not null then return; end if;
  if v.id is null or v.expires_at<now() or v.creation_lease is distinct from p_lease or
    v.provider_status not in ('APPROVED','PENDING_REVIEW') or not exists(
      select 1 from auth.users where id=p_id and raw_app_meta_data->>'registration_draft_id'=p_id::text) then
    raise exception 'Identity must finish before account creation' using errcode='42501'; end if;
  perform public.initialize_account_registration(p_id,v.nonce_hash);
  update public.account_registrations set terms_accepted_at=v.terms_accepted_at,
    identity_consent_at=v.identity_consent_at,pending_expires_at=v.expires_at where user_id=p_id;
  if v.evidence is not null then
    perform public.submit_account_manual_review(p_id,v.document,v.fingerprint,v.evidence);
  else
    perform public.claim_account_identity_session(p_id,v_session_lease);
    perform public.attach_account_identity_session(p_id,v_session_lease,v.session_id,v.session_url);
    if v.provider_status='APPROVED' then
      update public.account_registrations set name_confirmed_at=now(),source_legal_name=v.document->>'fullName'
        where user_id=p_id;
    end if;
    perform public.apply_didit_identity_event('draft-finalize:'||p_id::text,'trusted-draft',v.session_id,
      v.provider_status,v.payload,v.document,v.fingerprint);
    update public.profiles set full_name=v.document->>'fullName',first_name=null,middle_name=null,last_name=null
      where user_id=p_id and verification_status='APPROVED';
    if exists(select 1 from public.profiles where user_id=p_id and verification_status='APPROVED') then
      insert into public.identity_name_actions(user_id,actor_id,action,source_name)
        values(p_id,p_id,'CONFIRMED',v.document->>'fullName');
    end if;
  end if;
  update public.registration_drafts set finalized_at=now(),password_ciphertext=null,
    creation_lease=null,creation_started_at=null where id=p_id;
end; $$;

-- Approved identity and confirmed email are separate requirements. Preserve V2
-- compatibility, while V3 approval must never confirm an email or issue a session.
create or replace function public.guard_account_registration_access() returns trigger
language plpgsql security definer set search_path='' as $$
declare v_row public.account_registrations%rowtype; v_version integer;
begin
  select * into v_row from public.account_registrations where user_id=new.user_id;
  select coalesce((raw_app_meta_data->>'registration_version')::integer,2) into v_version from auth.users where id=new.user_id;
  if v_row.user_id is not null and (new.is_verified or new.verification_status='APPROVED') then
    if v_row.name_confirmed_at is null and v_row.reviewed_legal_name is null then
      raise exception 'Complete identity verification before account access' using errcode='42501'; end if;
    if v_version<>3 and not exists(select 1 from auth.users where id=new.user_id and email_confirmed_at is not null) then
      if auth.role() is distinct from 'service_role' or new.verification_status is distinct from 'APPROVED' or
        new.account_status is distinct from 'active' or (new.id_document_expiry is not null and new.id_document_expiry<current_date) then
        raise exception 'Complete identity verification before account access' using errcode='42501'; end if;
      update auth.users set email_confirmed_at=now(),confirmation_token='',updated_at=now() where id=new.user_id and email_confirmed_at is null;
      new.is_verified:=true;
    end if;
  end if;
  return new;
end; $$;

revoke all on function public.claim_registration_draft(uuid,uuid,text) from public,anon,authenticated;
revoke all on function public.finalize_registration_draft(uuid,uuid) from public,anon,authenticated;
grant execute on function public.claim_registration_draft(uuid,uuid,text) to service_role;
grant execute on function public.finalize_registration_draft(uuid,uuid) to service_role;
