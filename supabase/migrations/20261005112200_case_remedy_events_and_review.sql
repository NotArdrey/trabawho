create function public.start_booking_case_replacement(p_visit_id uuid)
returns public.booking_case_replacement_visits language plpgsql security definer set search_path = public as $$
declare v_visit public.booking_case_replacement_visits%rowtype; v_booking public.bookings%rowtype;
  v_slot public.service_slots%rowtype; v_case public.booking_support_cases%rowtype;
begin
  select * into v_visit from public.booking_case_replacement_visits where id = p_visit_id;
  if not found then raise exception 'Replacement visit not found' using errcode = 'P0002'; end if;
  select * into v_case from public.booking_support_cases where id = v_visit.case_id for update;
  select * into v_booking from public.bookings where id = v_visit.booking_id for update;
  select * into v_visit from public.booking_case_replacement_visits where id = p_visit_id for update;
  if auth.uid() is distinct from v_booking.seller_id then raise exception 'Only the provider can start this visit' using errcode = '42501'; end if;
  if v_visit.started_at is not null then return v_visit; end if;
  select * into v_slot from public.service_slots where id = v_visit.slot_id;
  if v_visit.status <> 'accepted' or v_case.status = 'closed' or v_booking.payment_status <> 'paid'
    or coalesce(v_booking.balance_due_amount,0) > 0 or v_booking.amount_paid < v_booking.total_charged_amount
    or v_booking.delivery_status <> 'not_delivered' or now() < v_slot.start_ts - interval '30 minutes' then
    raise exception 'The accepted visit can start only near its appointment after full verified payment' using errcode = '23514'; end if;
  update public.booking_case_replacement_visits set started_at = now() where id = p_visit_id returning * into v_visit;
  insert into public.booking_audit_events(booking_id,event_type,actor_id,actor_role,idempotency_key,event_data)
    values(v_booking.id,'replacement_work_started',auth.uid(),'seller','replacement-start:' || p_visit_id,
      jsonb_build_object('case_id',v_visit.case_id,'visit_id',p_visit_id)) on conflict do nothing;
  return v_visit;
end;
$$;
revoke all on function public.start_booking_case_replacement(uuid) from public;
grant execute on function public.start_booking_case_replacement(uuid) to authenticated;

create function public.deliver_booking_case_replacement(p_visit_id uuid, p_note text, p_storage_path text)
returns public.booking_case_replacement_visits language plpgsql security definer set search_path = public as $$
declare v_visit public.booking_case_replacement_visits%rowtype; v_booking public.bookings%rowtype;
begin
  select * into v_visit from public.booking_case_replacement_visits where id = p_visit_id;
  if not found then raise exception 'Replacement visit not found' using errcode = 'P0002'; end if;
  perform 1 from public.booking_support_cases where id = v_visit.case_id for update;
  select * into v_booking from public.bookings where id = v_visit.booking_id for update;
  select * into v_visit from public.booking_case_replacement_visits where id = p_visit_id for update;
  if auth.uid() is distinct from v_booking.seller_id then raise exception 'Only the provider can submit delivery' using errcode = '42501'; end if;
  if v_visit.status = 'delivered' then return v_visit; end if;
  if v_visit.status <> 'accepted' or v_visit.started_at is null
    or length(trim(coalesce(p_note,''))) < 20 or v_booking.payment_status <> 'paid' then
    raise exception 'Start the funded visit and describe completed work in at least 20 characters' using errcode = '23514'; end if;
  if p_storage_path is not null and (split_part(p_storage_path,'/',1) <> v_booking.id::text
    or split_part(p_storage_path,'/',2) <> auth.uid()::text
    or not exists(select 1 from storage.objects where bucket_id = 'booking-evidence' and name = p_storage_path)) then
    raise exception 'Evidence photo was not uploaded by this account' using errcode = '23514'; end if;
  update public.booking_case_replacement_visits set status = 'delivered', delivered_at = now(),
    delivery_note = trim(p_note), delivery_storage_path = p_storage_path
    where id = p_visit_id returning * into v_visit;
  insert into public.booking_audit_events(booking_id,event_type,actor_id,actor_role,idempotency_key,event_data)
    values(v_booking.id,'replacement_delivered',auth.uid(),'seller','replacement-delivered:' || p_visit_id,
      jsonb_build_object('case_id',v_visit.case_id,'visit_id',p_visit_id)) on conflict do nothing;
  return v_visit;
end;
$$;
revoke all on function public.deliver_booking_case_replacement(uuid, text, text) from public;
grant execute on function public.deliver_booking_case_replacement(uuid, text, text) to authenticated;

create function public.confirm_booking_case_replacement(p_visit_id uuid)
returns public.booking_case_replacement_visits language plpgsql security definer set search_path = public as $$
declare v_visit public.booking_case_replacement_visits%rowtype; v_booking public.bookings%rowtype;
  v_case public.booking_support_cases%rowtype;
begin
  select * into v_visit from public.booking_case_replacement_visits where id = p_visit_id;
  if not found then raise exception 'Replacement visit not found' using errcode = 'P0002'; end if;
  select * into v_case from public.booking_support_cases where id = v_visit.case_id for update;
  select * into v_booking from public.bookings where id = v_visit.booking_id for update;
  select * into v_visit from public.booking_case_replacement_visits where id = p_visit_id for update;
  if auth.uid() is distinct from v_booking.buyer_id then raise exception 'Only the client can confirm this visit' using errcode = '42501'; end if;
  if v_visit.status = 'completed' then return v_visit; end if;
  if v_visit.status <> 'delivered' or v_case.status = 'closed'
    or v_booking.payment_status <> 'paid' or coalesce(v_booking.balance_due_amount,0) > 0
    or v_booking.amount_paid < v_booking.total_charged_amount then
    raise exception 'Verified payment and replacement delivery are required' using errcode = '23514'; end if;
  insert into public.booking_delivery_evidence(booking_id,schedule_version,provider_id,checklist,explanation,storage_path)
    values(v_booking.id,v_booking.schedule_version,v_booking.seller_id,
      array['Agreed replacement visit completed','Result handed over to client'],
      v_visit.delivery_note,v_visit.delivery_storage_path)
    on conflict (booking_id,schedule_version) do nothing;
  perform set_config('app.booking_workflow_rpc','on',true);
  update public.bookings set status = 'completed', dispute_status = 'closed',
    work_started_at = coalesce(work_started_at,v_visit.started_at),
    delivery_status = 'buyer_confirmed', delivered_at = v_visit.delivered_at,
    completed_at = now(), updated_at = now(),
    metadata = coalesce(metadata,'{}'::jsonb) || jsonb_build_object('ui_status','Completed')
    where id = v_booking.id;
  update public.booking_case_replacement_visits set status = 'completed', completed_at = now()
    where id = p_visit_id returning * into v_visit;
  update public.booking_support_cases set status = 'closed', closed_at = now(),
    resolution_status = 'resolved' where id = v_case.id;
  insert into public.booking_audit_events(booking_id,event_type,actor_id,actor_role,idempotency_key,event_data)
    values(v_booking.id,'replacement_confirmed',auth.uid(),'buyer','replacement-confirmed:' || p_visit_id,
      jsonb_build_object('case_id',v_visit.case_id,'visit_id',p_visit_id)) on conflict do nothing;
  return v_visit;
end;
$$;
revoke all on function public.confirm_booking_case_replacement(uuid) from public;
grant execute on function public.confirm_booking_case_replacement(uuid) to authenticated;

create function public.notify_booking_case_visit()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_booking public.bookings%rowtype; v_message public.booking_case_messages%rowtype;
  v_author uuid; v_body text; v_role text;
begin
  if tg_op = 'UPDATE' and new.status = old.status then return new; end if;
  select * into v_booking from public.bookings where id = new.booking_id;
  v_author := coalesce(auth.uid(),new.proposed_by);
  v_role := case when v_author = v_booking.buyer_id then 'client'
    when v_author = v_booking.seller_id then 'provider' else 'admin' end;
  v_body := case new.status
    when 'proposed' then 'Support proposed a replacement visit. Both participants must accept the time before it is reserved. ' || new.reason
    when 'accepted' then 'Both participants accepted the replacement visit. The provider can start work near the new appointment time.'
    when 'delivered' then 'The provider submitted replacement work for client confirmation. Review the work notes and evidence before confirming.'
    when 'completed' then 'The client confirmed the replacement visit. This support case is resolved.'
    when 'unavailable' then 'The replacement time became unavailable. Support must propose another available time.'
    else 'The replacement visit was declined. Support will review the next step.' end;
  insert into public.booking_case_messages(case_id,author_id,author_role,audience,body,operation_id)
    values(new.case_id,v_author,v_role,'both',v_body,gen_random_uuid()) returning * into v_message;
  insert into public.booking_case_notifications(case_id,message_id,recipient_id)
    select new.case_id,v_message.id,recipient from unnest(array[v_booking.buyer_id,v_booking.seller_id]) recipient
    where recipient <> v_author on conflict do nothing;
  insert into public.booking_audit_events(booking_id,event_type,actor_id,actor_role,idempotency_key,event_data)
    values(new.booking_id,'replacement_visit_' || new.status,v_author,
      case when v_role = 'provider' then 'seller' when v_role = 'client' then 'buyer' else 'admin' end,
      'replacement-visit:' || new.id || ':' || new.status,
      jsonb_build_object('case_id',new.case_id,'visit_id',new.id,'slot_id',new.slot_id)) on conflict do nothing;
  return new;
end;
$$;
create trigger booking_case_visit_notify after insert or update of status on public.booking_case_replacement_visits
  for each row execute function public.notify_booking_case_visit();

create function public.notify_new_booking_case()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_message public.booking_case_messages%rowtype;
begin
  insert into public.booking_case_messages(case_id,author_id,author_role,audience,body,storage_path,operation_id)
    select new.id,new.reporter_id,case when new.reporter_id = b.buyer_id then 'client' else 'provider' end,
      'admin',new.reason,new.storage_path,gen_random_uuid()
    from public.bookings b where b.id = new.booking_id returning * into v_message;
  insert into public.booking_case_notifications(case_id,message_id,recipient_id)
    select new.id,v_message.id,p.user_id from public.profiles p
    where p.role = 'admin' and p.account_status = 'active' on conflict do nothing;
  return new;
end;
$$;
create trigger booking_case_open_notify after insert on public.booking_support_cases
  for each row execute function public.notify_new_booking_case();

create function public.request_booking_case_review(p_case_id uuid, p_reason text)
returns public.booking_case_review_requests language plpgsql security definer set search_path = public as $$
declare v_case public.booking_support_cases%rowtype; v_booking public.bookings%rowtype;
  v_request public.booking_case_review_requests%rowtype; v_message public.booking_case_messages%rowtype;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  if length(trim(coalesce(p_reason,''))) < 20 then raise exception 'Explain the review request in at least 20 characters' using errcode = '22023'; end if;
  select * into v_case from public.booking_support_cases where id = p_case_id for update;
  if not found then raise exception 'Case not found' using errcode = 'P0002'; end if;
  select * into v_booking from public.bookings where id = v_case.booking_id;
  if auth.uid() not in (v_booking.buyer_id,v_booking.seller_id) then
    raise exception 'Only booking participants may request review' using errcode = '42501'; end if;
  select * into v_request from public.booking_case_review_requests
    where case_id = p_case_id and requester_id = auth.uid();
  if found then return v_request; end if;
  if v_case.status <> 'closed' then raise exception 'This case is still open; reply in the case conversation' using errcode = '23514'; end if;
  insert into public.booking_case_review_requests(case_id,requester_id,reason)
    values(p_case_id,auth.uid(),trim(p_reason)) returning * into v_request;
  insert into public.booking_case_messages(case_id,author_id,author_role,audience,body,operation_id)
    values(p_case_id,auth.uid(),case when auth.uid() = v_booking.buyer_id then 'client' else 'provider' end,
      'admin','Further review requested: ' || trim(p_reason),gen_random_uuid()) returning * into v_message;
  insert into public.booking_case_notifications(case_id,message_id,recipient_id)
    select p_case_id,v_message.id,p.user_id from public.profiles p
    where p.role = 'admin' and p.account_status = 'active' on conflict do nothing;
  insert into public.booking_audit_events(booking_id,event_type,actor_id,actor_role,idempotency_key,event_data)
    values(v_case.booking_id,'case_review_requested',auth.uid(),
      case when auth.uid() = v_booking.buyer_id then 'buyer' else 'seller' end,
      'case-review:' || v_request.id,jsonb_build_object('case_id',p_case_id,'request_id',v_request.id))
    on conflict do nothing;
  return v_request;
end;
$$;
revoke all on function public.request_booking_case_review(uuid, text) from public;
grant execute on function public.request_booking_case_review(uuid, text) to authenticated;

create function public.decide_booking_case_review(p_request_id uuid, p_decision text, p_reason text)
returns public.booking_case_review_requests language plpgsql security definer set search_path = public as $$
declare v_request public.booking_case_review_requests%rowtype; v_case public.booking_support_cases%rowtype;
  v_booking public.bookings%rowtype; v_message public.booking_case_messages%rowtype;
begin
  if not public.is_current_user_admin() then raise exception 'Administrator access required' using errcode = '42501'; end if;
  if p_decision not in ('upheld','reopened') or length(trim(coalesce(p_reason,''))) < 20 then
    raise exception 'Choose an outcome and explain it in at least 20 characters' using errcode = '22023'; end if;
  select * into v_request from public.booking_case_review_requests where id = p_request_id for update;
  if not found then raise exception 'Review request not found' using errcode = 'P0002'; end if;
  if v_request.status <> 'pending' then return v_request; end if;
  select * into v_case from public.booking_support_cases where id = v_request.case_id for update;
  select * into v_booking from public.bookings where id = v_case.booking_id for update;
  if p_decision = 'reopened' then
    if v_booking.status = 'refunded' then
      raise exception 'A refunded booking cannot be reopened for an automatic money remedy' using errcode = '23514'; end if;
    update public.booking_support_cases set status = 'under_review', closed_at = null,
      resolution_status = 'reviewing', assigned_admin_id = auth.uid() where id = v_case.id;
    perform set_config('app.booking_workflow_rpc','on',true);
    update public.bookings set dispute_status = 'open' where id = v_booking.id;
  end if;
  update public.booking_case_review_requests set status = p_decision, decided_by = auth.uid(),
    decision_reason = trim(p_reason), decided_at = now() where id = p_request_id returning * into v_request;
  insert into public.booking_case_messages(case_id,author_id,author_role,audience,body,operation_id)
    values(v_case.id,auth.uid(),'admin',
      case when v_request.requester_id = v_booking.buyer_id then 'client' else 'provider' end,
      case when p_decision = 'reopened' then 'Support reopened this case for further review. '
        else 'Support reviewed the request and kept the prior outcome. ' end || trim(p_reason),
      gen_random_uuid()) returning * into v_message;
  insert into public.booking_case_notifications(case_id,message_id,recipient_id)
    values(v_case.id,v_message.id,v_request.requester_id) on conflict do nothing;
  insert into public.booking_audit_events(booking_id,event_type,actor_id,actor_role,idempotency_key,event_data)
    values(v_booking.id,'case_review_' || p_decision,auth.uid(),'admin',
      'case-review-decision:' || p_request_id,jsonb_build_object('case_id',v_case.id,'request_id',p_request_id))
    on conflict do nothing;
  return v_request;
end;
$$;
revoke all on function public.decide_booking_case_review(uuid, text, text) from public;
grant execute on function public.decide_booking_case_review(uuid, text, text) to authenticated;

create function public.notify_booking_case_refund()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_booking public.bookings%rowtype; v_message public.booking_case_messages%rowtype; v_body text;
begin
  if new.status = old.status then return new; end if;
  select * into v_booking from public.bookings where id = new.booking_id;
  v_body := case new.status
    when 'succeeded' then 'PayMongo confirmed the refund to the original payment method. Check the refund status in your booking.'
    when 'failed' then 'The refund attempt failed. Support is reviewing the provider response; the case remains open.'
    when 'needs_review' then 'The refund needs payment review. Support is checking the provider status; no completion is claimed.'
    else 'The refund status changed to ' || replace(new.status,'_',' ') || '. Check the booking for current progress.' end;
  insert into public.booking_case_messages(case_id,author_id,author_role,audience,body,operation_id)
    values(new.case_id,new.approved_by,'system','both',v_body,gen_random_uuid()) returning * into v_message;
  insert into public.booking_case_notifications(case_id,message_id,recipient_id)
    select new.case_id,v_message.id,recipient from unnest(array[v_booking.buyer_id,v_booking.seller_id]) recipient
    on conflict do nothing;
  update public.booking_support_cases set resolution_status = case
    when new.status = 'succeeded' and status = 'closed' then 'resolved'
    when new.status in ('failed','needs_review') then 'refund_failed' else 'refund_pending' end
    where id = new.case_id;
  return new;
end;
$$;
create trigger booking_case_refund_notify after update of status on public.booking_refunds
  for each row execute function public.notify_booking_case_refund();

create function public.sync_booking_case_resolution()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.status = 'closed' and old.status <> 'closed' then
    if new.case_type = 'provider_no_show' and not exists (
      select 1 from public.bookings b where b.id = new.booking_id and b.status = 'refunded'
    ) and not exists (
      select 1 from public.booking_case_replacement_visits v
      where v.case_id = new.id and v.status = 'completed'
    ) then
      raise exception 'A no-show case can close only after a confirmed refund or completed replacement visit'
        using errcode = '23514';
    end if;
    new.resolution_status := 'resolved';
  end if;
  return new;
end;
$$;
create trigger booking_case_resolution_status before update of status on public.booking_support_cases
  for each row execute function public.sync_booking_case_resolution();
