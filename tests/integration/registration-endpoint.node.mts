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

function endpoint(options: { expired?: boolean; confirmed?: boolean; initializationFails?: boolean; duplicate?: boolean; deliveryFails?: boolean } = {}) {
  const calls: string[] = [];
  const updates: Record<string, unknown>[] = [];
  let handler: ((request: Request) => Promise<Response>) | undefined;
  const user = { id: 'pending-test', email: 'person@example.com', email_confirmed_at: options.confirmed ? new Date().toISOString() : null,
    user_metadata: { registration_version: 2, full_name: 'Existing name' } };
  const row = { pending_nonce_hash: 'hash', pending_expires_at: new Date(Date.now() + (options.expired ? -1 : 1) * 3600000).toISOString(), account_role: 'worker' };
  const client = {
    auth: { admin: {
      getUserById: async () => ({ data: { user }, error: null }),
      createUser: async () => { calls.push('create_account'); return { data: { user: options.duplicate ? null : user }, error: options.duplicate ? {} : null }; },
      deleteUser: async () => { calls.push('delete_account'); return { error: null }; },
      updateUserById: async (_id: string, payload: Record<string, unknown>) => { calls.push('save_name'); updates.push(payload); return { error: null }; },
    } },
    rpc: async () => { calls.push('initialize_account'); return { error: options.initializationFails ? {} : null }; },
    from: () => ({ update: () => ({ eq: async () => { calls.push('record_email_delivery'); return { error: null }; } }) }),
  };
  const modules: Record<string, Record<string, unknown>> = {
    '../_shared/identityRegistration.ts': {
      corsHeaders: {}, createSessionNonce: () => 'capability', hashSessionNonce: async () => 'hash',
      verifySessionNonce: async (id: string, nonce: unknown) => id === user.id && nonce === 'capability',
      recordRegistrationAttempt: async () => { calls.push('record_attempt'); },
      sendEmailConfirmation: async () => { calls.push('send_email'); return { sent: !options.deliveryFails }; },
      jsonResponse: (body: unknown, status = 200) => new Response(JSON.stringify(body), { status }), RegistrationRateLimitError,
    },
    '../_shared/identityDomain.ts': { asRecord: (value: unknown) => value && typeof value === 'object' ? value : {} },
    '../_shared/identityRedirect.ts': { identityReturnUrl: () => new URL('http://localhost:3000/register') },
    '../_shared/accountRegistration.ts': {
      accountClient: () => client, AccountError, accountUser: async () => user,
      registrationRow: async () => row, registrationState: async () => ({ state: 'identity_pending' }),
      signupRole: (value: unknown) => value === 'worker' ? 'worker' : 'client', text: (value: unknown) => typeof value === 'string' ? value.trim() : '',
    },
  };
  runInNewContext(compiled, {
    exports: {}, require: (name: string) => { assert.ok(modules[name], `Unexpected import: ${name}`); return modules[name]; },
    Deno: { env: { get: () => '' }, serve: (callback: typeof handler) => { handler = callback; } },
    Request, Response, URL, Date,
  });
  assert.ok(handler);
  const registeredHandler = handler;
  return { calls, updates, request: async (body: Record<string, unknown>) => {
    const response = await registeredHandler(new Request('http://localhost/account-registration', { method: 'POST', body: JSON.stringify(body) }));
    return { status: response.status, body: await response.json() as Record<string, unknown> };
  } };
}

const validAccount = { action: 'create', email: 'person@example.com', password: 'Password123!', acceptedTerms: true, signupRole: 'worker' };
const validName = { action: 'save_name', userId: 'pending-test', nonce: 'capability', signupName: 'Ana María Santos' };

test('confirmation delivery follows successful account creation and initialization', async () => {
  const flow = endpoint();
  const response = await flow.request(validAccount);
  assert.equal(response.status, 200);
  assert.deepEqual(flow.calls, ['record_attempt', 'create_account', 'initialize_account', 'send_email', 'record_email_delivery']);
  assert.equal(response.body.state, 'email_pending');
});
for (const failure of ['initializationFails', 'duplicate'] as const) test(`${failure} prevents confirmation email delivery`, async () => {
  const flow = endpoint({ [failure]: true });
  const response = await flow.request(validAccount);
  assert.ok(response.status >= 400);
  assert.ok(!flow.calls.includes('send_email'));
  if (failure === 'initializationFails') assert.ok(flow.calls.includes('delete_account'));
});
test('delivery failure keeps the newly created account recoverable', async () => {
  const flow = endpoint({ deliveryFails: true });
  const response = await flow.request(validAccount);
  assert.equal(response.status, 200);
  assert.deepEqual(response.body.emailDelivery, { sent: false });
  assert.ok(response.body.pendingAccount);
  assert.ok(!flow.calls.includes('delete_account'));
});
test('name entry updates only unverified metadata and sends no email', async () => {
  const flow = endpoint();
  const response = await flow.request({ ...validName, full_name: 'Forged verified name', confirmed: true });
  assert.equal(response.status, 200);
  assert.deepEqual(response.body, { state: 'email_pending', email: 'person@example.com', signupName: 'Ana María Santos', signupRole: 'worker' });
  assert.deepEqual(JSON.parse(JSON.stringify(flow.updates)), [{ user_metadata: { registration_version: 2, full_name: 'Existing name', signup_name: 'Ana María Santos' } }]);
  assert.deepEqual(flow.calls, ['record_attempt', 'save_name']);
});
for (const options of [{ expired: true }, { confirmed: true }]) test(`name entry rejects ${JSON.stringify(options)} pending accounts`, async () => {
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
  const flow = endpoint();
  assert.equal((await flow.request({ ...validName, signupName: name })).status, 400);
  assert.equal(flow.updates.length, 0);
});
