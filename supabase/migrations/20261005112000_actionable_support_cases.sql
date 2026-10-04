-- A case conversation is separate from participant chat and private admin notes.
alter table public.booking_support_cases
  add column assigned_admin_id uuid references auth.users(id),
  add column response_due_at timestamptz,
  add column escalated_at timestamptz,
  add column resolution_status text not null default 'reviewing'
    check (resolution_status in ('reviewing','awaiting_provider','awaiting_client','replacement_proposed','replacement_accepted','refund_pending','refund_failed','resolved')),
  add column decision_reason text;
update public.booking_support_cases set resolution_status = 'resolved' where status = 'closed';

create function public.claim_booking_support_case(p_case_id uuid)
returns public.booking_support_cases language plpgsql security definer set search_path = public as $$
declare v_case public.booking_support_cases%rowtype;
begin
  if auth.uid() is null or not public.is_current_user_admin() then
    raise exception 'Administrator access required' using errcode = '42501'; end if;
  select * into v_case from public.booking_support_cases where id = p_case_id for update;
  if not found then raise exception 'Case not found' using errcode = 'P0002'; end if;
  if v_case.status = 'closed' then raise exception 'Closed cases cannot be claimed' using errcode = '23514'; end if;
  if v_case.assigned_admin_id is not null and v_case.assigned_admin_id <> auth.uid() then
    raise exception 'This case is already assigned to another admin' using errcode = '23514'; end if;
  update public.booking_support_cases set assigned_admin_id = auth.uid(), status = 'under_review'
    where id = p_case_id returning * into v_case;
  insert into public.booking_audit_events(booking_id,event_type,actor_id,actor_role,idempotency_key,event_data)
    values(v_case.booking_id,'support_case_claimed',auth.uid(),'admin',
      'case-claim:' || p_case_id || ':' || auth.uid(),jsonb_build_object('case_id',p_case_id)) on conflict do nothing;
  return v_case;
end;
$$;
revoke all on function public.claim_booking_support_case(uuid) from public;
grant execute on function public.claim_booking_support_case(uuid) to authenticated;

create table public.booking_case_messages (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.booking_support_cases(id) on delete restrict,
  author_id uuid not null references auth.users(id),
  author_role text not null check (author_role in ('admin','client','provider','system')),
  audience text not null check (audience in ('admin','client','provider','both')),
  body text not null check (length(trim(body)) between 20 and 4000),
  storage_path text,
  operation_id uuid not null,
  created_at timestamptz not null default now(),
  unique(case_id, operation_id)
);
create index booking_case_messages_case_time on public.booking_case_messages(case_id, created_at, id);
alter table public.booking_case_messages enable row level security;
create policy booking_case_messages_read on public.booking_case_messages for select to authenticated
using (exists (
  select 1 from public.booking_support_cases c join public.bookings b on b.id = c.booking_id
  where c.id = case_id and (
    public.is_current_user_admin() or
    (auth.uid() = b.buyer_id and (audience in ('client','both') or author_id = auth.uid())) or
    (auth.uid() = b.seller_id and (audience in ('provider','both') or author_id = auth.uid()))
  )
));
revoke insert, update, delete on public.booking_case_messages from anon, authenticated;
grant select on public.booking_case_messages to authenticated;
create trigger booking_case_messages_immutable before update or delete on public.booking_case_messages
  for each row execute function public.prevent_booking_case_action_mutation();

-- A targeted support attachment must not inherit the older booking-wide read policy.
drop policy if exists "Participants read booking evidence" on storage.objects;
create policy "Participants read booking evidence" on storage.objects for select to authenticated
using (bucket_id = 'booking-evidence' and exists (
  select 1 from public.bookings b where b.id::text = (storage.foldername(name))[1]
    and (b.buyer_id = auth.uid() or b.seller_id = auth.uid() or public.is_current_user_admin())
) and (
  (storage.foldername(name))[3] is distinct from 'case'
  or public.is_current_user_admin()
  or (storage.foldername(name))[2] = auth.uid()::text
  or exists(select 1 from public.booking_case_messages m join public.booking_support_cases c on c.id = m.case_id
    join public.bookings b on b.id = c.booking_id where m.storage_path = name
      and ((auth.uid() = b.buyer_id and m.audience in ('client','both'))
        or (auth.uid() = b.seller_id and m.audience in ('provider','both'))))
));

create table public.booking_case_notifications (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.booking_support_cases(id) on delete restrict,
  message_id uuid not null references public.booking_case_messages(id) on delete restrict,
  recipient_id uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  read_at timestamptz,
  unique(message_id, recipient_id)
);
create index booking_case_notifications_recipient on public.booking_case_notifications(recipient_id, read_at, created_at desc);
alter table public.booking_case_notifications enable row level security;
create policy booking_case_notifications_read on public.booking_case_notifications for select to authenticated
  using (recipient_id = auth.uid());
revoke insert, update, delete on public.booking_case_notifications from anon, authenticated;
grant select on public.booking_case_notifications to authenticated;

create table public.booking_case_review_requests (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.booking_support_cases(id) on delete restrict,
  requester_id uuid not null references auth.users(id),
  reason text not null check (length(trim(reason)) >= 20),
  status text not null default 'pending' check (status in ('pending','upheld','reopened')),
  decided_by uuid references auth.users(id),
  decision_reason text,
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  unique(case_id,requester_id)
);
alter table public.booking_case_review_requests enable row level security;
create policy booking_case_review_requests_read on public.booking_case_review_requests for select to authenticated
using (public.is_current_user_admin() or requester_id = auth.uid());
revoke insert, update, delete on public.booking_case_review_requests from anon, authenticated;
grant select on public.booking_case_review_requests to authenticated;

create function public.mark_booking_case_notifications_read(p_case_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  update public.booking_case_notifications set read_at = now()
    where case_id = p_case_id and recipient_id = auth.uid() and read_at is null;
end;
$$;
revoke all on function public.mark_booking_case_notifications_read(uuid) from public;
grant execute on function public.mark_booking_case_notifications_read(uuid) to authenticated;

create function public.send_booking_case_message(
  p_case_id uuid, p_audience text, p_body text, p_storage_path text, p_operation_id uuid
) returns public.booking_case_messages language plpgsql security definer set search_path = public as $$
declare
  v_case public.booking_support_cases%rowtype;
  v_booking public.bookings%rowtype;
  v_message public.booking_case_messages%rowtype;
  v_actor uuid := auth.uid();
  v_admin boolean := public.is_current_user_admin();
  v_role text;
  v_recipient uuid;
begin
  if v_actor is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  if length(trim(coalesce(p_body, ''))) not between 20 and 4000 or p_operation_id is null then
    raise exception 'Write 20 to 4000 characters and supply an operation ID' using errcode = '22023'; end if;
  select * into v_case from public.booking_support_cases where id = p_case_id for update;
  if not found then raise exception 'Case not found' using errcode = 'P0002'; end if;
  select * into v_booking from public.bookings where id = v_case.booking_id;
  if not v_admin and v_actor not in (v_booking.buyer_id, v_booking.seller_id) then
    raise exception 'Only case participants may send a reply' using errcode = '42501'; end if;
  v_role := case when v_admin then 'admin' when v_actor = v_booking.buyer_id then 'client' else 'provider' end;
  if (v_admin and p_audience not in ('client','provider','both'))
    or (not v_admin and p_audience <> 'admin') then
    raise exception 'Invalid case message recipient' using errcode = '42501'; end if;
  select * into v_message from public.booking_case_messages
    where case_id = p_case_id and operation_id = p_operation_id;
  if found then
    if v_message.author_id <> v_actor or v_message.audience <> p_audience
      or v_message.body <> trim(p_body) or v_message.storage_path is distinct from p_storage_path then
      raise exception 'Operation ID already used for another message' using errcode = '23505'; end if;
    return v_message;
  end if;
  if v_case.status = 'closed' then raise exception 'Request further review before replying to a closed case' using errcode = '23514'; end if;
  if p_storage_path is not null and (
    split_part(p_storage_path, '/', 1) <> v_case.booking_id::text
    or split_part(p_storage_path, '/', 2) <> v_actor::text
    or split_part(p_storage_path, '/', 3) <> 'case'
    or not exists (select 1 from storage.objects where bucket_id = 'booking-evidence' and name = p_storage_path)
  ) then raise exception 'Evidence image was not uploaded by this account' using errcode = '23514'; end if;
  insert into public.booking_case_messages(case_id, author_id, author_role, audience, body, storage_path, operation_id)
    values (p_case_id, v_actor, v_role, p_audience, trim(p_body), p_storage_path, p_operation_id)
    returning * into v_message;
  if v_admin then
    update public.booking_support_cases set assigned_admin_id = coalesce(assigned_admin_id, v_actor),
      status = 'under_review',
      resolution_status = case when p_audience = 'provider' then 'awaiting_provider'
        when p_audience = 'client' then 'awaiting_client' else 'reviewing' end,
      response_due_at = case when p_audience in ('provider','both') then now() + interval '24 hours'
        else response_due_at end,
      escalated_at = case when p_audience in ('provider','both') then null else escalated_at end
      where id = p_case_id;
  else
    update public.booking_support_cases set
      resolution_status = case when v_role = 'provider' or resolution_status <> 'awaiting_provider'
        then 'reviewing' else resolution_status end,
      response_due_at = case when v_role = 'provider' then null else response_due_at end
      where id = p_case_id;
  end if;
  for v_recipient in
    select distinct id from (
      select case when p_audience in ('client','both') then v_booking.buyer_id end id
      union all select case when p_audience in ('provider','both') then v_booking.seller_id end
      union all select p.user_id from public.profiles p
        where p.role = 'admin' and p.account_status = 'active' and p_audience = 'admin'
    ) recipients where id is not null and id <> v_actor
  loop
    insert into public.booking_case_notifications(case_id, message_id, recipient_id)
      values (p_case_id, v_message.id, v_recipient) on conflict do nothing;
  end loop;
  insert into public.booking_audit_events(booking_id, event_type, actor_id, actor_role, idempotency_key, event_data)
    values (v_case.booking_id, 'case_message_sent', v_actor,
      case when v_role = 'provider' then 'seller' when v_role = 'client' then 'buyer' else 'admin' end,
      p_operation_id::text, jsonb_build_object('case_id', p_case_id, 'message_id', v_message.id, 'audience', p_audience))
    on conflict do nothing;
  return v_message;
end;
$$;
revoke all on function public.send_booking_case_message(uuid, text, text, text, uuid) from public;
grant execute on function public.send_booking_case_message(uuid, text, text, text, uuid) to authenticated;

-- The visible admin queue calls this idempotent sweep on refresh. It is not a
-- substitute for a hosted scheduler when guaranteed response timing is needed.
create function public.escalate_overdue_booking_cases()
returns integer language plpgsql security definer set search_path = public as $$
declare v_case public.booking_support_cases%rowtype; v_message public.booking_case_messages%rowtype;
  v_count integer := 0;
begin
  if not public.is_current_user_admin() then raise exception 'Administrator access required' using errcode = '42501'; end if;
  for v_case in select * from public.booking_support_cases
    where case_type = 'provider_no_show' and status <> 'closed'
      and resolution_status = 'awaiting_provider' and response_due_at <= now() and escalated_at is null
    order by response_due_at limit 100 for update skip locked
  loop
    update public.booking_support_cases set escalated_at = now(), resolution_status = 'reviewing'
      where id = v_case.id;
    insert into public.booking_case_messages(case_id,author_id,author_role,audience,body,operation_id)
      values(v_case.id,coalesce(v_case.assigned_admin_id,v_case.reporter_id),'system','admin',
        'The provider response target passed. Support must review available evidence; silence alone does not decide the claim.',
        gen_random_uuid()) returning * into v_message;
    insert into public.booking_case_notifications(case_id,message_id,recipient_id)
      select v_case.id,v_message.id,p.user_id from public.profiles p
      where p.role = 'admin' and p.account_status = 'active' on conflict do nothing;
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;
revoke all on function public.escalate_overdue_booking_cases() from public;
grant execute on function public.escalate_overdue_booking_cases() to authenticated;

