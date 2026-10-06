-- New registrations verify inbox ownership before submitting identity evidence.
-- Keep already-issued V2/V3 recovery capabilities and completed decisions usable.
create function public.require_registration_email(p_user_id uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'Service access required' using errcode='42501'; end if;
  if exists(select 1 from auth.users where id=p_user_id and raw_app_meta_data->>'registration_version'='4') and
    not exists(select 1 from auth.users where id=p_user_id and email_confirmed_at is not null) then
    raise exception 'Confirm your email before identity verification' using errcode='42501'; end if;
end; $$;

alter function public.claim_account_identity_session(uuid,uuid) rename to claim_account_identity_session_before_email_gate;
create function public.claim_account_identity_session(p_user_id uuid,p_lease uuid)
returns boolean language plpgsql security definer set search_path='' as $$
begin
  perform public.require_registration_email(p_user_id);
  return public.claim_account_identity_session_before_email_gate(p_user_id,p_lease);
end; $$;

alter function public.attach_account_identity_session(uuid,uuid,text,text) rename to attach_account_identity_session_before_email_gate;
create function public.attach_account_identity_session(p_user_id uuid,p_lease uuid,p_session_id text,p_url text)
returns void language plpgsql security definer set search_path='' as $$
begin
  perform public.require_registration_email(p_user_id);
  perform public.attach_account_identity_session_before_email_gate(p_user_id,p_lease,p_session_id,p_url);
end; $$;

alter function public.submit_account_manual_review(uuid,jsonb,text,jsonb) rename to submit_account_manual_review_before_email_gate;
create function public.submit_account_manual_review(p_user_id uuid,p_document jsonb,p_fingerprint text,p_evidence jsonb)
returns uuid language plpgsql security definer set search_path='' as $$
begin
  perform public.require_registration_email(p_user_id);
  return public.submit_account_manual_review_before_email_gate(p_user_id,p_document,p_fingerprint,p_evidence);
end; $$;

-- An approved Didit report starts human review for V4. Keep the provider's actual
-- decision and existing event ordering, duplicate checks, and later admin decisions.
alter function public.apply_didit_identity_event(text,text,text,text,jsonb,jsonb,text)
  rename to apply_didit_identity_event_before_email_gate;
create function public.apply_didit_identity_event(p_event_key text,p_payload_hash text,p_session_id text,
  p_status text,p_payload jsonb,p_document jsonb,p_fingerprint text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_session public.verification_sessions%rowtype; v_row public.account_registrations%rowtype;
  v_payload jsonb;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'Service access required' using errcode='42501'; end if;
  v_payload:=public.normalize_didit_event_payload(p_payload);
  select * into v_session from public.verification_sessions where session_ref=p_session_id for update;
  select * into v_row from public.account_registrations where user_id=v_session.user_id for update;
  if v_row.user_id is not null and exists(select 1 from auth.users where id=v_row.user_id and raw_app_meta_data->>'registration_version'='4') then
    perform public.require_registration_email(v_row.user_id);
    if p_status='APPROVED' and v_row.current_session_id=p_session_id and v_session.status<>'SUPERSEDED' and
      v_row.name_confirmed_at is null and v_row.reviewed_legal_name is null and
      not exists(select 1 from public.didit_webhook_events where event_key=p_event_key) and
      (v_payload->>'created_at')::bigint>=coalesce((v_session.verification_data->>'didit_event_created_at')::bigint,0) then
      update public.account_registrations set name_issue=coalesce(name_issue,'Identity evidence requires administrator review.')
        where user_id=v_row.user_id;
    end if;
  end if;
  return public.apply_didit_identity_event_before_email_gate(p_event_key,p_payload_hash,p_session_id,
    p_status,v_payload,p_document,p_fingerprint);
end; $$;

revoke all on function public.require_registration_email(uuid) from public,anon,authenticated;
revoke all on function public.claim_account_identity_session(uuid,uuid) from public,anon,authenticated;
revoke all on function public.attach_account_identity_session(uuid,uuid,text,text) from public,anon,authenticated;
revoke all on function public.submit_account_manual_review(uuid,jsonb,text,jsonb) from public,anon,authenticated;
revoke all on function public.apply_didit_identity_event(text,text,text,text,jsonb,jsonb,text) from public,anon,authenticated;
grant execute on function public.require_registration_email(uuid) to service_role;
grant execute on function public.claim_account_identity_session(uuid,uuid) to service_role;
grant execute on function public.attach_account_identity_session(uuid,uuid,text,text) to service_role;
grant execute on function public.submit_account_manual_review(uuid,jsonb,text,jsonb) to service_role;
grant execute on function public.apply_didit_identity_event(text,text,text,text,jsonb,jsonb,text) to service_role;
