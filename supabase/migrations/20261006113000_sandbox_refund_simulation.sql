-- Test payments cannot return real money. Keep the complete case decision and
-- ledger transition, but record an unmistakably simulated result.
alter table public.booking_refunds drop constraint booking_refunds_status_check;
alter table public.booking_refunds add constraint booking_refunds_status_check check
  (status in ('approved', 'processing', 'pending', 'succeeded', 'failed', 'needs_review', 'simulated'));

create function public.simulate_booking_case_refund(p_refund_id uuid)
returns public.booking_refunds language plpgsql security definer set search_path = public as $$
declare
  v_booking public.bookings%rowtype;
  v_refund public.booking_refunds%rowtype;
  v_attempt public.payment_attempts%rowtype;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'Payment server required' using errcode = '42501';
  end if;
  select booking.* into v_booking from public.bookings booking
    join public.booking_refunds refund on refund.booking_id = booking.id
    where refund.id = p_refund_id for update of booking;
  if not found then raise exception 'Refund not found' using errcode = 'P0002'; end if;
  select * into v_refund from public.booking_refunds where id = p_refund_id for update;
  if v_refund.status = 'simulated' then return v_refund; end if;
  select * into v_attempt from public.payment_attempts where id = v_refund.payment_attempt_id for update;
  if v_refund.status <> 'approved' or v_refund.provider_refund_id is not null
    or v_refund.submitted_at is not null or v_attempt.environment <> 'test'
    or v_attempt.status not in ('paid', 'late_paid') or v_attempt.payment_id is null
    or v_refund.amount is distinct from v_attempt.amount
    or not exists (select 1 from public.payment_provider_events event
      where event.payment_attempt_id = v_attempt.id and event.status = 'processed'
        and event.livemode = false and event.processed_at is not null)
  then raise exception 'Sandbox refund simulation requires an unsubmitted verified test payment'
    using errcode = '23514'; end if;

  update public.booking_refunds set status = 'simulated', updated_at = now()
    where id = p_refund_id returning * into v_refund;
  update public.payment_attempts set status = 'refunded', updated_at = now()
    where id = v_attempt.id;
  insert into public.booking_audit_events(booking_id, event_type, actor_role,
    idempotency_key, event_data)
  values (v_booking.id, 'refund_simulated', 'system', 'sandbox-refund:' || p_refund_id,
    jsonb_build_object('refund_id', p_refund_id, 'amount', v_refund.amount,
      'environment', 'test', 'money_returned', false)) on conflict do nothing;

  if not exists (select 1 from public.booking_refunds
      where booking_id = v_booking.id and status not in ('succeeded', 'simulated'))
    and not exists (select 1 from public.payment_attempts
      where booking_id = v_booking.id and status in ('paid', 'late_paid')) then
    perform set_config('app.booking_workflow_rpc', 'on', true);
    perform set_config('app.verified_booking_refund', 'on', true);
    update public.bookings set status = 'refunded', payment_status = 'refunded',
      dispute_status = 'closed', schedule_status = 'released', hold_expires_at = null,
      metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
        'ui_status', 'Refund Simulated', 'refund_simulated', true, 'can_rate', false),
      updated_at = now()
      where id = v_booking.id;
    update public.booking_support_cases set status = 'closed', closed_at = now()
      where booking_id = v_booking.id and status <> 'closed';
  end if;
  return v_refund;
end;
$$;
revoke all on function public.simulate_booking_case_refund(uuid) from public;
grant execute on function public.simulate_booking_case_refund(uuid) to service_role;

create or replace function public.notify_booking_case_refund()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_booking public.bookings%rowtype; v_message public.booking_case_messages%rowtype; v_body text;
begin
  if new.status = old.status then return new; end if;
  select * into v_booking from public.bookings where id = new.booking_id;
  v_body := case new.status
    when 'simulated' then 'The test refund process was completed in the sandbox. No real money was returned by PayMongo.'
    when 'succeeded' then 'PayMongo confirmed the refund to the original payment method. Check the refund status in your booking.'
    when 'failed' then 'The refund attempt failed. Support is reviewing the provider response; the case remains open.'
    when 'needs_review' then 'The refund needs payment review. Support is checking the provider status; no completion is claimed.'
    else 'The refund status changed to ' || replace(new.status,'_',' ') || '. Check the booking for current progress.' end;
  insert into public.booking_case_messages(case_id,author_id,author_role,audience,body,operation_id)
    values(new.case_id,new.approved_by,'system','both',v_body,gen_random_uuid()) returning * into v_message;
  insert into public.booking_case_notifications(case_id,message_id,recipient_id)
    select new.case_id,v_message.id,recipient from unnest(array[v_booking.buyer_id,v_booking.seller_id]) recipient
    on conflict do nothing;
  update public.booking_support_cases set resolution_status = case
    when new.status in ('succeeded', 'simulated') and status = 'closed' then 'resolved'
    when new.status in ('failed','needs_review') then 'refund_failed' else 'refund_pending' end
    where id = new.case_id;
  return new;
end;
$$;
