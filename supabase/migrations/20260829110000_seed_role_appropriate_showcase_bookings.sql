-- Idempotent showcase coverage:
--   * every client has at least one buyer booking
--   * every worker with an active service has at least one seller booking
--   * one paid, seller-delivered booking is ready for buyer confirmation

create unique index if not exists bookings_showcase_seed_key_idx
  on public.bookings ((metadata->>'showcase_seed_key'))
  where metadata->>'showcase_seed_key' is not null;

with showcase_client as (
  select p.user_id
  from public.profiles p
  where lower(coalesce(p.role, '')) = 'client'
  order by p.created_at, p.user_id
  limit 1
),
showcase_service as (
  select s.id, s.seller_id, s.base_price, coalesce(s.currency, 'PHP') as currency
  from public.services s
  join public.profiles p on p.user_id = s.seller_id
  where s.active = true
    and lower(coalesce(p.role, '')) = 'worker'
    and s.seller_id <> (select user_id from showcase_client)
  order by s.updated_at desc nulls last, s.id
  limit 1
),
inserted_showcase as (
  insert into public.bookings (
    service_id, seller_id, buyer_id, start_ts, end_ts, status,
    total_amount, currency, payment_reference, metadata,
    delivery_status, payment_status, cash_collection_status, dispute_status,
    schedule_version, delivered_schedule_version, delivered_at, delivered_by,
    completion_due_at
  )
  select
    s.id,
    s.seller_id,
    c.user_id,
    now() - interval '2 hours',
    now() - interval '1 hour',
    'in_progress',
    coalesce(s.base_price, 0),
    s.currency,
    'SHOWCASE-PAID-READY-COMPLETE',
    jsonb_build_object(
      'showcase_seed_key', 'ready-to-complete-v1',
      'created_via', 'showcase-role-booking-seed',
      'ui_status', 'Service Delivered',
      'payment_method', 'gcash-advance',
      'quote_approved', true,
      'can_rate', false,
      'description', 'Showcase booking ready for buyer completion confirmation'
    ),
    'seller_claimed',
    'paid',
    'not_applicable',
    'none',
    1,
    1,
    now() - interval '1 hour',
    s.seller_id,
    now() + interval '7 days'
  from showcase_client c cross join showcase_service s
  where not exists (
    select 1 from public.bookings b
    where b.metadata->>'showcase_seed_key' = 'ready-to-complete-v1'
  )
  returning id, seller_id
)
insert into public.booking_audit_events (
  booking_id, event_type, actor_id, actor_role, reason, idempotency_key,
  from_status, to_status, event_data
)
select
  id,
  'showcase_seller_delivered',
  seller_id,
  'system_seed',
  'Seeded paid and delivered booking for completion-flow demonstration',
  'ready-to-complete-v1',
  'in_progress',
  'in_progress',
  jsonb_build_object('schedule_version', 1, 'showcase', true)
from inserted_showcase
on conflict do nothing;

-- Give every worker with an active service at least one seller-side booking.
with buyer_pool as (
  select
    p.user_id,
    row_number() over (order by p.created_at, p.user_id) as rn,
    count(*) over () as pool_size
  from public.profiles p
  where lower(coalesce(p.role, '')) = 'client'
),
missing_worker_services as (
  select distinct on (s.seller_id)
    s.id as service_id,
    s.seller_id,
    s.base_price,
    coalesce(s.currency, 'PHP') as currency
  from public.services s
  join public.profiles p on p.user_id = s.seller_id
  where s.active = true
    and lower(coalesce(p.role, '')) = 'worker'
    and not exists (
      select 1 from public.bookings b where b.seller_id = s.seller_id
    )
  order by s.seller_id, s.updated_at desc nulls last, s.id
),
ranked_missing_workers as (
  select m.*, row_number() over (order by m.seller_id) as rn
  from missing_worker_services m
)
insert into public.bookings (
  service_id, seller_id, buyer_id, start_ts, end_ts, status,
  total_amount, currency, metadata, payment_status, cash_collection_status
)
select
  m.service_id,
  m.seller_id,
  bp.user_id,
  now() + (m.rn || ' days')::interval,
  now() + (m.rn || ' days')::interval + interval '2 hours',
  'confirmed',
  coalesce(m.base_price, 0),
  m.currency,
  jsonb_build_object(
    'showcase_seed_key', 'worker-coverage-' || m.seller_id,
    'created_via', 'showcase-role-booking-seed',
    'ui_status', 'Service Scheduled',
    'payment_method', 'after-service-cash',
    'quote_approved', true,
    'can_rate', false
  ),
  'unpaid',
  'awaiting_collection'
from ranked_missing_workers m
join buyer_pool bp
  on bp.rn = ((m.rn - 1) % bp.pool_size) + 1;

-- Give every remaining client at least one buyer-side booking. Advance-payment
-- examples remain pending until a real provider/server callback marks them paid.
with service_pool as (
  select
    s.id as service_id,
    s.seller_id,
    s.base_price,
    coalesce(s.currency, 'PHP') as currency,
    row_number() over (order by s.updated_at desc nulls last, s.id) as rn,
    count(*) over () as pool_size
  from public.services s
  join public.profiles p on p.user_id = s.seller_id
  where s.active = true and lower(coalesce(p.role, '')) = 'worker'
),
missing_clients as (
  select p.user_id, row_number() over (order by p.created_at, p.user_id) as rn
  from public.profiles p
  where lower(coalesce(p.role, '')) = 'client'
    and not exists (
      select 1 from public.bookings b where b.buyer_id = p.user_id
    )
)
insert into public.bookings (
  service_id, seller_id, buyer_id, start_ts, end_ts, status,
  total_amount, currency, metadata, payment_status, cash_collection_status
)
select
  sp.service_id,
  sp.seller_id,
  mc.user_id,
  now() + ((mc.rn + 10) || ' days')::interval,
  now() + ((mc.rn + 10) || ' days')::interval + interval '1 hour',
  'confirmed',
  coalesce(sp.base_price, 0),
  sp.currency,
  jsonb_build_object(
    'showcase_seed_key', 'client-coverage-' || mc.user_id,
    'created_via', 'showcase-role-booking-seed',
    'ui_status', 'Payment Pending',
    'payment_method', 'gcash-advance',
    'quote_approved', true,
    'can_rate', false
  ),
  'pending_provider',
  'not_applicable'
from missing_clients mc
join service_pool sp
  on sp.rn = ((mc.rn - 1) % sp.pool_size) + 1;
