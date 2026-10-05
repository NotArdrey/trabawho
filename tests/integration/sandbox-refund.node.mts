import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";

const load = (relative: string) => readFileSync(new URL(`../../${relative}`, import.meta.url), "utf8");

test("sandbox refund closes the reviewed test booking without a provider refund", async () => {
  const db = new PGlite();
  try {
    await db.exec(load("tests/integration/fixtures/refund-schema.sql"));
    await db.exec(load("supabase/migrations/20261005100000_booking_case_refunds.sql"));
    await db.exec(load("supabase/migrations/20261005101000_guard_funded_work_and_verified_refunds.sql"));
    await db.exec(load("supabase/migrations/20261006113000_sandbox_refund_simulation.sql"));
    await db.exec(load("supabase/migrations/20261006114000_require_verified_refund_source.sql"));
    await db.exec("create trigger refund_notify after update of status on public.booking_refunds for each row execute function public.notify_booking_case_refund()");
    await db.exec(`
      insert into public.bookings(id,buyer_id,seller_id,status,payment_status,
        total_charged_amount,amount_paid,balance_due_amount,metadata)
      values('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        '11111111-1111-1111-1111-111111111111','22222222-2222-2222-2222-222222222222',
        'confirmed','paid',551,551,0,'{"payment_method":"paymongo-card"}');
      insert into public.booking_support_cases(id,booking_id,status)
      values('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','under_review');
      insert into public.payment_attempts(id,booking_id,status,payment_id,amount)
      values('cccccccc-cccc-cccc-cccc-cccccccccccc','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        'paid','pay_test',551);
      insert into public.payment_provider_events(payment_attempt_id,status,livemode,processed_at)
      values('cccccccc-cccc-cccc-cccc-cccccccccccc','processed',false,now());
      select set_config('test.uid','11111111-1111-1111-1111-111111111111',false);
      select set_config('test.role','authenticated',false);
    `);
    assert.equal((await db.query<{ has_verified_refund_payment: boolean }>(`select public.has_verified_refund_payment(
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')`)).rows[0].has_verified_refund_payment, true);
    await db.exec(`
      select set_config('test.uid','33333333-3333-3333-3333-333333333333',false);
      select set_config('test.admin','yes',false);
      select set_config('test.role','authenticated',false);
      select public.approve_booking_case_refund('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
        'Reviewed the evidence and approved a sandbox refund.',551);
      select set_config('test.role','service_role',false);
    `);
    const refundId = (await db.query<{ id: string }>("select id from public.booking_refunds")).rows[0].id;
    await db.query("select public.simulate_booking_case_refund($1::uuid)", [refundId]);
    await db.query("select public.simulate_booking_case_refund($1::uuid)", [refundId]);
    const result = await db.query<{ status: string; payment_status: string; refund_simulated: boolean }>(`
      select booking.status, booking.payment_status,
        booking.metadata->>'refund_simulated' = 'true' as refund_simulated
      from public.bookings booking where booking.id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'`);
    assert.deepEqual(result.rows[0], { status: "refunded", payment_status: "refunded", refund_simulated: true });
    assert.equal((await db.query<{ status: string }>("select status from public.booking_refunds")).rows[0].status, "simulated");
    assert.equal((await db.query<{ status: string }>("select status from public.payment_attempts")).rows[0].status, "refunded");
    assert.equal((await db.query<{ id: string }>("select id from public.booking_audit_events where event_type='refund_simulated'")).rows.length, 1);
    assert.match((await db.query<{ body: string }>("select body from public.booking_case_messages")).rows[0].body, /No real money/);
  } finally { await db.close(); }
});

test("sandbox refund refuses an unverified or live payment", async () => {
  const db = new PGlite();
  try {
    await db.exec(load("tests/integration/fixtures/refund-schema.sql"));
    await db.exec(load("supabase/migrations/20261005100000_booking_case_refunds.sql"));
    await db.exec(load("supabase/migrations/20261005101000_guard_funded_work_and_verified_refunds.sql"));
    await db.exec(load("supabase/migrations/20261006113000_sandbox_refund_simulation.sql"));
    await db.exec(load("supabase/migrations/20261006114000_require_verified_refund_source.sql"));
    await db.exec(`
      insert into public.bookings(id,buyer_id,seller_id,status,payment_status,metadata)
      values('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        '11111111-1111-1111-1111-111111111111','22222222-2222-2222-2222-222222222222',
        'confirmed','paid','{"payment_method":"paymongo-card"}');
      insert into public.booking_support_cases(id,booking_id,status)
      values('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','under_review');
      insert into public.payment_attempts(id,booking_id,status,payment_id,amount,environment)
      values('cccccccc-cccc-cccc-cccc-cccccccccccc','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        'paid','pay_live',551,'live');
      insert into public.payment_provider_events(payment_attempt_id,status,livemode,processed_at)
      values('cccccccc-cccc-cccc-cccc-cccccccccccc','processed',true,now());
      insert into public.booking_refunds(booking_id,case_id,payment_attempt_id,amount,approved_by,reason)
      values('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
        'cccccccc-cccc-cccc-cccc-cccccccccccc',551,'33333333-3333-3333-3333-333333333333',
        'Reviewed the full evidence and approved this payment.');
      select set_config('test.role','service_role',false);
    `);
    const refundId = (await db.query<{ id: string }>("select id from public.booking_refunds")).rows[0].id;
    await assert.rejects(db.query("select public.simulate_booking_case_refund($1::uuid)", [refundId]),
      /unsubmitted verified test payment/);
    assert.equal((await db.query<{ status: string }>("select status from public.booking_refunds")).rows[0].status, "approved");
  } finally { await db.close(); }
});

test("an unverified receipt cannot move a case into refund pending", async () => {
  const db = new PGlite();
  try {
    await db.exec(load("tests/integration/fixtures/refund-schema.sql"));
    await db.exec(load("supabase/migrations/20261005100000_booking_case_refunds.sql"));
    await db.exec(load("supabase/migrations/20261006114000_require_verified_refund_source.sql"));
    await db.exec(`
      insert into public.bookings(id,buyer_id,seller_id,status,payment_status)
      values('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        '11111111-1111-1111-1111-111111111111','22222222-2222-2222-2222-222222222222',
        'confirmed','paid');
      insert into public.booking_support_cases(id,booking_id,status)
      values('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','under_review');
      insert into public.payment_attempts(id,booking_id,status,payment_id,amount)
      values('cccccccc-cccc-cccc-cccc-cccccccccccc','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        'paid','manual-demo-receipt',551);
      select set_config('test.uid','11111111-1111-1111-1111-111111111111',false);
      select set_config('test.role','authenticated',false);
    `);
    assert.equal((await db.query<{ has_verified_refund_payment: boolean }>(`select public.has_verified_refund_payment(
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')`)).rows[0].has_verified_refund_payment, false);
    await assert.rejects(db.query(`select public.request_booking_case_refund(
      'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb')`), /verified PayMongo payment/);
    await db.exec(`
      select set_config('test.uid','33333333-3333-3333-3333-333333333333',false);
      select set_config('test.admin','yes',false);
      select set_config('test.role','authenticated',false);
    `);
    await assert.rejects(db.query(`select public.approve_booking_case_refund(
      'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','Reviewed the full support case and approved a test refund.',551)`),
    /verified PayMongo payment/);
    assert.equal((await db.query<{ payment_status: string }>("select payment_status from public.bookings")).rows[0].payment_status, "paid");
    assert.equal((await db.query("select id from public.booking_refunds")).rows.length, 0);
  } finally { await db.close(); }
});
