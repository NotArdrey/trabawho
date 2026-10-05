create function public.apply_registration_draft_event(p_event_key text,p_payload_hash text,p_session_id text,
  p_status text,p_payload jsonb,p_document jsonb,p_fingerprint text)
returns uuid language plpgsql security definer set search_path='' as $$
declare v public.registration_drafts%rowtype; v_status text:=p_status;
  v_timestamp bigint:=coalesce((p_payload->>'created_at')::bigint,(p_payload->>'timestamp')::bigint,0);
begin
  if auth.role()<>'service_role' then raise exception 'Service access required' using errcode='42501'; end if;
  select * into v from public.registration_drafts where session_id=p_session_id for update;
  if not found or v.finalized_at is not null then return null; end if;
  if v.expires_at<now() then return v.id; end if;
  if exists(select 1 from public.didit_webhook_events where event_key=p_event_key) then return v.id; end if;
  if p_status not in ('PENDING','PENDING_REVIEW','APPROVED','DECLINED','ABANDONED','EXPIRED') then
    raise exception 'Unsupported status' using errcode='22023'; end if;
  insert into public.didit_webhook_events(event_key,session_id,status,payload_hash)
    values(p_event_key,p_session_id,p_status,p_payload_hash);
  if v_timestamp<v.event_timestamp or (v.provider_status in ('APPROVED','PENDING_REVIEW','DECLINED','EXPIRED','ABANDONED') and p_status='PENDING') then return v.id; end if;
  if p_status='APPROVED' then
    if nullif(p_document->>'expiry','')::date<current_date then v_status:='EXPIRED';
    elsif nullif(btrim(p_document->>'fullName'),'') is null or p_document->>'nameAmbiguous'='true' or
      nullif(p_document->>'documentType','') is null or p_fingerprint is null then v_status:='PENDING_REVIEW';
    elsif exists(select 1 from public.identity_document_claims where document_fingerprint=p_fingerprint
      and role=case when v.account_role='worker' then 'musician' else 'fan' end and status in ('APPROVED','PENDING_REVIEW')) then
      v_status:='PENDING_REVIEW'; end if;
  end if;
  update public.registration_drafts set provider_status=v_status,document=p_document,fingerprint=p_fingerprint,
    payload=p_payload,event_timestamp=v_timestamp where id=v.id;
  return v.id;
end; $$;
revoke all on function public.apply_registration_draft_event(text,text,text,text,jsonb,jsonb,text) from public,anon,authenticated;
grant execute on function public.apply_registration_draft_event(text,text,text,text,jsonb,jsonb,text) to service_role;

-- Confirmation may be sent only for a locally approved identity. Apply this to
-- every account-owned resend/change request, including retries after failures.
alter function public.claim_pending_account_email(uuid,text,text) rename to claim_pending_account_email_before_identity_gate;
create function public.claim_pending_account_email(p_user_id uuid,p_expected_hash text,p_new_email text default null)
returns text language plpgsql security definer set search_path='' as $$
begin
  if auth.role()<>'service_role' then raise exception 'Service access required' using errcode='42501'; end if;
  perform 1 from auth.users where id=p_user_id for update;
  perform 1 from public.account_registrations where user_id=p_user_id for update;
  perform 1 from public.profiles where user_id=p_user_id for update;
  if exists(select 1 from auth.users where id=p_user_id and raw_app_meta_data->>'registration_version'='3') and
    not exists(select 1 from public.profiles where user_id=p_user_id and verification_status='APPROVED'
    and account_status='active' and (id_document_expiry is null or id_document_expiry>=current_date)) then
    raise exception 'Email confirmation is available after identity approval' using errcode='42501'; end if;
  return public.claim_pending_account_email_before_identity_gate(p_user_id,p_expected_hash,p_new_email);
end; $$;
revoke all on function public.claim_pending_account_email(uuid,text,text) from public,anon,authenticated;
grant execute on function public.claim_pending_account_email(uuid,text,text) to service_role;

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
    nullif(p_evidence->>'front','') is null or (nullif(p_evidence->>'back','') is null and coalesce((p_document->>'backNotApplicable')::boolean,false)=false) or nullif(p_evidence->>'selfie','') is null then
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
    jsonb_build_object('registration_version',2,'submitted_name',p_document->>'fullName','back_not_applicable',coalesce((p_document->>'backNotApplicable')::boolean,false)),null) returning id into v_review;
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

