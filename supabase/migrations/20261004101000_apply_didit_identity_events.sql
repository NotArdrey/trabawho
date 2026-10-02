-- Applying an event and recording its id are atomic: failed writes remain retryable.
create or replace function public.apply_didit_identity_event(
  p_event_key text, p_payload_hash text, p_session_id text, p_status text,
  p_payload jsonb, p_document jsonb, p_fingerprint text
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_session public.verification_sessions%rowtype;
  v_profile public.profiles%rowtype;
  v_user_id uuid;
  v_role text;
  v_duplicate integer := 0;
  v_review_id uuid;
  v_final_status text := p_status;
  v_claim_id uuid;
  v_confirmed boolean;
  v_created bigint := coalesce((p_payload->>'created_at')::bigint, (p_payload->>'timestamp')::bigint);
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Service access required' using errcode = '42501';
  end if;
  if p_status not in ('PENDING', 'PENDING_REVIEW', 'APPROVED', 'DECLINED', 'ABANDONED', 'EXPIRED') then
    raise exception 'Unsupported Didit session status' using errcode = '22023';
  end if;
  select * into v_session from public.verification_sessions where session_ref = p_session_id for update;
  if not found then raise exception 'Unknown verification session; retry delivery' using errcode = 'P0002'; end if;
  if exists(select 1 from public.didit_webhook_events where event_key = p_event_key) then
    return jsonb_build_object('received', true, 'duplicate', true);
  end if;
  insert into public.didit_webhook_events(event_key, session_id, status, payload_hash)
  values(p_event_key, p_session_id, p_status, p_payload_hash);
  if v_created < coalesce((v_session.verification_data->>'didit_event_created_at')::bigint, 0) or
    v_session.status = 'SUPERSEDED' then
    return jsonb_build_object('received', true, 'ignored', true);
  end if;
  -- Signup vendor_data is TEMP. The finalized session association owns updates.
  v_user_id := v_session.user_id;
  if v_user_id is not null then
    select * into v_profile from public.profiles where user_id = v_user_id for update;
    if not found or v_profile.didit_session_id is distinct from p_session_id or v_profile.role = 'admin' then
      v_user_id := null;
    end if;
  end if;
  if v_user_id is not null then
    v_role := coalesce(v_profile.identity_role, case when v_profile.role = 'worker' then 'musician' else 'fan' end);
    if p_fingerprint is not null then
      select count(*) into v_duplicate from public.identity_document_claims
      where document_fingerprint = p_fingerprint and role = v_role and user_id is distinct from v_user_id
        and status in ('APPROVED', 'PENDING_REVIEW');
    end if;
    select id into v_review_id from public.manual_identity_reviews
    where user_id = v_user_id and didit_session_id = p_session_id and status = 'PENDING_REVIEW'
    order by created_at desc limit 1;
    if p_status = 'APPROVED' then
      if v_session.verification_data->>'admin_decision' in ('APPROVED', 'DECLINED') then
        v_final_status := v_session.verification_data->>'admin_decision';
      elsif v_review_id is not null or v_duplicate > 0 then
        v_final_status := 'PENDING_REVIEW';
      end if;
    end if;
    if v_final_status = 'PENDING_REVIEW' then
      if v_review_id is null then
        insert into public.manual_identity_reviews(user_id, submitted_by_email, submitted_role, submitted_app_role,
          document_type, document_type_key, source, didit_session_id, document_fingerprint, metadata,
          duplicate_match_count, duplicate_reason, verified_full_legal_name, normalized_full_legal_name, birth_date)
        values(v_user_id, v_profile.email, v_role, v_profile.role,
          coalesce(nullif(p_document->>'documentType',''), 'Government ID'), nullif(p_document->>'documentType',''),
          case when v_duplicate > 0 then 'DIDIT_DUPLICATE' else 'DIDIT_PENDING' end,
          p_session_id, p_fingerprint, jsonb_build_object('diditWebhook', p_payload), v_duplicate,
          case when v_duplicate > 0 then 'Another account has a matching identity document.' else null end,
          nullif(p_document->>'fullName',''), nullif(p_document->>'normalizedFullName',''), nullif(p_document->>'birthDate','')::date)
        returning id into v_review_id;
      else
        update public.manual_identity_reviews set metadata = metadata || jsonb_build_object('diditWebhook', p_payload)
        where id = v_review_id;
      end if;
    elsif v_final_status in ('DECLINED', 'EXPIRED', 'ABANDONED') then
      update public.manual_identity_reviews set status = 'DECLINED', reviewed_at = now(),
        review_notes = 'Didit reported ' || p_status || '. A new verification is required.',
        email_delivery_status = 'not_required'
      where user_id = v_user_id and didit_session_id = p_session_id and status = 'PENDING_REVIEW';
    end if;
    select email_confirmed_at is not null into v_confirmed from auth.users where id = v_user_id;
    update public.profiles set verification_status = v_final_status,
      is_verified = v_final_status = 'APPROVED' and coalesce(v_confirmed, false),
      id_document_expiry = coalesce(nullif(p_document->>'expiry','')::date, id_document_expiry),
      id_verified_at = case when v_final_status = 'APPROVED' then coalesce(id_verified_at, now()) else null end,
      updated_at = now() where user_id = v_user_id;
    select id into v_claim_id from public.identity_document_claims
    where user_id = v_user_id and role = v_role and (didit_session_id = p_session_id or
      (p_fingerprint is not null and document_fingerprint = p_fingerprint)) order by created_at desc limit 1;
    if v_claim_id is not null then
      update public.identity_document_claims set
        status = case when v_final_status in ('PENDING', 'PENDING_REVIEW') then 'PENDING_REVIEW'
          when v_final_status in ('EXPIRED', 'ABANDONED') then 'REVOKED' else v_final_status end,
        manual_review_id = coalesce(v_review_id, manual_review_id),
        claim_metadata = claim_metadata || jsonb_build_object('diditWebhook', p_payload), updated_at = now()
      where id = v_claim_id;
    else
      insert into public.identity_document_claims(user_id, original_user_id, role, app_role, document_fingerprint,
        document_type, source, status, didit_session_id, manual_review_id, normalized_email, claim_metadata)
      values(v_user_id, v_user_id, v_role, v_profile.role, p_fingerprint, p_document->>'documentType', 'DIDIT',
        case when v_final_status in ('PENDING', 'PENDING_REVIEW') then 'PENDING_REVIEW'
          when v_final_status in ('EXPIRED', 'ABANDONED') then 'REVOKED' else v_final_status end,
        p_session_id, v_review_id, lower(v_profile.email), jsonb_build_object('diditWebhook', p_payload));
    end if;
  end if;
  update public.verification_sessions set status = v_final_status,
    verification_data = verification_data || jsonb_build_object('status', v_final_status,
      'raw_didit_status', p_payload->>'status', 'decision', coalesce(p_payload->'decision', '{}'::jsonb),
      'didit_event_created_at', v_created, 'webhook_received_at', now()), updated_at = now()
  where session_ref = p_session_id;
  return jsonb_build_object('received', true, 'sessionId', p_session_id, 'status', v_final_status);
end;
$$;
revoke all on function public.apply_didit_identity_event(text,text,text,text,jsonb,jsonb,text) from public, anon, authenticated;
grant execute on function public.apply_didit_identity_event(text,text,text,text,jsonb,jsonb,text) to service_role;
