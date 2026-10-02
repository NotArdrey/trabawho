-- Run only against the isolated fixture, followed by the two refund migrations.
insert into public.bookings(id, buyer_id, seller_id, status, payment_status, total_charged_amount, amount_paid, balance_due_amount, metadata)
values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111',
  '22222222-2222-2222-2222-222222222222', 'confirmed', 'partially_paid', 864, 464, 400, '{"payment_method":"paymongo-card"}');
insert into public.booking_support_cases(id, booking_id) values ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
insert into public.payment_attempts(id, booking_id, status, payment_id, amount) values
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'paid', 'pay_deposit', 464);
create trigger protect_demo before update on public.bookings for each row execute function public.protect_demo_transaction_fields();
select set_config('test.uid', '22222222-2222-2222-2222-222222222222', false);
select set_config('test.role', 'authenticated', false);
do $$ begin
  begin perform public.request_booking_case_refund('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');
    raise exception 'Provider requested a client refund'; exception when insufficient_privilege then null; end;
  begin perform public.approve_booking_case_refund('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Approved after reviewing the evidence.', 464);
    raise exception 'Non-admin approved a refund'; exception when insufficient_privilege then null; end;
  begin perform public.claim_booking_refund('cccccccc-cccc-cccc-cccc-cccccccccccc');
    raise exception 'Non-server claimed a refund'; exception when insufficient_privilege then null; end;
end $$;
select set_config('test.uid', '11111111-1111-1111-1111-111111111111', false);
select public.request_booking_case_refund('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');
select public.request_booking_case_refund('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');
do $$ begin
  if (select count(*) from public.booking_audit_events where event_type = 'refund_review_requested') <> 1 then
    raise exception 'Request retry duplicated its audit'; end if;
end $$;
select set_config('test.uid', '33333333-3333-3333-3333-333333333333', false);
select set_config('test.admin', 'yes', false);
do $$ begin
  begin perform public.approve_booking_case_refund('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Approved after reviewing the evidence.', 864);
    raise exception 'Stale approval amount accepted'; exception when check_violation then null; end;
  if exists (select 1 from public.booking_refunds) then raise exception 'Stale approval created a refund'; end if;
end $$;
select public.approve_booking_case_refund('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Approved after reviewing the evidence.', 464);
select public.approve_booking_case_refund('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Approved after reviewing the evidence.', 464);
do $$ begin
  if (select count(*) from public.booking_refunds) <> 1 or (select amount from public.booking_refunds) <> 464 then
    raise exception 'Refund was duplicated or not calculated from the payment'; end if;
  if (select payment_status from public.bookings) <> 'refund_pending' then raise exception 'Approval claimed refund success'; end if;
end $$;
-- Public progress must not copy internal reason text.
insert into public.booking_support_admin_actions(case_id, action, reason) values
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'refund_review_needed', 'Private support investigation notes.');
do $$ begin
  if (select latest_support_action from public.booking_support_cases) <> 'refund_review_needed' then
    raise exception 'Support progress not published'; end if;
end $$;
select set_config('test.role', 'service_role', false);
do $$ declare v_id uuid := (select id from public.booking_refunds); v_row public.booking_refunds%rowtype; begin
  v_row := public.claim_booking_refund(v_id);
  if v_row.id is null then raise exception 'Refund not claimed'; end if;
  v_row := public.claim_booking_refund(v_id);
  if v_row.id is not null then raise exception 'Concurrent duplicate claim accepted'; end if;
  begin perform public.record_booking_refund(v_id, 'ref_one', 'pay_wrong', 464, 'PHP', false, 'succeeded');
    raise exception 'Wrong payment accepted'; exception when check_violation then null; end;
  begin perform public.record_booking_refund(v_id, 'ref_one', 'pay_deposit', 864, 'PHP', false, 'succeeded');
    raise exception 'Wrong refund amount accepted'; exception when check_violation then null; end;
  begin perform public.record_booking_refund(v_id, 'ref_one', 'pay_deposit', 464, 'PHP', true, 'succeeded');
    raise exception 'Live/test mismatch accepted'; exception when check_violation then null; end;
  perform public.record_booking_refund(v_id, 'ref_one', 'pay_deposit', 464, 'PHP', false, 'pending');
  if (select payment_status from public.bookings) <> 'refund_pending' then raise exception 'Pending refund closed booking'; end if;
  perform public.record_booking_refund(v_id, 'ref_one', 'pay_deposit', 464, 'PHP', false, 'succeeded');
  perform public.record_booking_refund(v_id, 'ref_one', 'pay_deposit', 464, 'PHP', false, 'pending');
  if (select payment_status from public.bookings) <> 'refunded' or (select status from public.booking_support_cases) <> 'closed'
    or (select status from public.booking_refunds) <> 'succeeded' then raise exception 'Verified refund did not close or was downgraded'; end if;
end $$;
-- Row and column access: participants see progress, outsiders see nothing, notes stay private.
set role authenticated;
select set_config('test.admin', 'no', false);
select set_config('test.uid', '11111111-1111-1111-1111-111111111111', false);
do $$ begin
  if (select count(id) from public.booking_refunds) <> 1 then raise exception 'Client cannot see refund'; end if;
  begin perform reason from public.booking_refunds; raise exception 'Private reason exposed'; exception when insufficient_privilege then null; end;
  begin update public.booking_refunds set status = 'succeeded'; raise exception 'Browser changed refund'; exception when insufficient_privilege then null; end;
end $$;
select set_config('test.uid', '33333333-3333-3333-3333-333333333333', false);
do $$ begin if (select count(id) from public.booking_refunds) <> 0 then raise exception 'Unrelated user sees refund'; end if; end $$;
reset role;
-- Historical booking (no balance_due_at): numeric funding still enforced on every lifecycle route.
insert into public.bookings(id, buyer_id, seller_id, status, payment_status, dispute_status,
  total_charged_amount, amount_paid, balance_due_amount) values
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', '11111111-1111-1111-1111-111111111111',
  '22222222-2222-2222-2222-222222222222', 'confirmed', 'paid', 'none', 864, 464, 400);
do $$ begin
  begin update public.bookings set work_started_at = now(), status = 'in_progress' where id = 'dddddddd-dddd-dddd-dddd-dddddddddddd';
    raise exception 'Unfunded work started'; exception when check_violation then null; end;
  begin update public.bookings set delivery_status = 'seller_claimed' where id = 'dddddddd-dddd-dddd-dddd-dddddddddddd';
    raise exception 'Unfunded delivery accepted'; exception when check_violation then null; end;
  begin update public.bookings set status = 'completed' where id = 'dddddddd-dddd-dddd-dddd-dddddddddddd';
    raise exception 'Unfunded completion accepted'; exception when check_violation then null; end;
end $$;
update public.bookings set amount_paid = 864, balance_due_amount = 0, work_started_at = now(), status = 'in_progress'
  where id = 'dddddddd-dddd-dddd-dddd-dddddddddddd';

-- A completed booking retains its delivery record while both installments are refunded.
insert into public.booking_delivery_evidence(booking_id, schedule_version) values ('dddddddd-dddd-dddd-dddd-dddddddddddd', 1);
update public.bookings set status = 'completed', balance_due_at = now(), metadata = '{"payment_method":"paymongo-card"}'
  where id = 'dddddddd-dddd-dddd-dddd-dddddddddddd';
insert into public.booking_support_cases(id, booking_id) values ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'dddddddd-dddd-dddd-dddd-dddddddddddd');
insert into public.payment_attempts(id, booking_id, status, payment_id, amount) values
  ('eeeeeeee-0000-0000-0000-000000000001', 'dddddddd-dddd-dddd-dddd-dddddddddddd', 'paid', 'pay_initial_two', 464),
  ('eeeeeeee-0000-0000-0000-000000000002', 'dddddddd-dddd-dddd-dddd-dddddddddddd', 'paid', 'pay_balance_two', 400);
select set_config('test.admin', 'yes', false);
select public.approve_booking_case_refund('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'Approved after reviewing the completed service dispute.', 864);
do $$ declare v_id uuid; begin
  select id into v_id from public.booking_refunds where payment_attempt_id = 'eeeeeeee-0000-0000-0000-000000000001';
  perform public.record_booking_refund(v_id, 'ref_initial_two', 'pay_initial_two', 464, 'PHP', false, 'succeeded');
  if (select payment_status from public.bookings where id = 'dddddddd-dddd-dddd-dddd-dddddddddddd') <> 'refund_pending' then
    raise exception 'Booking closed before both installments were refunded'; end if;
  select id into v_id from public.booking_refunds where payment_attempt_id = 'eeeeeeee-0000-0000-0000-000000000002';
  perform public.record_booking_refund(v_id, 'ref_balance_two', 'pay_balance_two', 400, 'PHP', false, 'succeeded');
  if (select payment_status from public.bookings where id = 'dddddddd-dddd-dddd-dddd-dddddddddddd') <> 'refunded' then
    raise exception 'Both verified installments did not close booking'; end if;
end $$;

-- A lost response cannot cause a fresh submission after the provider key expires.
insert into public.bookings(id, buyer_id, seller_id, status, payment_status, total_charged_amount, amount_paid, balance_due_amount) values
  ('ffffffff-ffff-ffff-ffff-ffffffffffff', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', 'confirmed', 'paid', 100, 100, 0);
insert into public.booking_support_cases(id, booking_id) values ('ffffffff-0000-0000-0000-000000000001', 'ffffffff-ffff-ffff-ffff-ffffffffffff');
insert into public.payment_attempts(id, booking_id, status, payment_id, amount) values
  ('ffffffff-0000-0000-0000-000000000002', 'ffffffff-ffff-ffff-ffff-ffffffffffff', 'paid', 'pay_unknown', 100);
select public.approve_booking_case_refund('ffffffff-0000-0000-0000-000000000001', 'Approved after reviewing the unknown response.', 100);
update public.booking_refunds set submitted_at = now() - interval '24 hours' where booking_id = 'ffffffff-ffff-ffff-ffff-ffffffffffff';
do $$ declare v_id uuid; v_row public.booking_refunds%rowtype; begin
  select id into v_id from public.booking_refunds where booking_id = 'ffffffff-ffff-ffff-ffff-ffffffffffff';
  v_row := public.claim_booking_refund(v_id);
  if v_row.id is not null or (select status from public.booking_refunds where id = v_id) <> 'needs_review' then
    raise exception 'Expired provider key retried'; end if;
end $$;
select set_config('test.role', 'authenticated', false);
do $$ begin
  begin insert into public.bookings(id, status, payment_status, amount_paid, delivery_status)
    values ('ffffffff-0000-0000-0000-000000000099', 'completed', 'paid', 864, 'buyer_confirmed');
    raise exception 'Browser fabricated a paid completed booking'; exception when insufficient_privilege then null; end;
end $$;
