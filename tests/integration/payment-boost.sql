-- Run against the linked sandbox with Management API database/query.
-- All test mutations roll back, including spoofed metadata and payment events.
begin;
do $$
declare
  v_service public.services%rowtype;
  v_buyer uuid;
  v_booking public.bookings%rowtype;
  v_legacy public.bookings%rowtype;
  v_attempt jsonb;
  v_repeat jsonb;
  v_paid jsonb;
  v_operation text := 'integration:' || gen_random_uuid();
begin
  select * into strict v_service from public.services where active order by id limit 1;
  select user_id into strict v_buyer from public.profiles where user_id <> v_service.seller_id limit 1;
  perform set_config('request.jwt.claims', jsonb_build_object('role','service_role')::text, true);
  perform set_config('app.booking_workflow_rpc', 'on', true);
  insert into public.bookings(service_id, seller_id, buyer_id, total_amount, payment_plan, metadata)
    values (v_service.id, v_service.seller_id, v_buyer, 1200, 'downpayment', '{"booking_mode":"with-slots","payment_plan":"downpayment"}') returning * into v_booking;
  if v_booking.transaction_fee_rate <> 0.08 or v_booking.transaction_fee_amount <> 96
    or v_booking.total_charged_amount <> 1296 or v_booking.upfront_required_amount <> 696 then
    raise exception 'New booking commission/deposit is incorrect: %', to_jsonb(v_booking);
  end if;
  select * into v_legacy from public.bookings where transaction_fee_rate = 0.05 order by created_at limit 1;
  if found then
    update public.bookings set transaction_fee_rate = 0.08 where id = v_legacy.id returning * into v_booking;
    if v_booking.transaction_fee_rate <> 0.05 or v_booking.total_charged_amount <> v_legacy.total_charged_amount then
      raise exception 'Legacy agreed commission changed.';
    end if;
  end if;
  update public.services set metadata = coalesce(metadata,'{}') - 'ad_booster' - 'adBooster' where id = v_service.id;
  perform set_config('request.jwt.claims', jsonb_build_object('role','authenticated','sub',v_buyer)::text, true);
  begin
    perform public.start_service_ad_boost_checkout(v_service.id,7,250,v_operation);
    raise exception 'Non-owner checkout was allowed.';
  exception when insufficient_privilege then null; end;
  perform set_config('request.jwt.claims', jsonb_build_object('role','authenticated','sub',v_service.seller_id)::text, true);
  begin
    update public.services set metadata = jsonb_build_object('ad_booster',jsonb_build_object('active',true,'payment_verified',true)) where id = v_service.id;
    raise exception 'Browser boost spoof was allowed.';
  exception when insufficient_privilege then null; end;
  v_attempt := public.start_service_ad_boost_checkout(v_service.id,7,250,v_operation);
  v_repeat := public.start_service_ad_boost_checkout(v_service.id,7,250,'retry:' || gen_random_uuid());
  if v_attempt->>'id' <> v_repeat->>'id' then raise exception 'Retry created a duplicate attempt.'; end if;
  perform set_config('request.jwt.claims', jsonb_build_object('role','service_role')::text, true);
  update public.service_ad_boost_attempts set checkout_session_id = 'cs_test_' || v_operation where id = (v_attempt->>'id')::uuid;
  begin
    perform public.record_paymongo_boost_payment(v_operation,'checkout_session.payment.paid','cs_test_' || v_operation,'pay_test_' || v_operation,249,'PHP',false,'testhash');
    raise exception 'Incorrect payment amount was accepted.';
  exception when invalid_parameter_value then null; end;
  v_paid := public.record_paymongo_boost_payment(v_operation,'checkout_session.payment.paid','cs_test_' || v_operation,'pay_test_' || v_operation,250,'PHP',false,'testhash');
  v_repeat := public.record_paymongo_boost_payment(v_operation,'checkout_session.payment.paid','cs_test_' || v_operation,'pay_test_' || v_operation,250,'PHP',false,'testhash');
  if v_paid->>'status' <> 'paid' or v_paid->>'ends_at' <> v_repeat->>'ends_at'
    or (v_paid->>'ends_at')::timestamptz - (v_paid->>'starts_at')::timestamptz <> interval '7 days' then
    raise exception 'Payment activation/duration/idempotency failed.';
  end if;
end $$;
rollback;
