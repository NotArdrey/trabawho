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
    '20261006108000_identity_before_email_confirmation.sql',
    '20261006111000_registration_drafts.sql', '20261006112000_registration_draft_events.sql',
    '20261006121000_registration_review_and_reset.sql',
    '20261007100000_email_first_registration.sql',
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
  await db.exec(`create trigger promote_identity_profile_after_email_confirm after update of email_confirmed_at on auth.users
    for each row execute function public.promote_identity_profile_after_email_confirm()`);
});
after(async () => { await db.close(); });

async function admin() {
  const id = crypto.randomUUID();
  await db.query('insert into auth.users(id,email) values($1,$2)', [id, id + '@test.invalid']);
  await db.query("insert into public.profiles(user_id,role) values($1,'admin')", [id]);
  return id;
}

async function account(role: 'client' | 'worker', confirmed = true, version = 2) {
  const id = crypto.randomUUID();
  await db.query("insert into auth.users(id,email,email_confirmed_at,raw_app_meta_data) values($1,$2,$3,$4)", [id, id + '@test.invalid', confirmed ? new Date().toISOString() : null, { signup_role: role, registration_version: version }]);
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


test('unconfirmed older accounts still require their inbox link after identity approval', async () => {
  const id = await account('client', false);
  await approve(id, 'identity-first-' + id);
  const email = () => db.query('select email_confirmed_at from auth.users where id=$1', [id]);
  assert.equal((await email()).rows[0].email_confirmed_at, null);
  await assert.rejects(db.query("update public.profiles set is_verified=true,verification_status='APPROVED' where user_id=$1", [id]), /identity verification/);
  assert.equal((await email()).rows[0].email_confirmed_at, null);
  await db.query('select public.confirm_account_identity_name($1)', [id]);
  assert.equal((await email()).rows[0].email_confirmed_at,null);
  assert.equal((await db.query('select is_verified from public.profiles where user_id=$1', [id])).rows[0].is_verified, false);
  await db.exec("select set_config('test.role','authenticated',false)");
  try { await db.query('update public.profiles set full_name=full_name where user_id=$1', [id]); }
  finally { await db.exec("select set_config('test.role','service_role',false)"); }
});

test('approval and rejection of older manual registrations never confirm their email', async () => {
  for (const decision of ['APPROVED', 'DECLINED']) {
    const id = await account('worker', false);
    const review = await db.query<{ id: string }>('select public.submit_account_manual_review($1,$2,$3,$4) as id',
      [id, document, 'manual-identity-first-' + id, { front: id + '/front.png', back: id + '/back.png', selfie: id + '/selfie.png' }]);
    assert.equal((await db.query('select email_confirmed_at from auth.users where id=$1', [id])).rows[0].email_confirmed_at, null);
    await db.query('select public.decide_account_identity_review($1,$2,$3,$4,$5,$6)',
      [review.rows[0].id, await admin(), decision, 'Document and selfie evidence reviewed by administrator.', crypto.randomUUID(), decision === 'APPROVED' ? document.fullName : null]);
    assert.equal((await db.query('select email_confirmed_at from auth.users where id=$1', [id])).rows[0].email_confirmed_at,null);
    assert.equal((await db.query('select is_verified from public.profiles where user_id=$1', [id])).rows[0].is_verified,false);
  }
});

async function draft(role: 'client' | 'worker', status='APPROVED', evidence: Record<string,string> | null=null) {
  const id=crypto.randomUUID(),lease=crypto.randomUUID(),session=crypto.randomUUID();
  await db.query(`insert into public.registration_drafts(id,email,account_role,password_ciphertext,nonce_hash,
    session_id,session_url,provider_status,document,fingerprint,payload,evidence,creation_lease)
    values($1,$2,$3,'encrypted-only','nonce',$4,'https://verification.didit.me/test',$5,$6,$7,$8,$9,$10)`,
    [id,id+'@test.invalid',role,session,status,{...document,backNotApplicable:true},'draft-'+id,{timestamp:100},evidence,lease]);
  return {id,lease,session};
}
async function draftAuth(id:string,role:string) {
  await db.query('insert into auth.users(id,email,raw_app_meta_data) values($1,$2,$3)',
    [id,id+'@test.invalid',{registration_version:3,registration_draft_id:id,signup_role:role}]);
}
for (const role of ['client','worker'] as const) test(`V3 ${role} Didit approval waits for an admin, then requires inbox confirmation`, async()=>{
  const {id,lease}=await draft(role);
  assert.equal((await db.query('select id from auth.users where id=$1',[id])).rows.length,0);
  assert.equal((await db.query('select user_id from public.profiles where user_id=$1',[id])).rows.length,0);
  await assert.rejects(db.query('select public.finalize_registration_draft($1,$2)',[id,lease]),/Identity must finish/);
  await draftAuth(id,role);
  await db.query('select public.finalize_registration_draft($1,$2)',[id,lease]);
  const profile=await db.query('select role,verification_status,is_verified,full_name from public.profiles where user_id=$1',[id]);
  assert.deepEqual(profile.rows[0],{role,verification_status:'PENDING_REVIEW',is_verified:false,full_name:''});
  assert.equal((await db.query('select email_confirmed_at from auth.users where id=$1',[id])).rows[0].email_confirmed_at,null);
  assert.equal((await db.query('select password_ciphertext from public.registration_drafts where id=$1',[id])).rows[0].password_ciphertext,null);
  await db.query('select public.finalize_registration_draft($1,$2)',[id,lease]);
  assert.equal((await db.query('select user_id from public.account_registrations where user_id=$1',[id])).rows.length,1);
  await assert.rejects(db.query('select public.claim_pending_account_email($1,$2)',[id,'nonce']),/after identity approval/);
  const review=await db.query<{id:string}>('select id from public.manual_identity_reviews where user_id=$1',[id]);
  assert.equal(review.rows.length,1);
  await db.query('select public.decide_account_identity_review($1,$2,$3,$4,$5,$6)',
    [review.rows[0].id,await admin(),'APPROVED','Verified name and document against submitted evidence.',crypto.randomUUID(),document.fullName]);
  assert.equal((await db.query('select email_confirmed_at from auth.users where id=$1',[id])).rows[0].email_confirmed_at,null);
  assert.equal((await db.query('select is_verified from public.profiles where user_id=$1',[id])).rows[0].is_verified,false);
  await db.query('select public.claim_pending_account_email($1,$2)',[id,'nonce']);
  if (role==='worker') await assert.rejects(db.query('select public.complete_account_provider_setup($1,$2)',[id,providerSetup]),/verification/);
  await db.query('update auth.users set email_confirmed_at=now() where id=$1',[id]);
  assert.equal((await db.query('select is_verified from public.profiles where user_id=$1',[id])).rows[0].is_verified,true);
  assert.equal((await db.query('select full_name from public.profiles where user_id=$1',[id])).rows[0].full_name,document.fullName);
});
test('V3 manual submission permits IDs without a back side and keeps email blocked until admin approval',async()=>{
  const {id,lease}=await draft('worker','PENDING_REVIEW',{front:'front.png',selfie:'selfie.png'});
  await draftAuth(id,'worker');
  await db.query('select public.finalize_registration_draft($1,$2)',[id,lease]);
  await assert.rejects(db.query('select public.claim_pending_account_email($1,$2)',[id,'nonce']),/after identity approval/);
  const review=await db.query<{id:string}>('select id from public.manual_identity_reviews where user_id=$1',[id]);
  await db.query('select public.decide_account_identity_review($1,$2,$3,$4,$5,$6)',
    [review.rows[0].id,await admin(),'APPROVED','Verified name and document against submitted evidence.',crypto.randomUUID(),document.fullName]);
  assert.equal((await db.query('select email_confirmed_at from auth.users where id=$1',[id])).rows[0].email_confirmed_at,null);
  assert.equal((await db.query('select is_verified from public.profiles where user_id=$1',[id])).rows[0].is_verified,false);
  await db.query('select public.claim_pending_account_email($1,$2)',[id,'nonce']);
});
test('V3 draft event blocks expired and ambiguous identities, rejects forged status, and deduplicates deliveries',async()=>{
  for(const [patch,status] of [[{expiry:'2000-01-01'},'EXPIRED'],[{nameAmbiguous:true},'PENDING_REVIEW']] as const) {
    const {id,session}=await draft('client','PENDING');
    const event=crypto.randomUUID();
    const args=[event,'hash',session,'APPROVED',{timestamp:100},{...document,...patch},'fingerprint-'+id];
    await db.query('select public.apply_registration_draft_event($1,$2,$3,$4,$5,$6,$7)',args);
    assert.equal((await db.query('select provider_status from public.registration_drafts where id=$1',[id])).rows[0].provider_status,status);
    await db.query('select public.apply_registration_draft_event($1,$2,$3,$4,$5,$6,$7)',args);
    assert.equal((await db.query('select event_key from public.didit_webhook_events where event_key=$1',[event])).rows.length,1);
    await assert.rejects(db.query('select public.apply_registration_draft_event($1,$2,$3,$4,$5,$6,$7)',[crypto.randomUUID(),'hash',session,'FORGED',{timestamp:200},document,'fingerprint']),/Unsupported status/);
  }
});
test('V3 duplicate identity is held for review while opposite-role registration is allowed',async()=>{
  const fingerprint='draft-duplicate-'+crypto.randomUUID();
  const original=await account('client');await approve(original,fingerprint);await db.query('select public.confirm_account_identity_name($1)',[original]);
  for(const role of ['client','worker'] as const) {
    const {id,lease,session}=await draft(role,'PENDING');
    await db.query('select public.apply_registration_draft_event($1,$2,$3,$4,$5,$6,$7)',[crypto.randomUUID(),'hash',session,'APPROVED',{timestamp:100},document,fingerprint]);
    assert.equal((await db.query('select provider_status from public.registration_drafts where id=$1',[id])).rows[0].provider_status,'PENDING_REVIEW');
    await draftAuth(id,role);
    await db.query('select public.finalize_registration_draft($1,$2)',[id,lease]);
    assert.equal((await db.query('select verification_status from public.profiles where user_id=$1',[id])).rows[0].verification_status,'PENDING_REVIEW');
  }
});
test('V3 pending and expired drafts cannot obtain an account creation lease or finalize',async()=>{
  const {id,lease}=await draft('client','PENDING');await draftAuth(id,'client');
  const claim=await db.query<{claimed:boolean}>("select public.claim_registration_draft($1,$2,'finalize') as claimed",[id,lease]);
  assert.equal(claim.rows[0].claimed,false);
  await assert.rejects(db.query('select public.finalize_registration_draft($1,$2)',[id,lease]),/Identity must finish/);
  await db.query("update public.registration_drafts set provider_status='APPROVED',expires_at=now()-interval '1 day' where id=$1",[id]);
  await assert.rejects(db.query('select public.finalize_registration_draft($1,$2)',[id,lease]),/Identity must finish/);
});

test('Didit report ISO created_at is normalized and webhook timestamp controls event ordering',async()=>{
  const {id,session}=await draft('client','PENDING');
  await db.query('select public.apply_registration_draft_event($1,$2,$3,$4,$5,$6,$7)',
    [crypto.randomUUID(),'hash',session,'PENDING',{created_at:'2026-10-05T08:00:00Z',timestamp:1791187201},document,'fp-'+id]);
  assert.equal((await db.query('select event_timestamp from public.registration_drafts where id=$1',[id])).rows[0].event_timestamp,1791187201);
  await db.query('select public.apply_registration_draft_event($1,$2,$3,$4,$5,$6,$7)',
    [crypto.randomUUID(),'hash',session,'APPROVED',{created_at:'2026-10-05T08:00:00Z',timestamp:1791187202},document,'fp-'+id]);
  assert.equal((await db.query('select provider_status from public.registration_drafts where id=$1',[id])).rows[0].provider_status,'PENDING_REVIEW');
  const iso=await db.query<{payload:{created_at:number}}>("select public.normalize_didit_event_payload('{\"created_at\":\"2026-10-05T08:00:00Z\"}') as payload");
  assert.equal(iso.rows[0].payload.created_at,1791187200);
});

test('discarding an unfinished draft erases credentials and prevents late approved callbacks creating an account',async()=>{
  const {id,session,lease}=await draft('client','PENDING');
  await db.query('select public.discard_registration_draft($1)',[id]);
  const discarded=await db.query('select provider_status,password_ciphertext from public.registration_drafts where id=$1',[id]);
  assert.deepEqual(discarded.rows[0],{provider_status:'ABANDONED',password_ciphertext:null});
  const event=await db.query<{result:null}>('select public.apply_registration_draft_event($1,$2,$3,$4,$5,$6,$7) as result',
    [crypto.randomUUID(),'hash',session,'APPROVED',{timestamp:200},document,'fp-'+id]);
  assert.equal(event.rows[0].result,null);
  await assert.rejects(db.query('select public.finalize_registration_draft($1,$2)',[id,lease]),/Identity must finish/);
  assert.equal((await db.query('select id from auth.users where id=$1',[id])).rows.length,0);
  const submitted=await draft('client','PENDING_REVIEW');
  assert.equal((await db.query<{result:boolean}>('select public.discard_registration_draft($1) as result',[submitted.id])).rows[0].result,false);
});

for (const role of ['client','worker'] as const) test(`V4 ${role} verifies email before identity and still needs human approval`,async()=>{
  const id=await account(role,false,4);
  const lease=crypto.randomUUID();
  const evidence={front:'front.png',back:'back.png',selfie:'selfie.png'};
  // Email delivery can be claimed before any identity evidence exists.
  assert.equal((await db.query<{email:string}>('select public.claim_pending_account_email($1,$2) as email',[id,'test-nonce'])).rows[0].email,id+'@test.invalid');
  await assert.rejects(db.query('select public.claim_account_identity_session($1,$2)',[id,lease]),/Confirm your email/);
  await assert.rejects(db.query('select public.attach_account_identity_session($1,$2,$3,$4)',[id,lease,'forged','https://verification.didit.me/test']),/Confirm your email/);
  await assert.rejects(db.query('select public.submit_account_manual_review($1,$2,$3,$4)',[id,document,'fp-'+id,evidence]),/Confirm your email/);
  assert.equal((await db.query('select current_session_id from public.account_registrations where user_id=$1',[id])).rows[0].current_session_id,null);
  await db.query('update auth.users set email_confirmed_at=now() where id=$1',[id]);
  assert.equal((await db.query('select is_verified from public.profiles where user_id=$1',[id])).rows[0].is_verified,false);
  const session=await approve(id,'fp-'+id);
  assert.deepEqual((await db.query('select verification_status,is_verified from public.profiles where user_id=$1',[id])).rows[0],{verification_status:'PENDING_REVIEW',is_verified:false});
  await assert.rejects(db.query('select public.confirm_account_identity_name($1)',[id]),/needs review/);
  const review=await db.query<{id:string}>('select id from public.manual_identity_reviews where user_id=$1',[id]);
  assert.equal(review.rows.length,1);
  await db.query('select public.decide_account_identity_review($1,$2,$3,$4,$5,$6)',
    [review.rows[0].id,await admin(),'APPROVED','Document and selfie reviewed by the administrator.',crypto.randomUUID(),document.fullName]);
  assert.equal((await db.query('select is_verified from public.profiles where user_id=$1',[id])).rows[0].is_verified,true);
  // A later trusted provider update preserves the completed human decision.
  await db.query('select public.apply_didit_identity_event($1,$2,$3,$4,$5,$6,$7)',
    [session+'-later','hash',session,'APPROVED',{timestamp:200},document,'fp-'+id]);
  assert.equal((await db.query('select is_verified from public.profiles where user_id=$1',[id])).rows[0].is_verified,true);
});
