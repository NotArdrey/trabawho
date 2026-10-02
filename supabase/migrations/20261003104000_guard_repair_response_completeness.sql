-- Reject malformed RPC input (including a null action) at the data boundary.
alter table public.booking_support_cases
  add constraint booking_support_cases_response_complete_check check (
    (provider_responded_at is null
      and provider_response_action is null
      and provider_response_text is null
      and provider_responded_by is null
      and provider_response_operation_id is null)
    or
    (provider_responded_at is not null
      and provider_response_action is not null
      and provider_response_text is not null
      and provider_responded_by is not null
      and provider_response_operation_id is not null)
  );
