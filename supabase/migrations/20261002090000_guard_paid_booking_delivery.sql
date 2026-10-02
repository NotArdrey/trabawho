-- Keep the existing delivery workflow and audit contract, but enforce its payment
-- and schedule prerequisites in the database rather than only in the browser.
create or replace function public.mark_booking_delivered(
  p_booking_id uuid,
  p_idempotency_key text
) returns public.bookings
language plpgsql security definer set search_path = public as $$
declare
  v_booking public.bookings%rowtype;
  v_actor uuid := auth.uid();
begin
  if v_actor is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  if nullif(trim(p_idempotency_key), '') is null then raise exception 'Idempotency key required' using errcode = '22023'; end if;

  select * into v_booking from public.bookings where id = p_booking_id for update;
  if not found then raise exception 'Booking not found' using errcode = 'P0002'; end if;
  if v_booking.seller_id <> v_actor then raise exception 'Only the seller can claim delivery' using errcode = '42501'; end if;
  if exists (
    select 1 from public.booking_audit_events
    where booking_id = p_booking_id and event_type = 'seller_delivered'
      and actor_id = v_actor and idempotency_key = p_idempotency_key
  ) then return v_booking; end if;
  if v_booking.status not in ('confirmed', 'in_progress')
    or v_booking.delivery_status is distinct from 'not_delivered' then
    raise exception 'Booking is not eligible for delivery' using errcode = '23514';
  end if;
  if v_booking.payment_status is distinct from 'paid' then
    raise exception 'Payment must be confirmed before delivery' using errcode = '23514';
  end if;
  if v_booking.schedule_status is distinct from 'confirmed' then
    raise exception 'The booking schedule must be confirmed before delivery' using errcode = '23514';
  end if;
  if v_booking.dispute_status = 'open' then raise exception 'Disputed booking cannot be delivered' using errcode = '23514'; end if;

  perform set_config('app.booking_workflow_rpc', 'on', true);
  update public.bookings set
    delivery_status = 'seller_claimed',
    delivered_at = now(),
    delivered_by = v_actor,
    delivered_schedule_version = schedule_version,
    completion_due_at = now() + interval '72 hours',
    metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('ui_status', 'Service Delivered')
  where id = p_booking_id returning * into v_booking;

  insert into public.booking_audit_events(booking_id, event_type, actor_id, actor_role, idempotency_key, from_status, to_status, event_data)
  values (p_booking_id, 'seller_delivered', v_actor, 'seller', p_idempotency_key, v_booking.status, v_booking.status,
    jsonb_build_object('early_delivery', v_booking.end_ts is not null and now() < v_booking.end_ts, 'schedule_version', v_booking.schedule_version));
  return v_booking;
end;
$$;

revoke all on function public.mark_booking_delivered(uuid, text) from public;
grant execute on function public.mark_booking_delivered(uuid, text) to authenticated;
