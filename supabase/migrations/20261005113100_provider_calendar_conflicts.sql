-- A solo provider may publish many gigs but cannot reserve overlapping jobs.
-- The same transaction-scoped lock serializes checkout, reschedule, and case-visit acceptance.
create or replace function public.provider_time_conflicts(
  p_seller_id uuid, p_start_ts timestamptz, p_end_ts timestamptz,
  p_exclude_booking_id uuid default null
) returns boolean language sql volatile security definer set search_path = public as $$
  select exists (
    select 1 from public.bookings booking
    where booking.seller_id = p_seller_id
      and (p_exclude_booking_id is null or booking.id <> p_exclude_booking_id)
      and booking.status not in ('cancelled', 'refunded', 'completed')
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
revoke all on function public.provider_time_conflicts(uuid, timestamptz, timestamptz, uuid) from public;

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
  perform pg_advisory_xact_lock(hashtextextended('provider-calendar:' || new.seller_id::text, 0));
  if public.provider_time_conflicts(new.seller_id, new.start_ts, new.end_ts, new.id) then
    raise exception 'This provider already has a booking at that time' using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists guard_provider_booking_time on public.bookings;
create trigger guard_provider_booking_time
before insert or update of seller_id, start_ts, end_ts, status, schedule_status, hold_expires_at
on public.bookings for each row execute function public.guard_provider_booking_time();

create or replace function public.guard_provider_replacement_time()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_booking public.bookings%rowtype; v_slot public.service_slots%rowtype;
begin
  if new.status not in ('accepted', 'delivered') then return new; end if;
  select * into v_booking from public.bookings where id = new.booking_id;
  select * into v_slot from public.service_slots where id = new.slot_id;
  if not found or v_booking.id is null or v_slot.seller_id <> v_booking.seller_id
    or v_slot.end_ts <= v_slot.start_ts then
    raise exception 'Replacement time is invalid' using errcode = '23514';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('provider-calendar:' || v_booking.seller_id::text, 0));
  if public.provider_time_conflicts(v_booking.seller_id, v_slot.start_ts, v_slot.end_ts, v_booking.id) then
    raise exception 'This provider already has a booking at that time' using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists guard_provider_replacement_time on public.booking_case_replacement_visits;
create trigger guard_provider_replacement_time
before insert or update of status, slot_id, booking_id
on public.booking_case_replacement_visits for each row
execute function public.guard_provider_replacement_time();

-- A confirmed visit must not silently move when the provider edits its slot.
create or replace function public.guard_reserved_slot_identity()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (new.start_ts, new.end_ts, new.seller_id, new.service_id)
      is distinct from (old.start_ts, old.end_ts, old.seller_id, old.service_id)
    and public.booking_slot_occupancy(old.id, null) > 0 then
    raise exception 'This time has a booking. Reschedule the booking instead of editing the slot'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists guard_reserved_slot_identity on public.service_slots;
create trigger guard_reserved_slot_identity
before update of start_ts, end_ts, seller_id, service_id
on public.service_slots for each row execute function public.guard_reserved_slot_identity();

-- Legacy clients can still submit a larger per-service number; it must not
-- create parallel capacity for a solo provider. Historical values stay intact.
create or replace function public.enforce_solo_slot_capacity()
returns trigger language plpgsql set search_path = public as $$
begin
  new.capacity := 1;
  return new;
end;
$$;

drop trigger if exists enforce_solo_slot_capacity on public.service_slots;
create trigger enforce_solo_slot_capacity
before insert or update of capacity on public.service_slots
for each row execute function public.enforce_solo_slot_capacity();

-- Public availability reveals only free slots, never other customers' bookings.
create or replace function public.list_available_service_slots(p_service_ids bigint[])
returns table(id bigint, service_id bigint, seller_id uuid, start_ts timestamptz,
  end_ts timestamptz, capacity integer, status text, visibility text, metadata jsonb)
language sql volatile security definer set search_path = public as $$
  select slot.id, slot.service_id, slot.seller_id, slot.start_ts, slot.end_ts,
    1::integer, slot.status, slot.visibility,
    coalesce(slot.metadata, '{}'::jsonb) - 'booked_count' - 'bookedCount'
  from public.service_slots slot
  join public.services service on service.id = slot.service_id
  where service.active = true and slot.service_id = any(p_service_ids)
    and slot.status = 'available' and slot.visibility = 'public' and slot.start_ts > now()
    and public.booking_slot_occupancy(slot.id, null) < greatest(coalesce(slot.capacity, 1), 1)
    and not public.provider_time_conflicts(slot.seller_id, slot.start_ts, slot.end_ts, null)
  order by slot.start_ts, slot.id;
$$;
revoke all on function public.list_available_service_slots(bigint[]) from public;
grant execute on function public.list_available_service_slots(bigint[]) to anon, authenticated;

create index if not exists bookings_provider_time_idx
  on public.bookings (seller_id, start_ts, end_ts)
  where status not in ('cancelled', 'refunded', 'completed');
