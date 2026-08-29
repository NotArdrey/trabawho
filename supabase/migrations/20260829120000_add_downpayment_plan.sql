-- Add full-payment and 50%-downpayment plans.
-- The full 5% platform fee is collected with the first payment. For a
-- downpayment, the remaining 50% service balance must be paid before completion.

alter table public.bookings
  add column if not exists payment_plan text not null default 'full',
  add column if not exists service_downpayment_amount numeric(12,2) not null default 0,
  add column if not exists upfront_required_amount numeric(12,2) not null default 0,
  add column if not exists amount_paid numeric(12,2) not null default 0,
  add column if not exists balance_due_amount numeric(12,2) not null default 0;

alter table public.bookings
  drop constraint if exists bookings_payment_status_check,
  drop constraint if exists bookings_payment_plan_check,
  drop constraint if exists bookings_payment_amounts_check;

alter table public.bookings
  add constraint bookings_payment_status_check check (
    payment_status in (
      'unpaid', 'pending_provider', 'partially_paid',
      'pending_buyer_acknowledgement', 'paid', 'refunded'
    )
  ),
  add constraint bookings_payment_plan_check
    check (payment_plan in ('full', 'downpayment')),
  add constraint bookings_payment_amounts_check check (
    service_downpayment_amount >= 0
    and upfront_required_amount >= 0
    and amount_paid >= 0
    and balance_due_amount >= 0
    and amount_paid <= total_charged_amount
  );

update public.bookings
set
  payment_plan = 'full',
  service_downpayment_amount = round(coalesce(total_amount, 0) * 0.5, 2),
  upfront_required_amount = total_charged_amount,
  amount_paid = case
    when payment_status in ('paid', 'refunded') then total_charged_amount
    else 0
  end,
  balance_due_amount = case
    when payment_status in ('paid', 'refunded') then 0
    else total_charged_amount
  end,
  metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('payment_plan', 'full');

create or replace function public.calculate_booking_payment_plan_amounts()
returns trigger language plpgsql set search_path = public as $$
begin
  new.service_downpayment_amount := round(coalesce(new.total_amount, 0) * 0.5, 2);
  new.upfront_required_amount := case
    when new.payment_plan = 'downpayment'
      then new.service_downpayment_amount + new.transaction_fee_amount
    else new.total_charged_amount
  end;
  new.balance_due_amount := greatest(
    round(new.total_charged_amount - coalesce(new.amount_paid, 0), 2),
    0
  );
  return new;
end;
$$;

drop trigger if exists bookings_payment_plan_amounts on public.bookings;
create trigger bookings_payment_plan_amounts
before insert or update of total_amount, transaction_fee_amount,
  total_charged_amount, payment_plan, amount_paid
on public.bookings
for each row execute function public.calculate_booking_payment_plan_amounts();

create or replace function public.protect_booking_payment_plan_fields()
returns trigger language plpgsql set search_path = public as $$
declare
  v_controlled boolean := coalesce(current_setting('app.booking_workflow_rpc', true), '') = 'on';
begin
  if auth.role() = 'authenticated' and not v_controlled and (
    new.payment_plan is distinct from old.payment_plan
    or new.service_downpayment_amount is distinct from old.service_downpayment_amount
    or new.upfront_required_amount is distinct from old.upfront_required_amount
    or new.amount_paid is distinct from old.amount_paid
    or new.balance_due_amount is distinct from old.balance_due_amount
  ) then
    raise exception 'Payment plan and installment amounts require a workflow RPC'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists bookings_protect_payment_plan_fields on public.bookings;
create trigger bookings_protect_payment_plan_fields
before update on public.bookings
for each row execute function public.protect_booking_payment_plan_fields();

create or replace function public.enforce_upfront_booking_payment()
returns trigger language plpgsql set search_path = public as $$
declare
  v_method text := new.metadata->>'payment_method';
  v_requested_plan text := coalesce(new.metadata->>'payment_plan', 'full');
  v_controlled boolean := coalesce(current_setting('app.booking_workflow_rpc', true), '') = 'on';
begin
  if v_method is not null and v_method <> 'gcash-advance' then
    raise exception 'Only upfront GCash payment is supported' using errcode = '23514';
  end if;
  if v_requested_plan not in ('full', 'downpayment') then
    raise exception 'Payment plan must be full or downpayment' using errcode = '23514';
  end if;

  if tg_op = 'INSERT' then
    new.payment_plan := v_requested_plan;
  end if;

  if tg_op = 'INSERT' and auth.role() = 'authenticated' and v_method = 'gcash-advance' then
    new.payment_status := 'pending_provider';
    new.payment_reference := null;
    new.amount_paid := 0;
    new.status := 'pending';
    new.cash_collection_status := 'not_applicable';
    new.metadata := coalesce(new.metadata, '{}'::jsonb) || jsonb_build_object(
      'payment_plan', v_requested_plan,
      'allow_gcash_advance', true,
      'allow_after_service', false,
      'ui_status', 'Payment Pending',
      'payment_proof_submitted', false
    );
  end if;

  if tg_op = 'UPDATE'
    and not v_controlled
    and new.status in ('confirmed', 'in_progress', 'completed')
    and new.payment_status not in ('partially_paid', 'paid')
    and new.status is distinct from old.status then
    raise exception 'Provider-verified upfront payment is required before booking confirmation'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

create or replace function public.select_booking_payment_plan(
  p_booking_id uuid,
  p_payment_plan text,
  p_idempotency_key text
) returns public.bookings
language plpgsql security definer set search_path = public as $$
declare
  v_booking public.bookings%rowtype;
  v_actor uuid := auth.uid();
begin
  if v_actor is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  if p_payment_plan not in ('full', 'downpayment') then
    raise exception 'Payment plan must be full or downpayment' using errcode = '22023';
  end if;
  if nullif(trim(p_idempotency_key), '') is null then
    raise exception 'Idempotency key required' using errcode = '22023';
  end if;

  select * into v_booking from public.bookings where id = p_booking_id for update;
  if not found then raise exception 'Booking not found' using errcode = 'P0002'; end if;
  if v_booking.buyer_id <> v_actor then
    raise exception 'Only the buyer can select the payment plan' using errcode = '42501';
  end if;
  if v_booking.amount_paid > 0 or v_booking.payment_status in ('partially_paid', 'paid', 'refunded') then
    raise exception 'Payment plan cannot change after a verified payment' using errcode = '23514';
  end if;
  if exists (
    select 1 from public.booking_audit_events
    where booking_id = p_booking_id
      and event_type = 'payment_plan_selected'
      and actor_id = v_actor
      and idempotency_key = p_idempotency_key
  ) then return v_booking; end if;

  perform set_config('app.booking_workflow_rpc', 'on', true);
  update public.bookings
  set
    payment_plan = p_payment_plan,
    payment_status = 'pending_provider',
    status = 'pending',
    metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
      'payment_method', 'gcash-advance',
      'payment_plan', p_payment_plan,
      'allow_after_service', false,
      'ui_status', 'Payment Pending',
      'payment_proof_submitted', false
    )
  where id = p_booking_id
  returning * into v_booking;

  insert into public.booking_audit_events(
    booking_id, event_type, actor_id, actor_role, idempotency_key,
    from_status, to_status, event_data
  ) values (
    p_booking_id, 'payment_plan_selected', v_actor, 'buyer', p_idempotency_key,
    v_booking.status, v_booking.status,
    jsonb_build_object(
      'payment_plan', p_payment_plan,
      'upfront_required_amount', v_booking.upfront_required_amount,
      'balance_due_amount', v_booking.balance_due_amount
    )
  );
  return v_booking;
end;
$$;

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
  v_expected_amount numeric(12,2);
  v_new_amount_paid numeric(12,2);
  v_new_payment_status text;
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
  if exists (
    select 1 from public.booking_audit_events
    where booking_id = p_booking_id
      and event_type = 'provider_payment_confirmed'
      and idempotency_key = p_idempotency_key
  ) then return v_booking; end if;

  v_expected_amount := case
    when v_booking.amount_paid = 0 then v_booking.upfront_required_amount
    else v_booking.balance_due_amount
  end;
  if round(coalesce(p_amount, -1), 2) <> v_expected_amount or v_expected_amount <= 0 then
    raise exception 'Provider amount does not match the required installment' using errcode = '23514';
  end if;

  v_new_amount_paid := round(v_booking.amount_paid + p_amount, 2);
  v_new_payment_status := case
    when v_new_amount_paid = v_booking.total_charged_amount then 'paid'
    else 'partially_paid'
  end;
  v_from_status := v_booking.status;

  perform set_config('app.booking_workflow_rpc', 'on', true);
  update public.bookings
  set
    amount_paid = v_new_amount_paid,
    payment_status = v_new_payment_status,
    payment_reference = p_external_reference,
    status = 'confirmed',
    metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
      'payment_method', 'gcash-advance',
      'payment_plan', payment_plan,
      'allow_after_service', false,
      'ui_status', case when v_new_payment_status = 'paid' then 'Payment Confirmed' else 'Downpayment Paid' end,
      'payment_proof_submitted', true,
      'payment_references', coalesce(metadata->'payment_references', '[]'::jsonb)
        || jsonb_build_array(jsonb_build_object(
          'reference', p_external_reference,
          'amount', p_amount,
          'paid_at', now()
        ))
    )
  where id = p_booking_id
  returning * into v_booking;

  insert into public.booking_audit_events(
    booking_id, event_type, actor_role, idempotency_key,
    from_status, to_status, event_data
  ) values (
    p_booking_id, 'provider_payment_confirmed', 'payment_server', p_idempotency_key,
    v_from_status, 'confirmed',
    jsonb_build_object(
      'amount', p_amount,
      'amount_paid', v_new_amount_paid,
      'balance_due_amount', v_booking.balance_due_amount,
      'payment_status', v_new_payment_status,
      'reference', p_external_reference
    )
  );
  return v_booking;
end;
$$;

revoke all on function public.select_booking_payment_plan(uuid, text, text) from public;
grant execute on function public.select_booking_payment_plan(uuid, text, text) to authenticated;
revoke all on function public.record_booking_online_payment(uuid, text, numeric, text) from public;
grant execute on function public.record_booking_online_payment(uuid, text, numeric, text) to service_role;

-- Add one partially-paid showcase without changing the fully-paid completion demo.
with showcase_client as (
  select p.user_id from public.profiles p
  where lower(coalesce(p.role, '')) = 'client'
  order by p.created_at, p.user_id limit 1
),
showcase_service as (
  select s.id, s.seller_id, s.base_price, coalesce(s.currency, 'PHP') as currency
  from public.services s
  join public.profiles p on p.user_id = s.seller_id
  where s.active and lower(coalesce(p.role, '')) = 'worker'
  order by s.updated_at desc nulls last, s.id limit 1
),
inserted_downpayment as (
  insert into public.bookings(
    service_id, seller_id, buyer_id, start_ts, end_ts, status,
    total_amount, currency, payment_reference, metadata,
    payment_plan, payment_status, amount_paid
  )
  select
    s.id, s.seller_id, c.user_id,
    now() + interval '30 days', now() + interval '30 days 2 hours',
    'confirmed', coalesce(s.base_price, 0), s.currency,
    'SHOWCASE-DOWNPAYMENT-PAID',
    jsonb_build_object(
      'showcase_seed_key', 'downpayment-partially-paid-v1',
      'created_via', 'showcase-role-booking-seed',
      'ui_status', 'Downpayment Paid',
      'payment_method', 'gcash-advance',
      'payment_plan', 'downpayment',
      'allow_after_service', false,
      'payment_proof_submitted', true,
      'quote_approved', true,
      'can_rate', false
    ),
    'downpayment',
    'partially_paid',
    round(coalesce(s.base_price, 0) * 0.5, 2)
      + round(coalesce(s.base_price, 0) * 0.05, 2)
  from showcase_client c cross join showcase_service s
  where not exists (
    select 1 from public.bookings b
    where b.metadata->>'showcase_seed_key' = 'downpayment-partially-paid-v1'
  )
  returning id, status, upfront_required_amount, balance_due_amount
)
insert into public.booking_audit_events(
  booking_id, event_type, actor_role, reason, idempotency_key,
  from_status, to_status, event_data
)
select
  id, 'showcase_downpayment_confirmed', 'system_seed',
  'Seeded partially-paid downpayment showcase', 'downpayment-partially-paid-v1',
  status, status,
  jsonb_build_object(
    'upfront_required_amount', upfront_required_amount,
    'balance_due_amount', balance_due_amount,
    'showcase', true
  )
from inserted_downpayment
on conflict do nothing;
