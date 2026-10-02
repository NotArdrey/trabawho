-- Decisions use a service-only RPC after the Edge Function authenticates the admin.
-- Locking and audit writes are in the same transaction as profile/claim/session updates.
alter table public.manual_identity_reviews add column if not exists email_delivery_status text not null default 'pending';
alter table public.manual_identity_reviews add column if not exists email_delivery_started_at timestamptz;
alter table public.manual_identity_reviews add column if not exists email_delivery_error text;

create table if not exists public.identity_review_actions (
  id uuid primary key default gen_random_uuid(),
  operation_id uuid not null unique,
  review_id uuid not null,
  user_id uuid not null,
  actor_id uuid not null,
  decision text not null check (decision in ('APPROVED', 'DECLINED')),
  reason text not null check (char_length(btrim(reason)) between 20 and 2000),
  created_at timestamptz not null default now()
);
alter table public.identity_review_actions enable row level security;
revoke all on public.identity_review_actions from anon, authenticated;
grant select on public.identity_review_actions to authenticated;
grant select, insert on public.identity_review_actions to service_role;
create policy identity_review_actions_admin_read on public.identity_review_actions
for select to authenticated using (public.is_current_user_admin());

create or replace function public.prevent_identity_audit_change()
returns trigger language plpgsql set search_path = '' as $$
begin
  raise exception 'Identity review history is append-only' using errcode = '42501';
end;
$$;
create trigger identity_review_audit_immutable before update or delete on public.identity_review_actions
for each row execute function public.prevent_identity_audit_change();

create or replace function public.decide_identity_review(
  p_review_id uuid, p_actor_id uuid, p_decision text, p_reason text, p_operation_id uuid
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_review public.manual_identity_reviews%rowtype;
  v_profile public.profiles%rowtype;
  v_existing public.identity_review_actions%rowtype;
  v_confirmed boolean;
begin
  if coalesce(auth.role(), '') <> 'service_role' or not exists (
    select 1 from public.profiles where user_id = p_actor_id and role = 'admin' and account_status = 'active'
  ) then raise exception 'Administrator access required' using errcode = '42501'; end if;
  if p_operation_id is null or p_decision not in ('APPROVED', 'DECLINED') or
    char_length(btrim(coalesce(p_reason, ''))) not between 20 and 2000 then
    raise exception 'Choose a decision and provide a reason of 20 to 2000 characters' using errcode = '22023';
  end if;
  select * into v_review from public.manual_identity_reviews where id = p_review_id for update;
  if not found then raise exception 'Identity review not found' using errcode = 'P0002'; end if;
  select * into v_existing from public.identity_review_actions where operation_id = p_operation_id;
  if found then
    if v_existing.review_id <> p_review_id or v_existing.actor_id <> p_actor_id or
      v_existing.decision <> p_decision or v_existing.reason <> btrim(p_reason) then
      raise exception 'Operation already used for another decision' using errcode = '23505';
    end if;
    return jsonb_build_object('reviewId', v_review.id, 'userId', v_review.user_id,
      'status', v_review.status, 'replayed', true);
  end if;
  if v_review.status <> 'PENDING_REVIEW' then
    raise exception 'This review has already been decided. Refresh the queue' using errcode = '23514';
  end if;
  select * into v_profile from public.profiles where user_id = v_review.user_id for update;
  if not found or v_profile.role = 'admin' or not v_profile.identity_required then
    raise exception 'The account cannot use this review' using errcode = '23514';
  end if;
  if v_profile.verification_status <> 'PENDING_REVIEW' or
    (v_review.didit_session_id is not null and v_review.didit_session_id is distinct from v_profile.didit_session_id) then
    raise exception 'The account has another verification state. Refresh the queue' using errcode = '23514';
  end if;
  if p_decision = 'APPROVED' and v_profile.id_document_expiry < current_date then
    raise exception 'An expired document cannot be approved' using errcode = '23514';
  end if;
  select email_confirmed_at is not null into v_confirmed from auth.users where id = v_review.user_id;
  update public.manual_identity_reviews set status = p_decision, review_notes = btrim(p_reason),
    review_reason = btrim(p_reason), reviewed_by = p_actor_id, reviewed_at = now(),
    email_delivery_status = case when p_decision = 'DECLINED' or v_confirmed then 'not_required' else 'pending' end
  where id = p_review_id;
  update public.profiles set verification_status = p_decision,
    is_verified = p_decision = 'APPROVED' and coalesce(v_confirmed, false),
    id_verified_at = case when p_decision = 'APPROVED' then now() else null end,
    identity_reviewed_at = now(), updated_at = now() where user_id = v_review.user_id;
  update public.identity_document_claims set status = p_decision, updated_at = now(),
    claim_metadata = claim_metadata || jsonb_build_object('reviewed_by', p_actor_id, 'reviewed_at', now())
  where user_id = v_review.user_id and (manual_review_id = p_review_id or
    (v_review.didit_session_id is not null and didit_session_id = v_review.didit_session_id));
  update public.verification_sessions set status = p_decision,
    verification_data = verification_data || jsonb_build_object('admin_decision', p_decision,
      'admin_review_id', p_review_id, 'admin_reviewed_at', now()), updated_at = now()
  where session_ref = v_review.didit_session_id and user_id = v_review.user_id;
  update auth.users set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) ||
    jsonb_build_object('identity_required', true, 'verification_status', p_decision)
  where id = v_review.user_id;
  insert into public.identity_review_actions(operation_id, review_id, user_id, actor_id, decision, reason)
  values (p_operation_id, p_review_id, v_review.user_id, p_actor_id, p_decision, btrim(p_reason));
  return jsonb_build_object('reviewId', p_review_id, 'userId', v_review.user_id, 'status', p_decision, 'replayed', false);
end;
$$;
revoke all on function public.decide_identity_review(uuid, uuid, text, text, uuid) from public, anon, authenticated;
grant execute on function public.decide_identity_review(uuid, uuid, text, text, uuid) to service_role;

-- An email lease prevents concurrent approval retries from issuing duplicate mail.
create or replace function public.claim_identity_confirmation_email(p_review_id uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Service access required' using errcode = '42501';
  end if;
  update public.manual_identity_reviews set email_delivery_status = 'sending',
    email_delivery_started_at = now(), email_delivery_error = null
  where id = p_review_id and status = 'APPROVED' and decision_email_sent_at is null
    and (email_delivery_status in ('pending', 'failed') or
      (email_delivery_status = 'sending' and email_delivery_started_at < now() - interval '2 minutes'))
  returning id into v_id;
  return v_id is not null;
end;
$$;
revoke all on function public.claim_identity_confirmation_email(uuid) from public, anon, authenticated;
grant execute on function public.claim_identity_confirmation_email(uuid) to service_role;

-- Verification flags may only be changed by the identity backend. Existing admin
-- role/access management remains available, but an account cannot self-promote.
create or replace function public.guard_profile_identity_fields()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if coalesce(auth.role(), '') not in ('anon', 'authenticated') then return new; end if;
  if tg_op = 'INSERT' then
    if new.role = 'admin' or new.verification_status <> 'UNVERIFIED' or
      new.is_verified or not new.identity_required then
      raise exception 'Registration must use identity verification' using errcode = '42501';
    end if;
  else
    if row(new.identity_required, new.identity_role, new.is_verified, new.verification_status,
      new.didit_session_id, new.id_document_expiry, new.id_verified_at, new.identity_reviewed_at)
      is distinct from row(old.identity_required, old.identity_role, old.is_verified, old.verification_status,
      old.didit_session_id, old.id_document_expiry, old.id_verified_at, old.identity_reviewed_at) then
      raise exception 'Identity verification is managed by the review service' using errcode = '42501';
    end if;
    if not public.is_current_user_admin() and (new.role = 'admin' or old.role = 'admin' or
      row(new.account_status, new.disabled_reason, new.suspended_reason, new.suspended_until,
        new.disabled_at, new.suspended_at) is distinct from
      row(old.account_status, old.disabled_reason, old.suspended_reason, old.suspended_until, old.disabled_at, old.suspended_at)) then
      raise exception 'Administrator access required' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;
create trigger protect_profile_identity before insert or update on public.profiles
for each row execute function public.guard_profile_identity_fields();

-- Close the gap between auth user creation and the registration function's
-- profile write. Browser signup metadata cannot assert an approved identity.
create or replace function public.require_new_user_identity()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update public.profiles set identity_required = true, is_verified = false,
    verification_status = 'UNVERIFIED', role = case when role = 'worker' then 'worker' else 'client' end
  where user_id = new.id;
  return new;
end;
$$;
create trigger z_require_new_user_identity after insert on auth.users
for each row execute function public.require_new_user_identity();

-- Confirmation is necessary as well as identity approval. It must never clear
-- pending/rejected states or account access restrictions.
create or replace function public.promote_identity_profile_after_email_confirm()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if old.email_confirmed_at is null and new.email_confirmed_at is not null then
    update public.profiles set is_verified = true, updated_at = now()
    where user_id = new.id and identity_required and verification_status = 'APPROVED';
  end if;
  return new;
end;
$$;
