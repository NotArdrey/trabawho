-- Demo/test policy configuration. No listing receives coverage from its title.
create table public.service_warranty_policies (
  service_id bigint primary key references public.services(id) on delete cascade,
  policy_code text not null check (policy_code = 'repair_workmanship_7d'),
  version text not null,
  duration_days integer not null check (duration_days = 7),
  coverage_summary text not null check (length(trim(coverage_summary)) >= 40),
  enabled boolean not null default true,
  updated_at timestamptz not null default now()
);
alter table public.service_warranty_policies enable row level security;
create policy service_warranty_policies_read on public.service_warranty_policies
  for select to anon, authenticated using (enabled or public.is_current_user_admin());
revoke insert, update, delete on public.service_warranty_policies from anon, authenticated;
grant select on public.service_warranty_policies to anon, authenticated;

-- IDs and exact names designate the known demo repair listings only. The
-- equality guard prevents accidentally designating a different listing in
-- another project; future services require an explicit policy record.
insert into public.service_warranty_policies
  (service_id, policy_code, version, duration_days, coverage_summary)
select s.id, 'repair_workmanship_7d', 'demo-v1', 7,
  'Report a possible issue with the provider''s original repair workmanship within seven days of completion. This starts a rework request, not an automatic refund.'
from public.services s
join (values
  (44::bigint, 'Computer & Printer Repair'),
  (83::bigint, 'Handyman Home Repairs'),
  (94::bigint, 'Plumbing Leak Repair'),
  (97::bigint, 'Appliance Installation & Repair')
) designated(id, title) on s.id = designated.id and s.title = designated.title;

alter table public.bookings
  add column warranty_policy_code text,
  add column warranty_policy_version text,
  add column warranty_duration_days integer,
  add column warranty_coverage_summary text;

create function public.protect_booking_warranty_snapshot()
returns trigger language plpgsql set search_path = public as $$
begin
  if auth.role() = 'authenticated'
    and coalesce(current_setting('app.booking_workflow_rpc', true), '') <> 'on'
    and (new.warranty_policy_code is distinct from old.warranty_policy_code
      or new.warranty_policy_version is distinct from old.warranty_policy_version
      or new.warranty_duration_days is distinct from old.warranty_duration_days
      or new.warranty_coverage_summary is distinct from old.warranty_coverage_summary) then
    raise exception 'Warranty snapshot requires a booking workflow' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger bookings_protect_warranty_snapshot before update on public.bookings
for each row execute function public.protect_booking_warranty_snapshot();

-- The prior wrapper still handles deposit and hold rules. Its temporary title
-- inference is overwritten in this same transaction by explicit policy data.
alter function public.start_booking_checkout(uuid, bigint, bigint, integer, text, text)
  rename to start_booking_checkout_before_explicit_warranty;
create function public.start_booking_checkout(
  p_booking_id uuid default null,
  p_service_id bigint default null,
  p_slot_id bigint default null,
  p_quote_version integer default null,
  p_payment_plan text default 'downpayment',
  p_operation_id text default null
) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_result jsonb; v_booking_id uuid; v_booking public.bookings%rowtype;
begin
  v_result := public.start_booking_checkout_before_explicit_warranty(
    p_booking_id, p_service_id, p_slot_id, p_quote_version, p_payment_plan, p_operation_id
  );
  v_booking_id := (v_result->'booking'->>'id')::uuid;
  perform set_config('app.booking_workflow_rpc', 'on', true);
  update public.bookings b set
    warranty_eligible = coalesce(p.enabled, false),
    warranty_policy_code = case when p.enabled then p.policy_code else null end,
    warranty_policy_version = case when p.enabled then p.version else 'none-at-checkout' end,
    warranty_duration_days = case when p.enabled then p.duration_days else null end,
    warranty_coverage_summary = case when p.enabled then p.coverage_summary else null end
  from public.services s
  left join public.service_warranty_policies p on p.service_id = s.id
  where b.id = v_booking_id and b.service_id = s.id and b.amount_paid = 0
    and b.warranty_policy_version is null
    and b.metadata->>'booking_mode' = 'with-slots';
  select * into v_booking from public.bookings where id = v_booking_id;
  v_result := jsonb_set(v_result, '{booking}', to_jsonb(v_booking), true);
  return v_result;
end;
$$;
revoke all on function public.start_booking_checkout(uuid, bigint, bigint, integer, text, text) from public;
grant execute on function public.start_booking_checkout(uuid, bigint, bigint, integer, text, text) to authenticated;
revoke all on function public.start_booking_checkout_before_explicit_warranty(uuid, bigint, bigint, integer, text, text)
  from public, anon, authenticated;

alter table public.booking_support_cases
  drop constraint if exists booking_support_cases_case_type_check;
alter table public.booking_support_cases
  add constraint booking_support_cases_case_type_check
    check (case_type in ('provider_no_show', 'client_no_show', 'delivery_issue', 'warranty_issue', 'service_issue')),
  add column policy_route text not null default 'support_review'
    check (policy_route in ('rework_request', 'support_review')),
  add column policy_reason text;

create or replace function public.open_booking_support_case(
  p_booking_id uuid, p_case_type text, p_reason text, p_storage_path text, p_idempotency_key text
) returns public.booking_support_cases language plpgsql security definer set search_path = public as $$
declare
  v_booking public.bookings%rowtype;
  v_case public.booking_support_cases%rowtype;
  v_actor uuid := auth.uid();
  v_route text := 'support_review';
  v_policy_reason text;
begin
  if v_actor is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  if nullif(trim(coalesce(p_idempotency_key, '')), '') is null then raise exception 'Operation ID required' using errcode = '22023'; end if;
  if length(trim(coalesce(p_reason, ''))) < 20 then raise exception 'Describe the issue in at least 20 characters' using errcode = '22023'; end if;
  if p_case_type not in ('provider_no_show', 'client_no_show', 'delivery_issue', 'warranty_issue', 'service_issue') then
    raise exception 'Unsupported case type' using errcode = '22023'; end if;
  select * into v_booking from public.bookings where id = p_booking_id for update;
  if not found then raise exception 'Booking not found' using errcode = 'P0002'; end if;
  if v_actor not in (v_booking.buyer_id, v_booking.seller_id) then
    raise exception 'Only booking participants can report a case' using errcode = '42501'; end if;
  select * into v_case from public.booking_support_cases
    where booking_id = p_booking_id and reporter_id = v_actor and case_type = p_case_type;
  if found then return v_case; end if;
  if (p_case_type = 'provider_no_show' and v_actor <> v_booking.buyer_id)
    or (p_case_type = 'client_no_show' and v_actor <> v_booking.seller_id) then
    raise exception 'Only the affected participant can report this no-show' using errcode = '42501'; end if;
  if p_case_type in ('provider_no_show', 'client_no_show')
    and (v_booking.status not in ('confirmed', 'in_progress')
      or v_booking.start_ts is null or now() < v_booking.start_ts) then
    raise exception 'A no-show can only be reported after the appointment begins' using errcode = '23514'; end if;
  if p_case_type = 'delivery_issue'
    and (v_actor <> v_booking.buyer_id or v_booking.delivery_status <> 'seller_claimed') then
    raise exception 'Only the client can dispute a delivery awaiting confirmation' using errcode = '23514'; end if;
  if p_case_type in ('warranty_issue', 'service_issue')
    and (v_actor <> v_booking.buyer_id or v_booking.status <> 'completed') then
    raise exception 'Only the client can report an issue after completion' using errcode = '23514'; end if;
  if p_case_type = 'warranty_issue' then
    if v_booking.warranty_policy_code = 'repair_workmanship_7d'
      and v_booking.warranty_duration_days = 7 and v_booking.completed_at is not null
      and now() <= v_booking.completed_at + interval '7 days' then
      v_route := 'rework_request';
      v_policy_reason := 'Designated repair service, reported within seven days; workmanship still requires provider response.';
    else
      v_policy_reason := case when v_booking.warranty_policy_code is null
        then 'No explicit repair policy was snapshotted for this booking.'
        else 'Report is outside the seven-day window.' end;
    end if;
  elsif p_case_type = 'service_issue' then
    v_policy_reason := 'Service has no automatic repair-workmanship route.';
  end if;
  if p_storage_path is not null and (
    split_part(p_storage_path, '/', 1) <> p_booking_id::text
    or split_part(p_storage_path, '/', 2) <> v_actor::text
    or not exists (select 1 from storage.objects where bucket_id = 'booking-evidence' and name = p_storage_path)
  ) then raise exception 'Case image was not uploaded' using errcode = '23514'; end if;
  insert into public.booking_support_cases
    (booking_id, reporter_id, case_type, reason, storage_path, policy_route, policy_reason, status)
    values (p_booking_id, v_actor, p_case_type, trim(p_reason), p_storage_path,
      v_route, v_policy_reason, case when v_route = 'rework_request' then 'open' else 'under_review' end)
    returning * into v_case;
  perform set_config('app.booking_workflow_rpc', 'on', true);
  update public.bookings set dispute_status = 'open', dispute_opened_at = now(),
    dispute_opened_by = v_actor, dispute_reason = trim(p_reason)
    where id = p_booking_id;
  insert into public.booking_audit_events
    (booking_id, event_type, actor_id, actor_role, reason, idempotency_key, from_status, to_status, event_data)
    values (p_booking_id, 'support_case_opened', v_actor,
      case when v_actor = v_booking.buyer_id then 'buyer' else 'seller' end,
      trim(p_reason), p_idempotency_key, v_booking.status, v_booking.status,
      jsonb_build_object('case_id', v_case.id, 'case_type', p_case_type,
        'policy_route', v_route, 'policy_reason', v_policy_reason));
  return v_case;
end;
$$;
