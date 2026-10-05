-- Preserve historical bookings, but make every remaining slot a one-client
-- reservation and reject overlapping future claims for a solo provider.

create or replace function public.provider_time_conflicts(
  p_seller_id uuid, p_start_ts timestamptz, p_end_ts timestamptz,
  p_exclude_booking_id uuid default null
) returns boolean language sql volatile security definer set search_path = public as $$
  select exists (
    select 1 from public.bookings booking
    where booking.seller_id = p_seller_id
      and (p_exclude_booking_id is null or booking.id <> p_exclude_booking_id)
      -- A completed visit still owns its original window. Only cancellation
      -- or a refund releases that time for another client.
      and booking.status not in ('cancelled', 'refunded')
      and (booking.schedule_status in ('confirmed', 'reschedule_requested')
        or (booking.schedule_status = 'held' and booking.hold_expires_at > now()))
      and booking.start_ts is not null and booking.end_ts > booking.start_ts
      and tstzrange(booking.start_ts, booking.end_ts, '[)')
        && tstzrange(p_start_ts, p_end_ts, '[)')
  ) or exists (
    select 1 from public.booking_case_replacement_visits visit
    join public.bookings booking on booking.id = visit.booking_id
    join public.service_slots slot on slot.id = visit.slot_id
    where booking.seller_id = p_seller_id
      and (p_exclude_booking_id is null or booking.id <> p_exclude_booking_id)
      and booking.status not in ('cancelled', 'refunded')
      and visit.status in ('accepted', 'delivered')
      and slot.end_ts > slot.start_ts
      and tstzrange(slot.start_ts, slot.end_ts, '[)')
        && tstzrange(p_start_ts, p_end_ts, '[)')
  );
$$;

create or replace function public.guard_provider_booking_time()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status in ('cancelled', 'refunded', 'completed')
    or new.schedule_status not in ('held', 'confirmed', 'reschedule_requested')
    or (new.schedule_status = 'held' and (new.hold_expires_at is null or new.hold_expires_at <= now()))
  then return new; end if;
  if new.start_ts is null or new.end_ts is null or new.end_ts <= new.start_ts then
    raise exception 'A valid appointment time is required' using errcode = '23514';
  end if;

  -- All checkout and rescheduling paths serialize on the provider, not on a
  -- service-specific slot. Rechecking after the lock closes the race between
  -- two clients choosing separate services at the same time.
  perform pg_advisory_xact_lock(hashtextextended('provider-calendar:' || new.seller_id::text, 0));
  if new.slot_id is not null and public.booking_slot_occupancy(new.slot_id, new.id) > 0 then
    raise exception 'Selected time was just booked. Choose another available time.' using errcode = '23514';
  end if;
  if public.provider_time_conflicts(new.seller_id, new.start_ts, new.end_ts, new.id) then
    raise exception 'This provider already has a booking at that time' using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists guard_provider_booking_time on public.bookings;
create trigger guard_provider_booking_time
before insert or update of seller_id, service_id, slot_id, start_ts, end_ts,
  status, schedule_status, hold_expires_at
on public.bookings for each row execute function public.guard_provider_booking_time();

-- Legacy capacity=2/3 rows were intentionally retained by the first calendar
-- migration. Normalize only still-upcoming slots; never remove either booking
-- from an already-conflicting historical pair.
with occupancy as (
  select id, public.booking_slot_occupancy(id, null) as booked_count
  from public.service_slots
  where status <> 'cancelled' and end_ts > now()
)
update public.service_slots slot
set capacity = 1,
    status = case when occupancy.booked_count > 0 then 'booked' else slot.status end,
    metadata = jsonb_set(coalesce(slot.metadata, '{}'::jsonb),
      '{booked_count}', to_jsonb(occupancy.booked_count), true),
    updated_at = now()
from occupancy
where slot.id = occupancy.id
  and (slot.capacity is distinct from 1
    or (occupancy.booked_count > 0 and slot.status <> 'booked'));
