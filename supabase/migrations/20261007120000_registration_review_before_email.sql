-- Restore identity capture before inbox confirmation. Preserve completed reviews
-- and existing recovery capabilities; never rewrite previously applied migrations.
drop function public.claim_account_identity_session(uuid,uuid);
alter function public.claim_account_identity_session_before_email_gate(uuid,uuid)
  rename to claim_account_identity_session;
drop function public.attach_account_identity_session(uuid,uuid,text,text);
alter function public.attach_account_identity_session_before_email_gate(uuid,uuid,text,text)
  rename to attach_account_identity_session;
drop function public.submit_account_manual_review(uuid,jsonb,text,jsonb);
alter function public.submit_account_manual_review_before_email_gate(uuid,jsonb,text,jsonb)
  rename to submit_account_manual_review;

-- Accounts created by the preceding rollout still need human review after Didit.
-- New registrations use the maintained encrypted draft flow and its review gate.
create or replace function public.apply_didit_identity_event(p_event_key text,p_payload_hash text,p_session_id text,
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
drop function public.require_registration_email(uuid);

-- Both current draft registrations and existing V4 accounts request confirmation
-- only after approval. Keep nonce, expiry, cooldown, and atomic email-change checks.
create or replace function public.claim_pending_account_email(p_user_id uuid,p_expected_hash text,p_new_email text default null)
returns text language plpgsql security definer set search_path='' as $$
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'Service access required' using errcode='42501'; end if;
  perform 1 from auth.users where id=p_user_id for update;
  perform 1 from public.account_registrations where user_id=p_user_id for update;
  perform 1 from public.profiles where user_id=p_user_id for update;
  if exists(select 1 from auth.users where id=p_user_id and raw_app_meta_data->>'registration_version' in ('3','4')) and
    not exists(select 1 from public.profiles where user_id=p_user_id and verification_status='APPROVED'
      and account_status='active' and (id_document_expiry is null or id_document_expiry>=current_date)) then
    raise exception 'Email confirmation is available after identity approval' using errcode='42501'; end if;
  return public.claim_pending_account_email_before_identity_gate(p_user_id,p_expected_hash,p_new_email);
end; $$;

revoke all on function public.claim_account_identity_session(uuid,uuid) from public,anon,authenticated;
revoke all on function public.attach_account_identity_session(uuid,uuid,text,text) from public,anon,authenticated;
revoke all on function public.submit_account_manual_review(uuid,jsonb,text,jsonb) from public,anon,authenticated;
revoke all on function public.apply_didit_identity_event(text,text,text,text,jsonb,jsonb,text) from public,anon,authenticated;
revoke all on function public.claim_pending_account_email(uuid,text,text) from public,anon,authenticated;
grant execute on function public.claim_account_identity_session(uuid,uuid) to service_role;
grant execute on function public.attach_account_identity_session(uuid,uuid,text,text) to service_role;
grant execute on function public.submit_account_manual_review(uuid,jsonb,text,jsonb) to service_role;
grant execute on function public.apply_didit_identity_event(text,text,text,text,jsonb,jsonb,text) to service_role;
grant execute on function public.claim_pending_account_email(uuid,text,text) to service_role;
