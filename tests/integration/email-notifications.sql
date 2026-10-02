-- Privileged connection only. All assertions and product changes roll back;
-- the scheduler cannot see these uncommitted events or send test email.
begin;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
do $$
declare
  conversation public.conversations%rowtype;
  message_id uuid := gen_random_uuid();
  before_count bigint;
  message_count bigint;
  claimed public.email_notification_outbox%rowtype;
begin
  select * into conversation from public.conversations where buyer_id is not null and seller_id is not null and buyer_id <> seller_id limit 1;
  if conversation.id is null then raise exception 'Provide a two-participant conversation fixture first'; end if;
  select count(*) into before_count from public.email_notification_outbox;
  insert into public.messages(id,conversation_id,sender_id,body)
    values(message_id,conversation.id,conversation.buyer_id,'Private integration test body');
  select count(*) into message_count from public.email_notification_outbox
    where event_key like 'messages:' || message_id || ':%' and kind='message' and recipient_id=conversation.seller_id;
  if message_count <> 1 then raise exception 'Incoming message recipient or duplicate filtering failed'; end if;
  if exists(select 1 from public.email_notification_outbox where event_key like 'messages:' || message_id || ':%'
    and (recipient_id=conversation.buyer_id or payload::text like '%Private integration test body%')) then
    raise exception 'Sender notified or private body copied'; end if;
  update public.messages set read_by=jsonb_build_array(conversation.seller_id) where id=message_id;
  if (select count(*) from public.email_notification_outbox) <> before_count+1 then raise exception 'Read receipt queued another email'; end if;
  select * into claimed from public.claim_email_notifications(1);
  if claimed.id is null or claimed.lease_token is null or claimed.attempts < 1 then raise exception 'Delivery lease was not claimed'; end if;
  if exists(select 1 from public.claim_email_notifications(5) where id=claimed.id) then raise exception 'Live lease claimed twice'; end if;
  if has_table_privilege('authenticated','public.email_notification_outbox','select')
    or has_function_privilege('anon','public.claim_email_notifications(integer)','execute') then
    raise exception 'Email queue is exposed to browser roles'; end if;
end;
$$;
rollback;
