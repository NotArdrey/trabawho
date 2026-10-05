-- Existing duplicate slots may have bookings, so do not rewrite or delete them.
-- New active windows for one service must not overlap. Adjacent times and
-- windows for different services remain valid; checkout reserves a provider's
-- calendar across services when a client proceeds to payment.
create index if not exists service_slots_active_window_idx
  on public.service_slots (service_id, start_ts, end_ts)
  where status <> 'cancelled';

create or replace function public.guard_service_slot_window()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.end_ts <= new.start_ts then
    raise exception 'End time must be later than start time' using errcode = '23514';
  end if;
  if new.status = 'cancelled' then return new; end if;

  -- A booked legacy duplicate may still change status or capacity. Only reject
  -- a newly created/relocated window or reactivation of a cancelled window.
  if tg_op = 'UPDATE'
    and (new.service_id, new.seller_id, new.start_ts, new.end_ts)
      is not distinct from (old.service_id, old.seller_id, old.start_ts, old.end_ts)
    and old.status <> 'cancelled'
  then return new; end if;

  perform pg_advisory_xact_lock(hashtextextended('service-slot:' || new.service_id::text, 0));
  if exists (
    select 1 from public.service_slots existing
    where existing.service_id = new.service_id
      and existing.id <> new.id
      and existing.status <> 'cancelled'
      and existing.start_ts < new.end_ts
      and existing.end_ts > new.start_ts
  ) then
    raise exception 'This service already has an availability window at that time'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists guard_service_slot_window on public.service_slots;
create trigger guard_service_slot_window
before insert or update of service_id, seller_id, start_ts, end_ts, status
on public.service_slots for each row execute function public.guard_service_slot_window();

-- Materialization must be idempotent even if a legacy weekly template repeats
-- a block or contains overlapping blocks. Keep the first sorted window.
create or replace function public.refresh_service_availability_slots(
  p_horizon_weeks integer default 8
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_inserted integer := 0;
begin
  with recurring_services as (
    select
      service.id as service_id,
      service.seller_id,
      service.metadata -> 'availability_template' as availability_template,
      least(12, greatest(1, coalesce(
        nullif(service.metadata ->> 'availability_horizon_weeks', '')::integer,
        p_horizon_weeks, 8
      ))) as horizon_weeks
    from public.services service
    where service.active = true
      and coalesce(service.metadata ->> 'booking_mode', 'with-slots') = 'with-slots'
      and jsonb_typeof(service.metadata -> 'availability_template') = 'object'
  ),
  recurring_blocks as (
    select service.service_id, service.seller_id, service.horizon_weeks,
      day_template.key as day_key, block_template.value as block
    from recurring_services service
    cross join lateral jsonb_each(service.availability_template) day_template
    cross join lateral jsonb_array_elements(
      case when jsonb_typeof(day_template.value) = 'array' then day_template.value else '[]'::jsonb end
    ) block_template
    where block_template.value ->> 'startTime' ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
      and block_template.value ->> 'endTime' ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
      and (block_template.value ->> 'endTime')::time > (block_template.value ->> 'startTime')::time
  ),
  candidates as (
    select block.service_id, block.seller_id,
      timezone('Asia/Manila', day_value::timestamp + (block.block ->> 'startTime')::time) as start_ts,
      timezone('Asia/Manila', day_value::timestamp + (block.block ->> 'endTime')::time) as end_ts,
      block.day_key, block.block
    from recurring_blocks block
    cross join lateral generate_series(
      current_date + 1, current_date + (block.horizon_weeks * 7), interval '1 day'
    ) day_value
    where extract(isodow from day_value) = case block.day_key
      when 'Mon' then 1 when 'Tue' then 2 when 'Wed' then 3
      when 'Thu' then 4 when 'Fri' then 5 when 'Sat' then 6
      when 'Sun' then 7 else 0
    end
  ),
  unique_candidates as (
    select distinct on (service_id, start_ts, end_ts) *
    from candidates
    order by service_id, start_ts, end_ts
  ),
  accepted_candidates as (
    select candidate.* from unique_candidates candidate
    where not exists (
      select 1 from unique_candidates earlier
      where earlier.service_id = candidate.service_id
        and (earlier.start_ts, earlier.end_ts) < (candidate.start_ts, candidate.end_ts)
        and earlier.start_ts < candidate.end_ts
        and earlier.end_ts > candidate.start_ts
    )
  )
  insert into public.service_slots (
    service_id, seller_id, start_ts, end_ts, capacity, status, visibility, metadata
  )
  select candidate.service_id, candidate.seller_id, candidate.start_ts, candidate.end_ts,
    1, 'available', 'public',
    jsonb_build_object(
      'createdVia', 'recurring-availability',
      'template_day', candidate.day_key,
      'template_start_time', candidate.block ->> 'startTime',
      'template_end_time', candidate.block ->> 'endTime'
    )
  from accepted_candidates candidate
  where not exists (
    select 1 from public.service_slots existing
    where existing.service_id = candidate.service_id
      and existing.status <> 'cancelled'
      and existing.start_ts < candidate.end_ts
      and existing.end_ts > candidate.start_ts
  );

  get diagnostics v_inserted = row_count;
  return v_inserted;
end;
$$;
revoke all on function public.refresh_service_availability_slots(integer) from public;

-- Return one actionable row per actual time window while keeping all legacy
-- rows on disk; if one copy is occupied, another free copy can still be used.
create or replace function public.list_available_service_slots(p_service_ids bigint[])
returns table(id bigint, service_id bigint, seller_id uuid, start_ts timestamptz,
  end_ts timestamptz, capacity integer, status text, visibility text, metadata jsonb)
language sql volatile security definer set search_path = public as $$
  select available.id, available.service_id, available.seller_id,
    available.start_ts, available.end_ts, 1::integer,
    available.status, available.visibility, available.metadata
  from (
    select distinct on (slot.service_id, slot.start_ts, slot.end_ts)
      slot.id, slot.service_id, slot.seller_id, slot.start_ts, slot.end_ts,
      slot.status, slot.visibility,
      coalesce(slot.metadata, '{}'::jsonb) - 'booked_count' - 'bookedCount' as metadata
    from public.service_slots slot
    join public.services service on service.id = slot.service_id
    where service.active = true and slot.service_id = any(p_service_ids)
      and slot.status = 'available' and slot.visibility = 'public' and slot.start_ts > now()
      and public.booking_slot_occupancy(slot.id, null) < greatest(coalesce(slot.capacity, 1), 1)
      and not public.provider_time_conflicts(slot.seller_id, slot.start_ts, slot.end_ts, null)
    order by slot.service_id, slot.start_ts, slot.end_ts, slot.id
  ) available
  order by available.start_ts, available.id;
$$;
revoke all on function public.list_available_service_slots(bigint[]) from public;
grant execute on function public.list_available_service_slots(bigint[]) to anon, authenticated;
