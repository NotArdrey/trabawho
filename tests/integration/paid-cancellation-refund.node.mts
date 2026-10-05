import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";

const load = (relative: string) => readFileSync(new URL(`../../${relative}`, import.meta.url), "utf8");
const bookingId = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const buyerId = "11111111-1111-1111-1111-111111111111";
const sellerId = "22222222-2222-2222-2222-222222222222";
const adminId = "33333333-3333-3333-3333-333333333333";

async function setup(paymentStatus = "paid") {
  const db = new PGlite();
  await db.exec(load("tests/integration/fixtures/refund-schema.sql"));
  await db.exec(load("supabase/migrations/20261005100000_booking_case_refunds.sql"));
  await db.exec(load("supabase/migrations/20261005101000_guard_funded_work_and_verified_refunds.sql"));
  await db.exec(load("supabase/migrations/20261006113000_sandbox_refund_simulation.sql"));
  await db.exec(load("supabase/migrations/20261006114000_require_verified_refund_source.sql"));
  await db.exec(`
    alter table public.bookings add column cancellation_status text;
    alter table public.bookings add column cancellation_reason text;
    alter table public.bookings add column cancellation_requested_at timestamptz;
    alter table public.bookings add column cancellation_requested_by uuid;
    alter table public.booking_support_cases add column reporter_id uuid;
    alter table public.booking_support_cases add column case_type text;
    alter table public.booking_support_cases add column reason text;
    alter table public.booking_support_cases add column storage_path text;
    alter table public.booking_support_cases add column policy_route text;
    alter table public.booking_support_cases add column policy_reason text;
    alter table public.booking_support_cases add column assigned_admin_id uuid;
    alter table public.booking_support_cases add column created_at timestamptz default now();
    alter table public.booking_support_cases alter column id set default gen_random_uuid();
    alter table public.booking_case_messages add column storage_path text;
    alter table public.booking_audit_events add column from_status text;
    alter table public.booking_audit_events add column to_status text;
    alter table public.booking_support_cases add constraint booking_support_cases_case_type_check
      check (case_type in ('provider_no_show','client_no_show','delivery_issue','warranty_issue','service_issue'));
    alter table public.booking_support_cases add constraint booking_support_cases_booking_id_reporter_id_case_type_key
      unique (booking_id, reporter_id, case_type);
    create table public.profiles(user_id uuid, role text, account_status text);
    insert into public.profiles values ('${adminId}','admin','active');
    create function public.notify_new_booking_case() returns trigger language plpgsql as $$
      begin return new; end; $$;
    create trigger booking_case_open_notify after insert on public.booking_support_cases
      for each row execute function public.notify_new_booking_case();
    create function public.refresh_service_slot_capacity(bigint) returns void language plpgsql as $$
      begin return; end; $$;
  `);
  await db.exec(load("supabase/migrations/20261006115000_queue_pending_refund_reviews.sql"));
  await db.exec(load("supabase/migrations/20261006120000_reliable_paid_cancellation_refunds.sql"));
  await db.exec(`
    insert into public.bookings(id,buyer_id,seller_id,status,payment_status,dispute_status,
      schedule_status,slot_id,metadata,total_charged_amount,amount_paid,balance_due_amount)
    values('${bookingId}','${buyerId}','${sellerId}','confirmed','${paymentStatus}','none',
      'confirmed',19,'{"payment_method":"paymongo-card"}',702,
      ${paymentStatus === "partially_paid" ? 377 : paymentStatus === "unpaid" ? 0 : 702},${paymentStatus === "partially_paid" ? 325 : paymentStatus === "unpaid" ? 702 : 0});
    select set_config('test.role','authenticated',false);
  `);
  return db;
}

async function asUser(db: PGlite, uid: string, admin = false) {
  await db.query("select set_config('test.uid',$1,false)", [uid]);
  await db.query("select set_config('test.admin',$1,false)", [admin ? "yes" : "no"]);
  await db.query("select set_config('test.role','authenticated',false)");
}

test("either participant may request; only counterpart can approve, releasing the visit and queuing one case", async () => {
  for (const initiator of [buyerId, sellerId]) {
    const db = await setup("partially_paid");
    try {
      await asUser(db, initiator);
      const request = await db.query<{ cancel_booking: { outcome: string } }>(
        "select public.cancel_booking($1::uuid,'Need to cancel this appointment','request-1')", [bookingId]);
      assert.equal(request.rows[0].cancel_booking.outcome, "review_required");
      await assert.rejects(db.query(
        "select public.review_booking_cancellation($1::uuid,'approve','','self-approval')", [bookingId]),
      /Only the other booking participant/);
      await asUser(db, initiator === buyerId ? sellerId : buyerId);
      await db.query("select public.review_booking_cancellation($1::uuid,'approve','','review-1')", [bookingId]);
      await db.query("select public.review_booking_cancellation($1::uuid,'approve','','review-1')", [bookingId]);
      const state = await db.query<{ status: string; payment_status: string; schedule_status: string }>(
        "select status,payment_status,schedule_status from public.bookings where id=$1", [bookingId]);
      assert.deepEqual(state.rows[0], { status: "cancelled", payment_status: "refund_pending", schedule_status: "released" });
      const cases = await db.query<{ case_type: string; status: string }>(
        "select case_type,status from public.booking_support_cases where booking_id=$1", [bookingId]);
      assert.deepEqual(cases.rows, [{ case_type: "refund_review", status: "under_review" }]);
      assert.equal((await db.query("select id from public.booking_audit_events where event_type='booking_cancellation_approved'")).rows.length, 1);
    } finally { await db.close(); }
  }
});

test("decline retains the schedule; an active support case blocks a competing cancellation", async () => {
  const db = await setup();
  try {
    await asUser(db, buyerId);
    await db.query("select public.cancel_booking($1::uuid,'I need a different date','request-1')", [bookingId]);
    await asUser(db, sellerId);
    await db.query("select public.review_booking_cancellation($1::uuid,'decline','Still available','review-1')", [bookingId]);
    const state = await db.query<{ status: string; schedule_status: string; cancellation_status: string }>(
      "select status,schedule_status,cancellation_status from public.bookings where id=$1", [bookingId]);
    assert.deepEqual(state.rows[0], { status: "confirmed", schedule_status: "confirmed", cancellation_status: "declined" });
    await asUser(db, buyerId);
    const retry = await db.query<{ cancel_booking: { outcome: string } }>(
      "select public.cancel_booking($1::uuid,'I need a different date','request-1')", [bookingId]);
    assert.equal(retry.rows[0].cancel_booking.outcome, "unchanged");
    await db.exec(`insert into public.booking_support_cases(booking_id,reporter_id,case_type,reason,status)
      values('${bookingId}','${buyerId}','service_issue','An issue requiring ongoing support review.','under_review')`);
    await assert.rejects(db.query("select public.cancel_booking($1::uuid,'I want to cancel now','request-2')", [bookingId]),
      /active support case/);
  } finally { await db.close(); }
});

test("full verified multi-attempt sandbox refund closes only its case and leaves the visit cancelled", async () => {
  const db = await setup();
  try {
    await db.exec(`
      insert into public.payment_attempts(id,booking_id,status,payment_id,amount)
      values('cccccccc-cccc-cccc-cccc-cccccccccccc','${bookingId}','paid','pay_first',377),
        ('dddddddd-dddd-dddd-dddd-dddddddddddd','${bookingId}','paid','pay_second',325);
      insert into public.payment_provider_events(payment_attempt_id,status,livemode,processed_at)
      values('cccccccc-cccc-cccc-cccc-cccccccccccc','processed',false,now()),
        ('dddddddd-dddd-dddd-dddd-dddddddddddd','processed',false,now());
    `);
    await asUser(db, buyerId);
    await db.query("select public.cancel_booking($1::uuid,'Appointment is no longer needed','request-1')", [bookingId]);
    await asUser(db, sellerId);
    await db.query("select public.review_booking_cancellation($1::uuid,'approve','','review-1')", [bookingId]);
    const caseId = (await db.query<{ id: string }>("select id from public.booking_support_cases where case_type='refund_review'")).rows[0].id;
    await asUser(db, adminId, true);
    await db.query("update public.booking_support_cases set assigned_admin_id=$1 where id=$2", [adminId, caseId]);
    await assert.rejects(db.query("select public.approve_booking_case_refund($1::uuid,'Verified all collected test payments',377)", [caseId]),
      /Refund amount changed/);
    await db.query("select public.approve_booking_case_refund($1::uuid,'Verified all collected test payments',702)", [caseId]);
    await db.query("select public.approve_booking_case_refund($1::uuid,'Verified all collected test payments',702)", [caseId]);
    const refunds = await db.query<{ id: string }>("select id from public.booking_refunds order by id");
    assert.equal(refunds.rows.length, 2);
    await db.query("select set_config('test.role','service_role',false)");
    await db.query("select public.simulate_booking_case_refund($1::uuid)", [refunds.rows[0].id]);
    assert.equal((await db.query<{ status: string }>("select status from public.booking_support_cases where id=$1", [caseId])).rows[0].status, "under_review");
    await db.query("select public.simulate_booking_case_refund($1::uuid)", [refunds.rows[1].id]);
    await db.query("select public.simulate_booking_case_refund($1::uuid)", [refunds.rows[1].id]);
    assert.equal((await db.query<{ status: string }>("select status from public.booking_support_cases where id=$1", [caseId])).rows[0].status, "closed");
    assert.deepEqual((await db.query<{ status: string; payment_status: string }>(
      "select status,payment_status from public.bookings where id=$1", [bookingId])).rows[0],
    { status: "cancelled", payment_status: "refunded" });
  } finally { await db.close(); }
});

test("missing payment evidence leaves refund review open for investigation", async () => {
  const db = await setup();
  try {
    await db.exec(`insert into public.payment_attempts(id,booking_id,status,payment_id,amount)
      values('cccccccc-cccc-cccc-cccc-cccccccccccc','${bookingId}','paid','manual-receipt',702)`);
    await asUser(db, sellerId);
    await db.query("select public.cancel_booking($1::uuid,'Cannot attend this appointment','request-1')", [bookingId]);
    await asUser(db, buyerId);
    await db.query("select public.review_booking_cancellation($1::uuid,'approve','','review-1')", [bookingId]);
    const caseId = (await db.query<{ id: string }>("select id from public.booking_support_cases where case_type='refund_review'")).rows[0].id;
    await asUser(db, adminId, true);
    await db.query("update public.booking_support_cases set assigned_admin_id=$1 where id=$2", [adminId, caseId]);
    await assert.rejects(db.query("select public.approve_booking_case_refund($1::uuid,'Investigated the payment evidence in full',702)", [caseId]),
      /Every paid attempt needs verified sandbox payment evidence/);
    assert.equal((await db.query<{ status: string }>("select status from public.booking_support_cases where id=$1", [caseId])).rows[0].status, "under_review");
  } finally { await db.close(); }
});

test("a payment verified after immediate unpaid cancellation queues review without restoring the visit", async () => {
  const db = await setup("unpaid");
  try {
    await asUser(db, buyerId);
    await db.query("select public.cancel_booking($1::uuid,'I cannot keep this appointment','request-1')", [bookingId]);
    await db.exec(`
      insert into public.payment_attempts(id,booking_id,status,payment_id,amount)
      values('cccccccc-cccc-cccc-cccc-cccccccccccc','${bookingId}','late_paid','pay_late',377);
      insert into public.payment_provider_events(payment_attempt_id,status,livemode,processed_at)
      values('cccccccc-cccc-cccc-cccc-cccccccccccc','processed',false,now());
      update public.bookings set payment_status='refund_pending' where id='${bookingId}';
    `);
    assert.deepEqual((await db.query<{ status: string; schedule_status: string }>(
      "select status,schedule_status from public.bookings where id=$1", [bookingId])).rows[0],
    { status: "cancelled", schedule_status: "released" });
    assert.equal((await db.query("select id from public.booking_support_cases where case_type='refund_review' and status <> 'closed'")).rows.length, 1);
  } finally { await db.close(); }
});
