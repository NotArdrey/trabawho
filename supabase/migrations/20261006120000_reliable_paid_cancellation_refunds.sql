-- Appointment cancellation and payment settlement are separate transactions.
-- Run after 20261006115000_queue_pending_refund_reviews.sql.

create or replace function public.queue_pending_booking_refund_review(p_booking_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_booking public.bookings%rowtype;
  v_case_id uuid;
  v_reason text;
begin
  select * into v_booking from public.bookings where id = p_booking_id for update;
  if not found or v_booking.payment_status <> 'refund_pending' then return; end if;
  -- A cancelled visit owns a dedicated refund case, even if an older issue is open.
  if exists (select 1 from public.booking_support_cases
    where booking_id = p_booking_id and status <> 'closed'
      and (v_booking.status <> 'cancelled' or case_type = 'refund_review')) then return; end if;
  v_reason := case when v_booking.cancellation_status = 'approved'
    then 'A paid cancellation was approved. Support must verify every payment before completing the test refund.'
    when v_booking.status = 'pending' and v_booking.schedule_status <> 'confirmed'
    then 'Payment arrived after the checkout hold expired. Support must verify the payment and refund outcome.'
    else 'This booking has a payment exception requiring support verification.' end;
  insert into public.booking_support_cases
    (booking_id, reporter_id, case_type, reason, status, resolution_status, policy_route, policy_reason)
  values (p_booking_id, v_booking.buyer_id, 'refund_review', v_reason,
    'under_review', 'reviewing', 'support_review',
    'System-created payment exception. Verify every payment before approving a full test refund.')
  on conflict (booking_id) where case_type = 'refund_review' and status <> 'closed' do nothing
  returning id into v_case_id;
  if v_case_id is null then return; end if;
  perform set_config('app.booking_workflow_rpc', 'on', true);
  update public.bookings set dispute_status = 'open', updated_at = now()
    where id = p_booking_id and dispute_status is distinct from 'open';
  insert into public.booking_audit_events
    (booking_id, event_type, actor_role, idempotency_key, event_data)
  values (p_booking_id, 'refund_review_case_opened', 'system',
    'refund-review-case:' || v_case_id,
    jsonb_build_object('case_id', v_case_id, 'case_type', 'refund_review'))
  on conflict do nothing;
end;
$$;

-- An admin decision owns one open case and the server's complete set of paid
-- attempts. A manual or missing receipt must not be silently ignored.
create or replace function public.approve_booking_case_refund(
  p_case_id uuid, p_reason text, p_expected_amount numeric
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_case public.booking_support_cases%rowtype;
  v_booking public.bookings%rowtype;
  v_amount numeric(12,2);
  v_paid_count integer;
  v_verified_count integer;
  v_booking_id uuid;
begin
  if auth.uid() is null or not public.is_current_user_admin() then
    raise exception 'Administrator access required' using errcode = '42501'; end if;
  if length(trim(coalesce(p_reason, ''))) < 20 then
    raise exception 'Approval reason required' using errcode = '22023'; end if;
  select booking_id into v_booking_id from public.booking_support_cases where id = p_case_id;
  if not found then raise exception 'Case not found' using errcode = 'P0002'; end if;
  select * into v_booking from public.bookings where id = v_booking_id for update;
  select * into v_case from public.booking_support_cases where id = p_case_id for update;
  if v_case.assigned_admin_id is distinct from auth.uid() then
    raise exception 'Claim this case before approving a refund' using errcode = '42501'; end if;
  if v_case.status = 'closed' then
    if exists (select 1 from public.booking_refunds where case_id = p_case_id)
      and not exists (select 1 from public.booking_refunds
        where case_id = p_case_id and status not in ('simulated', 'succeeded')) then
      return jsonb_build_object('bookingId', v_booking.id); end if;
    raise exception 'A closed case cannot approve a refund' using errcode = '23514';
  end if;
  if v_booking.status = 'cancelled' and v_booking.cancellation_status = 'approved'
    and v_case.case_type <> 'refund_review' then
    raise exception 'Use the cancellation refund-review case' using errcode = '23514'; end if;
  select count(*), coalesce(sum(amount), 0) into v_paid_count, v_amount
    from public.payment_attempts where booking_id = v_booking.id
      and status in ('paid', 'late_paid');
  select count(*) into v_verified_count from public.payment_attempts a
    where a.booking_id = v_booking.id and a.status in ('paid', 'late_paid')
      and a.payment_id is not null and a.environment = 'test'
      and exists (select 1 from public.payment_provider_events e
        where e.payment_attempt_id = a.id
          and e.event_type = 'checkout_session.payment.paid'
          and e.status = 'processed' and e.processed_at is not null
          and e.livemode = false);
  if v_paid_count = 0 then
    if exists (select 1 from public.booking_refunds where case_id = p_case_id) then
      return jsonb_build_object('bookingId', v_booking.id); end if;
    raise exception 'No refundable payment remains' using errcode = '23514';
  end if;
  if v_paid_count <> v_verified_count then
    raise exception 'Every paid attempt needs verified sandbox payment evidence' using errcode = '23514'; end if;
  if v_amount is distinct from p_expected_amount then
    raise exception 'Refund amount changed; review all current payments' using errcode = '23514'; end if;
  if exists (select 1 from public.booking_refunds r
    join public.payment_attempts a on a.id = r.payment_attempt_id
    where a.booking_id = v_booking.id and a.status in ('paid', 'late_paid')
      and r.case_id <> p_case_id) then
    raise exception 'Another case already owns a payment refund' using errcode = '23514'; end if;
  insert into public.booking_refunds(booking_id, case_id, payment_attempt_id, amount, approved_by, reason)
    select v_booking.id, p_case_id, a.id, a.amount, auth.uid(), trim(p_reason)
    from public.payment_attempts a where a.booking_id = v_booking.id
      and a.status in ('paid', 'late_paid')
    on conflict (payment_attempt_id) do nothing;
  perform set_config('app.booking_workflow_rpc', 'on', true);
  update public.bookings set payment_status = 'refund_pending', dispute_status = 'open'
    where id = v_booking.id;
  update public.booking_support_cases set status = 'under_review' where id = p_case_id;
  insert into public.booking_audit_events
    (booking_id, event_type, actor_id, actor_role, reason, idempotency_key, event_data)
  values (v_booking.id, 'refund_approved', auth.uid(), 'admin',
    'Full sandbox refund approved after support review.', 'refund-approve:' || p_case_id,
    jsonb_build_object('case_id', p_case_id, 'amount', v_amount, 'money_returned', false))
  on conflict do nothing;
  return jsonb_build_object('bookingId', v_booking.id);
end;
$$;

create or replace function public.simulate_booking_case_refund(p_refund_id uuid)
returns public.booking_refunds language plpgsql security definer set search_path = public as $$
declare
  v_booking public.bookings%rowtype;
  v_refund public.booking_refunds%rowtype;
  v_attempt public.payment_attempts%rowtype;
  v_case public.booking_support_cases%rowtype;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'Payment server required' using errcode = '42501'; end if;
  select b.* into v_booking from public.bookings b
    join public.booking_refunds r on r.booking_id = b.id
    where r.id = p_refund_id for update of b;
  if not found then raise exception 'Refund not found' using errcode = 'P0002'; end if;
  select * into v_refund from public.booking_refunds where id = p_refund_id for update;
  if v_refund.status = 'simulated' then return v_refund; end if;
  select * into v_case from public.booking_support_cases where id = v_refund.case_id for update;
  select * into v_attempt from public.payment_attempts where id = v_refund.payment_attempt_id for update;
  if v_case.id is null or v_case.booking_id <> v_booking.id or v_case.status = 'closed'
    or v_case.assigned_admin_id is null or v_refund.approved_by <> v_case.assigned_admin_id
    or v_refund.status <> 'approved' or v_refund.provider_refund_id is not null
    or v_refund.submitted_at is not null or v_attempt.environment <> 'test'
    or v_attempt.status not in ('paid', 'late_paid') or v_attempt.payment_id is null
    or v_refund.amount is distinct from v_attempt.amount
    or v_refund.currency is distinct from v_attempt.currency
    or not exists (select 1 from public.payment_provider_events e
      where e.payment_attempt_id = v_attempt.id
        and e.event_type = 'checkout_session.payment.paid'
        and e.status = 'processed' and e.livemode = false
        and e.processed_at is not null)
  then raise exception 'Sandbox refund requires an admin-owned case and verified test payment'
    using errcode = '23514'; end if;
  update public.booking_refunds set status = 'simulated', updated_at = now()
    where id = p_refund_id returning * into v_refund;
  update public.payment_attempts set status = 'refunded', updated_at = now()
    where id = v_attempt.id;
  insert into public.booking_audit_events(booking_id, event_type, actor_role,
    idempotency_key, event_data)
  values (v_booking.id, 'refund_simulated', 'system', 'sandbox-refund:' || p_refund_id,
    jsonb_build_object('refund_id', p_refund_id, 'case_id', v_case.id,
      'amount', v_refund.amount, 'environment', 'test', 'money_returned', false))
  on conflict do nothing;
  if not exists (select 1 from public.booking_refunds
      where case_id = v_case.id and status not in ('succeeded', 'simulated'))
    and not exists (select 1 from public.payment_attempts
      where booking_id = v_booking.id and status in ('paid', 'late_paid')) then
    update public.booking_support_cases set status = 'closed', closed_at = now(),
      resolution_status = 'resolved' where id = v_case.id and status <> 'closed';
    perform set_config('app.booking_workflow_rpc', 'on', true);
    perform set_config('app.verified_booking_refund', 'on', true);
    update public.bookings set
      status = case when v_booking.status = 'cancelled' then 'cancelled' else 'refunded' end,
      payment_status = 'refunded',
      dispute_status = case when exists (select 1 from public.booking_support_cases c
        where c.booking_id = v_booking.id and c.status <> 'closed') then 'open' else 'closed' end,
      schedule_status = 'released', hold_expires_at = null,
      metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
        'ui_status', case when v_booking.status = 'cancelled' then 'Cancelled' else 'Refund Simulated' end,
        'refund_simulated', true, 'can_rate', false), updated_at = now()
      where id = v_booking.id;
  end if;
  return v_refund;
end;
$$;

-- The preceding migration intentionally skipped bookings with any open case.
-- Repair cancelled visits that need their own refund-owning case.
do $$ declare v_booking_id uuid;
begin
  for v_booking_id in select b.id from public.bookings b
    where b.status = 'cancelled' and b.payment_status = 'refund_pending'
      and not exists (select 1 from public.booking_support_cases c
        where c.booking_id = b.id and c.case_type = 'refund_review' and c.status <> 'closed')
    order by b.id
  loop perform public.queue_pending_booking_refund_review(v_booking_id); end loop;
end; $$;

create or replace function public.cancel_booking(p_booking_id uuid, p_reason text, p_operation_id text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_actor uuid := auth.uid();
  v_booking public.bookings%rowtype;
  v_old_slot_id bigint;
begin
  if v_actor is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  if nullif(trim(coalesce(p_reason, '')), '') is null then raise exception 'A cancellation reason is required' using errcode = '22023'; end if;
  if nullif(trim(coalesce(p_operation_id, '')), '') is null then raise exception 'Operation ID required' using errcode = '22023'; end if;
  select * into v_booking from public.bookings where id = p_booking_id for update;
  if not found then raise exception 'Booking not found' using errcode = 'P0002'; end if;
  if v_actor not in (v_booking.buyer_id, v_booking.seller_id) then
    raise exception 'Only booking participants may request cancellation' using errcode = '42501'; end if;
  if v_booking.status in ('completed', 'cancelled', 'refunded') then
    return jsonb_build_object('booking', to_jsonb(v_booking), 'outcome', 'unchanged'); end if;
  if exists (select 1 from public.booking_audit_events
    where booking_id = p_booking_id and actor_id = v_actor
      and event_type in ('booking_cancelled', 'booking_cancellation_requested')
      and idempotency_key = p_operation_id) then
    return jsonb_build_object('booking', to_jsonb(v_booking),
      'outcome', case when v_booking.cancellation_status = 'requested' then 'review_required' else 'unchanged' end);
  end if;
  if v_booking.cancellation_status = 'requested' then
    if v_booking.cancellation_requested_by = v_actor then
      return jsonb_build_object('booking', to_jsonb(v_booking), 'outcome', 'review_required'); end if;
    raise exception 'The other participant already requested cancellation; review their request'
      using errcode = '23514';
  end if;
  if exists (select 1 from public.booking_support_cases
    where booking_id = p_booking_id and status <> 'closed') then
    raise exception 'An active support case owns this booking. Continue cancellation through support.'
      using errcode = '23514'; end if;
  if v_booking.payment_status in ('partially_paid', 'paid', 'refund_pending') then
    perform set_config('app.booking_workflow_rpc', 'on', true);
    update public.bookings set cancellation_status = 'requested', cancellation_reason = trim(p_reason),
      cancellation_requested_at = now(), cancellation_requested_by = v_actor, updated_at = now()
    where id = p_booking_id returning * into v_booking;
    insert into public.booking_audit_events
      (booking_id, event_type, actor_id, actor_role, reason, idempotency_key, from_status, to_status, event_data)
    values (p_booking_id, 'booking_cancellation_requested', v_actor,
      case when v_actor = v_booking.seller_id then 'seller' else 'buyer' end,
      trim(p_reason), p_operation_id, v_booking.status, v_booking.status, '{}'::jsonb)
    on conflict do nothing;
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
  insert into public.booking_audit_events
    (booking_id, event_type, actor_id, actor_role, reason, idempotency_key, from_status, to_status, event_data)
  values (p_booking_id, 'booking_cancelled', v_actor,
    case when v_actor = v_booking.seller_id then 'seller' else 'buyer' end,
    trim(p_reason), p_operation_id, 'pending', 'cancelled', jsonb_build_object('released_slot_id', v_old_slot_id))
  on conflict do nothing;
  return jsonb_build_object('booking', to_jsonb(v_booking), 'outcome', 'cancelled');
end;
$$;

create or replace function public.review_booking_cancellation(
  p_booking_id uuid, p_decision text, p_reason text, p_operation_id text
) returns public.bookings language plpgsql security definer set search_path = public as $$
declare
  v_actor uuid := auth.uid();
  v_booking public.bookings%rowtype;
  v_old_status text;
  v_old_slot_id bigint;
begin
  if v_actor is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  if p_decision not in ('approve', 'decline') then raise exception 'Decision must be approve or decline' using errcode = '22023'; end if;
  if nullif(trim(coalesce(p_operation_id, '')), '') is null then raise exception 'Operation ID required' using errcode = '22023'; end if;
  select * into v_booking from public.bookings where id = p_booking_id for update;
  if not found then raise exception 'Booking not found' using errcode = 'P0002'; end if;
  if v_actor not in (v_booking.buyer_id, v_booking.seller_id)
    or v_actor = v_booking.cancellation_requested_by then
    raise exception 'Only the other booking participant may review cancellation' using errcode = '42501'; end if;
  if v_booking.cancellation_status <> 'requested' then return v_booking; end if;
  if v_booking.status in ('completed', 'cancelled', 'refunded') then
    raise exception 'This appointment can no longer be cancelled' using errcode = '23514'; end if;
  v_old_status := v_booking.status;
  v_old_slot_id := v_booking.slot_id;
  perform set_config('app.booking_workflow_rpc', 'on', true);
  if p_decision = 'approve' then
    update public.bookings set status = 'cancelled', cancellation_status = 'approved',
      payment_status = 'refund_pending', schedule_status = 'released', hold_expires_at = null,
      metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('ui_status', 'Cancelled'), updated_at = now()
    where id = p_booking_id returning * into v_booking;
    update public.payment_attempts set status = 'cancelled', updated_at = now()
      where booking_id = p_booking_id and status in ('created', 'awaiting_payment', 'processing');
    perform public.refresh_service_slot_capacity(v_old_slot_id);
    -- The status trigger queues the case; this also repairs any older trigger deployment.
    perform public.queue_pending_booking_refund_review(p_booking_id);
  else
    update public.bookings set cancellation_status = 'declined', updated_at = now()
      where id = p_booking_id returning * into v_booking;
  end if;
  insert into public.booking_audit_events
    (booking_id, event_type, actor_id, actor_role, reason, idempotency_key, from_status, to_status, event_data)
  values (p_booking_id,
    'booking_cancellation_' || case when p_decision = 'approve' then 'approved' else 'declined' end,
    v_actor, case when v_actor = v_booking.seller_id then 'seller' else 'buyer' end,
    nullif(trim(coalesce(p_reason, '')), ''), p_operation_id, v_old_status, v_booking.status,
    jsonb_build_object('refund_review_required', p_decision = 'approve'))
  on conflict do nothing;
  return v_booking;
end;
$$;

-- Reconciliation of an earlier provider refund obeys the same case boundary.
create or replace function public.record_booking_refund(
  p_refund_id uuid, p_provider_refund_id text, p_payment_id text,
  p_amount numeric, p_currency text, p_livemode boolean, p_status text
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_refund public.booking_refunds%rowtype;
  v_attempt public.payment_attempts%rowtype;
  v_booking public.bookings%rowtype;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'Payment server required' using errcode = '42501'; end if;
  select b.* into v_booking from public.bookings b
    join public.booking_refunds r on r.booking_id = b.id
    where r.id = p_refund_id for update of b;
  if not found then raise exception 'Refund not found' using errcode = 'P0002'; end if;
  select * into v_refund from public.booking_refunds where id = p_refund_id for update;
  select * into v_attempt from public.payment_attempts where id = v_refund.payment_attempt_id for update;
  if nullif(trim(coalesce(p_provider_refund_id, '')), '') is null
    or p_payment_id is distinct from v_attempt.payment_id
    or p_amount is distinct from v_refund.amount
    or p_currency is distinct from v_refund.currency
    or p_livemode is distinct from (v_attempt.environment = 'live')
    or p_status not in ('pending', 'processing', 'succeeded', 'failed')
    or (v_refund.provider_refund_id is not null and v_refund.provider_refund_id <> p_provider_refund_id) then
    raise exception 'Refund verification mismatch' using errcode = '23514'; end if;
  if v_refund.status = 'succeeded' then return; end if;
  update public.booking_refunds set provider_refund_id = p_provider_refund_id,
    status = p_status, lease_until = null, updated_at = now() where id = p_refund_id;
  insert into public.booking_audit_events(booking_id, event_type, actor_role, idempotency_key, event_data)
  values (v_booking.id, 'refund_' || p_status, 'system', p_provider_refund_id || ':' || p_status,
    jsonb_build_object('refund_id', p_refund_id, 'case_id', v_refund.case_id, 'amount', p_amount))
  on conflict do nothing;
  if p_status = 'succeeded' then
    update public.payment_attempts set status = 'refunded' where id = v_attempt.id;
    if not exists (select 1 from public.booking_refunds
        where case_id = v_refund.case_id and status not in ('succeeded', 'simulated'))
      and not exists (select 1 from public.payment_attempts
        where booking_id = v_booking.id and status in ('paid', 'late_paid')) then
      update public.booking_support_cases set status = 'closed', closed_at = now(),
        resolution_status = 'resolved'
        where id = v_refund.case_id and status <> 'closed';
      perform set_config('app.booking_workflow_rpc', 'on', true);
      perform set_config('app.verified_booking_refund', 'on', true);
      update public.bookings set
        status = case when v_booking.status = 'cancelled' then 'cancelled' else 'refunded' end,
        payment_status = 'refunded',
        dispute_status = case when exists (select 1 from public.booking_support_cases c
          where c.booking_id = v_booking.id and c.status <> 'closed') then 'open' else 'closed' end,
        schedule_status = 'released', hold_expires_at = null,
        metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
          'ui_status', case when v_booking.status = 'cancelled' then 'Cancelled' else 'Refunded' end,
          'can_rate', false), updated_at = now()
        where id = v_booking.id;
    end if;
  end if;
end;
$$;
