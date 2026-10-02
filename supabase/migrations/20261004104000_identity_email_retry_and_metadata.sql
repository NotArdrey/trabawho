-- Explicit admin retries can resend after one minute; approval retries stay idempotent.
create or replace function public.claim_identity_email_delivery(p_review_id uuid, p_resend boolean)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Service access required' using errcode = '42501';
  end if;
  update public.manual_identity_reviews set email_delivery_status = 'sending',
    email_delivery_started_at = now(), email_delivery_error = null, decision_email_sent_at = null
  where id = p_review_id and status = 'APPROVED'
    and (decision_email_sent_at is null or (p_resend and decision_email_sent_at < now() - interval '1 minute'))
    and (email_delivery_status in ('pending','failed','sent') or
      (email_delivery_status = 'sending' and email_delivery_started_at < now() - interval '2 minutes'))
  returning id into v_id;
  return v_id is not null;
end;
$$;
revoke all on function public.claim_identity_email_delivery(uuid,boolean) from public,anon,authenticated;
grant execute on function public.claim_identity_email_delivery(uuid,boolean) to service_role;

-- Trusted access metadata follows profile decisions, including signed Didit expiry.
create or replace function public.sync_identity_access_metadata()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update auth.users set raw_app_meta_data = coalesce(raw_app_meta_data,'{}'::jsonb) ||
    jsonb_build_object('identity_required',new.identity_required,'verification_status',new.verification_status)
  where id=new.user_id;
  return new;
end;
$$;
create trigger sync_identity_access_metadata after update of identity_required,verification_status on public.profiles
for each row when (old.identity_required is distinct from new.identity_required or old.verification_status is distinct from new.verification_status)
execute function public.sync_identity_access_metadata();
