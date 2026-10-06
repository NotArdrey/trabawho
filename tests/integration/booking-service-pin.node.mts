import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, test } from 'node:test';
import { PGlite } from '@electric-sql/pglite';

const db = new PGlite();
const buyer = '00000000-0000-0000-0000-000000000001';
const address = { province: 'Bulacan', city: 'Guiguinto', barangay: 'Poblacion', address: '12 Service Street' };
const pin = { latitude: 14.833, longitude: 120.883 };
type CheckoutResult = { booking: { id: string; metadata: { service_address: typeof address & { pin?: typeof pin } } } };

before(async () => {
  await db.exec(`create schema auth; create role anon; create role authenticated; create role service_role;
    create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('test.uid',true),'')::uuid $$;
    create table auth.users(id uuid primary key,email_confirmed_at timestamptz);
    create table public.profiles(user_id uuid primary key,province text,city text,barangay text,address text,
      updated_at timestamptz,is_verified boolean,verification_status text,account_status text,id_document_expiry date,role text);
    create table public.account_registrations(user_id uuid primary key);
    create table public.bookings(id uuid primary key default gen_random_uuid(),buyer_id uuid,metadata jsonb);
    create table public.booking_audit_events(booking_id uuid,actor_id uuid,event_type text,idempotency_key text);
    -- Simulate the pre-existing checkout delegation and insert address trigger.
    create function public.start_booking_checkout_before_account_gates(p_booking_id uuid,p_service_id bigint,
      p_slot_id bigint,p_quote_version integer,p_payment_plan text,p_operation_id text)
    returns jsonb language plpgsql as $$ declare v_id uuid; v_booking public.bookings%rowtype; begin
      select booking_id into v_id from public.booking_audit_events where actor_id=auth.uid() and idempotency_key=p_operation_id;
      if v_id is null then
        v_id:=p_booking_id;
        if v_id is null then
          insert into public.bookings(buyer_id,metadata) select user_id,jsonb_build_object('service_address',jsonb_build_object(
            'province',province,'city',city,'barangay',barangay,'address',address)) from public.profiles where user_id=auth.uid()
          returning id into v_id;
        end if;
        insert into public.booking_audit_events values(v_id,auth.uid(),'booking_checkout_started',p_operation_id);
      end if;
      select * into v_booking from public.bookings where id=v_id and buyer_id=auth.uid();
      if not found then raise exception 'Only the buyer can start checkout' using errcode='42501'; end if;
      return jsonb_build_object('booking',to_jsonb(v_booking));
    end; $$;
    -- The existing outer RPC retains its fixed-role gate.
    create function public.start_booking_checkout_with_address(p_booking_id uuid default null,p_service_id bigint default null,
      p_slot_id bigint default null,p_quote_version integer default null,p_payment_plan text default 'downpayment',
      p_operation_id text default null,p_service_address jsonb default null)
    returns jsonb language plpgsql as $$ begin
      perform 1 from public.profiles where user_id=auth.uid() and role in ('client','admin') and account_status='active' for update;
      if not found then raise exception 'Sign in to a Client account to book services' using errcode='42501'; end if;
      return public.start_checkout_before_fixed_roles(p_booking_id,p_service_id,p_slot_id,p_quote_version,p_payment_plan,p_operation_id,p_service_address);
    end; $$;`);
  await db.query("insert into public.profiles(user_id,role,account_status) values($1,'client','active')", [buyer]);
  await db.query("select set_config('test.uid',$1,false)", [buyer]);
  await db.exec(readFileSync(new URL('../../supabase/migrations/20261006123000_booking_service_location_pin.sql', import.meta.url), 'utf8'));
});
after(async () => { await db.close(); });

async function checkout(operation: string, destination: unknown, bookingId: string | null = null) {
  const result = await db.query<{ result: CheckoutResult }>('select public.start_booking_checkout_with_address($1,1,1,null,\'downpayment\',$2,$3) as result', [bookingId, operation, destination]);
  return result.rows[0].result.booking;
}

test('stores a numeric pin with the address captured by the insert trigger', async () => {
  const booking = await checkout('pin-first', { ...address, pin });
  assert.deepEqual(booking.metadata.service_address, { ...address, pin });
  const profile = await db.query('select address from public.profiles where user_id=$1', [buyer]);
  assert.equal(profile.rows[0].address, address.address);
  const retry = await checkout('pin-first', { ...address, pin: { latitude: 15, longitude: 121 } });
  assert.equal(retry.id, booking.id);
  assert.deepEqual(retry.metadata.service_address.pin, pin);
  const balance = await checkout('balance', { ...address, pin: { latitude: 16, longitude: 122 } }, booking.id);
  assert.deepEqual(balance.metadata.service_address.pin, pin);
});

test('preserves manual checkout and does not add a pin to an earlier snapshot on retry', async () => {
  const booking = await checkout('manual', address);
  assert.deepEqual(booking.metadata.service_address, address);
  assert.deepEqual((await checkout('manual', { ...address, pin })).metadata.service_address, address);
});

test('captures a pin on the first checkout of an existing quoted booking', async () => {
  const result = await db.query<{ id: string }>('insert into public.bookings(buyer_id,metadata) values($1,$2) returning id', [buyer, { service_address: address }]);
  const destination = { ...address, address: '24 Actual Service Street', pin };
  assert.deepEqual((await checkout('quote-first', destination, result.rows[0].id)).metadata.service_address, destination);
  await checkout('restore-profile', address);
});

test('rejects malformed pins before creating a reservation or updating the profile', async () => {
  const beforeCount = await db.query<{ count: number }>('select count(*)::int as count from public.bookings');
  for (const bad of [null, {}, { latitude: '14', longitude: 120 }, { latitude: 91, longitude: 120 }, { latitude: 14, longitude: 181 }]) {
    await assert.rejects(checkout('bad-' + JSON.stringify(bad), { ...address, address: 'Must not be saved', pin: bad }), /valid service location pin/);
  }
  assert.deepEqual((await db.query('select count(*)::int as count from public.bookings')).rows, beforeCount.rows);
  assert.equal((await db.query('select address from public.profiles where user_id=$1', [buyer])).rows[0].address, address.address);
});

test('retains account-role and identity gates and prevents direct browser access to the implementation', async () => {
  await db.query("update public.profiles set role='worker' where user_id=$1", [buyer]);
  await assert.rejects(checkout('worker', { ...address, pin }), /Client account/);
  await db.query("update public.profiles set role='client',is_verified=false where user_id=$1", [buyer]);
  await db.query('insert into public.account_registrations values($1)', [buyer]);
  await assert.rejects(checkout('unverified', { ...address, pin }), /verification before booking/);
  const access = await db.query<{ allowed: boolean }>("select has_function_privilege('authenticated','public.start_checkout_before_fixed_roles(uuid,bigint,bigint,integer,text,text,jsonb)','execute') as allowed");
  assert.equal(access.rows[0].allowed, false);
});
