-- Read-only predeployment audit. Resolve genuine overlaps without deleting booking history.
with claims as (
  select booking.seller_id, booking.id as booking_id, booking.id::text as claim_id,
    'booking'::text as claim_kind, booking.start_ts, booking.end_ts
  from public.bookings booking
  where booking.status not in ('cancelled', 'refunded', 'completed')
    and (booking.schedule_status in ('confirmed', 'reschedule_requested')
      or (booking.schedule_status = 'held' and booking.hold_expires_at > now()))
    and booking.start_ts is not null and booking.end_ts > booking.start_ts
  union all
  select booking.seller_id, booking.id, visit.id::text, 'replacement', slot.start_ts, slot.end_ts
  from public.booking_case_replacement_visits visit
  join public.bookings booking on booking.id = visit.booking_id
  join public.service_slots slot on slot.id = visit.slot_id
  where booking.status not in ('cancelled', 'refunded')
    and visit.status in ('accepted', 'delivered') and slot.end_ts > slot.start_ts
)
select first_claim.seller_id,
  first_claim.claim_kind as first_kind, first_claim.claim_id as first_id,
  second_claim.claim_kind as second_kind, second_claim.claim_id as second_id,
  first_claim.start_ts as first_start, first_claim.end_ts as first_end,
  second_claim.start_ts as second_start, second_claim.end_ts as second_end
from claims first_claim
join claims second_claim on second_claim.seller_id = first_claim.seller_id
  and (first_claim.claim_kind, first_claim.claim_id) < (second_claim.claim_kind, second_claim.claim_id)
  and first_claim.booking_id <> second_claim.booking_id
  and tstzrange(first_claim.start_ts, first_claim.end_ts, '[)')
    && tstzrange(second_claim.start_ts, second_claim.end_ts, '[)')
order by first_claim.seller_id, first_claim.start_ts;

select id, seller_id, service_id, start_ts, end_ts, capacity,
  public.booking_slot_occupancy(id, null) as active_occupancy
from public.service_slots
where capacity > 1 or public.booking_slot_occupancy(id, null) > 1
order by seller_id, start_ts;
