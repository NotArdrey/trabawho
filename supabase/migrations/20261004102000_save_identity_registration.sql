create or replace function public.save_identity_registration(
  p_user_id uuid, p_profile jsonb, p_review jsonb, p_claim jsonb,
  p_session_id text default null, p_session_data jsonb default '{}'::jsonb
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_profile public.profiles%rowtype;
  v_session public.verification_sessions%rowtype;
  v_status text := p_profile->>'verification_status';
  v_review_id uuid;
  v_claim_id uuid;
begin
  if coalesce(auth.role(), '') <> 'service_role' then raise exception 'Service access required' using errcode = '42501'; end if;
  if v_status not in ('APPROVED', 'PENDING_REVIEW') or p_profile->>'role' not in ('client', 'worker') or
    nullif(btrim(p_profile->>'province'),'') is null or nullif(btrim(p_profile->>'city'),'') is null or
    nullif(btrim(p_profile->>'barangay'),'') is null or nullif(btrim(p_profile->>'address'),'') is null then
    raise exception 'Valid registration and address required' using errcode = '22023';
  end if;
  if p_session_id is not null then
    select * into v_session from public.verification_sessions where session_ref = p_session_id for update;
    if not found or v_session.status = 'SUPERSEDED' or
      lower(v_session.verification_data->>'email') is distinct from lower(p_profile->>'email') then
      raise exception 'Session does not match this registration' using errcode = '23514';
    end if;
    if v_session.verification_data ? 'finalized_at' then
      if v_session.user_id is distinct from p_user_id then raise exception 'Session already finalized' using errcode = '23514'; end if;
      return jsonb_build_object('userId', p_user_id, 'identityStatus', v_session.status, 'replayed', true);
    end if;
  end if;
  select * into v_profile from public.profiles where user_id = p_user_id for update;
  if not found or v_profile.role = 'admin' or v_profile.account_status <> 'active' or
    v_profile.verification_status not in ('UNVERIFIED', 'DECLINED', 'ABANDONED', 'EXPIRED', 'SUPERSEDED') then
    raise exception 'Account already registered or unavailable' using errcode = '23514';
  end if;
  update public.profiles set full_name = p_profile->>'full_name', email = lower(p_profile->>'email'),
    role = p_profile->>'role', is_worker = (p_profile->>'role') = 'worker', is_client = true,
    province = p_profile->>'province', city = p_profile->>'city', barangay = p_profile->>'barangay', address = p_profile->>'address',
    identity_required = true, identity_role = p_profile->>'identity_role', verification_status = v_status,
    is_verified = v_status = 'APPROVED' and exists(select 1 from auth.users where id = p_user_id and email_confirmed_at is not null),
    didit_session_id = p_session_id, id_document_expiry = nullif(p_profile->>'id_document_expiry','')::date,
    id_verified_at = case when v_status = 'APPROVED' then now() else null end,
    identity_reviewed_at = null, updated_at = now() where user_id = p_user_id;
  if v_status = 'PENDING_REVIEW' then
    insert into public.manual_identity_reviews(user_id, submitted_by_email, submitted_role, submitted_app_role,
      document_type, document_type_key, source, document_fingerprint, didit_session_id,
      front_image_path, back_image_path, selfie_image_path, duplicate_reason, duplicate_match_count,
      metadata, verified_full_legal_name, normalized_full_legal_name, birth_date)
    values(p_user_id, lower(p_profile->>'email'), p_profile->>'identity_role', p_profile->>'role',
      p_review->>'documentType', p_review->>'documentTypeKey', p_review->>'source',
      p_review->>'documentFingerprint', p_session_id, p_review->>'frontImagePath', p_review->>'backImagePath',
      p_review->>'selfieImagePath', p_review->>'duplicateReason', coalesce((p_review->>'duplicateMatchCount')::integer,0),
      coalesce(p_review->'metadata','{}'::jsonb), p_review->>'verifiedFullLegalName', p_review->>'normalizedFullLegalName',
      nullif(p_review->>'birthDate','')::date) returning id into v_review_id;
  end if;
  select id into v_claim_id from public.identity_document_claims
  where user_id = p_user_id and document_fingerprint = p_claim->>'documentFingerprint' and role = p_profile->>'identity_role'
  limit 1;
  if v_claim_id is null then
    insert into public.identity_document_claims(user_id, original_user_id, role, app_role, document_fingerprint,
      document_type, document_type_key, document_country, source, status, didit_session_id, manual_review_id,
      normalized_email, claim_metadata, verified_full_legal_name, normalized_full_legal_name, birth_date)
    values(p_user_id, p_user_id, p_profile->>'identity_role', p_profile->>'role', p_claim->>'documentFingerprint',
      p_claim->>'documentType', p_claim->>'documentTypeKey', coalesce(p_claim->>'documentCountry','PHL'),
      p_claim->>'source', v_status, p_session_id, v_review_id, lower(p_profile->>'email'),
      coalesce(p_claim->'metadata','{}'::jsonb), p_claim->>'verifiedFullLegalName', p_claim->>'normalizedFullLegalName',
      nullif(p_claim->>'birthDate','')::date);
  else
    update public.identity_document_claims set status = v_status, didit_session_id = p_session_id,
      manual_review_id = v_review_id, claim_metadata = coalesce(p_claim->'metadata','{}'::jsonb), updated_at = now()
    where id = v_claim_id;
  end if;
  if p_session_id is not null then
    update public.verification_sessions set user_id = p_user_id, status = v_status,
      verification_data = verification_data || p_session_data || jsonb_build_object('status', v_status,
        'account_user_id', p_user_id, 'finalized_at', now()), updated_at = now()
    where session_ref = p_session_id;
  end if;
  update auth.users set raw_app_meta_data = coalesce(raw_app_meta_data,'{}'::jsonb) ||
    jsonb_build_object('identity_required',true,'verification_status',v_status) where id = p_user_id;
  return jsonb_build_object('userId',p_user_id,'identityStatus',v_status,'manualReviewId',v_review_id,'replayed',false);
end;
$$;
revoke all on function public.save_identity_registration(uuid,jsonb,jsonb,jsonb,text,jsonb) from public,anon,authenticated;
grant execute on function public.save_identity_registration(uuid,jsonb,jsonb,jsonb,text,jsonb) to service_role;
