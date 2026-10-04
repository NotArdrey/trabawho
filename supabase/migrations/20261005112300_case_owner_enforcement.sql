-- Administrative case actions require explicit ownership. These guards run
-- inside the existing security-definer RPC transactions, so a rejected action
-- rolls back its message, note, remedy, and payment records together.

create function public.guard_owned_booking_case_action()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_case_id uuid := (to_jsonb(new)->>'case_id')::uuid;
  v_actor uuid := (to_jsonb(new)->>(tg_argv[0]))::uuid;
  v_owner uuid;
begin
  if auth.role() = 'service_role' or auth.uid() is null then return new; end if;
  if not public.is_current_user_admin() or v_actor is distinct from auth.uid() then
    raise exception 'Administrator access required' using errcode = '42501'; end if;
  select assigned_admin_id into v_owner from public.booking_support_cases
    where id = v_case_id for update;
  if not found or v_owner is distinct from auth.uid() then
    raise exception 'Claim this case before taking action' using errcode = '42501'; end if;
  return new;
end;
$$;

create trigger booking_case_admin_message_owner before insert on public.booking_case_messages
  for each row when (new.author_role = 'admin')
  execute function public.guard_owned_booking_case_action('author_id');
create trigger booking_case_admin_note_owner before insert on public.booking_support_admin_actions
  for each row execute function public.guard_owned_booking_case_action('actor_id');
create trigger booking_case_replacement_owner before insert on public.booking_case_replacement_visits
  for each row execute function public.guard_owned_booking_case_action('proposed_by');
create trigger booking_case_refund_owner before insert on public.booking_refunds
  for each row execute function public.guard_owned_booking_case_action('approved_by');
create trigger booking_case_review_decision_owner before update on public.booking_case_review_requests
  for each row when (new.decided_by is not null and new.decided_by is distinct from old.decided_by)
  execute function public.guard_owned_booking_case_action('decided_by');

-- No action RPC may silently assign itself while doing other work. Only the
-- explicit claim and takeover RPCs set the transaction-local owner-change flag.
create function public.guard_booking_case_owner_change()
returns trigger language plpgsql set search_path = public as $$
declare v_mode text := current_setting('app.case_owner_change', true);
begin
  if auth.role() = 'service_role' or auth.uid() is null then return new; end if;
  if old.assigned_admin_id is distinct from new.assigned_admin_id then
    if public.is_current_user_admin() and new.assigned_admin_id = auth.uid()
      and ((v_mode = 'claim' and old.assigned_admin_id is null)
        or (v_mode = 'takeover' and old.assigned_admin_id is not null)) then
      return new;
    end if;
    raise exception 'Use claim or reasoned takeover to change case ownership'
      using errcode = '42501';
  end if;
  if public.is_current_user_admin() and old.assigned_admin_id is distinct from auth.uid()
    and (new.decision_reason is distinct from old.decision_reason
      or (new.resolution_status is distinct from old.resolution_status
        and new.resolution_status in ('replacement_proposed','refund_pending'))) then
    raise exception 'Claim this case before deciding a remedy' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger booking_case_owner_change before update on public.booking_support_cases
  for each row execute function public.guard_booking_case_owner_change();

create or replace function public.claim_booking_support_case(p_case_id uuid)
returns public.booking_support_cases language plpgsql security definer set search_path = public as $$
declare v_case public.booking_support_cases%rowtype;
begin
  if auth.uid() is null or not public.is_current_user_admin() then
    raise exception 'Administrator access required' using errcode = '42501'; end if;
  select * into v_case from public.booking_support_cases where id = p_case_id for update;
  if not found then raise exception 'Case not found' using errcode = 'P0002'; end if;
  if v_case.status = 'closed' and not exists (
    select 1 from public.booking_case_review_requests
    where case_id = p_case_id and status = 'pending'
  ) then raise exception 'Closed cases without a review request cannot be claimed' using errcode = '23514'; end if;
  if v_case.assigned_admin_id is not null and v_case.assigned_admin_id <> auth.uid() then
    raise exception 'This case is already assigned to another admin' using errcode = '23514'; end if;
  perform set_config('app.case_owner_change', 'claim', true);
  update public.booking_support_cases set assigned_admin_id = auth.uid(),
    status = case when v_case.status = 'closed' then 'closed' else 'under_review' end
    where id = p_case_id returning * into v_case;
  insert into public.booking_audit_events(booking_id,event_type,actor_id,actor_role,idempotency_key,event_data)
    values(v_case.booking_id,'support_case_claimed',auth.uid(),'admin',
      'case-claim:' || p_case_id || ':' || auth.uid(),jsonb_build_object('case_id',p_case_id)) on conflict do nothing;
  return v_case;
end;
$$;

create function public.takeover_booking_support_case(
  p_case_id uuid, p_expected_owner_id uuid, p_reason text
) returns public.booking_support_cases language plpgsql security definer set search_path = public as $$
declare
  v_case public.booking_support_cases%rowtype;
  v_message public.booking_case_messages%rowtype;
  v_actor uuid := auth.uid();
  v_reason text := trim(coalesce(p_reason, ''));
begin
  if v_actor is null or not public.is_current_user_admin() then
    raise exception 'Administrator access required' using errcode = '42501'; end if;
  if length(v_reason) < 20 then
    raise exception 'Explain the takeover in at least 20 characters' using errcode = '22023'; end if;
  select * into v_case from public.booking_support_cases where id = p_case_id for update;
  if not found then raise exception 'Case not found' using errcode = 'P0002'; end if;
  if v_case.assigned_admin_id = v_actor then return v_case; end if;
  if p_expected_owner_id is null or v_case.assigned_admin_id is distinct from p_expected_owner_id then
    raise exception 'Case owner changed; refresh before taking over' using errcode = '23514'; end if;
  perform set_config('app.case_owner_change', 'takeover', true);
  update public.booking_support_cases set assigned_admin_id = v_actor
    where id = p_case_id returning * into v_case;
  insert into public.booking_case_messages(case_id,author_id,author_role,audience,body,operation_id)
    values(p_case_id,v_actor,'system','admin',
      'Case ownership transferred to another support admin. Reason: ' || v_reason,
      gen_random_uuid()) returning * into v_message;
  insert into public.booking_case_notifications(case_id,message_id,recipient_id)
    values(p_case_id,v_message.id,p_expected_owner_id) on conflict do nothing;
  insert into public.booking_audit_events(booking_id,event_type,actor_id,actor_role,reason,idempotency_key,event_data)
    values(v_case.booking_id,'support_case_taken_over',v_actor,'admin',v_reason,
      'case-takeover:' || p_case_id || ':' || v_message.id,
      jsonb_build_object('case_id',p_case_id,'previous_owner_id',p_expected_owner_id,
        'new_owner_id',v_actor)) on conflict do nothing;
  return v_case;
end;
$$;
revoke all on function public.takeover_booking_support_case(uuid, uuid, text) from public;
grant execute on function public.takeover_booking_support_case(uuid, uuid, text) to authenticated;

-- Internal note reasons are also copied into audit events. Participants may
-- read booking lifecycle events, but must not read internal case triage.
drop policy if exists booking_audit_events_select_participant on public.booking_audit_events;
create policy booking_audit_events_select_participant on public.booking_audit_events
  for select to authenticated using (
    public.is_current_user_admin() or (
      event_type not in ('admin_case_followup','support_case_claimed','support_case_taken_over')
      and exists (select 1 from public.bookings b where b.id = booking_id
        and auth.uid() in (b.buyer_id,b.seller_id))
    )
  );
