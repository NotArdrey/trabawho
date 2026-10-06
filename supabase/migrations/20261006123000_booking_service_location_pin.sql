-- Preserve role/identity/payment gates and store a validated, optional pin in the
-- booking's private address snapshot. No profile coordinates or new public data.
create or replace function public.start_checkout_before_fixed_roles(
  p_booking_id uuid default null,p_service_id bigint default null,p_slot_id bigint default null,
  p_quote_version integer default null,p_payment_plan text default 'downpayment',p_operation_id text default null,
  p_service_address jsonb default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_user uuid:=auth.uid(); v_profile public.profiles%rowtype; v_result jsonb; v_booking uuid;
  v_address jsonb; v_key text; v_pin jsonb; v_retry boolean;
begin
  if v_user is null then raise exception 'Authentication required' using errcode='42501'; end if;
  select * into v_profile from public.profiles where user_id=v_user for update;
  if exists(select 1 from public.account_registrations where user_id=v_user) then
    if not v_profile.is_verified or v_profile.verification_status<>'APPROVED' or v_profile.account_status<>'active' or v_profile.id_document_expiry<current_date
      or not exists(select 1 from auth.users where id=v_user and email_confirmed_at is not null) then
      raise exception 'Complete email and identity verification before booking' using errcode='42501'; end if;
  end if;
  if p_service_address is not null then
    if jsonb_typeof(p_service_address)<>'object' then raise exception 'Provide a service address' using errcode='22023'; end if;
    foreach v_key in array array['province','city','barangay','address'] loop
      if jsonb_typeof(p_service_address->v_key) is distinct from 'string' or
        char_length(btrim(coalesce(p_service_address->>v_key,''))) not between 1 and 500 then
        raise exception 'Complete the province, city, barangay, and specific service address' using errcode='22023'; end if;
    end loop;
    if p_service_address ? 'pin' then
      v_pin:=p_service_address->'pin';
      if jsonb_typeof(v_pin) is distinct from 'object'
        or jsonb_typeof(v_pin->'latitude') is distinct from 'number'
        or jsonb_typeof(v_pin->'longitude') is distinct from 'number' then
        raise exception 'Choose a valid service location pin' using errcode='22023'; end if;
      if (v_pin->>'latitude')::numeric not between -90 and 90 or (v_pin->>'longitude')::numeric not between -180 and 180 then
        raise exception 'Choose a valid service location pin' using errcode='22023'; end if;
      v_pin:=jsonb_build_object('latitude',(v_pin->>'latitude')::numeric,'longitude',(v_pin->>'longitude')::numeric);
    end if;
    update public.profiles set province=btrim(p_service_address->>'province'),city=btrim(p_service_address->>'city'),
      barangay=btrim(p_service_address->>'barangay'),address=btrim(p_service_address->>'address'),updated_at=now()
      where user_id=v_user returning * into v_profile;
  end if;
  v_address:=jsonb_build_object('province',v_profile.province,'city',v_profile.city,'barangay',v_profile.barangay,'address',v_profile.address);
  if exists(select 1 from public.account_registrations where user_id=v_user) and
    not exists(select 1 from public.bookings where id=p_booking_id and buyer_id=v_user and metadata ? 'service_address') then
    foreach v_key in array array['province','city','barangay','address'] loop
      if nullif(btrim(v_address->>v_key),'') is null then
        raise exception 'Provide the address where this service will take place' using errcode='22023'; end if;
    end loop;
  end if;
  select exists(select 1 from public.booking_audit_events where actor_id=v_user
    and event_type='booking_checkout_started' and idempotency_key=p_operation_id) into v_retry;
  v_result:=public.start_booking_checkout_before_account_gates(p_booking_id,p_service_id,p_slot_id,
    p_quote_version,p_payment_plan,p_operation_id);
  v_booking:=(v_result->'booking'->>'id')::uuid;
  if p_service_address is not null or exists(select 1 from public.account_registrations where user_id=v_user) then
    perform set_config('app.booking_workflow_rpc','on',true);
    update public.bookings set metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object('service_address',
      v_address || case when v_pin is not null then jsonb_build_object('pin',v_pin) else '{}'::jsonb end)
    where id=v_booking and buyer_id=v_user and (
      not (coalesce(metadata,'{}'::jsonb) ? 'service_address')
      or (v_pin is not null and not v_retry
        and not exists(select 1 from public.booking_audit_events where booking_id=v_booking
          and event_type='booking_checkout_started' and idempotency_key is distinct from p_operation_id)));
    select jsonb_set(v_result,'{booking}',to_jsonb(b),true) into v_result from public.bookings b where id=v_booking;
  end if;
  return v_result;
end; $$;

-- This implementation remains accessible only through the role-gated wrapper.
revoke all on function public.start_checkout_before_fixed_roles(uuid,bigint,bigint,integer,text,text,jsonb) from public,anon,authenticated,service_role;
