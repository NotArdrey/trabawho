import { PGlite } from 'npm:@electric-sql/pglite@0.5.8';
import { assertEquals, assert } from 'https://deno.land/std@0.224.0/assert/mod.ts';

const buyer = '11111111-1111-1111-1111-111111111111';
const seller = '22222222-2222-2222-2222-222222222222';
const booking = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const conversation = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
const admin = '33333333-3333-3333-3333-333333333333';

Deno.test('Postgres triggers, permissions, event filtering, recipients and leases', async () => {
  const db = new PGlite();
  try {
    // Only external extension services and the surrounding product tables are
    // fixtures. Execute the actual migration's PL/pgSQL, policies and triggers.
    await db.exec(`
      create role anon; create role authenticated; create role service_role;
      create schema auth; create schema vault; create schema cron; create schema net;
      create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('request.user_id',true),'')::uuid $$;
      grant usage on schema auth to authenticated;
      create table auth.users(id uuid primary key);
      create table vault.decrypted_secrets(name text, decrypted_secret text);
      create function cron.schedule(text,text,text) returns bigint language sql as $$ select 1::bigint $$;
      create table public.profiles(user_id uuid primary key,account_status text,verification_status text,full_name text,role text);
      create table public.bookings(id uuid primary key,buyer_id uuid,seller_id uuid,status text,payment_status text,
        delivery_status text,dispute_status text,start_ts timestamptz,end_ts timestamptz,metadata jsonb,updated_at timestamptz);
      create table public.conversations(id uuid primary key,buyer_id uuid,seller_id uuid);
      create table public.messages(id uuid primary key,conversation_id uuid,sender_id uuid,body text,read_by jsonb);
      create table public.payment_attempts(id uuid primary key,buyer_id uuid,booking_id uuid,status text);
      create table public.booking_refunds(id uuid primary key,booking_id uuid,status text);
      create table public.booking_quotes(id uuid primary key,booking_id uuid,status text,version integer,amount numeric,proposed_start_ts timestamptz,proposed_end_ts timestamptz);
      create table public.booking_reschedule_requests(id uuid primary key,booking_id uuid,status text);
      create table public.booking_support_cases(id uuid primary key,booking_id uuid,status text,refund_requested_at timestamptz,
        latest_support_action text,latest_support_target text,latest_support_at timestamptz,private_notes text);
      create table public.reviews(id uuid primary key,seller_id uuid,booking_id uuid,published boolean,rating integer,title text,body text);
      create table public.service_ad_boost_attempts(id uuid primary key,seller_id uuid,status text);
      insert into auth.users values('${buyer}'),('${seller}');
      insert into profiles values('${buyer}','active','APPROVED','Buyer','client'),('${seller}','active','APPROVED','Seller','worker');
      insert into conversations values('${conversation}','${buyer}','${seller}');
    `);
    const sql = await Deno.readTextFile(new URL('../../migrations/20261005110000_system_email_notifications.sql', import.meta.url));
    await db.exec(sql.replace(/^create extension.*;$/gm, ''));
    await db.exec(`insert into bookings(id,buyer_id,seller_id,status) values('${booking}','${buyer}','${seller}','pending');`);
    const count = async () => (await db.query<{ count: number }>('select count(*)::int as count from email_notification_outbox')).rows[0].count;
    assertEquals(await count(), 2);
    await db.exec(`update bookings set updated_at=now(),metadata='{"internal":"changed"}' where id='${booking}';`);
    assertEquals(await count(), 2);
    await db.exec(`update bookings set status='confirmed' where id='${booking}';`);
    assertEquals(await count(), 4);
    await db.exec(`insert into messages values(gen_random_uuid(),'${conversation}','${buyer}','PRIVATE BODY','[]');`);
    const message = (await db.query<{ recipient_id: string; payload: unknown }>("select recipient_id,payload from email_notification_outbox where kind='message'")).rows;
    assertEquals(message.length, 1); assertEquals(message[0].recipient_id, seller);
    assert(!JSON.stringify(message).includes('PRIVATE BODY'));
    await db.exec("update messages set read_by='[\"read\"]';");
    assertEquals(await count(), 5);
    await db.exec(`insert into payment_attempts values(gen_random_uuid(),'${buyer}','${booking}','created');`);
    assertEquals(await count(), 5);
    await db.exec("update payment_attempts set status='paid';");
    assertEquals(await count(), 6);
    for (const table of ['booking_refunds','booking_quotes','booking_reschedule_requests','booking_support_cases']) {
      await db.exec(`insert into ${table}(id,booking_id,status) values(gen_random_uuid(),'${booking}','pending');`);
    }
    await db.exec(`insert into reviews(id,seller_id,booking_id,published,rating) values(gen_random_uuid(),'${seller}','${booking}',false,5);`);
    assertEquals(await count(), 14);
    await db.exec("update reviews set published=true; update booking_support_cases set private_notes='PRIVATE ADMIN NOTES';");
    assertEquals(await count(), 15);
    await db.exec(`update profiles set account_status='suspended' where user_id='${buyer}';
      update profiles set verification_status='REJECTED' where user_id='${seller}';
      insert into service_ad_boost_attempts values(gen_random_uuid(),'${seller}','paid');`);
    assertEquals(await count(), 18);
    assertEquals((await db.query<{ count:number }>('select count(distinct kind)::int as count from email_notification_outbox')).rows[0].count, 11);
    await db.exec(`insert into auth.users values('${admin}');
      insert into profiles values('${admin}','active','APPROVED','Administrator','admin');
      insert into booking_support_cases(id,booking_id,status) values(gen_random_uuid(),'${booking}','open');
      update profiles set verification_status='PENDING_REVIEW' where user_id='${buyer}';`);
    const alerts = (await db.query<{ kind:string }>(`select kind from email_notification_outbox where recipient_id='${admin}' order by kind`)).rows;
    assertEquals(alerts.map((row) => row.kind),['identity','support']);
    const first = (await db.query<{ id:string; lease_token:string }>('select * from claim_email_notifications(2)')).rows;
    const second = (await db.query<{ id:string }>('select * from claim_email_notifications(2)')).rows;
    assertEquals(first.length, 2); assertEquals(second.length, 2);
    assert(!second.some((row) => first.some((claimed) => claimed.id === row.id)));
    await db.exec(`update email_notification_outbox set lease_until=now()-interval '1 minute',attempts=5 where id='${first[0].id}';`);
    await db.query('select * from claim_email_notifications(1)');
    assertEquals((await db.query<{status:string}>(`select status from email_notification_outbox where id='${first[0].id}'`)).rows[0].status,'failed');
    for (const role of ['anon','authenticated']) {
      const privilege = (await db.query<{ allowed:boolean }>(`select has_table_privilege('${role}','email_notification_outbox','select') as allowed`)).rows[0];
      assertEquals(privilege.allowed,false);
      assertEquals((await db.query<{allowed:boolean}>(`select has_function_privilege('${role}','claim_email_notifications(integer)','execute') as allowed`)).rows[0].allowed,false);
    }
    await db.exec(`select set_config('request.user_id','${buyer}',false); set role authenticated;
      insert into notification_preferences(user_id,email_enabled) values('${buyer}',false);`);
    let denied = false;
    try { await db.exec(`insert into notification_preferences(user_id,email_enabled) values('${seller}',false);`); }
    catch { denied = true; }
    assert(denied, 'One account changed another account’s email preference');
    await db.exec('reset role;');
    assertEquals((await db.query<{email_enabled:boolean}>(`select email_enabled from notification_preferences where user_id='${buyer}'`)).rows[0].email_enabled,false);
  } finally { await db.close(); }
});
