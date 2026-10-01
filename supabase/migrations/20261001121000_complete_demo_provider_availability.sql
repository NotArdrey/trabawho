-- Older showcase providers predate the seed markers used by the newer demo
-- accounts. Give those known demo services the same renewable schedule.

update public.services
set metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
  'availability_horizon_weeks', 8,
  'availability_template', jsonb_build_object(
    'Mon', jsonb_build_array(jsonb_build_object('startTime', '09:00', 'endTime', '10:00', 'capacity', 3)),
    'Tue', '[]'::jsonb,
    'Wed', jsonb_build_array(jsonb_build_object('startTime', '13:00', 'endTime', '14:00', 'capacity', 3)),
    'Thu', '[]'::jsonb,
    'Fri', '[]'::jsonb,
    'Sat', jsonb_build_array(jsonb_build_object('startTime', '16:00', 'endTime', '17:00', 'capacity', 3)),
    'Sun', '[]'::jsonb
  )
)
where active = true
  and seller_id in (
    '55ed7c77-f8e8-4bfb-afd7-1a43421b1beb'::uuid,
    '89d4cadd-d482-45a3-aea8-a817d1ff92ed'::uuid,
    '5f829a3e-b2a4-4b85-9294-336fd1344a69'::uuid
  )
  and coalesce(metadata ->> 'booking_mode', 'with-slots') = 'with-slots'
  and not (coalesce(metadata, '{}'::jsonb) ? 'availability_template');

select public.refresh_service_availability_slots(8);

