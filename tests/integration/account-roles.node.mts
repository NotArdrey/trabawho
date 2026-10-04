import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, test } from 'node:test';
import { PGlite } from '@electric-sql/pglite';

const db = new PGlite();
const read = (file: string) => readFileSync(new URL(file, import.meta.url), 'utf8');
const migration = (file: string) => read('../../supabase/migrations/' + file);
const historicalWorkers: string[] = [];
before(async () => {
  await db.exec(read('./fixtures/account-role-schema.sql'));
  const identity = migration('20260513170000_identity_first_registration.sql');
  await db.exec(identity.slice(identity.indexOf('create table if not exists public.verification_sessions'), identity.indexOf('alter table public.verification_sessions enable')));
  await db.exec("select set_config('test.role','service_role',false)");
  for (const file of [
    '20261004100000_admin_identity_review.sql', '20261004101000_apply_didit_identity_events.sql',
    '20261006100000_account_registration.sql', '20261006101000_registration_review_marketplace.sql',
    '20261006102000_booking_address_checkout.sql', '20261006103000_pending_registration_email.sql',
    '20261006104000_registration_event_gate_hardening.sql', '20261006105000_registration_retry_hardening.sql',
    '20261006106000_fixed_account_roles.sql', '20261006107000_identity_duplicates_per_role.sql',
  ]) {
    if (file === '20261006106000_fixed_account_roles.sql') {
      for (let i = 0; i < 2; i++) {
        const id = await account('client');
        historicalWorkers.push(id);
        const session = await approve(id, 'historical-worker-' + i);
        await db.query('select public.confirm_account_identity_name($1)', [id]);
        await db.query('select public.complete_account_provider_setup($1,$2)', [id, providerSetup]);
        if (i === 1) await db.query('select public.apply_didit_identity_event($1,$2,$3,$4,$5,$6,$7)',
          [session + '-changed', 'test-hash', session, 'APPROVED', { timestamp: 200 }, { ...document, fullName: 'Changed Source Name' }, 'historical-worker-' + i]);
      }
    }
    await db.exec(migration(file));
  }
});
after(async () => { await db.close(); });

async function admin() {
  const id = crypto.randomUUID();
  await db.query('insert into auth.users(id,email) values($1,$2)', [id, id + '@test.invalid']);
  await db.query("insert into public.profiles(user_id,role) values($1,'admin')", [id]);
  return id;
}

async function account(role: 'client' | 'worker') {
  const id = crypto.randomUUID();
  await db.query("insert into auth.users(id,email,email_confirmed_at,raw_app_meta_data) values($1,$2,now(),$3)", [id, id + '@test.invalid', { signup_role: role }]);
  await db.query('select public.initialize_account_registration($1,$2)', [id, 'test-nonce']);
  return id;
}
const document = { fullName: 'Test Verified Person', documentType: 'passport', expiry: '2099-01-01' };
const providerSetup = { serviceType: 'Plumbing', bio: 'Local plumbing repairs', pricingModel: 'fixed', fixedPrice: '500',
  province: 'Bulacan', city: 'Guiguinto', barangay: 'Poblacion' };
async function approve(id: string, fingerprint: string) {
  const session = crypto.randomUUID();
  const lease = crypto.randomUUID();
  await db.query('select public.claim_account_identity_session($1,$2)', [id, lease]);
  await db.query('select public.attach_account_identity_session($1,$2,$3,$4)', [id, lease, session, 'https://verification.didit.me/test']);
  await db.query('select public.apply_didit_identity_event($1,$2,$3,$4,$5,$6,$7)', [session, 'test-hash', session, 'APPROVED', { timestamp: 100 }, document, fingerprint]);
  return session;
}

test('migration preserves existing Worker accounts and aligns Client identity claims and pending decisions', async () => {
  for (const id of historicalWorkers) {
    const profile = await db.query('select role,is_client,is_worker,identity_role from public.profiles where user_id=$1', [id]);
    assert.deepEqual(profile.rows[0], { role: 'worker', is_client: false, is_worker: true, identity_role: 'musician' });
    const claim = await db.query('select role,app_role from public.identity_document_claims where user_id=$1', [id]);
    assert.deepEqual(claim.rows, [{ role: 'musician', app_role: 'worker' }]);
    const registration = await db.query('select account_role from public.account_registrations where user_id=$1', [id]);
    assert.deepEqual(registration.rows[0], { account_role: 'worker' });
  }
  const actor = await admin();
  const id = historicalWorkers[1];
  const review = await db.query<{ id: string; submitted_app_role: string; submitted_role: string }>('select id,submitted_app_role,submitted_role from public.manual_identity_reviews where user_id=$1', [id]);
  assert.equal(review.rows[0].submitted_role, 'musician');
  assert.equal(review.rows[0].submitted_app_role, 'worker');
  await db.query('select public.decide_account_identity_review($1,$2,$3,$4,$5,$6)',
    [review.rows[0].id, actor, 'APPROVED', 'Verified corrected name checked against the ID evidence.', crypto.randomUUID(), 'Reviewed Worker Name']);
  const approved = await db.query('select role,is_verified,full_name from public.profiles where user_id=$1', [id]);
  assert.deepEqual(approved.rows[0], { role: 'worker', is_verified: true, full_name: 'Reviewed Worker Name' });
});

test('signup creates fixed Client and Worker profiles; profile edits cannot convert either role', async () => {
  for (const role of ['client', 'worker'] as const) {
    const id = await account(role);
    const profile = await db.query('select role,is_client,is_worker,identity_role from public.profiles where user_id=$1', [id]);
    assert.deepEqual(profile.rows[0], { role, is_client: role === 'client', is_worker: role === 'worker', identity_role: role === 'client' ? 'fan' : 'musician' });
    await assert.rejects(db.query('update public.profiles set role=$1 where user_id=$2', [role === 'worker' ? 'client' : 'worker', id]), /separate account/);
    await assert.rejects(db.query('update public.account_registrations set account_role=$1 where user_id=$2', [role === 'worker' ? 'client' : 'worker', id]), /separate account/);
  }
});

test('one document can verify one account per role; a second account for the same role cannot be approved', async () => {
  const fingerprint = crypto.randomUUID();
  const actor = await admin();
  for (const role of ['client', 'worker'] as const) {
    const id = await account(role);
    await approve(id, fingerprint);
    await db.query('select public.confirm_account_identity_name($1)', [id]);
    const duplicate = await account(role);
    await approve(duplicate, fingerprint);
    const profile = await db.query('select verification_status,is_verified from public.profiles where user_id=$1', [duplicate]);
    assert.deepEqual(profile.rows[0], { verification_status: 'PENDING_REVIEW', is_verified: false });
    await assert.rejects(db.query('select public.confirm_account_identity_name($1)', [duplicate]), /needs review/);
    await assert.rejects(db.query("update public.identity_document_claims set status='APPROVED' where user_id=$1", [duplicate]), /unique constraint/);
    const review = await db.query<{ id: string }>('select id from public.manual_identity_reviews where user_id=$1', [duplicate]);
    await assert.rejects(db.query('select public.decide_account_identity_review($1,$2,$3,$4,$5,$6)',
      [review.rows[0].id, actor, 'APPROVED', 'Verified document reviewed by the administrator.', crypto.randomUUID(), document.fullName]), /unique constraint/);
    const unchanged = await db.query('select reviewed_legal_name from public.account_registrations where user_id=$1', [duplicate]);
    assert.deepEqual(unchanged.rows[0], { reviewed_legal_name: null });
  }
  const claims = await db.query("select role from public.identity_document_claims where document_fingerprint=$1 and status='APPROVED' order by role", [fingerprint]);
  assert.deepEqual(claims.rows, [{ role: 'fan' }, { role: 'musician' }]);
});

test('verified separate accounts can complete Worker setup and Client booking checkout', async () => {
  const fingerprint = crypto.randomUUID();
  const client = await account('client');
  const worker = await account('worker');
  for (const id of [client, worker]) {
    await approve(id, fingerprint);
    await db.query('select public.confirm_account_identity_name($1)', [id]);
  }
  await db.query('select public.complete_account_provider_setup($1,$2)', [worker, providerSetup]);
  const services = await db.query('select seller_id,active from public.services where seller_id=$1', [worker]);
  assert.deepEqual(services.rows, [{ seller_id: worker, active: true }]);
  const booking = await db.query<{ id: string }>("insert into public.bookings(buyer_id,seller_id,metadata) values($1,$2,'{\"booking_mode\":\"calendar-only\"}') returning id", [client, worker]);
  await db.query('insert into public.conversations(buyer_id,seller_id) values($1,$2)', [client, worker]);
  await db.query("select set_config('test.uid',$1,false)", [client]);
  const address = { province: 'Bulacan', city: 'Guiguinto', barangay: 'Poblacion', address: '123 Test Street' };
  const checkout = await db.query<{ result: { booking: { metadata: { service_address: typeof address } } } }>(
    'select public.start_booking_checkout_with_address($1,null,null,null,\'downpayment\',\'test-operation\',$2) as result', [booking.rows[0].id, address]);
  assert.deepEqual(checkout.rows[0].result.booking.metadata.service_address, address);
});

test('manual review counts duplicates within the requested role and records the correct role', async () => {
  const fingerprint = crypto.randomUUID();
  const client = await account('client');
  await approve(client, fingerprint);
  await db.query('select public.confirm_account_identity_name($1)', [client]);
  for (const role of ['worker', 'client'] as const) {
    const id = await account(role);
    await db.query('select public.submit_account_manual_review($1,$2,$3,$4)', [id, document, fingerprint, { front: 'front.png', back: 'back.png', selfie: 'selfie.png' }]);
    const review = await db.query('select submitted_app_role,submitted_role,duplicate_match_count from public.manual_identity_reviews where user_id=$1', [id]);
    assert.deepEqual(review.rows[0], { submitted_app_role: role, submitted_role: role === 'worker' ? 'musician' : 'fan', duplicate_match_count: role === 'worker' ? 0 : 1 });
  }
});

test('Client accounts cannot create provider profiles; Worker accounts cannot create bookings or checkout', async () => {
  const client = await account('client');
  const worker = await account('worker');
  await assert.rejects(db.query('select public.complete_account_provider_setup($1,$2)', [client, {}]), /Worker account/);
  for (const table of ['sellers', 'worker_profiles']) await assert.rejects(db.query(`insert into public.${table}(user_id) values($1)`, [client]), /Worker account/);
  await assert.rejects(db.query('insert into public.services(seller_id,active) values($1,false)', [client]), /Worker account/);
  await assert.rejects(db.query('insert into public.bookings(buyer_id,seller_id) values($1,$2)', [worker, worker]), /Client account/);
  await assert.rejects(db.query('insert into public.conversations(buyer_id,seller_id) values($1,$2)', [worker, worker]), /Client account/);
  await db.query("select set_config('test.uid',$1,false)", [worker]);
  await assert.rejects(db.query('select public.start_booking_checkout_with_address()'), /Client account/);
  await db.query("select set_config('test.uid',$1,false)", [client]);
  await assert.rejects(db.query('select public.start_booking_checkout_with_address()'), /verification/);
});
