import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

const source = readFileSync(new URL('../../supabase/functions/account-registration/index.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
class AccountError extends Error {
  status: number;
  constructor(message: string, status = 400) { super(message); this.status = status; }
}
class RegistrationRateLimitError extends Error {}

function endpoint(options: { expired?: boolean; confirmed?: boolean; draftFails?: boolean; approved?: boolean; humanReviewed?: boolean; deliveryFails?: boolean; profileStatus?: string; missingProfile?: boolean } = {}) {
  const calls: string[] = [];
  const updates: Record<string, unknown>[] = [];
  let handler: ((request: Request) => Promise<Response>) | undefined;
  const user = { id: 'pending-test', email: 'person@example.com', email_confirmed_at: options.confirmed ? new Date().toISOString() : null,
    user_metadata: { registration_version: 2, full_name: 'Existing name' } };
  const row = { pending_nonce_hash: 'hash', pending_expires_at: new Date(Date.now() + (options.expired ? -1 : 1) * 3600000).toISOString(), account_role: 'worker', reviewed_legal_name: options.humanReviewed ? 'Reviewed Name' : null };
  const client = {
    auth: { admin: {
      getUserById: async () => ({ data: { user }, error: null }),
      createUser: async () => { calls.push('create_account'); throw new Error('Account creation must wait for identity evidence'); },
      deleteUser: async () => { calls.push('delete_account'); return { error: null }; },
      updateUserById: async (_id: string, payload: Record<string, unknown>) => { calls.push('save_name'); updates.push(payload); return { error: null }; },
    } },
    rpc: async () => { calls.push('claim_email'); return { error: null,data:user.email }; },
    from: () => ({ select: () => ({eq: () => ({
      maybeSingle: async () => ({error:null,data:options.missingProfile?null:{account_status:'active',identity_required:true,verification_status:options.profileStatus || 'PENDING_REVIEW'}}),
      single:async()=>({error:null,data:row}),
    })}), insert: async (payload:Record<string,unknown>) => { calls.push('save_draft'); updates.push(payload); return { error: options.draftFails ? {} : null }; }, update: () => ({ eq: async () => { calls.push('record_email_delivery'); return { error: null }; } }) }),
  };
  const modules: Record<string, Record<string, unknown>> = {
    '../_shared/identityRegistration.ts': {
      corsHeaders: {}, createSessionNonce: () => 'capability', hashSessionNonce: async () => 'hash',
      verifySessionNonce: async (id: string, nonce: unknown) => id === user.id && nonce === 'capability',
      recordRegistrationAttempt: async () => { calls.push('record_attempt'); },
      sendEmailConfirmation: async () => { calls.push('send_email'); return { sent: !options.deliveryFails }; },
      jsonResponse: (body: unknown, status = 200) => new Response(JSON.stringify(body), { status }), RegistrationRateLimitError,
    },
    '../_shared/pendingRegistrationAccess.ts': {
      registrationUser: async (_request: Request, _client: unknown, body: Record<string, unknown>) => {
        if (body.nonce !== 'capability') throw new AccountError('Invalid recovery capability', 403);
        if (options.expired) throw new AccountError('Expired recovery capability', 410);
        return user;
      }, completedRegistrationSession: async () => { throw new Error('Unexpected session'); },
    },
    '../_shared/identityDomain.ts': { asRecord: (value: unknown) => value && typeof value === 'object' ? value : {} },
    '../_shared/identityRedirect.ts': { identityReturnUrl: () => new URL('http://localhost:3000/register') },
    '../_shared/accountRegistration.ts': {
      accountClient: () => client, AccountError, accountUser: async () => user,
      registrationRow: async () => row, registrationState: async () => ({ state: options.approved ? options.confirmed ? 'ready' : 'email_pending' : 'identity_pending', email: user.email, signupRole: 'worker' }),
      signupRole: (value: unknown) => value === 'worker' ? 'worker' : 'client', text: (value: unknown) => typeof value === 'string' ? value.trim() : '',
    },
  };
  const draftExports: Record<string, unknown> = {};
  const draftSource = readFileSync(new URL('../../supabase/functions/_shared/registrationDrafts.ts', import.meta.url), 'utf8');
  runInNewContext(ts.transpileModule(draftSource, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, {
    exports: draftExports, require: (name: string) => name === './registrationCredentials.ts'
      ? { encryptRegistrationPassword: async () => 'encrypted-password' } : name === './accountConfirmation.ts' ? {}
      : modules['../_shared/' + name.slice(2)], crypto, Date,
  });
  const confirmationExports:Record<string,unknown>={};
  const confirmationSource=readFileSync(new URL('../../supabase/functions/_shared/accountConfirmation.ts',import.meta.url),'utf8');
  runInNewContext(ts.transpileModule(confirmationSource,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{
    exports:confirmationExports,require:(name:string)=>modules['../_shared/'+name.slice(2)],Date,URL,
    Deno:{env:{get:()=>'http://localhost:3000'}},
  });
  modules['../_shared/accountConfirmation.ts'] = confirmationExports;
  modules['../_shared/registrationDrafts.ts'] = { ...draftExports, ownedDraft: async () => null };
  runInNewContext(compiled, {
    exports: {}, require: (name: string) => { assert.ok(modules[name], `Unexpected import: ${name}`); return modules[name]; },
    Deno: { env: { get: () => '' }, serve: (callback: typeof handler) => { handler = callback; } },
    Request, Response, URL, Date,
  });
  assert.ok(handler);
  const registeredHandler = handler;
  return { calls, updates, deliver: () => (confirmationExports.deliverAccountConfirmation as (client:unknown,id:string)=>Promise<Record<string,unknown>>)(client,user.id), request: async (body: Record<string, unknown>) => {
    const response = await registeredHandler(new Request('http://localhost/account-registration', { method: 'POST', body: JSON.stringify(body) }));
    return { status: response.status, body: await response.json() as Record<string, unknown> };
  } };
}

const validAccount = { action: 'create', registrationVersion: 3, email: 'person@example.com', password: 'Password123!', acceptedTerms: true, signupRole: 'worker' };
const validName = { action: 'save_name', userId: 'pending-test', nonce: 'capability', signupName: 'Ana María Santos' };

test('account details save an encrypted draft and start identity without creating Auth or sending email', async () => {
  const flow = endpoint();
  const response = await flow.request(validAccount);
  assert.equal(response.status, 200);
  assert.deepEqual(flow.calls, ['record_attempt', 'save_draft']);
  assert.equal(response.body.state, 'identity_pending');
  assert.equal(flow.updates[0].password_ciphertext,'encrypted-password');
  assert.equal(flow.updates[0].account_role,'worker');
  assert.ok(response.body.pendingAccount);
  assert.ok(!JSON.stringify(response.body).includes('Password123!'));
  assert.ok(!JSON.stringify(flow.updates).includes('Password123!'));
});
test('failed draft persistence creates no Auth account and sends no email', async () => {
  const flow = endpoint({ draftFails: true });
  const response = await flow.request(validAccount);
  assert.ok(response.status >= 400);
  assert.ok(!flow.calls.includes('send_email'));
  assert.ok(!flow.calls.includes('create_account'));
});
test('SMTP failure after approval keeps the account on the final email step', async () => {
  const flow = endpoint({ deliveryFails: true, approved:true });
  const response = await flow.deliver();
  assert.deepEqual(response.emailDelivery, {sent:false});
  assert.equal(response.state,'email_pending');
  assert.ok(flow.calls.includes('send_email'));
  assert.ok(!flow.calls.includes('delete_account'));
});
test('pending identity sends no confirmation through automatic delivery',async()=>{
  const flow=endpoint();
  assert.equal((await flow.deliver()).state,'identity_pending');
  assert.deepEqual(flow.calls,[]);
});
test('refreshing an approved human review leaves initial delivery to the admin action and durable queue',async()=>{
  const flow=endpoint({approved:true,humanReviewed:true});
  assert.equal((await flow.deliver()).state,'email_pending');
  assert.deepEqual(flow.calls,[]);
});
for(const action of ['resend','change_email']) test(`${action} cannot request confirmation before identity approval`,async()=>{
  const flow=endpoint();
  assert.equal((await flow.request({action,userId:'pending-test',nonce:'capability',email:'changed@example.com'})).status,409);
  assert.deepEqual(flow.calls,[]);
});
test('approved identity can request confirmation using its recovery capability',async()=>{
  const flow=endpoint({approved:true});
  const response=await flow.request({action:'resend',userId:'pending-test',nonce:'capability'});
  assert.equal(response.status,200);
  assert.equal(response.body.state,'email_pending');
  assert.deepEqual(flow.calls,['record_attempt','claim_email','send_email','record_email_delivery']);
});
for(const override of [{email:'invalid'},{password:'short'},{acceptedTerms:false}]) test(`server rejects malformed account input ${JSON.stringify(override)} before Auth creation`,async()=>{
  const flow=endpoint();
  assert.equal((await flow.request({...validAccount,...override})).status,400);
  assert.deepEqual(flow.calls,[]);
});
test('name entry updates only unverified metadata and sends no email', async () => {
  const flow = endpoint({confirmed:true});
  const response = await flow.request({ ...validName, full_name: 'Forged verified name', confirmed: true });
  assert.equal(response.status, 200);
  assert.deepEqual(response.body, { state: 'identity_pending', email: 'person@example.com', signupName: 'Ana María Santos', signupRole: 'worker' });
  assert.deepEqual(JSON.parse(JSON.stringify(flow.updates)), [{ user_metadata: { registration_version: 2, full_name: 'Existing name', signup_name: 'Ana María Santos' } }]);
  assert.deepEqual(flow.calls, ['record_attempt', 'save_name']);
});
for (const options of [{ expired: true }]) test(`name entry rejects ${JSON.stringify(options)} pending accounts`, async () => {
  const flow = endpoint(options);
  assert.ok((await flow.request(validName)).status >= 400);
  assert.equal(flow.updates.length, 0);
});
test('name entry rejects an invalid recovery capability', async () => {
  const flow = endpoint();
  assert.equal((await flow.request({ ...validName, nonce: 'wrong' })).status, 403);
  assert.equal(flow.updates.length, 0);
});
for (const name of ['', '123', 'a'.repeat(201), 'Ana\nSantos']) test(`name entry rejects malformed input ${JSON.stringify(name)}`, async () => {
  const flow = endpoint({confirmed:true});
  assert.equal((await flow.request({ ...validName, signupName: name })).status, 400);
  assert.equal(flow.updates.length, 0);
});

for(const status of ['UNVERIFIED','PENDING_REVIEW','DECLINED','APPROVED']) test(`sign-in resend sends only for approved identity: ${status}`,async()=>{
  const flow=endpoint({profileStatus:status});
  const response=await flow.request({action:'resend_from_sign_in',email:'person@example.com'});
  assert.equal(response.status,200);assert.deepEqual(response.body,{requested:true});
  assert.equal(flow.calls.includes('send_email'),status==='APPROVED');
});
test('sign-in resend returns the same result for an unknown email',async()=>{
  const flow=endpoint({missingProfile:true});
  assert.deepEqual((await flow.request({action:'resend_from_sign_in',email:'missing@example.com'})).body,{requested:true});
  assert.ok(!flow.calls.includes('send_email'));
});

for(const sent of [true,false]) test(`approved review records confirmation outcome for the final registration screen: sent=${sent}`,async()=>{
  const updates:{table:string;payload:Record<string,unknown>}[]=[];
  const client={
    auth:{admin:{getUserById:async()=>({error:null,data:{user:{email:'person@example.com',email_confirmed_at:null}}})}},
    rpc:async(name:string)=>{assert.equal(name,'claim_identity_email_delivery');return{error:null,data:true};},
    from:(table:string)=>({
      select:()=>({eq:()=>({single:async()=>({error:null,data:table==='profiles'
        ?{verification_status:'APPROVED',account_status:'active'}
        :{user_id:'reviewed-user',status:'APPROVED',email_delivery_status:'pending'}})})}),
      update:(payload:Record<string,unknown>)=>({eq:async()=>{updates.push({table,payload});return{error:null};}}),
    }),
  };
  const helper:Record<string,unknown>={};
  const code=readFileSync(new URL('../../supabase/functions/_shared/identityConfirmation.ts',import.meta.url),'utf8');
  const dependencies:Record<string,unknown>={
    './identityDomain.ts':{asRecord:(value:unknown)=>value && typeof value==='object'?value:{}},
    './confirmationEmail.ts':{sendEmailConfirmation:async()=>({sent})},
    './identityReviewError.ts':{ReviewError:AccountError},
  };
  runInNewContext(ts.transpileModule(code,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{
    exports:helper,require:(name:string)=>{assert.ok(dependencies[name]);return dependencies[name];},
    Deno:{env:{get:()=>'http://localhost:3000'}},Date,URL,
  });
  const deliver=helper.deliverIdentityConfirmation as(client:unknown,id:string)=>Promise<{sent:boolean}>;
  assert.equal((await deliver(client,'review')).sent,sent);
  assert.equal(updates.length,2);
  assert.equal(updates[0].table,'manual_identity_reviews');
  assert.equal(updates[1].table,'account_registrations');
  assert.equal(updates[1].payload.confirmation_delivery_status,sent?'sent':'failed');
  assert.equal(typeof updates[1].payload.email_sent_at,'string');
});
