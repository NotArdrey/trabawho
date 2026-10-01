-- Keep recurring provider availability materialized as dated, bookable slots.
-- The UI stores the weekly template on services.metadata; checkout operates on
-- concrete service_slots rows so it can lock capacity safely.

update public.services
set metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
  'availability_horizon_weeks', 8,
  'availability_template', jsonb_build_object(
    'Mon', jsonb_build_array(jsonb_build_object('startTime', '09:00', 'endTime', '10:00', 'capacity', 3)),
    'Tue', '[]'::jsonb,
    'Wed', jsonb_build_array(jsonb_build_object('startTime', '13:00', 'endTime', '14:00', 'capacity', 3)),
    'Thu', '[]'::jsonb,
    'Fri', '[]'::jsonb,
    'Sat', jsonb_build_array(jsonb_build_object('startTime', '16:00', 'endTime', '17:00', 'capacity', 3)),
    'Sun', '[]'::jsonb
  )
)
where active = true
  and coalesce(metadata ->> 'booking_mode', 'with-slots') = 'with-slots'
  and not (coalesce(metadata, '{}'::jsonb) ? 'availability_template')
  and (
    coalesce(metadata, '{}'::jsonb) ? 'seed_batch'
    or coalesce(metadata, '{}'::jsonb) ? 'seed_account'
  );

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
      least(
        12,
        greatest(
          1,
          coalesce(
            nullif(service.metadata ->> 'availability_horizon_weeks', '')::integer,
            p_horizon_weeks,
            8
          )
        )
      ) as horizon_weeks
    from public.services service
    where service.active = true
      and coalesce(service.metadata ->> 'booking_mode', 'with-slots') = 'with-slots'
      and jsonb_typeof(service.metadata -> 'availability_template') = 'object'
  ),
  recurring_blocks as (
    select
      service.service_id,
      service.seller_id,
      service.horizon_weeks,
      day_template.key as day_key,
      block_template.value as block
    from recurring_services service
    cross join lateral jsonb_each(service.availability_template) day_template
    cross join lateral jsonb_array_elements(
      case
        when jsonb_typeof(day_template.value) = 'array' then day_template.value
        else '[]'::jsonb
      end
    ) block_template
    where block_template.value ->> 'startTime' ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
      and block_template.value ->> 'endTime' ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
      and (block_template.value ->> 'endTime')::time > (block_template.value ->> 'startTime')::time
  ),
  candidates as (
    select
      block.service_id,
      block.seller_id,
      timezone('Asia/Manila', day_value::timestamp + (block.block ->> 'startTime')::time) as start_ts,
      timezone('Asia/Manila', day_value::timestamp + (block.block ->> 'endTime')::time) as end_ts,
      greatest(1, coalesce(nullif(block.block ->> 'capacity', '')::integer, 1)) as capacity,
      block.day_key,
      block.block
    from recurring_blocks block
    cross join lateral generate_series(
      current_date + 1,
      current_date + (block.horizon_weeks * 7),
      interval '1 day'
    ) day_value
    where extract(isodow from day_value) = case block.day_key
      when 'Mon' then 1 when 'Tue' then 2 when 'Wed' then 3
      when 'Thu' then 4 when 'Fri' then 5 when 'Sat' then 6
      when 'Sun' then 7 else 0
    end
  )
  insert into public.service_slots (
    service_id,
    seller_id,
    start_ts,
    end_ts,
    capacity,
    status,
    visibility,
    metadata
  )
  select
    candidate.service_id,
    candidate.seller_id,
    candidate.start_ts,
    candidate.end_ts,
    candidate.capacity,
    'available',
    'public',
    jsonb_build_object(
      'createdVia', 'recurring-availability',
      'template_day', candidate.day_key,
      'template_start_time', candidate.block ->> 'startTime',
      'template_end_time', candidate.block ->> 'endTime'
    )
  from candidates candidate
  where not exists (
    select 1
    from public.service_slots existing
    where existing.service_id = candidate.service_id
      and existing.start_ts = candidate.start_ts
      and existing.end_ts = candidate.end_ts
  );

  get diagnostics v_inserted = row_count;
  return v_inserted;
end;
$$;

revoke all on function public.refresh_service_availability_slots(integer) from public;

select public.refresh_service_availability_slots(8);

do $$
declare
  v_job_id bigint;
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    select jobid into v_job_id
    from cron.job
    where jobname = 'refresh-service-availability'
    limit 1;

    if v_job_id is not null then
      perform cron.unschedule(v_job_id);
    end if;

    perform cron.schedule(
      'refresh-service-availability',
      '15 16 * * *',
      $cron$select public.refresh_service_availability_slots(8);$cron$
    );
  end if;
end;
$$;

