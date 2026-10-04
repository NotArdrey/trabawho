-- Hosted and manual checks permit one account per identity document and role.
create or replace function public.apply_account_didit_event_before_review_guard(p_event_key text,p_payload_hash text,p_session_id text,
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
      and role=case when v_row.account_role='worker' then 'musician' else 'fan' end
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


-- Retry eligibility follows the local decision and expiry, including admin rejection.
create or replace function public.submit_account_manual_review(p_user_id uuid,p_document jsonb,p_fingerprint text,p_evidence jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_row public.account_registrations%rowtype; v_review uuid; v_email text; v_count integer; v_role text; v_identity text;
begin
  if auth.role()<>'service_role' then raise exception 'Service access required' using errcode='42501'; end if;
  select * into v_row from public.account_registrations where user_id=p_user_id for update;
  v_role:=v_row.account_role;
  v_identity:=case when v_role='worker' then 'musician' else 'fan' end;
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

