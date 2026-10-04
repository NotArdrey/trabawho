-- Retry eligibility follows the local decision and expiry, including admin rejection.
create or replace function public.submit_account_manual_review(p_user_id uuid,p_document jsonb,p_fingerprint text,p_evidence jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_row public.account_registrations%rowtype; v_review uuid; v_email text; v_count integer;
begin
  if auth.role()<>'service_role' then raise exception 'Service access required' using errcode='42501'; end if;
  select * into v_row from public.account_registrations where user_id=p_user_id for update;
  select email into v_email from auth.users where id=p_user_id and email_confirmed_at is not null;
  if v_email is null or v_row.user_id is null or
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
    and user_id is distinct from p_user_id and status in ('APPROVED','PENDING_REVIEW');
  update public.verification_sessions set status='SUPERSEDED' where session_ref=v_row.current_session_id;
  insert into public.manual_identity_reviews(user_id,submitted_by_email,submitted_role,submitted_app_role,
    document_type,document_type_key,source,front_image_path,back_image_path,selfie_image_path,
    document_fingerprint,duplicate_match_count,duplicate_reason,metadata,verified_full_legal_name)
  values(p_user_id,v_email,'fan','client',p_document->>'documentType',p_document->>'documentType','MANUAL_UPLOAD',
    p_evidence->>'front',p_evidence->>'back',p_evidence->>'selfie',p_fingerprint,v_count,
    case when v_count>0 then 'Another account has a matching identity document.' end,
    jsonb_build_object('registration_version',2,'submitted_name',p_document->>'fullName'),null) returning id into v_review;
  insert into public.identity_document_claims(user_id,original_user_id,role,app_role,document_fingerprint,
    document_type,source,status,manual_review_id,normalized_email)
  values(p_user_id,p_user_id,'fan','client',p_fingerprint,p_document->>'documentType','MANUAL_UPLOAD','PENDING_REVIEW',v_review,lower(v_email));
  update public.account_registrations set current_session_id=null,provider_status='PENDING_REVIEW',creation_lease=null,creation_started_at=null,
    requested_legal_name=p_document->>'fullName',source_legal_name=null,name_confirmed_at=null,reviewed_legal_name=null,name_issue='Manual document evidence requires human review.',
    document_type=p_document->>'documentType',identity_consent_at=now(),updated_at=now() where user_id=p_user_id;
  update public.profiles set verification_status='PENDING_REVIEW',is_verified=false,didit_session_id=null,
    id_document_expiry=nullif(p_document->>'expiry','')::date,updated_at=now() where user_id=p_user_id;
  return v_review;
end; $$;

create or replace function public.claim_account_identity_session(p_user_id uuid,p_lease uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_row public.account_registrations%rowtype; v_profile public.profiles%rowtype; v_previous text;
begin
  if auth.role()<>'service_role' then raise exception 'Service access required' using errcode='42501'; end if;
  select current_session_id into v_previous from public.account_registrations where user_id=p_user_id;
  perform 1 from public.verification_sessions where session_ref=v_previous for update;
  select * into v_row from public.account_registrations where user_id=p_user_id for update;
  select * into v_profile from public.profiles where user_id=p_user_id for update;
  if v_row.user_id is null or v_profile.account_status<>'active' or not exists(
    select 1 from auth.users where id=p_user_id and email_confirmed_at is not null) then
    raise exception 'Confirm your email before identity verification' using errcode='42501'; end if;
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
