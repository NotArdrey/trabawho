-- Public case progress deliberately excludes private administrative notes.
alter table public.booking_support_cases
  add column refund_requested_at timestamptz,
  add column latest_support_action text,
  add column latest_support_target text,
  add column latest_support_at timestamptz;

create function public.publish_booking_support_progress()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.booking_support_cases set latest_support_action = new.action,
    latest_support_target = new.target_party, latest_support_at = new.created_at
    where id = new.case_id;
  return new;
end;
$$;
create trigger booking_support_publish_progress after insert on public.booking_support_admin_actions
  for each row execute function public.publish_booking_support_progress();
update public.booking_support_cases c set latest_support_action = a.action,
  latest_support_target = a.target_party, latest_support_at = a.created_at
from (select distinct on (case_id) case_id, action, target_party, created_at
  from public.booking_support_admin_actions order by case_id, created_at desc, id desc) a
where a.case_id = c.id;

create table public.booking_refunds (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id),
  case_id uuid not null references public.booking_support_cases(id),
  payment_attempt_id uuid not null unique references public.payment_attempts(id),
  amount numeric(12,2) not null check (amount > 0),
  currency text not null default 'PHP' check (currency = 'PHP'),
  status text not null default 'approved' check (status in
    ('approved', 'processing', 'pending', 'succeeded', 'failed', 'needs_review')),
  provider_refund_id text unique,
  approved_by uuid not null references auth.users(id),
  reason text not null check (length(trim(reason)) >= 20),
  submitted_at timestamptz,
  lease_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.booking_refunds enable row level security;
create policy booking_refunds_read on public.booking_refunds for select to authenticated
using (public.is_current_user_admin() or exists (select 1 from public.bookings b
  where b.id = booking_id and auth.uid() in (b.buyer_id, b.seller_id)));
revoke all on public.booking_refunds from anon, authenticated;
-- Reasons and approval identity stay private even for participants.
grant select (id, booking_id, case_id, payment_attempt_id, amount, currency, status,
  provider_refund_id, created_at, updated_at) on public.booking_refunds to authenticated;
grant all on public.booking_refunds to service_role;

create function public.request_booking_case_refund(p_case_id uuid)
returns public.booking_support_cases language plpgsql security definer set search_path = public as $$
declare v_case public.booking_support_cases%rowtype; v_booking public.bookings%rowtype;
begin
  select * into v_case from public.booking_support_cases where id = p_case_id for update;
  select * into v_booking from public.bookings where id = v_case.booking_id;
  if auth.uid() is null or auth.uid() is distinct from v_booking.buyer_id then
    raise exception 'Only the client may request refund review' using errcode = '42501'; end if;
  if v_case.refund_requested_at is not null then return v_case; end if;
  if v_case.status = 'closed' or not exists (select 1 from public.payment_attempts
    where booking_id = v_booking.id and status in ('paid', 'late_paid') and payment_id is not null) then
    raise exception 'An open case and verified payment are required' using errcode = '23514'; end if;
  update public.booking_support_cases set refund_requested_at = now(), status = 'under_review'
    where id = p_case_id returning * into v_case;
  insert into public.booking_audit_events(booking_id, event_type, actor_id, actor_role, idempotency_key, event_data)
    values (v_booking.id, 'refund_review_requested', auth.uid(), 'buyer', 'refund-review:' || p_case_id,
      jsonb_build_object('case_id', p_case_id));
  return v_case;
end;
$$;

create function public.approve_booking_case_refund(p_case_id uuid, p_reason text, p_expected_amount numeric)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_case public.booking_support_cases%rowtype; v_booking public.bookings%rowtype; v_amount numeric(12,2);
begin
  if auth.uid() is null or not public.is_current_user_admin() then
    raise exception 'Administrator access required' using errcode = '42501'; end if;
  if length(trim(coalesce(p_reason, ''))) < 20 then
    raise exception 'Approval reason required' using errcode = '22023'; end if;
  select * into v_case from public.booking_support_cases where id = p_case_id for update;
  if not found then raise exception 'Case not found' using errcode = 'P0002'; end if;
  select * into v_booking from public.bookings where id = v_case.booking_id for update;
  if exists (select 1 from public.booking_refunds where booking_id = v_booking.id)
    and not exists (select 1 from public.payment_attempts a where a.booking_id = v_booking.id
      and a.status in ('paid', 'late_paid') and a.payment_id is not null
      and not exists (select 1 from public.booking_refunds r where r.payment_attempt_id = a.id)) then
    return jsonb_build_object('bookingId', v_booking.id); end if;
  if v_case.status = 'closed' or not exists (select 1 from public.payment_attempts
    where booking_id = v_booking.id and status in ('paid', 'late_paid') and payment_id is not null) then
    raise exception 'An open case and verified payment are required' using errcode = '23514'; end if;
  select sum(a.amount) into v_amount from public.payment_attempts a where a.booking_id = v_booking.id
    and a.status in ('paid', 'late_paid') and a.payment_id is not null
    and not exists (select 1 from public.booking_refunds r where r.payment_attempt_id = a.id);
  if v_amount is null or v_amount is distinct from p_expected_amount then
    raise exception 'Refund amount changed; review the current payments' using errcode = '23514'; end if;
  insert into public.booking_refunds(booking_id, case_id, payment_attempt_id, amount, approved_by, reason)
    select v_booking.id, v_case.id, id, amount, auth.uid(), trim(p_reason)
    from public.payment_attempts where booking_id = v_booking.id
      and status in ('paid', 'late_paid') and payment_id is not null
      and not exists (select 1 from public.booking_refunds r where r.payment_attempt_id = payment_attempts.id);
  perform set_config('app.booking_workflow_rpc', 'on', true);
  update public.bookings set payment_status = 'refund_pending', dispute_status = 'open'
    where id = v_booking.id;
  update public.booking_support_cases set status = 'under_review' where id = p_case_id;
  insert into public.booking_audit_events(booking_id, event_type, actor_id, actor_role, reason, idempotency_key, event_data)
    values (v_booking.id, 'refund_approved', auth.uid(), 'admin', 'Full refund approved after support review.', 'refund-approve:' || p_case_id,
      jsonb_build_object('case_id', p_case_id)) on conflict do nothing;
  return jsonb_build_object('bookingId', v_booking.id);
end;
$$;

-- Serialize external submissions; uncertain requests retain their provider key.
create function public.claim_booking_refund(p_refund_id uuid)
returns public.booking_refunds language plpgsql security definer set search_path = public as $$
declare v_refund public.booking_refunds%rowtype;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'Payment server required' using errcode = '42501'; end if;
  select * into v_refund from public.booking_refunds where id = p_refund_id for update;
  if not found or v_refund.status in ('succeeded', 'failed', 'needs_review')
    or v_refund.lease_until > now() then return null; end if;
  if v_refund.provider_refund_id is null and v_refund.submitted_at < now() - interval '23 hours' then
    update public.booking_refunds set status = 'needs_review', updated_at = now() where id = p_refund_id;
    return null;
  end if;
  update public.booking_refunds set status = 'processing', lease_until = now() + interval '60 seconds',
    submitted_at = coalesce(submitted_at, now()), updated_at = now()
    where id = p_refund_id returning * into v_refund;
  return v_refund;
end;
$$;

create function public.record_booking_refund(p_refund_id uuid, p_provider_refund_id text,
  p_payment_id text, p_amount numeric, p_currency text, p_livemode boolean, p_status text)
returns void language plpgsql security definer set search_path = public as $$
declare v_refund public.booking_refunds%rowtype; v_attempt public.payment_attempts%rowtype;
  v_booking public.bookings%rowtype;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'Payment server required' using errcode = '42501'; end if;
  -- All money transitions lock the booking before their child records.
  select b.* into v_booking from public.bookings b join public.booking_refunds r on r.booking_id = b.id
    where r.id = p_refund_id for update of b;
  select * into v_refund from public.booking_refunds where id = p_refund_id for update;
  select * into v_attempt from public.payment_attempts where id = v_refund.payment_attempt_id for update;
  if v_refund.id is null or nullif(trim(p_provider_refund_id), '') is null
    or p_payment_id is distinct from v_attempt.payment_id or p_amount is distinct from v_refund.amount
    or p_currency is distinct from v_refund.currency or p_livemode is distinct from (v_attempt.environment = 'live')
    or p_status is null or p_status not in ('pending', 'processing', 'succeeded', 'failed')
    or (v_refund.provider_refund_id is not null and v_refund.provider_refund_id <> p_provider_refund_id) then
    raise exception 'Refund verification mismatch' using errcode = '23514'; end if;
  if v_refund.status = 'succeeded' then return; end if;
  update public.booking_refunds set provider_refund_id = p_provider_refund_id, status = p_status,
    lease_until = null, updated_at = now() where id = p_refund_id;
  insert into public.booking_audit_events(booking_id, event_type, actor_role, idempotency_key, event_data)
    values (v_refund.booking_id, 'refund_' || p_status, 'system', p_provider_refund_id || ':' || p_status,
      jsonb_build_object('refund_id', p_refund_id, 'amount', p_amount)) on conflict do nothing;
  if p_status = 'succeeded' then
    update public.payment_attempts set status = 'refunded' where id = v_attempt.id;
    if not exists (select 1 from public.booking_refunds where booking_id = v_booking.id and status <> 'succeeded')
      and not exists (select 1 from public.payment_attempts where booking_id = v_booking.id and status in ('paid', 'late_paid')) then
      perform set_config('app.booking_workflow_rpc', 'on', true);
      perform set_config('app.verified_booking_refund', 'on', true);
      update public.bookings set status = 'refunded', payment_status = 'refunded', dispute_status = 'closed',
        schedule_status = 'released', hold_expires_at = null,
        metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('ui_status', 'Refunded', 'can_rate', false)
        where id = v_booking.id;
      update public.booking_support_cases set status = 'closed', closed_at = now() where booking_id = v_booking.id and status <> 'closed';
    end if;
  end if;
end;
$$;

revoke all on function public.request_booking_case_refund(uuid) from public;
revoke all on function public.approve_booking_case_refund(uuid, text, numeric) from public;
revoke all on function public.claim_booking_refund(uuid) from public;
revoke all on function public.record_booking_refund(uuid, text, text, numeric, text, boolean, text) from public;
grant execute on function public.request_booking_case_refund(uuid) to authenticated;
grant execute on function public.approve_booking_case_refund(uuid, text, numeric) to authenticated;
grant execute on function public.claim_booking_refund(uuid) to service_role;
grant execute on function public.record_booking_refund(uuid, text, text, numeric, text, boolean, text) to service_role;
