-- Preserve all original appointment facts. A proposed slot is not occupied until both parties accept.
create table public.booking_case_replacement_visits (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.booking_support_cases(id) on delete restrict,
  booking_id uuid not null references public.bookings(id) on delete restrict,
  slot_id bigint not null references public.service_slots(id),
  proposed_by uuid not null references auth.users(id),
  reason text not null check (length(trim(reason)) >= 20),
  status text not null default 'proposed' check (status in ('proposed','accepted','delivered','unavailable','declined','completed')),
  client_accepted_at timestamptz,
  provider_accepted_at timestamptz,
  accepted_at timestamptz,
  started_at timestamptz,
  delivery_note text,
  delivery_storage_path text,
  delivered_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index booking_case_one_active_visit on public.booking_case_replacement_visits(case_id)
  where status in ('proposed','accepted','delivered');
create index booking_case_accepted_slot on public.booking_case_replacement_visits(slot_id)
  where status in ('accepted','delivered','completed');
alter table public.booking_case_replacement_visits enable row level security;
create policy booking_case_replacement_visits_read on public.booking_case_replacement_visits for select to authenticated
using (public.is_current_user_admin() or exists (
  select 1 from public.bookings b where b.id = booking_id and auth.uid() in (b.buyer_id,b.seller_id)
));
revoke insert, update, delete on public.booking_case_replacement_visits from anon, authenticated;
grant select on public.booking_case_replacement_visits to authenticated;

-- Existing checkout and reschedule capacity checks must include accepted replacement visits.
create or replace function public.booking_slot_occupancy(p_slot_id bigint, p_exclude_booking_id uuid default null)
returns integer language sql stable security definer set search_path = public as $$
  select (
    (select count(*) from public.bookings b where b.slot_id = p_slot_id
      and (p_exclude_booking_id is null or b.id <> p_exclude_booking_id)
      and b.status not in ('cancelled','refunded')
      and (b.schedule_status in ('confirmed','reschedule_requested')
        or (b.schedule_status = 'held' and b.hold_expires_at > now())))
    + (select count(*) from public.booking_case_replacement_visits rv where rv.slot_id = p_slot_id
      and rv.status in ('accepted','delivered','completed')
      and (p_exclude_booking_id is null or rv.booking_id <> p_exclude_booking_id))
  )::integer;
$$;

create function public.propose_booking_case_replacement(p_case_id uuid, p_slot_id bigint, p_reason text)
returns public.booking_case_replacement_visits language plpgsql security definer set search_path = public as $$
declare v_case public.booking_support_cases%rowtype; v_booking public.bookings%rowtype;
  v_slot public.service_slots%rowtype; v_visit public.booking_case_replacement_visits%rowtype;
begin
  if not public.is_current_user_admin() then raise exception 'Administrator access required' using errcode = '42501'; end if;
  if length(trim(coalesce(p_reason,''))) < 20 then raise exception 'Decision reason required' using errcode = '22023'; end if;
  select * into v_case from public.booking_support_cases where id = p_case_id for update;
  if not found or v_case.case_type <> 'provider_no_show' or v_case.status = 'closed' then
    raise exception 'An open provider no-show case is required' using errcode = '23514'; end if;
  select * into v_booking from public.bookings where id = v_case.booking_id for update;
  if v_booking.delivery_status <> 'not_delivered'
    or exists(select 1 from public.booking_delivery_evidence e where e.booking_id = v_booking.id
      and e.schedule_version = v_booking.schedule_version)
    or v_booking.payment_status in ('refund_pending','refunded')
    or exists (select 1 from public.booking_refunds where booking_id = v_booking.id) then
    raise exception 'A refunded or delivered booking cannot receive a replacement visit' using errcode = '23514'; end if;
  select * into v_slot from public.service_slots where id = p_slot_id;
  if not found or v_slot.service_id <> v_booking.service_id or v_slot.seller_id <> v_booking.seller_id
    or v_slot.status = 'cancelled' or v_slot.start_ts <= now() then
    raise exception 'Choose a future slot from the same provider and service' using errcode = '23514'; end if;
  insert into public.booking_case_replacement_visits(case_id, booking_id, slot_id, proposed_by, reason)
    values (p_case_id, v_booking.id, p_slot_id, auth.uid(), trim(p_reason)) returning * into v_visit;
  update public.booking_support_cases set assigned_admin_id = coalesce(assigned_admin_id, auth.uid()),
    status = 'under_review', resolution_status = 'replacement_proposed', response_due_at = null,
    decision_reason = trim(p_reason) where id = p_case_id;
  return v_visit;
end;
$$;
revoke all on function public.propose_booking_case_replacement(uuid, bigint, text) from public;
grant execute on function public.propose_booking_case_replacement(uuid, bigint, text) to authenticated;

create function public.respond_booking_case_replacement(p_visit_id uuid, p_accept boolean)
returns public.booking_case_replacement_visits language plpgsql security definer set search_path = public as $$
declare v_visit public.booking_case_replacement_visits%rowtype; v_case public.booking_support_cases%rowtype;
  v_booking public.bookings%rowtype; v_slot public.service_slots%rowtype; v_actor uuid := auth.uid();
begin
  select * into v_visit from public.booking_case_replacement_visits where id = p_visit_id;
  if not found then raise exception 'Replacement visit not found' using errcode = 'P0002'; end if;
  select * into v_case from public.booking_support_cases where id = v_visit.case_id for update;
  select * into v_booking from public.bookings where id = v_visit.booking_id for update;
  select * into v_visit from public.booking_case_replacement_visits where id = p_visit_id for update;
  if v_actor not in (v_booking.buyer_id,v_booking.seller_id) then
    raise exception 'Only booking participants may respond' using errcode = '42501'; end if;
  if v_visit.status = 'accepted' then return v_visit; end if;
  if v_visit.status <> 'proposed' or v_case.status = 'closed' then
    raise exception 'This proposal is no longer active' using errcode = '23514'; end if;
  if not p_accept then
    update public.booking_case_replacement_visits set status = 'declined' where id = p_visit_id returning * into v_visit;
    update public.booking_support_cases set resolution_status = 'reviewing' where id = v_case.id;
    return v_visit;
  end if;
  update public.booking_case_replacement_visits set
    client_accepted_at = case when v_actor = v_booking.buyer_id then now() else client_accepted_at end,
    provider_accepted_at = case when v_actor = v_booking.seller_id then now() else provider_accepted_at end
    where id = p_visit_id returning * into v_visit;
  if v_visit.client_accepted_at is not null and v_visit.provider_accepted_at is not null then
    select * into v_slot from public.service_slots where id = v_visit.slot_id for update;
    if v_slot.start_ts <= now() or v_slot.status = 'cancelled'
      or public.booking_slot_occupancy(v_slot.id, v_booking.id)
        >= greatest(coalesce(v_slot.capacity,1),1) then
      update public.booking_case_replacement_visits set status = 'unavailable' where id = p_visit_id returning * into v_visit;
      update public.booking_support_cases set resolution_status = 'reviewing' where id = v_case.id;
      return v_visit;
    end if;
    update public.booking_case_replacement_visits set status = 'accepted', accepted_at = now()
      where id = p_visit_id returning * into v_visit;
    perform public.refresh_service_slot_capacity(v_slot.id);
    update public.booking_support_cases set resolution_status = 'replacement_accepted' where id = v_case.id;
  end if;
  return v_visit;
end;
$$;
revoke all on function public.respond_booking_case_replacement(uuid, boolean) from public;
grant execute on function public.respond_booking_case_replacement(uuid, boolean) to authenticated;

-- A refund approval is an admin decision, not evidence of a completed refund.
-- The existing provider-backed refund processor continues to own money state.
create or replace function public.approve_no_show_case_refund(p_case_id uuid, p_reason text, p_expected_amount numeric)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_case public.booking_support_cases%rowtype; v_booking public.bookings%rowtype; v_result jsonb;
begin
  if not public.is_current_user_admin() then raise exception 'Administrator access required' using errcode = '42501'; end if;
  select * into v_case from public.booking_support_cases where id = p_case_id for update;
  if not found or v_case.case_type <> 'provider_no_show' or v_case.status = 'closed' then
    raise exception 'An open provider no-show case is required' using errcode = '23514'; end if;
  select * into v_booking from public.bookings where id = v_case.booking_id for update;
  if not exists(select 1 from public.booking_case_messages m where m.case_id = p_case_id
      and m.author_role = 'admin' and m.audience in ('provider','both'))
    or (not exists(select 1 from public.booking_case_messages m where m.case_id = p_case_id
      and m.author_role = 'provider' and m.audience = 'admin')
      and (v_case.response_due_at is null or v_case.response_due_at > now())) then
    raise exception 'Request the provider response and wait for a reply or the 24-hour review target' using errcode = '23514'; end if;
  if exists(select 1 from public.booking_case_replacement_visits where case_id = p_case_id and status in ('proposed','accepted','completed')) then
    raise exception 'Resolve the replacement visit before approving a refund' using errcode = '23514'; end if;
  if not exists(select 1 from public.payment_attempts a join public.payment_provider_events e
      on e.payment_attempt_id = a.id and e.provider = 'paymongo' and e.status = 'processed'
      and e.livemode = false and e.processed_at is not null
      where a.booking_id = v_booking.id and a.status in ('paid','late_paid')
        and a.payment_id is not null and a.environment = 'test')
    or exists(select 1 from public.payment_attempts a where a.booking_id = v_booking.id
      and a.status in ('paid','late_paid') and a.payment_id is not null
      and not exists(select 1 from public.payment_provider_events e
        where e.payment_attempt_id = a.id and e.provider = 'paymongo'
          and e.status = 'processed' and e.livemode = false and e.processed_at is not null)) then
    raise exception 'Provider-confirmed test payment events are required for every refundable attempt' using errcode = '23514'; end if;
  if length(trim(coalesce(p_reason,''))) < 20 then raise exception 'Decision reason required' using errcode = '22023'; end if;
  update public.booking_support_cases set assigned_admin_id = coalesce(assigned_admin_id, auth.uid()),
    decision_reason = trim(p_reason) where id = p_case_id;
  perform set_config('app.no_show_refund_review','on',true);
  v_result := public.approve_booking_case_refund(p_case_id, p_reason, p_expected_amount);
  update public.booking_support_cases set resolution_status = 'refund_pending' where id = p_case_id;
  return v_result;
end;
$$;
revoke all on function public.approve_no_show_case_refund(uuid, text, numeric) from public;
grant execute on function public.approve_no_show_case_refund(uuid, text, numeric) to authenticated;

create function public.guard_no_show_refund_decision()
returns trigger language plpgsql set search_path = public as $$
declare v_case public.booking_support_cases%rowtype;
begin
  select * into v_case from public.booking_support_cases where id = new.case_id;
  if v_case.case_type = 'provider_no_show' and (
    coalesce(current_setting('app.no_show_refund_review',true),'') <> 'on'
    or
    v_case.decision_reason is null or v_case.decision_reason <> new.reason
    or exists(select 1 from public.booking_case_replacement_visits
      where case_id = v_case.id and status in ('proposed','accepted','completed'))
  ) then raise exception 'A reviewed no-show decision is required before refund approval' using errcode = '23514'; end if;
  return new;
end;
$$;
create trigger booking_refunds_guard_no_show before insert on public.booking_refunds
  for each row execute function public.guard_no_show_refund_decision();

create policy payment_provider_events_admin_case on public.payment_provider_events for select to authenticated
using (public.is_current_user_admin() and exists (
  select 1 from public.payment_attempts a join public.booking_support_cases c on c.booking_id = a.booking_id
    where a.id = payment_attempt_id
));
grant select (event_id,event_type,payment_attempt_id,livemode,status,processed_at)
  on public.payment_provider_events to authenticated;

