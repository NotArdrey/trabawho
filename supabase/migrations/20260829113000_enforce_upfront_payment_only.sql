-- Upfront-only marketplace payments. A pending booking/order is created first,
-- then only a trusted payment-provider callback can mark it paid and confirmed.

-- Convert historical payment-method metadata so no after-service option remains.
-- Do not fabricate payments for unrelated bookings: only showcase seed records
-- are marked paid; other unpaid active records return to payment-pending.
update public.bookings
set
  metadata = (
    coalesce(metadata, '{}'::jsonb)
    - 'after_service_payment_type'
    - 'cash_confirmation_status'
    - 'cash_verifier_qr_id'
    - 'submitted_cash_amount'
    - 'expected_cash_amount'
  ) || jsonb_build_object(
    'payment_method', 'gcash-advance',
    'allow_gcash_advance', true,
    'allow_after_service', false,
    'ui_status', case
      when status = 'completed' then 'Completed Service'
      when status = 'refunded' then 'Refunded'
      when status = 'cancelled' then 'Cancelled'
      when metadata->>'created_via' = 'showcase-role-booking-seed' then coalesce(metadata->>'ui_status', 'Payment Confirmed')
      when payment_status = 'paid' then 'Payment Confirmed'
      else 'Payment Pending'
    end,
    'payment_proof_submitted', case
      when metadata->>'created_via' = 'showcase-role-booking-seed' then true
      else payment_status = 'paid'
    end
  ),
  payment_status = case
    when status = 'refunded' then 'refunded'
    when metadata->>'created_via' = 'showcase-role-booking-seed' then 'paid'
    when payment_status = 'paid' then 'paid'
    else 'pending_provider'
  end,
  payment_reference = case
    when metadata->>'created_via' = 'showcase-role-booking-seed' then coalesce(
      payment_reference,
      'SHOWCASE-PAID-' || upper(substr(replace(id::text, '-', ''), 1, 12))
    )
    else payment_reference
  end,
  cash_collection_status = 'not_applicable',
  status = case
    when status in ('confirmed', 'in_progress')
      and coalesce(metadata->>'created_via', '') <> 'showcase-role-booking-seed'
      and payment_status <> 'paid'
      then 'pending'
    else status
  end,
  updated_at = now();

alter table public.bookings
  drop constraint if exists bookings_upfront_payment_method_check;
alter table public.bookings
  add constraint bookings_upfront_payment_method_check
  check (
    metadata->>'payment_method' is null
    or metadata->>'payment_method' = 'gcash-advance'
  );

create or replace function public.enforce_upfront_booking_payment()
returns trigger language plpgsql set search_path = public as $$
declare
  v_method text := new.metadata->>'payment_method';
  v_controlled boolean := coalesce(current_setting('app.booking_workflow_rpc', true), '') = 'on';
begin
  if v_method is not null and v_method <> 'gcash-advance' then
    raise exception 'Only upfront GCash payment is supported' using errcode = '23514';
  end if;

  if tg_op = 'INSERT' and auth.role() = 'authenticated' and v_method = 'gcash-advance' then
    new.payment_status := 'pending_provider';
    new.payment_reference := null;
    new.status := 'pending';
    new.cash_collection_status := 'not_applicable';
    new.metadata := coalesce(new.metadata, '{}'::jsonb) || jsonb_build_object(
      'allow_gcash_advance', true,
      'allow_after_service', false,
      'ui_status', 'Payment Pending',
      'payment_proof_submitted', false
    );
  end if;

  if tg_op = 'UPDATE'
    and not v_controlled
    and new.status in ('confirmed', 'in_progress', 'completed')
    and new.payment_status <> 'paid'
    and new.status is distinct from old.status then
    raise exception 'Provider-verified upfront payment is required before booking confirmation'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists bookings_enforce_upfront_payment on public.bookings;
create trigger bookings_enforce_upfront_payment
before insert or update on public.bookings
for each row execute function public.enforce_upfront_booking_payment();

create or replace function public.record_booking_online_payment(
  p_booking_id uuid,
  p_external_reference text,
  p_amount numeric,
  p_idempotency_key text
) returns public.bookings
language plpgsql security definer set search_path = public as $$
declare
  v_booking public.bookings%rowtype;
  v_from_status text;
begin
  if auth.role() <> 'service_role' then
    raise exception 'Only the payment server can confirm online payment' using errcode = '42501';
  end if;
  if nullif(trim(p_external_reference), '') is null
    or nullif(trim(p_idempotency_key), '') is null then
    raise exception 'Payment reference and idempotency key required' using errcode = '22023';
  end if;

  select * into v_booking from public.bookings where id = p_booking_id for update;
  if not found then raise exception 'Booking not found' using errcode = 'P0002'; end if;
  if round(coalesce(p_amount, -1), 2) <> v_booking.total_charged_amount then
    raise exception 'Provider amount does not match booking total' using errcode = '23514';
  end if;
  if exists (
    select 1 from public.booking_audit_events
    where booking_id = p_booking_id
      and event_type = 'provider_payment_confirmed'
      and idempotency_key = p_idempotency_key
  ) then return v_booking; end if;

  v_from_status := v_booking.status;
  perform set_config('app.booking_workflow_rpc', 'on', true);
  update public.bookings
  set
    payment_status = 'paid',
    payment_reference = p_external_reference,
    status = 'confirmed',
    metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
      'payment_method', 'gcash-advance',
      'allow_after_service', false,
      'ui_status', 'Payment Confirmed',
      'payment_proof_submitted', true
    )
  where id = p_booking_id
  returning * into v_booking;

  insert into public.booking_audit_events(
    booking_id, event_type, actor_role, idempotency_key,
    from_status, to_status, event_data
  ) values (
    p_booking_id,
    'provider_payment_confirmed',
    'payment_server',
    p_idempotency_key,
    v_from_status,
    'confirmed',
    jsonb_build_object('amount', p_amount, 'reference', p_external_reference)
  );
  return v_booking;
end;
$$;

revoke all on function public.record_booking_online_payment(uuid, text, numeric, text) from public;
grant execute on function public.record_booking_online_payment(uuid, text, numeric, text) to service_role;

with showcase_paid as (
  select id, status, total_charged_amount
  from public.bookings
  where metadata->>'created_via' = 'showcase-role-booking-seed'
)
insert into public.booking_audit_events(
  booking_id, event_type, actor_role, reason, idempotency_key,
  from_status, to_status, event_data
)
select
  id,
  'showcase_upfront_payment_confirmed',
  'system_seed',
  'Verified upfront showcase payment for demonstration',
  'showcase-upfront-paid-v1',
  status,
  status,
  jsonb_build_object('amount', total_charged_amount, 'showcase', true)
from showcase_paid
on conflict do nothing;

-- Workers who already had an older booking may not have received a role-seed
-- record. Give each active worker at least one paid seller-side showcase.
with buyer_pool as (
  select
    p.user_id,
    row_number() over (order by p.created_at, p.user_id) as rn,
    count(*) over () as pool_size
  from public.profiles p
  where lower(coalesce(p.role, '')) = 'client'
),
missing_paid_worker_services as (
  select distinct on (s.seller_id)
    s.id as service_id,
    s.seller_id,
    s.base_price,
    coalesce(s.currency, 'PHP') as currency
  from public.services s
  join public.profiles p on p.user_id = s.seller_id
  where s.active = true
    and lower(coalesce(p.role, '')) = 'worker'
    and not exists (
      select 1 from public.bookings b
      where b.seller_id = s.seller_id and b.payment_status = 'paid'
    )
  order by s.seller_id, s.updated_at desc nulls last, s.id
),
ranked_missing_workers as (
  select m.*, row_number() over (order by m.seller_id) as rn
  from missing_paid_worker_services m
),
inserted_worker_showcase as (
  insert into public.bookings (
    service_id, seller_id, buyer_id, start_ts, end_ts, status,
    total_amount, currency, payment_reference, metadata,
    payment_status, cash_collection_status
  )
  select
    m.service_id,
    m.seller_id,
    bp.user_id,
    now() + ((m.rn + 20) || ' days')::interval,
    now() + ((m.rn + 20) || ' days')::interval + interval '2 hours',
    'confirmed',
    coalesce(m.base_price, 0),
    m.currency,
    'SHOWCASE-PAID-' || upper(substr(replace(m.seller_id::text, '-', ''), 1, 12)),
    jsonb_build_object(
      'showcase_seed_key', 'worker-paid-coverage-' || m.seller_id,
      'created_via', 'showcase-role-booking-seed',
      'ui_status', 'Payment Confirmed',
      'payment_method', 'gcash-advance',
      'allow_gcash_advance', true,
      'allow_after_service', false,
      'quote_approved', true,
      'payment_proof_submitted', true,
      'can_rate', false
    ),
    'paid',
    'not_applicable'
  from ranked_missing_workers m
  join buyer_pool bp on bp.rn = ((m.rn - 1) % bp.pool_size) + 1
  returning id, status, total_charged_amount
)
insert into public.booking_audit_events(
  booking_id, event_type, actor_role, reason, idempotency_key,
  from_status, to_status, event_data
)
select
  id,
  'showcase_upfront_payment_confirmed',
  'system_seed',
  'Paid upfront worker-coverage showcase',
  'worker-paid-coverage-v1',
  status,
  status,
  jsonb_build_object('amount', total_charged_amount, 'showcase', true)
from inserted_worker_showcase
on conflict do nothing;
