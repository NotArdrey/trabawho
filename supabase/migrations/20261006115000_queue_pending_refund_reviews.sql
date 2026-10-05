-- Cancellation approval and late checkout payment can require a refund without
-- passing through the participant-reported support-case flow. Give both paths
-- an actionable, system-origin case in the same transaction as the status change.
alter table public.booking_support_cases
  drop constraint booking_support_cases_case_type_check;
alter table public.booking_support_cases
  add constraint booking_support_cases_case_type_check check (case_type in (
    'provider_no_show', 'client_no_show', 'delivery_issue', 'warranty_issue',
    'service_issue', 'refund_review'
  ));

-- Preserve the existing one-report-per-type rule for participant reports, but
-- allow a later, distinct payment exception after an older review was closed.
alter table public.booking_support_cases
  drop constraint if exists booking_support_cases_booking_id_reporter_id_case_type_key;
create unique index booking_support_cases_participant_report_unique
  on public.booking_support_cases(booking_id, reporter_id, case_type)
  where case_type <> 'refund_review';
create unique index booking_support_cases_active_refund_review_unique
  on public.booking_support_cases(booking_id)
  where case_type = 'refund_review' and status <> 'closed';

create or replace function public.notify_new_booking_case()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_booking public.bookings%rowtype;
  v_message public.booking_case_messages%rowtype;
  v_system_case boolean := new.case_type = 'refund_review';
begin
  select * into v_booking from public.bookings where id = new.booking_id;
  insert into public.booking_case_messages(case_id,author_id,author_role,audience,body,storage_path,operation_id)
    values (new.id,new.reporter_id,
      case when v_system_case then 'system'
        when new.reporter_id = v_booking.buyer_id then 'client' else 'provider' end,
      'both',new.reason,new.storage_path,gen_random_uuid()) returning * into v_message;

  insert into public.booking_case_notifications(case_id,message_id,recipient_id)
    select new.id,v_message.id,p.user_id from public.profiles p
    where p.role = 'admin' and p.account_status = 'active' on conflict do nothing;
  insert into public.booking_case_notifications(case_id,message_id,recipient_id)
    select new.id,v_message.id,recipient
    from unnest(array[v_booking.buyer_id,v_booking.seller_id]) recipient
    where v_system_case or recipient <> new.reporter_id on conflict do nothing;
  return new;
end;
$$;

create function public.queue_pending_booking_refund_review(p_booking_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_booking public.bookings%rowtype;
  v_case public.booking_support_cases%rowtype;
  v_reason text;
begin
  select * into v_booking from public.bookings where id = p_booking_id for update;
  if not found or v_booking.payment_status <> 'refund_pending' then return; end if;

  -- A support case already under review is the correct owner of its refund.
  if exists (select 1 from public.booking_support_cases
      where booking_id = p_booking_id and status <> 'closed') then return; end if;

  v_reason := case when v_booking.cancellation_status = 'approved'
    then 'A paid cancellation was approved. Support must review the original payment and refund outcome.'
    when v_booking.status = 'pending' and v_booking.schedule_status <> 'confirmed'
    then 'Payment arrived after the checkout hold expired. No visit was reserved; support must review the payment and refund outcome.'
    else 'This booking is refund pending without an open case. Support must review the original payment and refund outcome.' end;

  insert into public.booking_support_cases
    (booking_id, reporter_id, case_type, reason, status, resolution_status,
      policy_route, policy_reason)
    values (p_booking_id, v_booking.buyer_id, 'refund_review', v_reason,
      'under_review', 'reviewing', 'support_review',
      'System-created payment exception. Verify the payment source before approving a refund.')
    returning * into v_case;

  perform set_config('app.booking_workflow_rpc', 'on', true);
  update public.bookings set dispute_status = 'open', updated_at = now()
    where id = p_booking_id and dispute_status is distinct from 'open';
  insert into public.booking_audit_events
    (booking_id, event_type, actor_role, idempotency_key, event_data)
    values (p_booking_id, 'refund_review_case_opened', 'system',
      'refund-review-case:' || v_case.id,
      jsonb_build_object('case_id', v_case.id, 'case_type', 'refund_review'))
    on conflict do nothing;
end;
$$;
revoke all on function public.queue_pending_booking_refund_review(uuid) from public, anon, authenticated;
grant execute on function public.queue_pending_booking_refund_review(uuid) to service_role;

create function public.queue_pending_booking_refund_review_on_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.payment_status = 'refund_pending'
    and old.payment_status is distinct from new.payment_status then
    perform public.queue_pending_booking_refund_review(new.id);
  end if;
  return new;
end;
$$;
revoke all on function public.queue_pending_booking_refund_review_on_change() from public;
create trigger booking_pending_refund_review
  after update of payment_status on public.bookings
  for each row execute function public.queue_pending_booking_refund_review_on_change();

-- Historical exceptions become visible to the admin queue. Existing open
-- support cases remain authoritative and are not duplicated.
do $$
declare v_booking_id uuid;
begin
  for v_booking_id in
    select b.id from public.bookings b
    where b.payment_status = 'refund_pending'
      and not exists (select 1 from public.booking_support_cases c
        where c.booking_id = b.id and c.status <> 'closed')
    order by b.updated_at, b.id
  loop
    perform public.queue_pending_booking_refund_review(v_booking_id);
  end loop;
end;
$$;
