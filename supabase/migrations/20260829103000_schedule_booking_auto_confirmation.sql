-- Run delivered-booking auto-confirmation every 15 minutes. The worker function
-- still atomically rechecks payment, dispute, schedule version, and due time.

create extension if not exists pg_cron with schema pg_catalog;

create or replace function public.auto_confirm_delivered_bookings()
returns integer language plpgsql security definer set search_path = public as $$
declare v_booking public.bookings%rowtype; v_count integer := 0;
begin
  if auth.role() <> 'service_role' and session_user not in ('postgres', 'supabase_admin') then
    raise exception 'Only the booking scheduler can auto-confirm' using errcode = '42501';
  end if;

  for v_booking in
    select * from public.bookings
    where delivery_status = 'seller_claimed'
      and payment_status = 'paid'
      and dispute_status <> 'open'
      and completion_due_at <= now()
      and delivered_schedule_version = schedule_version
      and status in ('confirmed', 'in_progress')
    for update skip locked
  loop
    perform set_config('app.booking_workflow_rpc', 'on', true);
    update public.bookings
    set
      status = 'completed',
      delivery_status = 'buyer_confirmed',
      completed_at = now(),
      completed_by = null,
      dispute_deadline_at = now() + interval '48 hours',
      metadata = coalesce(metadata, '{}'::jsonb)
        || jsonb_build_object('ui_status', 'Completed Service', 'can_rate', true)
    where id = v_booking.id;

    insert into public.booking_audit_events(
      booking_id, event_type, actor_role, idempotency_key, from_status, to_status
    ) values (
      v_booking.id,
      'auto_confirmed_completion',
      'system',
      'auto-' || v_booking.delivered_schedule_version,
      v_booking.status,
      'completed'
    ) on conflict do nothing;
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

revoke all on function public.auto_confirm_delivered_bookings() from public;
grant execute on function public.auto_confirm_delivered_bookings() to service_role;

do $$
declare v_job_id bigint;
begin
  select jobid into v_job_id
  from cron.job
  where jobname = 'booking-auto-confirm-delivered';

  if v_job_id is not null then
    perform cron.unschedule(v_job_id);
  end if;

  perform cron.schedule(
    'booking-auto-confirm-delivered',
    '*/15 * * * *',
    'select public.auto_confirm_delivered_bookings();'
  );
end;
$$;
