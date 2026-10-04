-- Version 2 registrations are account-owned. Existing reviewed accounts are untouched.
create table public.account_registrations (
  user_id uuid primary key references auth.users(id) on delete cascade,
  terms_accepted_at timestamptz not null default now(),
  pending_nonce_hash text not null,
  pending_expires_at timestamptz not null default now() + interval '24 hours',
  email_sent_at timestamptz,
  identity_consent_at timestamptz,
  current_session_id text,
  creation_lease uuid,
  creation_started_at timestamptz,
  provider_status text not null default 'UNVERIFIED',
  source_legal_name text,
  document_type text,
  requested_legal_name text,
  name_issue text,
  name_confirmed_at timestamptz,
  reviewed_legal_name text,
  provider_setup_completed_at timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.account_registrations enable row level security;
revoke all on public.account_registrations from anon, authenticated;
grant all on public.account_registrations to service_role;

create table public.identity_name_actions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  actor_id uuid not null,
  operation_id uuid unique,
  action text not null check(action in ('CONFIRMED','CORRECTION_REQUESTED','REVIEWED')),
  source_name text,
  requested_name text,
  reviewed_name text,
  created_at timestamptz not null default now()
);
alter table public.identity_name_actions enable row level security;
revoke all on public.identity_name_actions from anon, authenticated;
grant select, insert on public.identity_name_actions to service_role;
create trigger immutable_identity_name_actions before update or delete on public.identity_name_actions
for each row execute function public.prevent_identity_audit_change();

create function public.initialize_account_registration(p_user_id uuid, p_nonce_hash text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.role() <> 'service_role' then raise exception 'Service access required' using errcode='42501'; end if;
  insert into public.account_registrations(user_id,pending_nonce_hash) values(p_user_id,p_nonce_hash);
  insert into public.profiles(user_id,email,full_name,role,is_client,is_worker,identity_role,
    identity_required,verification_status,is_verified)
  select id,email,'','client',true,false,'fan',true,'UNVERIFIED',false from auth.users where id=p_user_id
  on conflict(user_id) do update set full_name='',first_name=null,middle_name=null,last_name=null,
    role='client',is_client=true,is_worker=false,identity_role='fan',identity_required=true,
    verification_status='UNVERIFIED',is_verified=false;
end; $$;

create function public.claim_account_identity_session(p_user_id uuid, p_lease uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_row public.account_registrations%rowtype;
begin
  if auth.role() <> 'service_role' then raise exception 'Service access required' using errcode='42501'; end if;
  select * into v_row from public.account_registrations where user_id=p_user_id for update;
  if not found or not exists(select 1 from auth.users where id=p_user_id and email_confirmed_at is not null)
    or not exists(select 1 from public.profiles where user_id=p_user_id and account_status='active') then
    raise exception 'Confirm your email before identity verification' using errcode='42501'; end if;
  if v_row.provider_status in ('APPROVED','PENDING_REVIEW') or
    (v_row.creation_started_at > now()-interval '2 minutes') or
    (v_row.current_session_id is not null and v_row.provider_status='PENDING') then return false; end if;
  update public.verification_sessions set status='SUPERSEDED' where session_ref=v_row.current_session_id;
  update public.account_registrations set creation_lease=p_lease,creation_started_at=now(),
    identity_consent_at=now() where user_id=p_user_id;
  return true;
end; $$;

create function public.attach_account_identity_session(p_user_id uuid,p_lease uuid,p_session_id text,p_url text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.role() <> 'service_role' then raise exception 'Service access required' using errcode='42501'; end if;
  perform 1 from public.account_registrations where user_id=p_user_id and creation_lease=p_lease for update;
  if not found then raise exception 'Session creation lease expired' using errcode='23514'; end if;
  insert into public.verification_sessions(user_id,session_ref,status,verification_data)
  values(p_user_id,p_session_id,'PENDING',jsonb_build_object('session_url',p_url,'registration_version',2));
  update public.account_registrations set current_session_id=p_session_id,provider_status='PENDING',
    source_legal_name=null,requested_legal_name=null,name_issue=null,name_confirmed_at=null,
    reviewed_legal_name=null,creation_lease=null,creation_started_at=null,updated_at=now() where user_id=p_user_id;
  update public.profiles set didit_session_id=p_session_id,verification_status='PENDING',is_verified=false,
    id_document_expiry=null,updated_at=now() where user_id=p_user_id;
end; $$;

-- Keep the legacy event implementation for existing accounts and unfinished V1 sessions.
alter function public.apply_didit_identity_event(text,text,text,text,jsonb,jsonb,text)
rename to apply_legacy_didit_identity_event;
create function public.apply_didit_identity_event(p_event_key text,p_payload_hash text,p_session_id text,
  p_status text,p_payload jsonb,p_document jsonb,p_fingerprint text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_session public.verification_sessions%rowtype;
  v_row public.account_registrations%rowtype;
  v_status text:=p_status;
  v_name text:=nullif(btrim(p_document->>'fullName'),'');
  v_issue text;
  v_result jsonb;
begin
  if auth.role() <> 'service_role' then raise exception 'Service access required' using errcode='42501'; end if;
  select * into v_session from public.verification_sessions where session_ref=p_session_id for update;
  select * into v_row from public.account_registrations where user_id=v_session.user_id for update;
  if not found then return public.apply_legacy_didit_identity_event(p_event_key,p_payload_hash,p_session_id,
    p_status,p_payload,p_document,p_fingerprint); end if;
  if exists(select 1 from public.didit_webhook_events where event_key=p_event_key) then
    return jsonb_build_object('received',true,'duplicate',true); end if;
  if v_session.status='SUPERSEDED' or v_row.current_session_id is distinct from p_session_id or
    coalesce((p_payload->>'created_at')::bigint,(p_payload->>'timestamp')::bigint,0) <
    coalesce((v_session.verification_data->>'didit_event_created_at')::bigint,0) then
    return public.apply_legacy_didit_identity_event(p_event_key,p_payload_hash,p_session_id,
      p_status,p_payload,p_document,p_fingerprint); end if;
  if p_fingerprint is not null then
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_fingerprint,0));
    if exists(select 1 from public.identity_document_claims where document_fingerprint=p_fingerprint
      and user_id is distinct from v_row.user_id and status in ('APPROVED','PENDING_REVIEW')) then
      v_issue:='Another account has a matching identity document.'; end if;
  end if;
  if p_status='APPROVED' then
    if v_name is null or p_document->>'nameAmbiguous'='true' or nullif(p_document->>'documentType','') is null then
      v_issue:=coalesce(v_issue,'The verified name or document type needs human review.');
    elsif v_row.name_confirmed_at is not null and v_name is distinct from v_row.source_legal_name then
      v_issue:='The provider reported a different name after confirmation.';
    end if;
    if v_issue is not null or v_row.name_issue is not null or
      exists(select 1 from public.manual_identity_reviews where user_id=v_row.user_id and
        didit_session_id=p_session_id and status='PENDING_REVIEW') then v_status:='PENDING_REVIEW';
    elsif v_row.name_confirmed_at is null then v_status:='PENDING'; end if;
  end if;
  v_result:=public.apply_legacy_didit_identity_event(p_event_key,p_payload_hash,p_session_id,
    v_status,p_payload,p_document,p_fingerprint);
  update public.account_registrations set provider_status=p_status,
    source_legal_name=coalesce(v_name,source_legal_name),document_type=coalesce(nullif(p_document->>'documentType',''),document_type),
    name_issue=coalesce(v_issue,name_issue),updated_at=now() where user_id=v_row.user_id;
  return v_result;
end; $$;

create function public.confirm_account_identity_name(p_user_id uuid,p_requested_name text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare v_row public.account_registrations%rowtype; v_session public.verification_sessions%rowtype;
begin
  if auth.role() <> 'service_role' then raise exception 'Service access required' using errcode='42501'; end if;
  -- The session lock precedes account/profile locks, matching webhook ordering.
  select s.* into v_session from public.verification_sessions s join public.account_registrations r
    on r.current_session_id=s.session_ref where r.user_id=p_user_id for update of s;
  select * into v_row from public.account_registrations where user_id=p_user_id for update;
  if not exists(select 1 from auth.users where id=p_user_id and email_confirmed_at is not null) or
    not exists(select 1 from public.profiles where user_id=p_user_id and account_status='active') then
    raise exception 'Account access denied' using errcode='42501'; end if;
  if v_row.name_confirmed_at is not null then return; end if;
  if p_requested_name is not null then
    if char_length(btrim(p_requested_name)) not between 2 and 200 then
      raise exception 'Provide the requested legal name' using errcode='22023'; end if;
    if v_row.provider_status not in ('APPROVED','PENDING_REVIEW') then
      raise exception 'Wait for the verification result' using errcode='23514'; end if;
    update public.account_registrations set requested_legal_name=btrim(p_requested_name),
      name_issue='The applicant requested a legal-name correction.' where user_id=p_user_id;
    insert into public.identity_name_actions(user_id,actor_id,action,source_name,requested_name)
    values(p_user_id,p_user_id,'CORRECTION_REQUESTED',v_row.source_legal_name,btrim(p_requested_name));
    perform public.apply_didit_identity_event('correction:'||gen_random_uuid()::text,'',v_row.current_session_id,
      'PENDING_REVIEW',jsonb_build_object('timestamp',extract(epoch from now())::bigint),
      jsonb_build_object('fullName',v_row.source_legal_name,'documentType',v_row.document_type),null);
    return;
  end if;
  if v_row.provider_status <> 'APPROVED' or v_row.source_legal_name is null or v_row.name_issue is not null
    or v_session.status <> 'PENDING' then raise exception 'This identity needs review' using errcode='23514'; end if;
  if exists(select 1 from public.profiles where user_id=p_user_id and id_document_expiry < current_date) then
    raise exception 'An expired identity cannot be approved' using errcode='23514'; end if;
  update public.account_registrations set name_confirmed_at=now(),updated_at=now() where user_id=p_user_id;
  update public.profiles set full_name=v_row.source_legal_name,first_name=null,middle_name=null,last_name=null,
    verification_status='APPROVED',is_verified=true,id_verified_at=now(),updated_at=now() where user_id=p_user_id;
  update public.verification_sessions set status='APPROVED' where session_ref=v_row.current_session_id;
  update public.identity_document_claims set status='APPROVED',updated_at=now()
    where user_id=p_user_id and didit_session_id=v_row.current_session_id;
  insert into public.identity_name_actions(user_id,actor_id,action,source_name)
  values(p_user_id,p_user_id,'CONFIRMED',v_row.source_legal_name);
end; $$;

-- Every new function above is service-only; authenticated clients use checked Edge handlers.
revoke all on function public.initialize_account_registration(uuid,text),
  public.claim_account_identity_session(uuid,uuid),public.attach_account_identity_session(uuid,uuid,text,text),
  public.confirm_account_identity_name(uuid,text),public.apply_didit_identity_event(text,text,text,text,jsonb,jsonb,text)
  from public,anon,authenticated;
grant execute on function public.initialize_account_registration(uuid,text),
  public.claim_account_identity_session(uuid,uuid),public.attach_account_identity_session(uuid,uuid,text,text),
  public.confirm_account_identity_name(uuid,text),public.apply_didit_identity_event(text,text,text,text,jsonb,jsonb,text)
  to service_role;
