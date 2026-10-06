import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

const source = readFileSync(new URL('../../supabase/functions/_shared/accountRegistration.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
interface AccessModule {
  accountUser: (request: Request, client: unknown) => Promise<unknown>;
  registrationState: (client: unknown, user: unknown) => Promise<{state:string}>;
}
const exports: Record<string, unknown> = {};
const modules: Record<string, Record<string, unknown>> = {
  'https://esm.sh/@supabase/supabase-js@2.104.1': { createClient: () => { throw new Error('Unexpected network client creation.'); } },
  './identityDomain.ts': { asRecord: (value: unknown) => value && typeof value === 'object' ? value : {} },
  './identityRegistration.ts': {},
};
runInNewContext(compiled, {
  exports, require: (name: string) => { assert.ok(modules[name], `Unexpected import: ${name}`); return modules[name]; },
  Request, Response, URL, Date,
});
const access = exports as unknown as AccessModule;

function fixture(options: { invalidToken?: boolean; missing?: boolean; databaseError?: boolean; firstReadFails?: boolean; status?: string | null; verified?: boolean } = {}) {
  const user = { id: 'signed-in-account', email_confirmed_at: '2026-10-05T00:00:00Z' };
  const filters: { column: string; value: unknown }[] = [];
  let reads = 0;
  const client = {
    auth: { getUser: async (token: string) => {
      assert.equal(token, 'authenticated-token');
      return { data: { user: options.invalidToken ? null : user }, error: options.invalidToken ? { message: 'Invalid token' } : null };
    } },
    from: (table: string) => {
      assert.equal(table, 'profiles');
      return { select: (columns: string) => {
        assert.equal(columns, 'account_status');
        return { eq: (column: string, value: unknown) => {
          filters.push({ column, value });
          return { maybeSingle: async () => { reads += 1; return {
            data: options.missing ? null : { account_status: options.status === undefined ? 'active' : options.status, is_verified: options.verified ?? true },
            error: options.databaseError || (options.firstReadFails && reads === 1) ? { message: 'Private database diagnostic' } : null,
          }; } };
        } };
      } };
    },
  };
  const request = new Request('https://example.invalid/registration', { headers: { Authorization: 'Bearer authenticated-token' } });
  return { user, filters, reads: () => reads, read: () => access.accountUser(request, client) };
}

test('active verified legacy accounts can sign in without a registration record', async () => {
  const flow = fixture();
  assert.equal(await flow.read(), flow.user);
  assert.deepEqual(flow.filters, [{ column: 'user_id', value: flow.user.id }]);
});
test('active unverified accounts can sign in to resume registration', async () => {
  const flow = fixture({ verified: false });
  assert.equal(await flow.read(), flow.user);
});
test('invalid authentication stops before profile access', async () => {
  const flow = fixture({ invalidToken: true });
  await assert.rejects(flow.read(), { status: 401, message: 'Sign in to continue your registration.' });
  assert.deepEqual(flow.filters, []);
});
test('profile lookup failure offers retry without falsely reporting a restricted account', async () => {
  const flow = fixture({ databaseError: true });
  await assert.rejects(flow.read(), { status: 503, message: 'Account access could not be checked. Retry shortly.' });
  assert.equal(flow.reads(), 2);
});
test('a transient profile read failure recovers using the same authenticated account', async () => {
  const flow = fixture({ firstReadFails: true });
  assert.equal(await flow.read(), flow.user);
  assert.equal(flow.reads(), 2);
  assert.ok(flow.filters.every(filter => filter.column === 'user_id' && filter.value === flow.user.id));
});
test('missing profiles remain blocked and report unavailable account setup', async () => {
  const flow = fixture({ missing: true });
  await assert.rejects(flow.read(), { status: 409, message: 'Your account profile is unavailable. Contact support.' });
  assert.equal(flow.reads(), 1);
});
for (const status of ['disabled', 'suspended', 'unknown', null]) test(`account status ${String(status)} remains restricted`, async () => {
  const flow = fixture({ status });
  await assert.rejects(flow.read(), { status: 403, message: 'Account access is restricted. Contact support.' });
  assert.equal(flow.reads(), 1);
});


const pendingSource = readFileSync(new URL('../../supabase/functions/_shared/pendingRegistrationAccess.ts', import.meta.url), 'utf8');
const pendingCompiled = ts.transpileModule(pendingSource, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const pendingExports: Record<string, unknown> = {};
runInNewContext(pendingCompiled, {
  exports: pendingExports,
  require: (name: string) => {
    if (name === './accountRegistration.ts') return exports;
    assert.equal(name, './identityRegistration.ts');
    return { verifySessionNonce: async (id: string, nonce: unknown, hash: unknown) => id === 'pending-user' && nonce === 'valid-capability' && hash === 'stored-hash' };
  }, Date, Number,
});
const pendingAccess = pendingExports as unknown as {
  registrationUser: (request: Request, client: unknown, body: Record<string, unknown>) => Promise<{ id: string }>;
};
function pendingFixture(options: { nonce?: string; expired?: boolean; malformedExpiry?: boolean; status?: string; missing?: boolean } = {}) {
  let userReads = 0;
  const client = {
    from: (table: string) => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ error: null,
      data: table === 'account_registrations' ? options.missing ? null : {
        pending_nonce_hash: 'stored-hash', pending_expires_at: options.malformedExpiry ? 'invalid' : new Date(Date.now() + (options.expired ? -1 : 1) * 3600000).toISOString(),
      } : { account_status: options.status ?? 'active' },
    }) }) }) }),
    auth: { admin: { getUserById: async (id: string) => { userReads++; return { error: null, data: { user: { id, email_confirmed_at: null } } }; } } },
  };
  const request = new Request('https://example.invalid/registration');
  return { read: () => pendingAccess.registrationUser(request, client, { userId: 'pending-user', nonce: options.nonce ?? 'valid-capability' }), userReads: () => userReads };
}

test('a valid recovery capability permits registration before email confirmation', async () => {
  assert.equal((await pendingFixture().read()).id, 'pending-user');
});
for (const options of [{ nonce: 'forged' }, { expired: true }, { malformedExpiry: true }, { status: 'disabled' }, { status: 'suspended' }, { missing: true }]) {
  test(`pending registration rejects ${JSON.stringify(options)} before accessing Auth`, async () => {
    const flow = pendingFixture(options);
    await assert.rejects(flow.read());
    assert.equal(flow.userReads(), 0);
  });
}

test('unconfirmed email takes precedence over identity status in registration state',async()=>{
  for(const status of ['UNVERIFIED','PENDING_REVIEW','APPROVED','DECLINED']) {
    const client={from:(table:string)=>({select:()=>({eq:()=>({
      maybeSingle:async()=>({error:null,data:table==='account_registrations'?{account_role:'client'}:null}),
      single:async()=>({error:null,data:{verification_status:status,is_verified:status==='APPROVED'}}),
    })})})};
    assert.equal((await access.registrationState(client,{id:'email-pending',email:'person@example.com',email_confirmed_at:null,user_metadata:{}})).state,'email_pending');
  }
});

for(const name of ['account-didit-session','account-manual-review','account-identity-name']) test(`${name} rejects unconfirmed account recovery before identity writes`,async()=>{
  let handler:((request:Request)=>Promise<Response>)|undefined;
  const unconfirmed={id:'unconfirmed',email:'person@example.com',email_confirmed_at:null};
  const endpointModules:Record<string,Record<string,unknown>>={
    '../_shared/accountRegistration.ts':{...exports,accountClient:()=>({})},
    '../_shared/pendingRegistrationAccess.ts':{registrationUser:async()=>unconfirmed},
    '../_shared/registrationDrafts.ts':{ownedDraft:async()=>null},
    '../_shared/registrationDraftIdentity.ts':{},
    '../_shared/identityRegistration.ts':{corsHeaders:{},jsonResponse:(value:unknown,status=200)=>new Response(JSON.stringify(value),{status})},
    '../_shared/identityDomain.ts':modules['./identityDomain.ts'],
    '../_shared/identityRedirect.ts':{},
    '../_shared/manualRegistrationEvidence.ts':{manualDocument:()=>({fullName:'Person'})},
    '../_shared/accountConfirmation.ts':{},
  };
  const code=readFileSync(new URL(`../../supabase/functions/${name}/index.ts`,import.meta.url),'utf8');
  runInNewContext(ts.transpileModule(code,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{
    exports:{},require:(dependency:string)=>{assert.ok(endpointModules[dependency]);return endpointModules[dependency];},
    Deno:{env:{get:()=>''},serve:(value:typeof handler)=>{handler=value;}},Response,
  });
  assert.ok(handler);
  const response=await handler(new Request('https://example.invalid/identity',{method:'POST',body:JSON.stringify({userId:'unconfirmed',nonce:'valid',acceptedIdentityTerms:true})}));
  assert.equal(response.status,403);
  assert.deepEqual(await response.json(),{error:'Confirm your email before identity verification.'});
});
