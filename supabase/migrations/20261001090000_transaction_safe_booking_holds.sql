-- Transaction-safe booking requests, quotes, slot holds, rescheduling, and cancellation.
-- Browser clients may request transitions, but capacity and lifecycle decisions stay here.

alter table public.bookings
  add column if not exists quote_status text not null default 'not_required',
  add column if not exists schedule_status text not null default 'unscheduled',
  add column if not exists hold_expires_at timestamptz,
  add column if not exists cancellation_status text not null default 'none',
  add column if not exists cancellation_reason text,
  add column if not exists cancellation_requested_at timestamptz,
  add column if not exists cancellation_requested_by uuid references auth.users(id);

alter table public.bookings
  drop constraint if exists bookings_quote_status_check,
  drop constraint if exists bookings_schedule_status_check,
  drop constraint if exists bookings_cancellation_status_check,
  drop constraint if exists bookings_payment_status_check;

alter table public.bookings
  add constraint bookings_quote_status_check check (
    quote_status in ('not_required', 'awaiting_quote', 'proposed', 'accepted', 'rejected')
  ),
  add constraint bookings_schedule_status_check check (
    schedule_status in (
      'unscheduled', 'proposed', 'held', 'confirmed', 'expired',
      'reschedule_requested', 'released'
    )
  ),
  add constraint bookings_cancellation_status_check check (
    cancellation_status in ('none', 'requested', 'approved', 'declined')
  ),
  add constraint bookings_payment_status_check check (
    payment_status in (
      'unpaid', 'pending_provider', 'partially_paid',
      'pending_buyer_acknowledgement', 'paid', 'refund_pending', 'refunded'
    )
  );

alter table public.service_slots
  add column if not exists visibility text not null default 'public';

alter table public.service_slots
  drop constraint if exists service_slots_visibility_check;
alter table public.service_slots
  add constraint service_slots_visibility_check check (visibility in ('public', 'booking_only'));

alter table public.payment_attempts
  alter column expires_at set default (now() + interval '15 minutes');

alter table public.payment_attempts
  drop constraint if exists payment_attempts_status_check;
alter table public.payment_attempts
  add constraint payment_attempts_status_check check (
    status in (
      'created', 'awaiting_payment', 'processing', 'paid', 'late_paid',
      'failed', 'expired', 'cancelled', 'refunded'
    )
  );

update public.payment_attempts
set expires_at = least(expires_at, created_at + interval '15 minutes')
where status in ('created', 'awaiting_payment', 'processing');

create table if not exists public.booking_quotes (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete restrict,
  version integer not null,
  amount numeric(12,2) not null check (amount > 0),
  currency text not null default 'PHP' check (currency = 'PHP'),
  scope_summary text not null check (char_length(trim(scope_summary)) between 1 and 1000),
  proposed_start_ts timestamptz not null,
  proposed_end_ts timestamptz not null,
  status text not null default 'proposed'
    check (status in ('proposed', 'accepted', 'rejected', 'superseded')),
  created_by uuid not null references auth.users(id),
  accepted_at timestamptz,
  rejected_at timestamptz,
  rejection_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (booking_id, version),
  check (proposed_end_ts > proposed_start_ts)
);

create index if not exists booking_quotes_booking_idx
  on public.booking_quotes(booking_id, version desc);

create table if not exists public.booking_reschedule_requests (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete restrict,
  requested_by uuid not null references auth.users(id),
  requested_slot_id bigint not null references public.service_slots(id) on delete restrict,
  previous_slot_id bigint references public.service_slots(id) on delete set null,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'declined', 'cancelled')),
  reason text,
  reviewer_id uuid references auth.users(id),
  review_reason text,
  reviewed_at timestamptz,
  operation_id text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (booking_id, operation_id)
);

create unique index if not exists booking_reschedule_one_pending_idx
  on public.booking_reschedule_requests(booking_id)
  where status = 'pending';

alter table public.booking_quotes enable row level security;
alter table public.booking_reschedule_requests enable row level security;

create policy booking_quotes_select_participants
on public.booking_quotes for select to authenticated
using (
  exists (
    select 1 from public.bookings b
    where b.id = booking_id and auth.uid() in (b.buyer_id, b.seller_id)
  )
  or public.is_current_user_admin()
);

create policy booking_reschedule_select_participants
on public.booking_reschedule_requests for select to authenticated
using (
  exists (
    select 1 from public.bookings b
    where b.id = booking_id and auth.uid() in (b.buyer_id, b.seller_id)
  )
  or public.is_current_user_admin()
);

revoke insert, update, delete on public.booking_quotes from anon, authenticated;
revoke insert, update, delete on public.booking_reschedule_requests from anon, authenticated;
grant select on public.booking_quotes, public.booking_reschedule_requests to authenticated;

-- Preserve historical rows while moving active workflow display state to typed fields.
update public.bookings
set
  quote_status = case
    when coalesce(metadata->>'booking_mode', '') = 'calendar-only'
      then case when lower(coalesce(metadata->>'quote_approved', 'false')) = 'true' then 'accepted' else 'awaiting_quote' end
    else 'not_required'
  end,
  schedule_status = case
    when slot_id is not null or (start_ts is not null and end_ts is not null) then 'confirmed'
    else 'unscheduled'
  end,
  cancellation_status = case when status = 'cancelled' then 'approved' else 'none' end;

create or replace function public.booking_slot_occupancy(
  p_slot_id bigint,
  p_exclude_booking_id uuid default null
) returns integer
language sql stable security definer set search_path = public as $$
  select count(*)::integer
  from public.bookings b
  where b.slot_id = p_slot_id
    and (p_exclude_booking_id is null or b.id <> p_exclude_booking_id)
    and b.status not in ('cancelled', 'refunded')
    and (
      b.schedule_status in ('confirmed', 'reschedule_requested')
      or (b.schedule_status = 'held' and b.hold_expires_at > now())
    );
$$;

create or replace function public.refresh_service_slot_capacity(p_slot_id bigint)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_capacity integer;
  v_count integer;
begin
  if p_slot_id is null then return; end if;
  select greatest(coalesce(capacity, 1), 1) into v_capacity
  from public.service_slots where id = p_slot_id for update;
  if not found then return; end if;
  v_count := public.booking_slot_occupancy(p_slot_id, null);
  update public.service_slots
  set
    status = case when v_count >= v_capacity then 'booked' else 'available' end,
    metadata = jsonb_set(coalesce(metadata, '{}'::jsonb), '{booked_count}', to_jsonb(v_count), true),
    updated_at = now()
  where id = p_slot_id and status <> 'cancelled';
end;
$$;

create or replace function public.protect_booking_transaction_fields()
returns trigger language plpgsql set search_path = public as $$
declare
  v_controlled boolean := coalesce(current_setting('app.booking_workflow_rpc', true), '') = 'on';
begin
  if auth.role() = 'authenticated' and not v_controlled and (
    new.quote_status is distinct from old.quote_status
    or new.schedule_status is distinct from old.schedule_status
    or new.hold_expires_at is distinct from old.hold_expires_at
    or new.cancellation_status is distinct from old.cancellation_status
    or new.cancellation_reason is distinct from old.cancellation_reason
    or new.cancellation_requested_at is distinct from old.cancellation_requested_at
    or new.cancellation_requested_by is distinct from old.cancellation_requested_by
    or new.slot_id is distinct from old.slot_id
    or new.start_ts is distinct from old.start_ts
    or new.end_ts is distinct from old.end_ts
    or new.total_amount is distinct from old.total_amount
  ) then
    raise exception 'Booking quote, schedule, and cancellation fields require a workflow operation'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists bookings_protect_transaction_fields on public.bookings;
create trigger bookings_protect_transaction_fields
before update on public.bookings
for each row execute function public.protect_booking_transaction_fields();

create or replace function public.create_booking_request(
  p_service_id bigint,
  p_operation_id text
) returns public.bookings
language plpgsql security definer set search_path = public as $$
declare
  v_actor uuid := auth.uid();
  v_service public.services%rowtype;
  v_booking public.bookings%rowtype;
begin
  if v_actor is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  if nullif(trim(p_operation_id), '') is null then raise exception 'Operation ID required' using errcode = '22023'; end if;

  perform pg_advisory_xact_lock(hashtextextended(v_actor::text || ':' || p_service_id::text, 0));
  select * into v_service from public.services where id = p_service_id and active = true;
  if not found then raise exception 'Service is not available' using errcode = 'P0002'; end if;
  if v_service.seller_id = v_actor then raise exception 'You cannot book your own service' using errcode = '23514'; end if;

  select b.* into v_booking
  from public.booking_audit_events e join public.bookings b on b.id = e.booking_id
  where e.event_type = 'booking_request_created'
    and e.actor_id = v_actor and e.idempotency_key = p_operation_id
    and b.status = 'pending'
  limit 1;
  if found then return v_booking; end if;

  select * into v_booking from public.bookings
  where service_id = p_service_id and buyer_id = v_actor and status = 'pending'
    and quote_status in ('awaiting_quote', 'proposed', 'accepted', 'rejected')
  order by created_at desc limit 1 for update;
  if found then return v_booking; end if;

  perform set_config('app.booking_workflow_rpc', 'on', true);
  insert into public.bookings(
    service_id, seller_id, buyer_id, status, total_amount, currency, metadata,
    quote_status, schedule_status, cancellation_status, payment_status
  ) values (
    v_service.id, v_service.seller_id, v_actor, 'pending', v_service.base_price,
    coalesce(v_service.currency, 'PHP'),
    jsonb_build_object(
      'booking_mode', 'calendar-only', 'booking_flow', 'request-booking',
      'created_via', 'create_booking_request', 'payment_method', null,
      'ui_status', 'Awaiting Quote'
    ),
    'awaiting_quote', 'unscheduled', 'none', 'unpaid'
  ) returning * into v_booking;

  insert into public.booking_audit_events(
    booking_id, event_type, actor_id, actor_role, idempotency_key,
    from_status, to_status, event_data
  ) values (
    v_booking.id, 'booking_request_created', v_actor, 'buyer', p_operation_id,
    null, 'pending', jsonb_build_object('service_id', p_service_id)
  );
  return v_booking;
end;
$$;

create or replace function public.propose_booking_quote(
  p_booking_id uuid,
  p_amount numeric,
  p_start_ts timestamptz,
  p_end_ts timestamptz,
  p_scope_summary text,
  p_operation_id text
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_actor uuid := auth.uid();
  v_booking public.bookings%rowtype;
  v_quote public.booking_quotes%rowtype;
  v_version integer;
begin
  if v_actor is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  if nullif(trim(p_operation_id), '') is null then raise exception 'Operation ID required' using errcode = '22023'; end if;
  if coalesce(p_amount, 0) <= 0 then raise exception 'Quote amount must be greater than zero' using errcode = '22023'; end if;
  if p_start_ts <= now() or p_end_ts <= p_start_ts then raise exception 'Choose a valid future schedule' using errcode = '22023'; end if;
  if char_length(trim(coalesce(p_scope_summary, ''))) not between 1 and 1000 then
    raise exception 'Scope summary is required and must be 1000 characters or fewer' using errcode = '22023';
  end if;

  select * into v_booking from public.bookings where id = p_booking_id for update;
  if not found then raise exception 'Booking not found' using errcode = 'P0002'; end if;
  if v_booking.seller_id <> v_actor then raise exception 'Only the provider can propose a quote' using errcode = '42501'; end if;
  if v_booking.status <> 'pending' or v_booking.cancellation_status = 'approved' then
    raise exception 'This booking cannot receive a new quote' using errcode = '23514';
  end if;
  if v_booking.schedule_status in ('held', 'confirmed', 'reschedule_requested')
    or v_booking.payment_status in ('partially_paid', 'paid', 'refund_pending', 'refunded') then
    raise exception 'This booking already has an active schedule or payment' using errcode = '23514';
  end if;

  select q.* into v_quote from public.booking_quotes q
  where q.booking_id = p_booking_id
    and q.created_by = v_actor
    and exists (
      select 1 from public.booking_audit_events e
      where e.booking_id = p_booking_id and e.event_type = 'quote_proposed'
        and e.actor_id = v_actor and e.idempotency_key = p_operation_id
        and (e.event_data->>'quote_id')::uuid = q.id
    )
  limit 1;
  if found then return jsonb_build_object('booking', to_jsonb(v_booking), 'quote', to_jsonb(v_quote)); end if;

  update public.booking_quotes set status = 'superseded', updated_at = now()
  where booking_id = p_booking_id and status in ('proposed', 'accepted');
  select coalesce(max(version), 0) + 1 into v_version from public.booking_quotes where booking_id = p_booking_id;

  insert into public.booking_quotes(
    booking_id, version, amount, currency, scope_summary,
    proposed_start_ts, proposed_end_ts, created_by
  ) values (
    p_booking_id, v_version, round(p_amount, 2), coalesce(v_booking.currency, 'PHP'),
    trim(p_scope_summary), p_start_ts, p_end_ts, v_actor
  ) returning * into v_quote;

  perform set_config('app.booking_workflow_rpc', 'on', true);
  update public.bookings set
    total_amount = round(p_amount, 2), quote_status = 'proposed', schedule_status = 'proposed',
    metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
      'quote_approved', false, 'quote_amount', round(p_amount, 2),
      'ui_status', 'Quote Ready', 'active_quote_version', v_version
    ), updated_at = now()
  where id = p_booking_id returning * into v_booking;

  insert into public.booking_audit_events(
    booking_id, event_type, actor_id, actor_role, idempotency_key,
    from_status, to_status, event_data
  ) values (
    p_booking_id, 'quote_proposed', v_actor, 'seller', p_operation_id,
    v_booking.status, v_booking.status,
    jsonb_build_object('quote_id', v_quote.id, 'version', v_version, 'amount', v_quote.amount)
  );
  return jsonb_build_object('booking', to_jsonb(v_booking), 'quote', to_jsonb(v_quote));
end;
$$;

create or replace function public.reject_booking_quote(
  p_booking_id uuid,
  p_quote_version integer,
  p_reason text,
  p_operation_id text
) returns public.bookings
language plpgsql security definer set search_path = public as $$
declare
  v_actor uuid := auth.uid();
  v_booking public.bookings%rowtype;
begin
  if v_actor is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  if nullif(trim(p_reason), '') is null then raise exception 'A rejection reason is required' using errcode = '22023'; end if;
  if nullif(trim(p_operation_id), '') is null then raise exception 'Operation ID required' using errcode = '22023'; end if;
  select * into v_booking from public.bookings where id = p_booking_id for update;
  if not found then raise exception 'Booking not found' using errcode = 'P0002'; end if;
  if v_booking.buyer_id <> v_actor then raise exception 'Only the buyer can reject this quote' using errcode = '42501'; end if;
  if exists (select 1 from public.booking_audit_events where booking_id = p_booking_id and event_type = 'quote_rejected' and actor_id = v_actor and idempotency_key = p_operation_id) then return v_booking; end if;

  update public.booking_quotes set status = 'rejected', rejected_at = now(),
    rejection_reason = trim(p_reason), updated_at = now()
  where booking_id = p_booking_id and version = p_quote_version and status = 'proposed';
  if not found then raise exception 'This quote is no longer available' using errcode = '23514'; end if;

  perform set_config('app.booking_workflow_rpc', 'on', true);
  update public.bookings set quote_status = 'rejected', schedule_status = 'unscheduled',
    metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
      'quote_approved', false, 'quote_rejection_reason', trim(p_reason), 'ui_status', 'Quote Rejected'
    ), updated_at = now()
  where id = p_booking_id returning * into v_booking;

  insert into public.booking_audit_events(booking_id, event_type, actor_id, actor_role, reason, idempotency_key, from_status, to_status, event_data)
  values (p_booking_id, 'quote_rejected', v_actor, 'buyer', trim(p_reason), p_operation_id,
    v_booking.status, v_booking.status, jsonb_build_object('quote_version', p_quote_version));
  return v_booking;
end;
$$;

create or replace function public.start_booking_checkout(
  p_booking_id uuid default null,
  p_service_id bigint default null,
  p_slot_id bigint default null,
  p_quote_version integer default null,
  p_payment_plan text default 'full',
  p_operation_id text default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_actor uuid := auth.uid();
  v_service public.services%rowtype;
  v_booking public.bookings%rowtype;
  v_slot public.service_slots%rowtype;
  v_quote public.booking_quotes%rowtype;
  v_attempt public.payment_attempts%rowtype;
  v_capacity integer;
  v_occupancy integer;
  v_old_slot_id bigint;
  v_attempt_id uuid := gen_random_uuid();
  v_hold_expires_at timestamptz := now() + interval '15 minutes';
begin
  if v_actor is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  if p_payment_plan not in ('full', 'downpayment') then raise exception 'Payment plan must be full or downpayment' using errcode = '22023'; end if;
  if nullif(trim(coalesce(p_operation_id, '')), '') is null then raise exception 'Operation ID required' using errcode = '22023'; end if;

  select b.* into v_booking
  from public.booking_audit_events e join public.bookings b on b.id = e.booking_id
  where e.event_type = 'booking_checkout_started' and e.actor_id = v_actor
    and e.idempotency_key = p_operation_id limit 1;
  if found then
    select * into v_attempt from public.payment_attempts
    where booking_id = v_booking.id and idempotency_key = p_operation_id limit 1;
    return jsonb_build_object('booking', to_jsonb(v_booking), 'paymentAttempt', to_jsonb(v_attempt), 'holdExpiresAt', v_booking.hold_expires_at);
  end if;

  if p_booking_id is null then
    if p_service_id is null or p_slot_id is null then raise exception 'Service and slot are required' using errcode = '22023'; end if;
    perform pg_advisory_xact_lock(hashtextextended(v_actor::text || ':' || p_service_id::text || ':' || p_slot_id::text, 0));
    select * into v_service from public.services where id = p_service_id and active = true;
    if not found then raise exception 'Service is not available' using errcode = 'P0002'; end if;
    if v_service.seller_id = v_actor then raise exception 'You cannot book your own service' using errcode = '23514'; end if;
    select * into v_booking from public.bookings
    where service_id = p_service_id and buyer_id = v_actor and slot_id = p_slot_id
      and status in ('pending', 'confirmed')
      and (schedule_status = 'confirmed' or (schedule_status = 'held' and hold_expires_at > now()))
    order by created_at desc limit 1 for update;
    if not found then
      perform set_config('app.booking_workflow_rpc', 'on', true);
      insert into public.bookings(
        service_id, seller_id, buyer_id, slot_id, status, total_amount, currency,
        payment_status, payment_plan, quote_status, schedule_status, cancellation_status, metadata
      ) values (
        v_service.id, v_service.seller_id, v_actor, null, 'pending', v_service.base_price,
        coalesce(v_service.currency, 'PHP'), 'pending_provider', p_payment_plan,
        'not_required', 'unscheduled', 'none',
        jsonb_build_object(
          'booking_mode', 'with-slots', 'created_via', 'start_booking_checkout',
          'payment_method', 'paymongo-card', 'payment_plan', p_payment_plan,
          'allow_gcash_advance', false, 'allow_after_service', false,
          'quote_approved', true, 'ui_status', 'Payment Pending'
        )
      ) returning * into v_booking;
    end if;
  else
    select * into v_booking from public.bookings where id = p_booking_id for update;
    if not found then raise exception 'Booking not found' using errcode = 'P0002'; end if;
    if v_booking.buyer_id <> v_actor then raise exception 'Only the buyer can start checkout' using errcode = '42501'; end if;
    if v_booking.buyer_id = v_booking.seller_id then raise exception 'You cannot book your own service' using errcode = '23514'; end if;
    if v_booking.status in ('completed', 'cancelled', 'refunded') or v_booking.cancellation_status in ('requested', 'approved') then
      raise exception 'This booking is not eligible for checkout' using errcode = '23514';
    end if;
  end if;

  if v_booking.payment_status in ('paid', 'refund_pending', 'refunded') then
    raise exception 'This booking does not have an outstanding checkout payment' using errcode = '23514';
  end if;

  v_old_slot_id := v_booking.slot_id;
  if v_booking.payment_status = 'partially_paid' then
    if v_booking.schedule_status <> 'confirmed' then raise exception 'The booking schedule is not confirmed' using errcode = '23514'; end if;
    v_hold_expires_at := null;
  else
    if v_booking.quote_status <> 'not_required' and p_quote_version is null then
      raise exception 'Accept the latest provider quote before checkout' using errcode = '23514';
    end if;
    if p_quote_version is not null and p_slot_id is not null then
      raise exception 'A quote checkout cannot replace its proposed schedule' using errcode = '23514';
    end if;
    if p_slot_id is null then
      select * into v_quote from public.booking_quotes
      where booking_id = v_booking.id and version = p_quote_version and status in ('proposed', 'accepted')
        and version = (select max(latest.version) from public.booking_quotes latest where latest.booking_id = v_booking.id)
      for update;
      if not found then raise exception 'The selected quote is no longer available' using errcode = '23514'; end if;
      if v_quote.proposed_start_ts <= now() then raise exception 'The proposed schedule is in the past' using errcode = '23514'; end if;
      if exists (
        select 1 from public.bookings other
        where other.seller_id = v_booking.seller_id and other.id <> v_booking.id
          and other.status not in ('cancelled', 'refunded')
          and (other.schedule_status in ('confirmed', 'reschedule_requested')
            or (other.schedule_status = 'held' and other.hold_expires_at > now()))
          and tstzrange(other.start_ts, other.end_ts, '[)')
            && tstzrange(v_quote.proposed_start_ts, v_quote.proposed_end_ts, '[)')
      ) then
        raise exception 'The proposed time conflicts with another booking' using errcode = '23514';
      end if;

      select * into v_slot from public.service_slots
      where visibility = 'booking_only' and metadata->>'quote_id' = v_quote.id::text
        and status <> 'cancelled'
      order by created_at desc limit 1 for update;
      if not found then
        insert into public.service_slots(
          service_id, seller_id, start_ts, end_ts, capacity, status, visibility, metadata
        ) values (
          v_booking.service_id, v_booking.seller_id, v_quote.proposed_start_ts,
          v_quote.proposed_end_ts, 1, 'available', 'booking_only',
          jsonb_build_object('booking_id', v_booking.id, 'quote_id', v_quote.id, 'source', 'booking_quote')
        ) returning * into v_slot;
      end if;
    else
      select * into v_slot from public.service_slots
      where id = p_slot_id and service_id = v_booking.service_id and seller_id = v_booking.seller_id
      for update;
      if not found then raise exception 'Selected time does not belong to this service' using errcode = 'P0002'; end if;
    end if;

    if v_slot.start_ts <= now() or v_slot.end_ts <= v_slot.start_ts or v_slot.status = 'cancelled' then
      raise exception 'Selected time is no longer available' using errcode = '23514';
    end if;
    v_capacity := greatest(coalesce(v_slot.capacity, 1), 1);
    v_occupancy := public.booking_slot_occupancy(v_slot.id, v_booking.id);
    if v_occupancy >= v_capacity then raise exception 'Selected time was just booked. Choose another available time.' using errcode = '23514'; end if;

    perform set_config('app.booking_workflow_rpc', 'on', true);
    update public.bookings set
      slot_id = v_slot.id, start_ts = v_slot.start_ts, end_ts = v_slot.end_ts,
      quote_status = case when p_quote_version is null then quote_status else 'accepted' end,
      schedule_status = 'held', hold_expires_at = v_hold_expires_at,
      payment_plan = p_payment_plan, payment_status = 'pending_provider', status = 'pending',
      cancellation_status = 'none', cancellation_reason = null,
      metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
        'payment_method', 'paymongo-card', 'payment_plan', p_payment_plan,
        'allow_gcash_advance', false, 'allow_after_service', false,
        'quote_approved', true, 'ui_status', 'Reserved - Payment Pending'
      ), updated_at = now()
    where id = v_booking.id returning * into v_booking;

    if p_quote_version is not null then
      update public.booking_quotes set status = 'accepted', accepted_at = now(), updated_at = now()
      where id = v_quote.id;
    end if;
    perform public.refresh_service_slot_capacity(v_slot.id);
    if v_old_slot_id is not null and v_old_slot_id <> v_slot.id then
      perform public.refresh_service_slot_capacity(v_old_slot_id);
    end if;
  end if;

  -- Supersede unpaid attempts before creating one tied to this operation.
  update public.payment_attempts set status = 'expired', updated_at = now()
  where booking_id = v_booking.id and status in ('created', 'awaiting_payment', 'processing')
    and expires_at <= now();

  select * into v_attempt from public.payment_attempts
  where booking_id = v_booking.id
    and purpose = case when v_booking.amount_paid > 0 then 'balance' else 'initial' end
    and status in ('created', 'awaiting_payment', 'processing') and expires_at > now()
  order by created_at desc limit 1;
  if found then
    insert into public.booking_audit_events(
      booking_id, event_type, actor_id, actor_role, idempotency_key,
      from_status, to_status, event_data
    ) values (
      v_booking.id, 'booking_checkout_started', v_actor, 'buyer', p_operation_id,
      v_booking.status, v_booking.status,
      jsonb_build_object('slot_id', v_booking.slot_id, 'attempt_id', v_attempt.id,
        'payment_plan', p_payment_plan, 'hold_expires_at', v_booking.hold_expires_at)
    );
    return jsonb_build_object('booking', to_jsonb(v_booking), 'paymentAttempt', to_jsonb(v_attempt), 'holdExpiresAt', v_booking.hold_expires_at);
  end if;

  insert into public.payment_attempts(
    id, booking_id, buyer_id, environment, purpose, status, amount, currency,
    idempotency_key, reference_number, expires_at
  ) values (
    v_attempt_id, v_booking.id, v_actor, 'test',
    case when v_booking.amount_paid > 0 then 'balance' else 'initial' end,
    'created',
    case when v_booking.amount_paid > 0 then v_booking.balance_due_amount else v_booking.upfront_required_amount end,
    coalesce(v_booking.currency, 'PHP'), p_operation_id,
    'TW-' || upper(substr(replace(v_attempt_id::text, '-', ''), 1, 20)),
    coalesce(v_hold_expires_at, now() + interval '15 minutes')
  ) returning * into v_attempt;

  insert into public.booking_audit_events(
    booking_id, event_type, actor_id, actor_role, idempotency_key,
    from_status, to_status, event_data
  ) values (
    v_booking.id, 'booking_checkout_started', v_actor, 'buyer', p_operation_id,
    v_booking.status, v_booking.status,
    jsonb_build_object('slot_id', v_booking.slot_id, 'attempt_id', v_attempt.id,
      'payment_plan', p_payment_plan, 'hold_expires_at', v_hold_expires_at)
  );
  return jsonb_build_object('booking', to_jsonb(v_booking), 'paymentAttempt', to_jsonb(v_attempt), 'holdExpiresAt', v_hold_expires_at);
end;
$$;

create or replace function public.expire_booking_holds(p_limit integer default 100)
returns integer language plpgsql security definer set search_path = public as $$
declare
  v_row record;
  v_count integer := 0;
begin
  if coalesce(auth.role(), '') not in ('service_role', 'postgres') and current_user <> 'postgres' then
    raise exception 'Only the booking scheduler can expire holds' using errcode = '42501';
  end if;
  for v_row in
    select id, slot_id, status from public.bookings
    where schedule_status = 'held' and hold_expires_at <= now()
      and payment_status not in ('partially_paid', 'paid', 'refunded', 'refund_pending')
    order by hold_expires_at for update skip locked limit greatest(coalesce(p_limit, 100), 1)
  loop
    perform set_config('app.booking_workflow_rpc', 'on', true);
    update public.bookings set
      slot_id = null, start_ts = null, end_ts = null,
      schedule_status = 'expired', hold_expires_at = null,
      metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
        'ui_status', 'Reservation Expired', 'selected_slot', null
      ), updated_at = now()
    where id = v_row.id;
    update public.payment_attempts set status = 'expired', updated_at = now()
    where booking_id = v_row.id and status in ('created', 'awaiting_payment', 'processing');
    perform public.refresh_service_slot_capacity(v_row.slot_id);
    insert into public.booking_audit_events(booking_id, event_type, actor_role, from_status, to_status, event_data)
    values (v_row.id, 'booking_hold_expired', 'scheduler', v_row.status, v_row.status,
      jsonb_build_object('released_slot_id', v_row.slot_id));
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

create or replace function public.reschedule_booking(
  p_booking_id uuid,
  p_new_slot_id bigint,
  p_reason text,
  p_operation_id text
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_actor uuid := auth.uid();
  v_booking public.bookings%rowtype;
  v_slot public.service_slots%rowtype;
  v_request public.booking_reschedule_requests%rowtype;
  v_old_slot_id bigint;
begin
  if v_actor is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  if nullif(trim(p_operation_id), '') is null then raise exception 'Operation ID required' using errcode = '22023'; end if;
  select * into v_booking from public.bookings where id = p_booking_id for update;
  if not found then raise exception 'Booking not found' using errcode = 'P0002'; end if;
  if v_booking.buyer_id <> v_actor then raise exception 'Only the buyer can reschedule this booking' using errcode = '42501'; end if;
  if v_booking.status not in ('pending', 'confirmed') or v_booking.start_ts <= now() then
    raise exception 'This booking can no longer be rescheduled' using errcode = '23514';
  end if;
  if v_booking.payment_status not in ('partially_paid', 'paid')
    and (v_booking.schedule_status <> 'held' or v_booking.hold_expires_at <= now()) then
    raise exception 'The reservation expired. Start checkout again to choose another time.' using errcode = '23514';
  end if;
  select * into v_slot from public.service_slots
  where id = p_new_slot_id and service_id = v_booking.service_id and seller_id = v_booking.seller_id
  for update;
  if not found or v_slot.status = 'cancelled' or v_slot.start_ts <= now() then
    raise exception 'The requested time is no longer available' using errcode = '23514';
  end if;
  if public.booking_slot_occupancy(v_slot.id, v_booking.id) >= greatest(coalesce(v_slot.capacity, 1), 1) then
    raise exception 'The requested time was just booked' using errcode = '23514';
  end if;

  if v_booking.payment_status in ('partially_paid', 'paid') then
    insert into public.booking_reschedule_requests(
      booking_id, requested_by, requested_slot_id, previous_slot_id, reason, operation_id
    ) values (p_booking_id, v_actor, p_new_slot_id, v_booking.slot_id, nullif(trim(p_reason), ''), p_operation_id)
    on conflict (booking_id, operation_id) do update set operation_id = excluded.operation_id
    returning * into v_request;
    perform set_config('app.booking_workflow_rpc', 'on', true);
    update public.bookings set schedule_status = 'reschedule_requested', updated_at = now()
    where id = p_booking_id returning * into v_booking;
    insert into public.booking_audit_events(booking_id, event_type, actor_id, actor_role, reason, idempotency_key, from_status, to_status, event_data)
    values (p_booking_id, 'booking_reschedule_requested', v_actor, 'buyer', nullif(trim(p_reason), ''), p_operation_id,
      v_booking.status, v_booking.status, jsonb_build_object('request_id', v_request.id, 'requested_slot_id', p_new_slot_id))
    on conflict do nothing;
    return jsonb_build_object('booking', to_jsonb(v_booking), 'outcome', 'approval_required', 'requestId', v_request.id);
  end if;

  v_old_slot_id := v_booking.slot_id;
  perform set_config('app.booking_workflow_rpc', 'on', true);
  update public.bookings set slot_id = v_slot.id, start_ts = v_slot.start_ts, end_ts = v_slot.end_ts,
    schedule_status = 'held',
    updated_at = now()
  where id = p_booking_id returning * into v_booking;
  perform public.refresh_service_slot_capacity(v_old_slot_id);
  perform public.refresh_service_slot_capacity(v_slot.id);
  insert into public.booking_audit_events(booking_id, event_type, actor_id, actor_role, reason, idempotency_key, from_status, to_status, event_data)
  values (p_booking_id, 'booking_rescheduled', v_actor, 'buyer', nullif(trim(p_reason), ''), p_operation_id,
    v_booking.status, v_booking.status, jsonb_build_object('previous_slot_id', v_old_slot_id, 'slot_id', v_slot.id));
  return jsonb_build_object('booking', to_jsonb(v_booking), 'outcome', 'rescheduled');
end;
$$;

create or replace function public.review_booking_reschedule(
  p_request_id uuid,
  p_decision text,
  p_reason text,
  p_operation_id text
) returns public.bookings
language plpgsql security definer set search_path = public as $$
declare
  v_actor uuid := auth.uid();
  v_request public.booking_reschedule_requests%rowtype;
  v_booking public.bookings%rowtype;
  v_slot public.service_slots%rowtype;
  v_old_slot_id bigint;
begin
  if v_actor is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  if p_decision not in ('approve', 'decline') then raise exception 'Decision must be approve or decline' using errcode = '22023'; end if;
  if nullif(trim(p_operation_id), '') is null then raise exception 'Operation ID required' using errcode = '22023'; end if;
  select * into v_request from public.booking_reschedule_requests where id = p_request_id for update;
  if not found then raise exception 'Reschedule request not found' using errcode = 'P0002'; end if;
  select * into v_booking from public.bookings where id = v_request.booking_id for update;
  if v_booking.seller_id <> v_actor then raise exception 'Only the provider can review this request' using errcode = '42501'; end if;
  if v_request.status <> 'pending' then return v_booking; end if;

  if p_decision = 'approve' then
    select * into v_slot from public.service_slots where id = v_request.requested_slot_id for update;
    if not found or v_slot.status = 'cancelled' or v_slot.start_ts <= now()
      or public.booking_slot_occupancy(v_slot.id, v_booking.id) >= greatest(coalesce(v_slot.capacity, 1), 1) then
      raise exception 'The requested time is no longer available' using errcode = '23514';
    end if;
    v_old_slot_id := v_booking.slot_id;
    perform set_config('app.booking_workflow_rpc', 'on', true);
    update public.bookings set slot_id = v_slot.id, start_ts = v_slot.start_ts, end_ts = v_slot.end_ts,
      schedule_status = 'confirmed', hold_expires_at = null, updated_at = now()
    where id = v_booking.id returning * into v_booking;
    update public.booking_reschedule_requests set status = 'approved', reviewer_id = v_actor,
      review_reason = nullif(trim(p_reason), ''), reviewed_at = now(), updated_at = now()
    where id = p_request_id;
    perform public.refresh_service_slot_capacity(v_old_slot_id);
    perform public.refresh_service_slot_capacity(v_slot.id);
  else
    perform set_config('app.booking_workflow_rpc', 'on', true);
    update public.bookings set schedule_status = 'confirmed', updated_at = now()
    where id = v_booking.id returning * into v_booking;
    update public.booking_reschedule_requests set status = 'declined', reviewer_id = v_actor,
      review_reason = nullif(trim(p_reason), ''), reviewed_at = now(), updated_at = now()
    where id = p_request_id;
  end if;
  insert into public.booking_audit_events(booking_id, event_type, actor_id, actor_role, reason, idempotency_key, from_status, to_status, event_data)
  values (v_booking.id, 'booking_reschedule_' || case when p_decision = 'approve' then 'approved' else 'declined' end,
    v_actor, 'seller', nullif(trim(p_reason), ''), p_operation_id, v_booking.status, v_booking.status,
    jsonb_build_object('request_id', p_request_id)) on conflict do nothing;
  return v_booking;
end;
$$;

create or replace function public.cancel_booking(
  p_booking_id uuid,
  p_reason text,
  p_operation_id text
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_actor uuid := auth.uid();
  v_booking public.bookings%rowtype;
  v_old_slot_id bigint;
begin
  if v_actor is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  if nullif(trim(p_reason), '') is null then raise exception 'A cancellation reason is required' using errcode = '22023'; end if;
  if nullif(trim(p_operation_id), '') is null then raise exception 'Operation ID required' using errcode = '22023'; end if;
  select * into v_booking from public.bookings where id = p_booking_id for update;
  if not found then raise exception 'Booking not found' using errcode = 'P0002'; end if;
  if v_actor not in (v_booking.buyer_id, v_booking.seller_id) and not public.is_current_user_admin() then
    raise exception 'You cannot cancel this booking' using errcode = '42501';
  end if;
  if v_booking.status in ('completed', 'cancelled', 'refunded') then return jsonb_build_object('booking', to_jsonb(v_booking), 'outcome', 'unchanged'); end if;
  if exists (select 1 from public.booking_audit_events where booking_id = p_booking_id and event_type in ('booking_cancelled', 'booking_cancellation_requested') and actor_id = v_actor and idempotency_key = p_operation_id) then
    return jsonb_build_object('booking', to_jsonb(v_booking), 'outcome', case when v_booking.cancellation_status = 'requested' then 'review_required' else 'cancelled' end);
  end if;

  if v_booking.payment_status in ('partially_paid', 'paid') then
    perform set_config('app.booking_workflow_rpc', 'on', true);
    update public.bookings set cancellation_status = 'requested', cancellation_reason = trim(p_reason),
      cancellation_requested_at = now(), cancellation_requested_by = v_actor, updated_at = now()
    where id = p_booking_id returning * into v_booking;
    insert into public.booking_audit_events(booking_id, event_type, actor_id, actor_role, reason, idempotency_key, from_status, to_status, event_data)
    values (p_booking_id, 'booking_cancellation_requested', v_actor,
      case when v_actor = v_booking.seller_id then 'seller' else 'buyer' end,
      trim(p_reason), p_operation_id, v_booking.status, v_booking.status, '{}'::jsonb);
    return jsonb_build_object('booking', to_jsonb(v_booking), 'outcome', 'review_required');
  end if;

  v_old_slot_id := v_booking.slot_id;
  perform set_config('app.booking_workflow_rpc', 'on', true);
  update public.bookings set status = 'cancelled', cancellation_status = 'approved',
    cancellation_reason = trim(p_reason), cancellation_requested_at = now(), cancellation_requested_by = v_actor,
    schedule_status = 'released', hold_expires_at = null,
    metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('ui_status', 'Cancelled'), updated_at = now()
  where id = p_booking_id returning * into v_booking;
  update public.payment_attempts set status = 'cancelled', updated_at = now()
  where booking_id = p_booking_id and status in ('created', 'awaiting_payment', 'processing');
  perform public.refresh_service_slot_capacity(v_old_slot_id);
  insert into public.booking_audit_events(booking_id, event_type, actor_id, actor_role, reason, idempotency_key, from_status, to_status, event_data)
  values (p_booking_id, 'booking_cancelled', v_actor,
    case when v_actor = v_booking.seller_id then 'seller' else 'buyer' end,
    trim(p_reason), p_operation_id, 'pending', 'cancelled', jsonb_build_object('released_slot_id', v_old_slot_id));
  return jsonb_build_object('booking', to_jsonb(v_booking), 'outcome', 'cancelled');
end;
$$;

create or replace function public.review_booking_cancellation(
  p_booking_id uuid,
  p_decision text,
  p_reason text,
  p_operation_id text
) returns public.bookings
language plpgsql security definer set search_path = public as $$
declare
  v_actor uuid := auth.uid();
  v_booking public.bookings%rowtype;
  v_old_slot_id bigint;
begin
  if v_actor is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  if p_decision not in ('approve', 'decline') then raise exception 'Decision must be approve or decline' using errcode = '22023'; end if;
  if nullif(trim(p_operation_id), '') is null then raise exception 'Operation ID required' using errcode = '22023'; end if;
  select * into v_booking from public.bookings where id = p_booking_id for update;
  if not found then raise exception 'Booking not found' using errcode = 'P0002'; end if;
  if v_actor <> v_booking.seller_id and not public.is_current_user_admin() then
    raise exception 'Only the provider or an administrator can review this request' using errcode = '42501';
  end if;
  if v_booking.cancellation_status <> 'requested' then return v_booking; end if;
  v_old_slot_id := v_booking.slot_id;
  perform set_config('app.booking_workflow_rpc', 'on', true);
  if p_decision = 'approve' then
    update public.bookings set status = 'cancelled', cancellation_status = 'approved',
      payment_status = 'refund_pending', schedule_status = 'released', hold_expires_at = null,
      metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('ui_status', 'Cancelled - Refund Pending'),
      updated_at = now()
    where id = p_booking_id returning * into v_booking;
    perform public.refresh_service_slot_capacity(v_old_slot_id);
  else
    update public.bookings set cancellation_status = 'declined', updated_at = now()
    where id = p_booking_id returning * into v_booking;
  end if;
  insert into public.booking_audit_events(booking_id, event_type, actor_id, actor_role, reason, idempotency_key, from_status, to_status, event_data)
  values (p_booking_id, 'booking_cancellation_' || case when p_decision = 'approve' then 'approved' else 'declined' end,
    v_actor, case when public.is_current_user_admin() then 'admin' else 'seller' end,
    nullif(trim(p_reason), ''), p_operation_id, v_booking.status, v_booking.status,
    jsonb_build_object('refund_pending', p_decision = 'approve')) on conflict do nothing;
  return v_booking;
end;
$$;

-- New checkouts use PayMongo cards. Historical GCash rows remain valid records.
alter table public.bookings drop constraint if exists bookings_upfront_payment_method_check;
alter table public.bookings add constraint bookings_upfront_payment_method_check check (
  metadata->>'payment_method' is null
  or metadata->>'payment_method' in ('paymongo-card', 'gcash-advance')
);

create or replace function public.enforce_upfront_booking_payment()
returns trigger language plpgsql set search_path = public as $$
declare
  v_method text := new.metadata->>'payment_method';
  v_requested_plan text := coalesce(new.metadata->>'payment_plan', 'full');
  v_controlled boolean := coalesce(current_setting('app.booking_workflow_rpc', true), '') = 'on';
begin
  if v_method is not null and v_method not in ('paymongo-card', 'gcash-advance') then
    raise exception 'Only secure upfront payment is supported' using errcode = '23514';
  end if;
  if v_requested_plan not in ('full', 'downpayment') then
    raise exception 'Payment plan must be full or downpayment' using errcode = '23514';
  end if;
  if tg_op = 'INSERT' then new.payment_plan := v_requested_plan; end if;
  if tg_op = 'INSERT' and auth.role() = 'authenticated' and v_method is not null then
    new.payment_status := 'pending_provider';
    new.payment_reference := null;
    new.amount_paid := 0;
    new.status := 'pending';
    new.cash_collection_status := 'not_applicable';
  end if;
  if tg_op = 'UPDATE' and not v_controlled
    and new.status in ('confirmed', 'in_progress', 'completed')
    and new.payment_status not in ('partially_paid', 'paid')
    and new.status is distinct from old.status then
    raise exception 'Verified upfront payment is required before booking confirmation' using errcode = '23514';
  end if;
  return new;
end;
$$;

-- Convert active legacy demo checkouts only after the PayMongo-compatible
-- enforcement trigger above has replaced the former GCash-only trigger.
update public.bookings
set metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
  'payment_method', 'paymongo-card',
  'allow_gcash_advance', false
)
where status not in ('completed', 'cancelled', 'refunded')
  and metadata->>'payment_method' = 'gcash-advance';

-- Payment confirmation wins only while a hold is live. A late payment is kept
-- for refund review and never silently reclaims released capacity.
create or replace function public.record_booking_online_payment(
  p_booking_id uuid,
  p_external_reference text,
  p_amount numeric,
  p_idempotency_key text
) returns public.bookings
language plpgsql security definer set search_path = public as $$
declare
  v_booking public.bookings%rowtype;
  v_expected numeric(12,2);
  v_new_paid numeric(12,2);
  v_new_status text;
begin
  if auth.role() <> 'service_role' then raise exception 'Only the payment server can confirm online payment' using errcode = '42501'; end if;
  select * into v_booking from public.bookings where id = p_booking_id for update;
  if not found then raise exception 'Booking not found' using errcode = 'P0002'; end if;
  if exists (select 1 from public.booking_audit_events where booking_id = p_booking_id and event_type in ('provider_payment_confirmed', 'late_payment_received') and idempotency_key = p_idempotency_key) then return v_booking; end if;
  v_expected := case when v_booking.amount_paid = 0 then v_booking.upfront_required_amount else v_booking.balance_due_amount end;
  if round(coalesce(p_amount, -1), 2) <> v_expected or v_expected <= 0 then raise exception 'Provider amount does not match the required installment' using errcode = '23514'; end if;

  perform set_config('app.booking_workflow_rpc', 'on', true);
  if v_booking.amount_paid = 0 and (v_booking.schedule_status <> 'held' or v_booking.hold_expires_at <= now()) then
    update public.bookings set payment_status = 'refund_pending', payment_reference = p_external_reference,
      amount_paid = round(amount_paid + p_amount, 2),
      metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('ui_status', 'Payment received - schedule review required'),
      updated_at = now()
    where id = p_booking_id returning * into v_booking;
    insert into public.booking_audit_events(booking_id, event_type, actor_role, idempotency_key, from_status, to_status, event_data)
    values (p_booking_id, 'late_payment_received', 'payment_server', p_idempotency_key,
      v_booking.status, v_booking.status, jsonb_build_object('amount', p_amount, 'reference', p_external_reference));
    return v_booking;
  end if;

  v_new_paid := round(v_booking.amount_paid + p_amount, 2);
  v_new_status := case when v_new_paid = v_booking.total_charged_amount then 'paid' else 'partially_paid' end;
  update public.bookings set amount_paid = v_new_paid, payment_status = v_new_status,
    payment_reference = p_external_reference, status = 'confirmed', schedule_status = 'confirmed',
    hold_expires_at = null,
    metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
      'payment_method', 'paymongo-card', 'ui_status',
      case when v_new_status = 'paid' then 'Payment Confirmed' else 'Downpayment Paid' end,
      'payment_proof_submitted', true
    ), updated_at = now()
  where id = p_booking_id returning * into v_booking;
  perform public.refresh_service_slot_capacity(v_booking.slot_id);
  insert into public.booking_audit_events(booking_id, event_type, actor_role, idempotency_key, from_status, to_status, event_data)
  values (p_booking_id, 'provider_payment_confirmed', 'payment_server', p_idempotency_key,
    'pending', 'confirmed', jsonb_build_object('amount', p_amount, 'amount_paid', v_new_paid,
      'balance_due_amount', v_booking.balance_due_amount, 'payment_status', v_new_status,
      'reference', p_external_reference));
  return v_booking;
end;
$$;

-- Align the existing payment-attempt helper with card checkout and 15-minute expiry.
create or replace function public.create_booking_payment_attempt(
  p_booking_id uuid,
  p_idempotency_key text,
  p_environment text default 'test'
) returns public.payment_attempts
language plpgsql security definer set search_path = public as $$
declare
  v_actor uuid := auth.uid();
  v_booking public.bookings%rowtype;
  v_attempt public.payment_attempts%rowtype;
  v_attempt_id uuid := gen_random_uuid();
  v_amount numeric(12,2);
  v_purpose text;
begin
  if v_actor is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  if p_environment not in ('test', 'live') then raise exception 'Invalid payment environment' using errcode = '22023'; end if;
  select * into v_booking from public.bookings where id = p_booking_id for update;
  if not found then raise exception 'Booking not found' using errcode = 'P0002'; end if;
  if v_booking.buyer_id <> v_actor then raise exception 'Only the buyer can start payment' using errcode = '42501'; end if;
  if coalesce(v_booking.metadata->>'payment_method', '') <> 'paymongo-card' then raise exception 'This booking is not configured for PayMongo card payment' using errcode = '23514'; end if;
  if v_booking.payment_status not in ('pending_provider', 'partially_paid') then raise exception 'Booking is not eligible for payment' using errcode = '23514'; end if;
  if v_booking.payment_status <> 'partially_paid' and (v_booking.schedule_status <> 'held' or v_booking.hold_expires_at <= now()) then raise exception 'The reservation expired. Choose another time.' using errcode = '23514'; end if;
  v_purpose := case when v_booking.amount_paid > 0 then 'balance' else 'initial' end;
  v_amount := case when v_purpose = 'balance' then v_booking.balance_due_amount else v_booking.upfront_required_amount end;
  select * into v_attempt from public.payment_attempts where provider = 'paymongo' and idempotency_key = p_idempotency_key;
  if found then return v_attempt; end if;
  select * into v_attempt from public.payment_attempts where booking_id = p_booking_id and purpose = v_purpose
    and status in ('created', 'awaiting_payment', 'processing') and expires_at > now()
    order by created_at desc limit 1;
  if found then return v_attempt; end if;
  insert into public.payment_attempts(id, booking_id, buyer_id, environment, purpose, amount, currency,
    idempotency_key, reference_number, expires_at)
  values (v_attempt_id, p_booking_id, v_actor, p_environment, v_purpose, v_amount,
    coalesce(v_booking.currency, 'PHP'), p_idempotency_key,
    'TW-' || upper(substr(replace(v_attempt_id::text, '-', ''), 1, 20)), now() + interval '15 minutes')
  returning * into v_attempt;
  return v_attempt;
end;
$$;

create or replace function public.record_paymongo_checkout_payment(
  p_event_id text,
  p_event_type text,
  p_checkout_session_id text,
  p_payment_id text,
  p_amount numeric,
  p_currency text,
  p_livemode boolean,
  p_payload_hash text
) returns public.bookings
language plpgsql security definer set search_path = public as $$
declare
  v_attempt public.payment_attempts%rowtype;
  v_booking public.bookings%rowtype;
begin
  if auth.role() <> 'service_role' then
    raise exception 'Only the payment server can record PayMongo payments' using errcode = '42501';
  end if;
  select b.* into v_booking
  from public.payment_provider_events e
  join public.payment_attempts a on a.id = e.payment_attempt_id
  join public.bookings b on b.id = a.booking_id
  where e.provider = 'paymongo' and e.event_id = p_event_id;
  if found then return v_booking; end if;

  select * into v_attempt from public.payment_attempts
  where provider = 'paymongo' and checkout_session_id = p_checkout_session_id for update;
  if not found then raise exception 'PayMongo checkout session was not found' using errcode = 'P0002'; end if;
  if v_attempt.environment <> (case when p_livemode then 'live' else 'test' end) then
    raise exception 'PayMongo environment does not match payment attempt' using errcode = '23514';
  end if;
  if upper(coalesce(p_currency, '')) <> v_attempt.currency
    or round(coalesce(p_amount, -1), 2) <> v_attempt.amount then
    raise exception 'PayMongo amount or currency does not match payment attempt' using errcode = '23514';
  end if;

  if v_attempt.status in ('paid', 'late_paid') then
    if v_attempt.payment_id <> p_payment_id then
      raise exception 'Payment attempt already belongs to another payment' using errcode = '23505';
    end if;
    select * into v_booking from public.bookings where id = v_attempt.booking_id;
  else
    select * into v_booking from public.record_booking_online_payment(
      v_attempt.booking_id, p_payment_id, v_attempt.amount, 'paymongo-payment:' || p_payment_id
    );
    update public.payment_attempts set
      status = case when v_booking.payment_status = 'refund_pending' then 'late_paid' else 'paid' end,
      payment_id = p_payment_id, paid_at = now(), failure_code = null, failure_message = null
    where id = v_attempt.id;
  end if;

  insert into public.payment_provider_events(
    provider, event_id, event_type, resource_id, payment_attempt_id,
    livemode, payload_hash, status, processed_at
  ) values (
    'paymongo', p_event_id, p_event_type, p_checkout_session_id, v_attempt.id,
    p_livemode, p_payload_hash, 'processed', now()
  ) on conflict (provider, event_id) do nothing;
  return v_booking;
end;
$$;

do $$
declare
  v_job_id bigint;
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    select jobid into v_job_id from cron.job where jobname = 'expire-booking-holds' limit 1;
    if v_job_id is not null then perform cron.unschedule(v_job_id); end if;
    perform cron.schedule(
      'expire-booking-holds', '* * * * *',
      $cron$select public.expire_booking_holds(100);$cron$
    );
  end if;
end;
$$;

revoke all on function public.booking_slot_occupancy(bigint, uuid) from public;
revoke all on function public.refresh_service_slot_capacity(bigint) from public;
revoke all on function public.create_booking_request(bigint, text) from public;
revoke all on function public.propose_booking_quote(uuid, numeric, timestamptz, timestamptz, text, text) from public;
revoke all on function public.reject_booking_quote(uuid, integer, text, text) from public;
revoke all on function public.start_booking_checkout(uuid, bigint, bigint, integer, text, text) from public;
revoke all on function public.expire_booking_holds(integer) from public;
revoke all on function public.reschedule_booking(uuid, bigint, text, text) from public;
revoke all on function public.review_booking_reschedule(uuid, text, text, text) from public;
revoke all on function public.cancel_booking(uuid, text, text) from public;
revoke all on function public.review_booking_cancellation(uuid, text, text, text) from public;

grant execute on function public.create_booking_request(bigint, text) to authenticated;
grant execute on function public.propose_booking_quote(uuid, numeric, timestamptz, timestamptz, text, text) to authenticated;
grant execute on function public.reject_booking_quote(uuid, integer, text, text) to authenticated;
grant execute on function public.start_booking_checkout(uuid, bigint, bigint, integer, text, text) to authenticated;
grant execute on function public.reschedule_booking(uuid, bigint, text, text) to authenticated;
grant execute on function public.review_booking_reschedule(uuid, text, text, text) to authenticated;
grant execute on function public.cancel_booking(uuid, text, text) to authenticated;
grant execute on function public.review_booking_cancellation(uuid, text, text, text) to authenticated;
grant execute on function public.expire_booking_holds(integer) to service_role;

comment on column public.bookings.hold_expires_at is
  'Server-owned expiry for an unpaid slot reservation. The browser must not extend it.';
comment on table public.booking_quotes is
  'Versioned provider quotes with an exact proposed schedule.';
comment on table public.booking_reschedule_requests is
  'Approval requests for schedule changes to paid bookings.';
