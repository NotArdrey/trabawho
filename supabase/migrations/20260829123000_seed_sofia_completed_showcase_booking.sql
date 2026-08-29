-- Give the Sofia Garcia Cruz demo client a completed booking so the buyer
-- dashboard visibly demonstrates booking history, details, and rating state.

with sofia as (
  select p.user_id
  from public.profiles p
  where p.user_id = '00000000-0000-4000-8000-000000000101'::uuid
),
showcase_service as (
  select s.id, s.seller_id, s.base_price, coalesce(s.currency, 'PHP') as currency
  from public.services s
  join public.profiles p on p.user_id = s.seller_id
  where s.active = true
    and lower(coalesce(p.role, '')) = 'worker'
    and s.seller_id <> '00000000-0000-4000-8000-000000000101'::uuid
  order by s.updated_at desc nulls last, s.id
  limit 1
),
inserted_completed as (
  insert into public.bookings (
    service_id, seller_id, buyer_id, start_ts, end_ts, status,
    total_amount, currency, payment_reference, metadata,
    delivery_status, payment_status, cash_collection_status, dispute_status,
    schedule_version, delivered_schedule_version, delivered_at, delivered_by,
    completed_at, completed_by, dispute_deadline_at,
    transaction_fee_rate, transaction_fee_amount, total_charged_amount,
    payment_plan, amount_paid
  )
  select
    s.id,
    s.seller_id,
    c.user_id,
    now() - interval '16 days 2 hours',
    now() - interval '16 days',
    'completed',
    coalesce(s.base_price, 0),
    s.currency,
    'SHOWCASE-SOFIA-COMPLETED',
    jsonb_build_object(
      'showcase_seed_key', 'sofia-completed-booking-v1',
      'created_via', 'showcase-role-booking-seed',
      'ui_status', 'Completed Service',
      'payment_method', 'gcash-advance',
      'payment_plan', 'full',
      'payment_proof_submitted', true,
      'quote_approved', true,
      'can_rate', true,
      'description', 'Completed home service showcased in Sofia Garcia Cruz''s booking history'
    ),
    'buyer_confirmed',
    'paid',
    'not_applicable',
    'none',
    1,
    1,
    now() - interval '16 days',
    s.seller_id,
    now() - interval '16 days',
    c.user_id,
    now() - interval '14 days',
    0.05,
    round(coalesce(s.base_price, 0) * 0.05, 2),
    round(coalesce(s.base_price, 0) * 1.05, 2),
    'full',
    round(coalesce(s.base_price, 0) * 1.05, 2)
  from sofia c cross join showcase_service s
  where not exists (
    select 1
    from public.bookings b
    where b.metadata->>'showcase_seed_key' = 'sofia-completed-booking-v1'
  )
  returning id, seller_id, buyer_id
)
insert into public.booking_audit_events (
  booking_id, event_type, actor_id, actor_role, reason, idempotency_key,
  from_status, to_status, event_data
)
select
  id,
  'showcase_booking_completed',
  buyer_id,
  'system_seed',
  'Seeded completed booking for Sofia booking-history demonstration',
  'sofia-completed-booking-v1',
  'in_progress',
  'completed',
  jsonb_build_object('showcase', true, 'seller_id', seller_id)
from inserted_completed
on conflict do nothing;
