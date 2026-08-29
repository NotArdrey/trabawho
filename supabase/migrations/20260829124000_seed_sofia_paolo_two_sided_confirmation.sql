-- Fully paid demo booking for the two-sided completion walkthrough:
-- 1. Paolo marks the service delivered.
-- 2. Sofia confirms completion.

with sofia as (
  select p.user_id
  from public.profiles p
  where p.user_id = '00000000-0000-4000-8000-000000000101'::uuid
),
paolo_service as (
  select s.id, s.seller_id, s.base_price, coalesce(s.currency, 'PHP') as currency
  from public.services s
  where s.seller_id = '00000000-0000-4000-8000-000000000103'::uuid
    and s.active = true
  order by s.updated_at desc nulls last, s.id
  limit 1
),
inserted_demo as (
  insert into public.bookings (
    service_id, seller_id, buyer_id, start_ts, end_ts, status,
    total_amount, currency, payment_reference, metadata,
    delivery_status, payment_status, cash_collection_status, dispute_status,
    transaction_fee_rate, transaction_fee_amount, total_charged_amount,
    payment_plan, amount_paid
  )
  select
    s.id,
    s.seller_id,
    c.user_id,
    now() - interval '1 hour',
    now() + interval '1 hour',
    'confirmed',
    coalesce(s.base_price, 0),
    s.currency,
    'SHOWCASE-TWO-SIDED-CONFIRMATION',
    jsonb_build_object(
      'showcase_seed_key', 'sofia-paolo-two-sided-confirmation-v1',
      'created_via', 'showcase-role-booking-seed',
      'ui_status', 'Payment Confirmed',
      'payment_method', 'gcash-advance',
      'payment_plan', 'full',
      'payment_proof_submitted', true,
      'quote_approved', true,
      'can_rate', false,
      'description', 'Two-sided demo: Paolo confirms delivery, then Sofia confirms completion'
    ),
    'not_delivered',
    'paid',
    'not_applicable',
    'none',
    0.05,
    round(coalesce(s.base_price, 0) * 0.05, 2),
    round(coalesce(s.base_price, 0) * 1.05, 2),
    'full',
    round(coalesce(s.base_price, 0) * 1.05, 2)
  from sofia c cross join paolo_service s
  where not exists (
    select 1
    from public.bookings b
    where b.metadata->>'showcase_seed_key' = 'sofia-paolo-two-sided-confirmation-v1'
  )
  returning id, seller_id
)
insert into public.booking_audit_events (
  booking_id, event_type, actor_id, actor_role, reason, idempotency_key,
  from_status, to_status, event_data
)
select
  id,
  'showcase_two_sided_confirmation_ready',
  seller_id,
  'system_seed',
  'Seeded paid booking awaiting Paolo delivery confirmation',
  'sofia-paolo-two-sided-confirmation-v1',
  'confirmed',
  'confirmed',
  jsonb_build_object('showcase', true, 'next_action', 'seller_mark_delivered')
from inserted_demo
on conflict do nothing;
