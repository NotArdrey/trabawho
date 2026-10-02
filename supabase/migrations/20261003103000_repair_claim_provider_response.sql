-- A provider may answer a designated repair rework request once. The answer
-- records a proposal or escalation, never a finding of coverage or a refund.
alter table public.booking_support_cases
  add column provider_response_action text
    check (provider_response_action in ('offer_rework', 'request_support_review')),
  add column provider_response_text text
    check (provider_response_text is null or length(trim(provider_response_text)) >= 20),
  add column provider_response_storage_path text,
  add column provider_responded_at timestamptz,
  add column provider_responded_by uuid references auth.users(id),
  add column provider_response_operation_id text;

create function public.respond_to_repair_claim(
  p_case_id uuid, p_action text, p_response text,
  p_storage_path text, p_operation_id text
) returns public.booking_support_cases
language plpgsql security definer set search_path = public as $$
declare
  v_case public.booking_support_cases%rowtype;
  v_booking public.bookings%rowtype;
  v_actor uuid := auth.uid();
begin
  if v_actor is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  if nullif(trim(coalesce(p_operation_id, '')), '') is null then
    raise exception 'Operation ID required' using errcode = '22023'; end if;
  if p_action not in ('offer_rework', 'request_support_review') then
    raise exception 'Unsupported response' using errcode = '22023'; end if;
  if length(trim(coalesce(p_response, ''))) < 20 then
    raise exception 'Explain your response in at least 20 characters' using errcode = '22023'; end if;

  select * into v_case from public.booking_support_cases where id = p_case_id for update;
  if not found then raise exception 'Support case not found' using errcode = 'P0002'; end if;
  select * into v_booking from public.bookings where id = v_case.booking_id;
  if v_actor <> v_booking.seller_id then
    raise exception 'Only the booked provider can answer this claim' using errcode = '42501'; end if;
  if v_case.provider_response_operation_id = p_operation_id then
    if v_case.provider_response_action <> p_action or v_case.provider_response_text <> trim(p_response)
      or v_case.provider_response_storage_path is distinct from p_storage_path then
      raise exception 'Operation ID was already used for another response' using errcode = '23505';
    end if;
    return v_case;
  end if;
  if v_case.case_type <> 'warranty_issue' or v_case.policy_route <> 'rework_request'
    or v_case.status <> 'open' or v_case.provider_responded_at is not null then
    raise exception 'This repair claim is not awaiting a provider response' using errcode = '23514';
  end if;
  if p_storage_path is not null and (
    split_part(p_storage_path, '/', 1) <> v_case.booking_id::text
    or split_part(p_storage_path, '/', 2) <> v_actor::text
    or not exists (select 1 from storage.objects
      where bucket_id = 'booking-evidence' and name = p_storage_path)
  ) then raise exception 'Response image was not uploaded' using errcode = '23514'; end if;

  update public.booking_support_cases set
    provider_response_action = p_action,
    provider_response_text = trim(p_response),
    provider_response_storage_path = p_storage_path,
    provider_responded_at = now(),
    provider_responded_by = v_actor,
    provider_response_operation_id = p_operation_id,
    status = case when p_action = 'request_support_review' then 'under_review' else 'open' end
    where id = p_case_id returning * into v_case;
  insert into public.booking_audit_events
    (booking_id, event_type, actor_id, actor_role, reason, idempotency_key,
     from_status, to_status, event_data)
    values (v_case.booking_id, 'repair_claim_provider_responded', v_actor, 'seller',
      trim(p_response), p_operation_id, v_booking.status, v_booking.status,
      jsonb_build_object('case_id', v_case.id, 'response_action', p_action,
        'evidence_path', p_storage_path));
  return v_case;
end;
$$;
revoke all on function public.respond_to_repair_claim(uuid, text, text, text, text) from public;
grant execute on function public.respond_to_repair_claim(uuid, text, text, text, text) to authenticated;
