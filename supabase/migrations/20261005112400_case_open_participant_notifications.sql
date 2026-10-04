-- A new case must reach the other booking participant as well as support.
-- The reporter already sees the case immediately, so do not alert them about their own report.
create or replace function public.notify_new_booking_case()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_booking public.bookings%rowtype;
  v_message public.booking_case_messages%rowtype;
begin
  select * into v_booking from public.bookings where id = new.booking_id;
  insert into public.booking_case_messages(case_id,author_id,author_role,audience,body,storage_path,operation_id)
    values (new.id,new.reporter_id,
      case when new.reporter_id = v_booking.buyer_id then 'client' else 'provider' end,
      'both',new.reason,new.storage_path,gen_random_uuid()) returning * into v_message;

  insert into public.booking_case_notifications(case_id,message_id,recipient_id)
    select new.id,v_message.id,p.user_id from public.profiles p
    where p.role = 'admin' and p.account_status = 'active' on conflict do nothing;
  insert into public.booking_case_notifications(case_id,message_id,recipient_id)
    select new.id,v_message.id,recipient
    from unnest(array[v_booking.buyer_id,v_booking.seller_id]) recipient
    where recipient <> new.reporter_id on conflict do nothing;
  return new;
end;
$$;
