import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, test } from 'node:test';
import { PGlite } from '@electric-sql/pglite';

const db = new PGlite();
const sellerId = '00000000-0000-0000-0000-000000000001';
const readMigration = () => readFileSync(new URL('../../supabase/migrations/20261006109000_unique_service_availability_windows.sql', import.meta.url), 'utf8');

before(async () => {
  await db.exec(`
    create role anon; create role authenticated;
    create table public.services (
      id bigint primary key, seller_id uuid not null, active boolean not null default true,
      metadata jsonb not null default '{}'::jsonb
    );
    create table public.service_slots (
      id bigserial primary key, service_id bigint not null, seller_id uuid not null,
      start_ts timestamptz not null, end_ts timestamptz not null,
      capacity integer not null default 1, status text not null default 'available',
      visibility text not null default 'public', metadata jsonb not null default '{}'::jsonb
    );
    create function public.booking_slot_occupancy(bigint, uuid) returns integer
      language sql as $$ select 0 $$;
    create function public.provider_time_conflicts(uuid, timestamptz, timestamptz, uuid)
      returns boolean language sql as $$ select false $$;
    insert into public.services(id, seller_id) values
      (1, '${sellerId}'), (2, '${sellerId}');
    -- Historical duplicates are deliberately preserved by the migration.
    insert into public.service_slots(service_id, seller_id, start_ts, end_ts) values
      (1, '${sellerId}', now() + interval '30 days', now() + interval '30 days 1 hour'),
      (1, '${sellerId}', now() + interval '30 days', now() + interval '30 days 1 hour');
  `);
  await db.exec(readMigration());
});
after(async () => { await db.close(); });

test('duplicate legacy windows remain stored but appear once to clients', async () => {
  const stored = await db.query<{ count: number }>('select count(*)::integer as count from public.service_slots where service_id=1');
  const visible = await db.query<{ id: number }>('select id from public.list_available_service_slots(array[1]::bigint[])');
  assert.equal(stored.rows[0].count, 2);
  assert.equal(visible.rows.length, 1);
});

test('new duplicate and partially overlapping windows are rejected, adjacent times allowed', async () => {
  const insert = (serviceId: number, start: string, end: string) => db.query(
    'insert into public.service_slots(service_id,seller_id,start_ts,end_ts) values($1,$2,$3,$4)',
    [serviceId, sellerId, start, end],
  );
  const base = new Date(Date.now() + 40 * 86400000);
  base.setUTCHours(0, 0, 0, 0);
  const at = (hours: number) => new Date(base.getTime() + hours * 3600000).toISOString();
  await insert(1, at(9), at(10));
  await assert.rejects(insert(1, at(9), at(10)), /already has an availability window/);
  await assert.rejects(insert(1, at(9.5), at(10.5)), /already has an availability window/);
  await insert(1, at(10), at(11));
  await insert(2, at(9), at(10));
  await assert.rejects(insert(1, at(11), at(11)), /End time must be later/);
});

test('moving a slot into another window is blocked, while booked legacy copies remain updatable', async () => {
  const legacy = await db.query<{ id: number }>('select id from public.service_slots where service_id=1 order by id limit 1');
  await db.query("update public.service_slots set status='booked' where id=$1", [legacy.rows[0].id]);
  const adjacent = await db.query<{ id: number }>(
    "select id from public.service_slots where service_id=1 and start_ts > now() + interval '35 days' order by id desc limit 1",
  );
  await assert.rejects(db.query(
    'update public.service_slots set start_ts=(select start_ts from public.service_slots where id=$1) where id=$2',
    [legacy.rows[0].id, adjacent.rows[0].id],
  ), /already has an availability window/);
});

test('recurring refresh skips duplicate template blocks and remains idempotent', async () => {
  await db.query(`update public.services set metadata = jsonb_build_object(
    'booking_mode', 'with-slots', 'availability_horizon_weeks', 1,
    'availability_template', jsonb_build_object('Mon', jsonb_build_array(
      jsonb_build_object('startTime','09:00','endTime','10:00'),
      jsonb_build_object('startTime','09:00','endTime','10:00'),
      jsonb_build_object('startTime','09:30','endTime','10:30')
    ))) where id=2`);
  const first = await db.query<{ count: number }>('select public.refresh_service_availability_slots(1) as count');
  const second = await db.query<{ count: number }>('select public.refresh_service_availability_slots(1) as count');
  assert.equal(first.rows[0].count, 1);
  assert.equal(second.rows[0].count, 0);
});
