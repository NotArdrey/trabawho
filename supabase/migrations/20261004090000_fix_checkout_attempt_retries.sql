-- Resolve retries through the attempt recorded in the audit event, including reused attempts.
create or replace function public.start_booking_checkout_before_deposit_policy(
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
    where booking_id = v_booking.id
      and id = (select (event_data->>'attempt_id')::uuid from public.booking_audit_events
        where booking_id = v_booking.id and event_type = 'booking_checkout_started'
          and actor_id = v_actor and idempotency_key = p_operation_id limit 1);
    if not found then raise exception 'Payment reservation is unavailable. Please try again.' using errcode = '23514'; end if;
    if v_attempt.status not in ('created', 'awaiting_payment', 'processing') or v_attempt.expires_at <= now() then
      raise exception 'Payment reservation has expired. Please choose your time again.' using errcode = '23514';
    end if;
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
    if v_attempt.amount <> (case when v_booking.amount_paid > 0
      then v_booking.balance_due_amount else v_booking.upfront_required_amount end) then
      raise exception 'An unpaid checkout has a different amount. Wait for it to expire before changing your payment plan.' using errcode = '23514';
    end if;
    if v_booking.schedule_status = 'held' then
      -- Reusing a checkout must preserve the same payment/reservation deadline.
      update public.bookings set hold_expires_at = v_attempt.expires_at
      where id = v_booking.id returning * into v_booking;
    end if;
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
