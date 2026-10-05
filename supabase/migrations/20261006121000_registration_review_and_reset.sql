-- New submissions require human review. Provider decisions never confirm email.
-- Normalize session-report dates before the existing event ordering checks.
create function public.normalize_didit_event_payload(p_payload jsonb)
returns jsonb language plpgsql stable set search_path='' as $$
declare v_value text; v_timestamp bigint:=0;
begin
  v_value:=coalesce(nullif(p_payload->>'timestamp',''),nullif(p_payload->>'created_at',''));
  if v_value ~ '^[0-9]{1,15}$' then
    v_timestamp:=v_value::bigint;
    if v_timestamp>100000000000 then v_timestamp:=v_timestamp/1000; end if;
  elsif v_value ~ '^\d{4}-\d{2}-\d{2}T' then
    begin
      v_timestamp:=extract(epoch from v_value::timestamptz)::bigint;
    exception when invalid_datetime_format or datetime_field_overflow then
      raise exception 'Invalid identity event date' using errcode='22023';
    end;
  end if;
  return coalesce(p_payload,'{}'::jsonb)||jsonb_build_object('created_at',v_timestamp,'timestamp',v_timestamp);
end; $$;
revoke all on function public.normalize_didit_event_payload(jsonb) from public,anon,authenticated;
grant execute on function public.normalize_didit_event_payload(jsonb) to service_role;

alter function public.apply_registration_draft_event(text,text,text,text,jsonb,jsonb,text)
  rename to apply_registration_draft_event_before_reset;
create function public.apply_registration_draft_event(p_event_key text,p_payload_hash text,p_session_id text,
  p_status text,p_payload jsonb,p_document jsonb,p_fingerprint text)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid; v_draft public.registration_drafts%rowtype;
begin
  if auth.role()<>'service_role' then raise exception 'Service access required' using errcode='42501'; end if;
  select * into v_draft from public.registration_drafts where session_id=p_session_id for update;
  if not found or v_draft.expires_at<now() or v_draft.finalized_at is not null then return null; end if;
  v_id:=public.apply_registration_draft_event_before_reset(p_event_key,p_payload_hash,p_session_id,p_status,
    public.normalize_didit_event_payload(p_payload),p_document,p_fingerprint);
  update public.registration_drafts set provider_status='PENDING_REVIEW'
    where id=v_id and provider_status='APPROVED' and finalized_at is null;
  return v_id;
end; $$;
revoke all on function public.apply_registration_draft_event(text,text,text,text,jsonb,jsonb,text) from public,anon,authenticated;
grant execute on function public.apply_registration_draft_event(text,text,text,text,jsonb,jsonb,text) to service_role;

alter function public.apply_didit_identity_event(text,text,text,text,jsonb,jsonb,text)
  rename to apply_didit_identity_event_before_payload_normalization;
create function public.apply_didit_identity_event(p_event_key text,p_payload_hash text,p_session_id text,
  p_status text,p_payload jsonb,p_document jsonb,p_fingerprint text)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
  if auth.role()<>'service_role' then raise exception 'Service access required' using errcode='42501'; end if;
  return public.apply_didit_identity_event_before_payload_normalization(p_event_key,p_payload_hash,p_session_id,
    p_status,public.normalize_didit_event_payload(p_payload),p_document,p_fingerprint);
end; $$;
revoke all on function public.apply_didit_identity_event(text,text,text,text,jsonb,jsonb,text) from public,anon,authenticated;
grant execute on function public.apply_didit_identity_event(text,text,text,text,jsonb,jsonb,text) to service_role;

alter function public.finalize_registration_draft(uuid,uuid) rename to finalize_registration_draft_before_admin_review;
create function public.finalize_registration_draft(p_id uuid,p_lease uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
  if auth.role()<>'service_role' then raise exception 'Service access required' using errcode='42501'; end if;
  perform 1 from public.registration_drafts where id=p_id for update;
  update public.registration_drafts set provider_status='PENDING_REVIEW',
    payload=public.normalize_didit_event_payload(payload)
    where id=p_id and finalized_at is null and provider_status='APPROVED';
  perform public.finalize_registration_draft_before_admin_review(p_id,p_lease);
end; $$;
revoke all on function public.finalize_registration_draft(uuid,uuid) from public,anon,authenticated;
grant execute on function public.finalize_registration_draft(uuid,uuid) to service_role;

create function public.discard_registration_draft(p_id uuid)
returns boolean language plpgsql security definer set search_path='' as $$
begin
  if auth.role()<>'service_role' then raise exception 'Service access required' using errcode='42501'; end if;
  perform 1 from public.registration_drafts where id=p_id for update;
  update public.registration_drafts set provider_status='ABANDONED',expires_at=now()-interval '1 second',
    password_ciphertext=null,creation_lease=null,creation_started_at=null
    where id=p_id and finalized_at is null and provider_status not in ('APPROVED','PENDING_REVIEW');
  return found;
end; $$;
revoke all on function public.discard_registration_draft(uuid) from public,anon,authenticated;
grant execute on function public.discard_registration_draft(uuid) to service_role;

-- Existing confirmed accounts retain access. Every unconfirmed account must
-- follow its inbox link after approval, including older pending registrations.
create or replace function public.guard_account_registration_access() returns trigger
language plpgsql security definer set search_path='' as $$
declare v_row public.account_registrations%rowtype;
begin
  select * into v_row from public.account_registrations where user_id=new.user_id;
  if v_row.user_id is not null and (new.is_verified or new.verification_status='APPROVED') then
    if v_row.name_confirmed_at is null and v_row.reviewed_legal_name is null then
      raise exception 'Complete identity verification before account access' using errcode='42501'; end if;
    if not exists(select 1 from auth.users where id=new.user_id and email_confirmed_at is not null) then
      new.is_verified:=false;
    end if;
  end if;
  return new;
end; $$;
