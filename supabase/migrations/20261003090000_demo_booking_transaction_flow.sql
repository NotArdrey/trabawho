-- Demo/test transaction flow. Historical full-payment bookings remain readable.
alter table public.bookings
  add column if not exists balance_due_at timestamptz,
  add column if not exists work_started_at timestamptz,
  add column if not exists warranty_eligible boolean not null default false;

create function public.protect_demo_transaction_fields()
returns trigger language plpgsql set search_path = public as $$
declare v_controlled boolean := coalesce(current_setting('app.booking_workflow_rpc', true), '') = 'on';
begin
  if tg_op = 'UPDATE' and auth.role() = 'authenticated' and not v_controlled and (
    new.balance_due_at is distinct from old.balance_due_at
    or new.work_started_at is distinct from old.work_started_at
    or new.warranty_eligible is distinct from old.warranty_eligible
  ) then raise exception 'Transaction fields require a workflow action' using errcode = '42501'; end if;
  if tg_op = 'UPDATE' and old.work_started_at is not null and (
    new.slot_id is distinct from old.slot_id or new.start_ts is distinct from old.start_ts
  ) then raise exception 'Started work cannot be rescheduled' using errcode = '23514'; end if;
  if tg_op = 'UPDATE' and old.balance_due_at = old.start_ts and new.start_ts is distinct from old.start_ts
    and old.work_started_at is null then new.balance_due_at := new.start_ts; end if;
  if new.balance_due_at is not null then
    if new.status in ('in_progress', 'completed') and (new.payment_status <> 'paid' or new.work_started_at is null) then
      raise exception 'Verified balance and work start are required' using errcode = '23514'; end if;
    if new.status = 'completed' and not exists (
      select 1 from public.booking_delivery_evidence e where e.booking_id = new.id
        and e.schedule_version = new.schedule_version
    ) then raise exception 'Delivery evidence is required for completion' using errcode = '23514'; end if;
  end if;
  if tg_op = 'UPDATE' and coalesce(new.metadata->>'payment_method', '') = 'paymongo-card'
    and (new.status = 'refunded' and old.status <> 'refunded'
      or new.payment_status = 'refunded' and old.payment_status <> 'refunded') then
    raise exception 'A verified provider refund workflow is required' using errcode = '23514';
  end if;
  return new;
end;
$$;
-- Created after the evidence table below; trigger creation follows it.

-- Preserve quote/request behavior while rejecting full initial payment for direct slots.
alter function public.start_booking_checkout(uuid, bigint, bigint, integer, text, text)
  rename to start_booking_checkout_before_deposit_policy;

create function public.start_booking_checkout(
  p_booking_id uuid default null,
  p_service_id bigint default null,
  p_slot_id bigint default null,
  p_quote_version integer default null,
  p_payment_plan text default 'downpayment',
  p_operation_id text default null
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_booking public.bookings%rowtype;
  v_result jsonb;
  v_direct boolean;
begin
  if p_booking_id is not null then
    select * into v_booking from public.bookings where id = p_booking_id;
    if not found then raise exception 'Booking not found' using errcode = 'P0002'; end if;
    v_direct := v_booking.metadata->>'booking_mode' = 'with-slots';
  else
    v_direct := p_slot_id is not null and p_quote_version is null;
  end if;
  if v_direct and p_payment_plan <> 'downpayment' then
    raise exception 'Direct-slot bookings require the 50%% deposit' using errcode = '23514';
  end if;
  if v_direct and v_booking.id is not null and v_booking.amount_paid > 0
    and v_booking.payment_plan <> 'downpayment' then
    raise exception 'Historical full-payment booking has no balance due' using errcode = '23514';
  end if;
  v_result := public.start_booking_checkout_before_deposit_policy(
    p_booking_id, p_service_id, p_slot_id, p_quote_version, p_payment_plan, p_operation_id
  );
  if v_direct then
    update public.bookings b set
      balance_due_at = coalesce(b.balance_due_at, b.start_ts),
      warranty_eligible = coalesce(s.title ~* '(repair|fix|plumb|electrical|installation)', false)
    from public.services s
    where b.id = (v_result->'booking'->>'id')::uuid and s.id = b.service_id
      and b.amount_paid = 0;
  end if;
  return v_result;
end;
$$;
revoke all on function public.start_booking_checkout(uuid, bigint, bigint, integer, text, text) from public;
grant execute on function public.start_booking_checkout(uuid, bigint, bigint, integer, text, text) to authenticated;
revoke all on function public.start_booking_checkout_before_deposit_policy(uuid, bigint, bigint, integer, text, text) from public, anon, authenticated;

create or replace function public.start_booking_work(p_booking_id uuid, p_idempotency_key text)
returns public.bookings language plpgsql security definer set search_path = public as $$
declare v_booking public.bookings%rowtype; v_actor uuid := auth.uid();
begin
  if v_actor is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  if nullif(trim(coalesce(p_idempotency_key, '')), '') is null then raise exception 'Operation ID required' using errcode = '22023'; end if;
  select * into v_booking from public.bookings where id = p_booking_id for update;
  if not found then raise exception 'Booking not found' using errcode = 'P0002'; end if;
  if v_booking.seller_id <> v_actor then raise exception 'Only the provider can start work' using errcode = '42501'; end if;
  if v_booking.work_started_at is not null then return v_booking; end if;
  if v_booking.status <> 'confirmed' or v_booking.schedule_status <> 'confirmed'
    or v_booking.payment_status <> 'paid' or v_booking.dispute_status = 'open'
    or v_booking.cancellation_status <> 'none' then
    raise exception 'Booking is not ready to start' using errcode = '23514';
  end if;
  if v_booking.start_ts is null or now() < v_booking.start_ts - interval '30 minutes' then
    raise exception 'Work can start only within 30 minutes of the appointment' using errcode = '23514';
  end if;
  perform set_config('app.booking_workflow_rpc', 'on', true);
  update public.bookings set status = 'in_progress', work_started_at = now(), updated_at = now()
    where id = p_booking_id returning * into v_booking;
  insert into public.booking_audit_events(booking_id, event_type, actor_id, actor_role, idempotency_key, from_status, to_status)
    values (p_booking_id, 'work_started', v_actor, 'seller', p_idempotency_key, 'confirmed', 'in_progress');
  return v_booking;
end;
$$;
revoke all on function public.start_booking_work(uuid, text) from public;
grant execute on function public.start_booking_work(uuid, text) to authenticated;

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('booking-evidence', 'booking-evidence', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = false, file_size_limit = 5242880,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "Participants read booking evidence" on storage.objects for select to authenticated
using (bucket_id = 'booking-evidence' and exists (
  select 1 from public.bookings b where b.id::text = (storage.foldername(name))[1]
    and (b.buyer_id = auth.uid() or b.seller_id = auth.uid() or public.is_current_user_admin())
));
create policy "Participants upload own booking evidence" on storage.objects for insert to authenticated
with check (bucket_id = 'booking-evidence' and (storage.foldername(name))[2] = auth.uid()::text
  and exists (select 1 from public.bookings b where b.id::text = (storage.foldername(name))[1]
    and (b.buyer_id = auth.uid() or b.seller_id = auth.uid())));

create table public.booking_delivery_evidence (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete restrict,
  schedule_version integer not null,
  provider_id uuid not null references auth.users(id),
  checklist text[] not null,
  explanation text,
  storage_path text,
  created_at timestamptz not null default now(),
  unique (booking_id, schedule_version),
  check (array_length(checklist, 1) >= 2),
  check (length(trim(coalesce(explanation, ''))) >= 20 or storage_path is not null)
);
create trigger bookings_protect_demo_transaction_fields before update on public.bookings
for each row execute function public.protect_demo_transaction_fields();
alter table public.booking_delivery_evidence enable row level security;
create policy booking_delivery_evidence_read on public.booking_delivery_evidence for select to authenticated
using (exists (select 1 from public.bookings b where b.id = booking_id
  and (b.buyer_id = auth.uid() or b.seller_id = auth.uid() or public.is_current_user_admin())));
revoke insert, update, delete on public.booking_delivery_evidence from anon, authenticated;

create function public.save_booking_delivery_evidence(
  p_booking_id uuid, p_checklist text[], p_explanation text, p_storage_path text
) returns public.booking_delivery_evidence language plpgsql security definer set search_path = public as $$
declare v_booking public.bookings%rowtype; v_evidence public.booking_delivery_evidence%rowtype;
begin
  select * into v_booking from public.bookings where id = p_booking_id for update;
  if not found then raise exception 'Booking not found' using errcode = 'P0002'; end if;
  if auth.uid() is distinct from v_booking.seller_id then raise exception 'Only the provider can submit delivery evidence' using errcode = '42501'; end if;
  if v_booking.status <> 'in_progress' or v_booking.work_started_at is null
    or v_booking.payment_status <> 'paid' or v_booking.delivery_status <> 'not_delivered' then
    raise exception 'Booking is not ready for delivery evidence' using errcode = '23514';
  end if;
  if coalesce(array_length(p_checklist, 1), 0) < 2 or exists (
    select 1 from unnest(p_checklist) item where length(trim(coalesce(item, ''))) < 3
  ) then raise exception 'Complete the delivery checklist' using errcode = '22023'; end if;
  if length(trim(coalesce(p_explanation, ''))) < 20 and p_storage_path is null then
    raise exception 'Add a photo or at least 20 characters of explanation' using errcode = '22023';
  end if;
  if p_storage_path is not null and (
    split_part(p_storage_path, '/', 1) <> p_booking_id::text
    or split_part(p_storage_path, '/', 2) <> auth.uid()::text
    or not exists (select 1 from storage.objects where bucket_id = 'booking-evidence' and name = p_storage_path)
  ) then raise exception 'Evidence image was not uploaded' using errcode = '23514'; end if;
  insert into public.booking_delivery_evidence(booking_id, schedule_version, provider_id, checklist, explanation, storage_path)
    values (p_booking_id, v_booking.schedule_version, auth.uid(), p_checklist, nullif(trim(p_explanation), ''), p_storage_path)
    on conflict (booking_id, schedule_version) do nothing returning * into v_evidence;
  if v_evidence.id is null then
    select * into v_evidence from public.booking_delivery_evidence
      where booking_id = p_booking_id and schedule_version = v_booking.schedule_version;
  end if;
  return v_evidence;
end;
$$;
revoke all on function public.save_booking_delivery_evidence(uuid, text[], text, text) from public;
grant execute on function public.save_booking_delivery_evidence(uuid, text[], text, text) to authenticated;

create or replace function public.mark_booking_delivered(p_booking_id uuid, p_idempotency_key text)
returns public.bookings language plpgsql security definer set search_path = public as $$
declare v_booking public.bookings%rowtype; v_actor uuid := auth.uid();
begin
  if v_actor is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  if nullif(trim(coalesce(p_idempotency_key, '')), '') is null then raise exception 'Idempotency key required' using errcode = '22023'; end if;
  select * into v_booking from public.bookings where id = p_booking_id for update;
  if not found then raise exception 'Booking not found' using errcode = 'P0002'; end if;
  if v_booking.seller_id <> v_actor then raise exception 'Only the seller can claim delivery' using errcode = '42501'; end if;
  if exists (select 1 from public.booking_audit_events where booking_id = p_booking_id
    and event_type = 'seller_delivered' and actor_id = v_actor and idempotency_key = p_idempotency_key) then return v_booking; end if;
  if v_booking.status <> 'in_progress' or v_booking.work_started_at is null
    or v_booking.delivery_status <> 'not_delivered' or v_booking.payment_status <> 'paid'
    or v_booking.schedule_status <> 'confirmed' or v_booking.dispute_status = 'open'
    or not exists (select 1 from public.booking_delivery_evidence e where e.booking_id = p_booking_id
      and e.schedule_version = v_booking.schedule_version) then
    raise exception 'Verified payment, work start, and delivery evidence are required' using errcode = '23514';
  end if;
  perform set_config('app.booking_workflow_rpc', 'on', true);
  update public.bookings set delivery_status = 'seller_claimed', delivered_at = now(), delivered_by = v_actor,
    delivered_schedule_version = schedule_version, completion_due_at = now() + interval '72 hours',
    metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('ui_status', 'Service Delivered')
  where id = p_booking_id returning * into v_booking;
  insert into public.booking_audit_events(booking_id, event_type, actor_id, actor_role, idempotency_key, from_status, to_status, event_data)
    values (p_booking_id, 'seller_delivered', v_actor, 'seller', p_idempotency_key, 'in_progress', 'in_progress',
      jsonb_build_object('schedule_version', v_booking.schedule_version));
  return v_booking;
end;
$$;

create table public.booking_support_cases (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete restrict,
  reporter_id uuid not null references auth.users(id),
  case_type text not null check (case_type in ('provider_no_show', 'client_no_show', 'delivery_issue', 'warranty_issue')),
  reason text not null check (length(trim(reason)) >= 20),
  storage_path text,
  status text not null default 'open' check (status in ('open', 'under_review', 'closed')),
  created_at timestamptz not null default now(),
  closed_at timestamptz,
  unique (booking_id, reporter_id, case_type)
);
create index booking_support_cases_open_idx on public.booking_support_cases(status, created_at desc);
alter table public.booking_support_cases enable row level security;
create policy booking_support_cases_read on public.booking_support_cases for select to authenticated
using (public.is_current_user_admin() or exists (
  select 1 from public.bookings b where b.id = booking_id
    and (b.buyer_id = auth.uid() or b.seller_id = auth.uid())
));
revoke insert, update, delete on public.booking_support_cases from anon, authenticated;

create function public.open_booking_support_case(
  p_booking_id uuid, p_case_type text, p_reason text, p_storage_path text, p_idempotency_key text
) returns public.booking_support_cases language plpgsql security definer set search_path = public as $$
declare v_booking public.bookings%rowtype; v_case public.booking_support_cases%rowtype; v_actor uuid := auth.uid();
begin
  if v_actor is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  if nullif(trim(coalesce(p_idempotency_key, '')), '') is null then raise exception 'Operation ID required' using errcode = '22023'; end if;
  if length(trim(coalesce(p_reason, ''))) < 20 then raise exception 'Describe the issue in at least 20 characters' using errcode = '22023'; end if;
  if p_case_type not in ('provider_no_show', 'client_no_show', 'delivery_issue', 'warranty_issue') then
    raise exception 'Unsupported case type' using errcode = '22023'; end if;
  select * into v_booking from public.bookings where id = p_booking_id for update;
  if not found then raise exception 'Booking not found' using errcode = 'P0002'; end if;
  if v_actor not in (v_booking.buyer_id, v_booking.seller_id) then
    raise exception 'Only booking participants can report a case' using errcode = '42501'; end if;
  select * into v_case from public.booking_support_cases
    where booking_id = p_booking_id and reporter_id = v_actor and case_type = p_case_type;
  if found then return v_case; end if;
  if p_case_type = 'provider_no_show' and v_actor <> v_booking.buyer_id
    or p_case_type = 'client_no_show' and v_actor <> v_booking.seller_id then
    raise exception 'Only the affected participant can report this no-show' using errcode = '42501'; end if;
  if p_case_type in ('provider_no_show', 'client_no_show')
    and (v_booking.status not in ('confirmed', 'in_progress')
      or v_booking.start_ts is null or now() < v_booking.start_ts) then
    raise exception 'A no-show can only be reported after the appointment begins' using errcode = '23514'; end if;
  if p_case_type = 'delivery_issue'
    and (v_actor <> v_booking.buyer_id or v_booking.delivery_status <> 'seller_claimed') then
    raise exception 'Only the client can dispute a delivery awaiting confirmation' using errcode = '23514'; end if;
  if p_case_type = 'warranty_issue' and (v_actor <> v_booking.buyer_id
    or v_booking.status <> 'completed' or not v_booking.warranty_eligible
    or v_booking.completed_at is null or now() > v_booking.completed_at + interval '7 days') then
    raise exception 'This booking is outside its repair warranty claim window' using errcode = '23514'; end if;
  if p_storage_path is not null and (
    split_part(p_storage_path, '/', 1) <> p_booking_id::text
    or split_part(p_storage_path, '/', 2) <> v_actor::text
    or not exists (select 1 from storage.objects where bucket_id = 'booking-evidence' and name = p_storage_path)
  ) then raise exception 'Case image was not uploaded' using errcode = '23514'; end if;
  insert into public.booking_support_cases(booking_id, reporter_id, case_type, reason, storage_path)
    values (p_booking_id, v_actor, p_case_type, trim(p_reason), p_storage_path) returning * into v_case;
  perform set_config('app.booking_workflow_rpc', 'on', true);
  update public.bookings set dispute_status = 'open', dispute_opened_at = now(),
    dispute_opened_by = v_actor, dispute_reason = trim(p_reason)
    where id = p_booking_id;
  insert into public.booking_audit_events(booking_id, event_type, actor_id, actor_role, reason, idempotency_key, from_status, to_status, event_data)
    values (p_booking_id, 'support_case_opened', v_actor,
      case when v_actor = v_booking.buyer_id then 'buyer' else 'seller' end,
      trim(p_reason), p_idempotency_key, v_booking.status, v_booking.status,
      jsonb_build_object('case_id', v_case.id, 'case_type', p_case_type));
  return v_case;
end;
$$;
revoke all on function public.open_booking_support_case(uuid, text, text, text, text) from public;
grant execute on function public.open_booking_support_case(uuid, text, text, text, text) to authenticated;

-- Existing scheduler already skips dispute_status='open'; the case RPC above
-- sets that state atomically, so a delivery case pauses the 72-hour timer.
