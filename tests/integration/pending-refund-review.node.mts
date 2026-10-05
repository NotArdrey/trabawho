import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";

const migration = readFileSync(new URL("../../supabase/migrations/20261006115000_queue_pending_refund_reviews.sql", import.meta.url), "utf8");
const fixture = readFileSync(new URL("fixtures/refund-schema.sql", import.meta.url), "utf8");

test("pending payment exceptions create actionable cases without duplicates", async () => {
  const db = new PGlite();
  try {
    await db.exec(fixture);
    await db.exec(`
      alter table public.bookings add column cancellation_status text;
      alter table public.booking_support_cases
        add column reporter_id uuid, add column case_type text,
        add column reason text, add column storage_path text,
        add column policy_route text, add column policy_reason text,
        add column created_at timestamptz default now();
      alter table public.booking_support_cases alter column id set default gen_random_uuid();
      alter table public.booking_case_messages add column storage_path text;
      alter table public.booking_support_cases add constraint booking_support_cases_case_type_check
        check (case_type in ('provider_no_show','client_no_show','delivery_issue','warranty_issue','service_issue'));
      alter table public.booking_support_cases add constraint booking_support_cases_booking_id_reporter_id_case_type_key
        unique (booking_id, reporter_id, case_type);
      create table public.profiles(user_id uuid, role text, account_status text);
      insert into public.profiles values ('33333333-3333-3333-3333-333333333333','admin','active');
      create function public.notify_new_booking_case() returns trigger language plpgsql as $$
        begin return new; end; $$;
      create trigger booking_case_open_notify after insert on public.booking_support_cases
        for each row execute function public.notify_new_booking_case();
      insert into public.bookings(id,buyer_id,seller_id,status,payment_status,cancellation_status,dispute_status,schedule_status)
      values
        ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','11111111-1111-1111-1111-111111111111',
          '22222222-2222-2222-2222-222222222222','cancelled','refund_pending','approved','none','released'),
        ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','11111111-1111-1111-1111-111111111111',
          '22222222-2222-2222-2222-222222222222','pending','refund_pending',null,'none','released'),
        ('cccccccc-cccc-cccc-cccc-cccccccccccc','11111111-1111-1111-1111-111111111111',
          '22222222-2222-2222-2222-222222222222','confirmed','paid',null,'none','confirmed'),
        ('dddddddd-dddd-dddd-dddd-dddddddddddd','11111111-1111-1111-1111-111111111111',
          '22222222-2222-2222-2222-222222222222','confirmed','refund_pending',null,'open','confirmed');
      insert into public.booking_support_cases(booking_id,reporter_id,case_type,reason,status)
        values('dddddddd-dddd-dddd-dddd-dddddddddddd',
          '11111111-1111-1111-1111-111111111111','service_issue',
          'The client reported a problem with the completed service.','under_review');
    `);
    await db.exec(migration);

    const backfilled = await db.query<{ booking_id: string; reason: string; case_type: string }>(
      "select booking_id, reason, case_type from public.booking_support_cases order by booking_id");
    assert.equal(backfilled.rows.length, 3);
    assert.match(backfilled.rows[0].reason, /cancellation was approved/);
    assert.match(backfilled.rows[1].reason, /checkout hold expired/);
    assert.equal(backfilled.rows[2].case_type, "service_issue");
    assert.equal((await db.query("select case_id from public.booking_case_notifications")).rows.length, 6);
    assert.ok((await db.query<{ author_role: string }>("select author_role from public.booking_case_messages"))
      .rows.every((item) => item.author_role === "system"));

    await db.exec(`
      update public.bookings set payment_status='refund_pending'
        where id='cccccccc-cccc-cccc-cccc-cccccccccccc';
      update public.bookings set payment_status='refund_pending'
        where id='cccccccc-cccc-cccc-cccc-cccccccccccc';
    `);
    assert.equal((await db.query("select id from public.booking_support_cases where booking_id='cccccccc-cccc-cccc-cccc-cccccccccccc'")).rows.length, 1);
    assert.equal((await db.query<{ dispute_status: string }>("select dispute_status from public.bookings where id='cccccccc-cccc-cccc-cccc-cccccccccccc'")).rows[0].dispute_status, "open");

    await db.exec(`
      update public.booking_support_cases set status='closed'
        where booking_id='cccccccc-cccc-cccc-cccc-cccccccccccc';
      update public.bookings set payment_status='paid'
        where id='cccccccc-cccc-cccc-cccc-cccccccccccc';
      update public.bookings set payment_status='refund_pending'
        where id='cccccccc-cccc-cccc-cccc-cccccccccccc';
    `);
    assert.equal((await db.query("select id from public.booking_support_cases where booking_id='cccccccc-cccc-cccc-cccc-cccccccccccc'")).rows.length, 2);
    assert.equal((await db.query("select id from public.booking_support_cases where booking_id='cccccccc-cccc-cccc-cccc-cccccccccccc' and status <> 'closed'")).rows.length, 1);
  } finally { await db.close(); }
});
