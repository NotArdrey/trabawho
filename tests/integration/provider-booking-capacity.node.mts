import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";

const oldMigration = readFileSync(new URL("../../supabase/migrations/20261005113100_provider_calendar_conflicts.sql", import.meta.url), "utf8");
const migration = readFileSync(new URL("../../supabase/migrations/20261006122000_prevent_future_provider_double_bookings.sql", import.meta.url), "utf8");
const seller = "11111111-1111-1111-1111-111111111111";
const otherSeller = "22222222-2222-2222-2222-222222222222";
const at = (day: number, hour: number) => `2030-10-${String(day).padStart(2, "0")}T${String(hour).padStart(2, "0")}:00:00Z`;

async function setup() {
  const db = new PGlite();
  await db.exec(`
    create role anon; create role authenticated;
    create table public.services (id bigint primary key, seller_id uuid not null, active boolean not null default true);
    create table public.service_slots (
      id bigint primary key, service_id bigint not null, seller_id uuid not null,
      start_ts timestamptz not null, end_ts timestamptz not null,
      capacity integer not null default 1, status text not null default 'available',
      visibility text not null default 'public', metadata jsonb not null default '{}'::jsonb,
      updated_at timestamptz default now()
    );
    create table public.bookings (
      id uuid primary key, seller_id uuid not null, buyer_id uuid not null,
      service_id bigint not null, slot_id bigint, start_ts timestamptz,
      end_ts timestamptz, status text not null, schedule_status text not null,
      hold_expires_at timestamptz
    );
    create table public.booking_case_replacement_visits (
      id uuid primary key, booking_id uuid not null, slot_id bigint not null,
      status text not null
    );
    create function public.booking_slot_occupancy(p_slot_id bigint, p_exclude_booking_id uuid)
    returns integer language sql stable as $$
      select count(*)::integer from public.bookings b where b.slot_id = p_slot_id
        and (p_exclude_booking_id is null or b.id <> p_exclude_booking_id)
        and b.status not in ('cancelled','refunded')
        and (b.schedule_status in ('confirmed','reschedule_requested')
          or (b.schedule_status = 'held' and b.hold_expires_at > now()))
    $$;
    insert into public.services(id,seller_id) values (1,'${seller}'),(2,'${seller}'),(3,'${otherSeller}');
    insert into public.service_slots(id,service_id,seller_id,start_ts,end_ts,capacity) values
      (1,1,'${seller}','${at(5, 9)}','${at(5, 10)}',3),
      (2,1,'${seller}','${at(6, 9)}','${at(6, 10)}',3),
      (3,2,'${seller}','${at(6, 9)}','${at(6, 10)}',1),
      (4,2,'${seller}','${at(6, 10)}','${at(6, 11)}',1),
      (5,3,'${otherSeller}','${at(6, 9)}','${at(6, 10)}',1);
    -- Historical duplicates must survive the migration for support review.
    insert into public.bookings values
      ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','${seller}',
        'aaaaaaaa-0000-0000-0000-000000000001',1,1,'${at(5, 9)}','${at(5, 10)}','confirmed','confirmed',null),
      ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','${seller}',
        'bbbbbbbb-0000-0000-0000-000000000001',1,1,'${at(5, 9)}','${at(5, 10)}','confirmed','confirmed',null);
  `);
  await db.exec(oldMigration);
  await db.exec(migration);
  return db;
}

const insertBooking = (db: PGlite, id: string, serviceId: number, slotId: number, provider = seller) =>
  db.query(`insert into public.bookings
    (id,seller_id,buyer_id,service_id,slot_id,start_ts,end_ts,status,schedule_status)
    select $1,$2,'cccccccc-0000-0000-0000-000000000001',$3,id,start_ts,end_ts,'confirmed','confirmed'
    from public.service_slots where id=$4`, [id, provider, serviceId, slotId]);

test("normalizes upcoming legacy slots without deleting double-booked history", async () => {
  const db = await setup();
  try {
    const slots = await db.query<{ id: number; capacity: number; status: string }>(
      "select id,capacity,status from public.service_slots where id in (1,2) order by id");
    assert.deepEqual(slots.rows, [
      { id: 1, capacity: 1, status: "booked" },
      { id: 2, capacity: 1, status: "available" },
    ]);
    const history = await db.query<{ count: number }>("select count(*)::integer as count from public.bookings where slot_id=1");
    assert.equal(history.rows[0].count, 2);
  } finally { await db.close(); }
});

test("rejects a second client for the same slot or another overlapping service", async () => {
  const db = await setup();
  try {
    await insertBooking(db, "cccccccc-cccc-cccc-cccc-cccccccccccc", 1, 2);
    const visible = await db.query<{ id: number }>(
      "select id from public.list_available_service_slots(array[1,2]::bigint[]) where id in (2,3)");
    assert.deepEqual(visible.rows, []);
    await assert.rejects(insertBooking(db, "dddddddd-dddd-dddd-dddd-dddddddddddd", 1, 2),
      /Selected time was just booked/);
    await assert.rejects(insertBooking(db, "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee", 2, 3),
      /provider already has a booking/);
    await insertBooking(db, "ffffffff-ffff-ffff-ffff-ffffffffffff", 2, 4);
    await insertBooking(db, "99999999-9999-9999-9999-999999999999", 3, 5, otherSeller);
  } finally { await db.close(); }
});

test("cancelling the first visit releases its time for another client", async () => {
  const db = await setup();
  try {
    await insertBooking(db, "cccccccc-cccc-cccc-cccc-cccccccccccc", 1, 2);
    await db.query("update public.bookings set status='cancelled' where id='cccccccc-cccc-cccc-cccc-cccccccccccc'");
    await insertBooking(db, "dddddddd-dddd-dddd-dddd-dddddddddddd", 1, 2);
  } finally { await db.close(); }
});

test("a completed future visit retains its appointment window", async () => {
  const db = await setup();
  try {
    await insertBooking(db, "cccccccc-cccc-cccc-cccc-cccccccccccc", 1, 2);
    await db.query("update public.bookings set status='completed' where id='cccccccc-cccc-cccc-cccc-cccccccccccc'");
    await assert.rejects(insertBooking(db, "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee", 2, 3),
      /provider already has a booking/);
  } finally { await db.close(); }
});
