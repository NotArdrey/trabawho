-- Account -> Name -> Identity. Pending access is validated in Edge handlers.
-- Existing roles, duplicate checks, review decisions, and marketplace gates remain.

create or replace function public.claim_account_identity_session(p_user_id uuid,p_lease uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_row public.account_registrations%rowtype; v_profile public.profiles%rowtype; v_previous text;
begin
  if auth.role()<>'service_role' then raise exception 'Service access required' using errcode='42501'; end if;
  select current_session_id into v_previous from public.account_registrations where user_id=p_user_id;
  perform 1 from public.verification_sessions where session_ref=v_previous for update;
  select * into v_row from public.account_registrations where user_id=p_user_id for update;
  select * into v_profile from public.profiles where user_id=p_user_id for update;
  if v_row.user_id is null or v_profile.account_status is distinct from 'active' or not exists(
    select 1 from auth.users where id=p_user_id) then
    raise exception 'Account access denied' using errcode='42501'; end if;
  if v_row.current_session_id is distinct from v_previous then return false; end if;
  if v_profile.verification_status='PENDING_REVIEW' or
    (v_profile.verification_status='APPROVED' and (v_profile.id_document_expiry is null or v_profile.id_document_expiry>=current_date)) or
    v_row.creation_started_at>now()-interval '2 minutes' or
    (v_row.current_session_id is not null and v_profile.verification_status='PENDING' and v_row.provider_status='PENDING'
      and (v_profile.id_document_expiry is null or v_profile.id_document_expiry>=current_date)) then return false; end if;
  update public.verification_sessions set status='SUPERSEDED' where session_ref=v_previous;
  update public.account_registrations set creation_lease=p_lease,creation_started_at=now(),identity_consent_at=now()
    where user_id=p_user_id;
  return true;
end; $$;

create or replace function public.submit_account_manual_review(p_user_id uuid,p_document jsonb,p_fingerprint text,p_evidence jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_row public.account_registrations%rowtype; v_review uuid; v_email text; v_count integer; v_role text; v_identity text;
begin
  if auth.role()<>'service_role' then raise exception 'Service access required' using errcode='42501'; end if;
  select * into v_row from public.account_registrations where user_id=p_user_id for update;
  v_role:=v_row.account_role;
  v_identity:=case when v_role='worker' then 'musician' else 'fan' end;
  select email into v_email from auth.users where id=p_user_id;
  if v_email is null or v_row.user_id is null or not exists(select 1 from public.profiles where user_id=p_user_id and account_status='active') or
    exists(select 1 from public.profiles where user_id=p_user_id and
      (account_status<>'active' or verification_status='PENDING_REVIEW' or
        ((id_document_expiry is null or id_document_expiry>=current_date) and
          (verification_status='APPROVED' or (verification_status='PENDING' and v_row.provider_status='APPROVED'))))) then
    raise exception 'This account cannot submit another review' using errcode='23514'; end if;
  if nullif(btrim(p_document->>'fullName'),'') is null or nullif(p_document->>'documentType','') is null or
    nullif(p_evidence->>'front','') is null or nullif(p_evidence->>'back','') is null or nullif(p_evidence->>'selfie','') is null then
    raise exception 'Complete the identity evidence' using errcode='22023'; end if;
  if p_fingerprint is not null then perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_fingerprint,0)); end if;
  select count(*) into v_count from public.identity_document_claims where document_fingerprint=p_fingerprint
    and role=v_identity and user_id is distinct from p_user_id and status in ('APPROVED','PENDING_REVIEW');
  update public.verification_sessions set status='SUPERSEDED' where session_ref=v_row.current_session_id;
  insert into public.manual_identity_reviews(user_id,submitted_by_email,submitted_role,submitted_app_role,
    document_type,document_type_key,source,front_image_path,back_image_path,selfie_image_path,
    document_fingerprint,duplicate_match_count,duplicate_reason,metadata,verified_full_legal_name)
  values(p_user_id,v_email,v_identity,v_role,p_document->>'documentType',p_document->>'documentType','MANUAL_UPLOAD',
    p_evidence->>'front',p_evidence->>'back',p_evidence->>'selfie',p_fingerprint,v_count,
    case when v_count>0 then 'Another account has a matching identity document.' end,
    jsonb_build_object('registration_version',2,'submitted_name',p_document->>'fullName'),null) returning id into v_review;
  insert into public.identity_document_claims(user_id,original_user_id,role,app_role,document_fingerprint,
    document_type,source,status,manual_review_id,normalized_email)
  values(p_user_id,p_user_id,v_identity,v_role,p_fingerprint,p_document->>'documentType','MANUAL_UPLOAD','PENDING_REVIEW',v_review,lower(v_email));
  update public.account_registrations set current_session_id=null,provider_status='PENDING_REVIEW',creation_lease=null,creation_started_at=null,
    requested_legal_name=p_document->>'fullName',source_legal_name=null,name_confirmed_at=null,reviewed_legal_name=null,name_issue='Manual document evidence requires human review.',
    document_type=p_document->>'documentType',identity_consent_at=now(),updated_at=now() where user_id=p_user_id;
  update public.profiles set verification_status='PENDING_REVIEW',is_verified=false,didit_session_id=null,
    id_document_expiry=nullif(p_document->>'expiry','')::date,updated_at=now() where user_id=p_user_id;
  return v_review;
end; $$;

create or replace function public.confirm_account_identity_name(p_user_id uuid,p_requested_name text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare v_row public.account_registrations%rowtype; v_session public.verification_sessions%rowtype;
begin
  if auth.role() <> 'service_role' then raise exception 'Service access required' using errcode='42501'; end if;
  -- The session lock precedes account/profile locks, matching webhook ordering.
  select s.* into v_session from public.verification_sessions s join public.account_registrations r
    on r.current_session_id=s.session_ref where r.user_id=p_user_id for update of s;
  select * into v_row from public.account_registrations where user_id=p_user_id for update;
  if not exists(select 1 from auth.users where id=p_user_id) or
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
    update public.account_registrations set provider_status=v_row.provider_status where user_id=p_user_id;
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

-- Confirm the email atomically with trusted, final identity approval. Marketplace
-- gates still require both approved identity and a confirmed email.
create or replace function public.guard_account_registration_access() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_row public.account_registrations%rowtype;
begin
  select * into v_row from public.account_registrations where user_id=new.user_id;
  if v_row.user_id is not null and (new.is_verified or new.verification_status='APPROVED') then
    if v_row.name_confirmed_at is null and v_row.reviewed_legal_name is null then
      raise exception 'Complete identity verification before account access' using errcode='42501';
    end if;
    if not exists(select 1 from auth.users where id=new.user_id and email_confirmed_at is not null) then
      if auth.role() is distinct from 'service_role' or new.verification_status is distinct from 'APPROVED' or new.account_status is distinct from 'active' or
        (new.id_document_expiry is not null and new.id_document_expiry<current_date) then
        raise exception 'Complete identity verification before account access' using errcode='42501';
      end if;
      update auth.users set email_confirmed_at=now(),confirmation_token='',updated_at=now()
        where id=new.user_id and email_confirmed_at is null;
      new.is_verified:=true;
    end if;
  end if;
  return new;
end; $$;

revoke all on function public.guard_account_registration_access() from public,anon,authenticated;
-- Replacement functions retain their existing service-only execute grants.

-- Recovery must cover the documented seven-day manual review window.
alter table public.account_registrations alter column pending_expires_at set default now()+interval '14 days';
update public.account_registrations set pending_expires_at=greatest(pending_expires_at,now()+interval '14 days')
  where pending_expires_at>now() and not exists(
    select 1 from auth.users where id=user_id and email_confirmed_at is not null);
