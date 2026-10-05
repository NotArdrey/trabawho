import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { handleSystemEmails } from './handler.ts';

const userId = '11111111-1111-4111-8111-111111111111';

async function run(input: { token?: string; enabled?: boolean; confirmed?: boolean; smtpFailure?: boolean; saveFailure?: boolean; kind?: string; status?: string; confirmationFails?: boolean; alreadySent?: boolean; restricted?: boolean } = {}) {
  const env = { EMAIL_WORKER_SECRET: 'worker-secret', SMTP_USER: 'sender@example.test', SMTP_PASSWORD: 'test-password',
    TRABAWHO_APP_URL: 'https://trabawho.example', SUPABASE_URL: 'https://email-fixture.test', SUPABASE_ANON_KEY: 'anon-fixture', SUPABASE_SERVICE_ROLE_KEY: 'service-test-key' };
  const previous = Object.fromEntries(Object.keys(env).map((key) => [key, Deno.env.get(key)]));
  for (const [key,value] of Object.entries(env)) Deno.env.set(key,value);
  const originalFetch = globalThis.fetch;
  const deliveries: Record<string, unknown>[] = [];
  const saves: Record<string, unknown>[] = [];
  let claims = 0;
  let confirmationRequests = 0;
  const reviewSaves: Record<string, unknown>[] = [];
  globalThis.fetch = async (url, options) => {
    const request = new Request(url, options);
    const path = new URL(request.url).pathname;
    const response = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type':'application/json' } });
    if (path.endsWith('/rpc/claim_email_notifications')) {
      claims++;
      return response([{ id: 'event-1', recipient_id: userId, kind: input.kind || 'booking', payload: { status: input.status || 'confirmed', email: 'attacker@example.test' }, attempts: 1, lease_token: 'lease-1' }]);
    }
    if (path.endsWith(`/admin/users/${userId}`)) return response({ id: userId, aud: 'authenticated', role: 'authenticated', email: 'recipient@example.test', email_confirmed_at: input.confirmed === false ? null : '2026-01-01', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01' });
    if (path.endsWith('/notification_preferences')) return response({ email_enabled: input.enabled !== false });
    if (path.endsWith('/manual_identity_reviews')) {
      if (request.method === 'PATCH') { reviewSaves.push(await request.json()); return response(null); }
      return response({ id:'review-1',user_id:userId,status:'APPROVED',submitted_by_email:'outdated@example.test',
        decision_email_sent_at:input.alreadySent?'2026-10-01':null,email_delivery_status:input.alreadySent?'sent':'failed' });
    }
    if (path.endsWith('/profiles')) return response({verification_status:'APPROVED',account_status:input.restricted?'suspended':'active',id_document_expiry:null});
    if (path.endsWith('/rpc/claim_identity_email_delivery')) return response(true);
    if (path.endsWith('/auth/v1/resend')) {
      confirmationRequests++;
      assertEquals((await request.json()).email,'recipient@example.test');
      return response({},input.confirmationFails?503:200);
    }
    if (path.endsWith('/email_notification_outbox')) {
      assert(new URL(request.url).searchParams.get('lease_token') === 'eq.lease-1');
      saves.push(await request.json());
      return response(input.saveFailure ? { message: 'private database failure' } : [{ id:'event-1' }], input.saveFailure ? 500 : 200);
    }
    throw new Error(`Unexpected fixture path: ${path}`);
  };
  try {
    const result = await handleSystemEmails(new Request('https://email-fixture.test/function', {
      method: 'POST', headers: { 'x-email-worker-secret': input.token ?? 'worker-secret' },
      body: JSON.stringify({ to:'attacker@example.test', text:'arbitrary content' }),
    }), () => ({ close() {}, sendMail(message) {
      deliveries.push(message);
      return input.smtpFailure ? Promise.reject(new Error('password must not leak')) : Promise.resolve({ accepted: [message.to] });
    } }));
    return { status: result.status, body: await result.json(), deliveries, saves, claims, confirmationRequests, reviewSaves };
  } finally {
    globalThis.fetch = originalFetch;
    for (const [key, value] of Object.entries(previous)) { if (value === undefined) Deno.env.delete(key); else Deno.env.set(key,value); }
  }
}

Deno.test('unauthorized worker calls cannot claim or send email', async () => {
  const result = await run({ token: 'public-token' });
  assertEquals(result.status, 401); assertEquals(result.claims, 0); assertEquals(result.deliveries.length, 0);
});
Deno.test('delivery uses server recipient and records SMTP acceptance with a stable message ID', async () => {
  const result = await run();
  assertEquals(result.status, 200); assertEquals(result.deliveries[0].to, 'recipient@example.test');
  assertEquals(result.deliveries[0].messageId, '<event-1@trabawho.notifications>');
  assertEquals(result.saves[0].status, 'sent');
});
Deno.test('disabled preferences and unconfirmed optional recipients skip delivery', async () => {
  for (const input of [{ enabled: false }, { confirmed: false }]) {
    const result = await run(input);
    assertEquals(result.deliveries.length, 0); assertEquals(result.saves[0].status, 'skipped');
  }
  assertEquals((await run({ enabled:false, confirmed:false, kind:'identity' })).deliveries.length, 1);
});
Deno.test('SMTP failures stay retryable without exposing secrets or claiming success', async () => {
  const result = await run({ smtpFailure: true });
  assertEquals(result.saves[0].status, 'pending');
  assert(!JSON.stringify(result.saves).includes('password'));
  assertEquals(result.body.sent, 0); assertEquals(result.body.failed, 1);
});
Deno.test('failed persistence reports failure instead of returning success', async () => {
  assertEquals((await run({ saveFailure:true })).status, 503);
});

Deno.test('approved identity events retry failed confirmation using the current server email',async()=>{
  const result=await run({kind:'identity',status:'APPROVED',confirmed:false});
  assertEquals(result.confirmationRequests,1);
  assertEquals(result.reviewSaves[0].email_delivery_status,'sent');
  assertEquals(result.saves[0].status,'sent');
  assertEquals(result.deliveries.length,1);
});
Deno.test('confirmation outage keeps approval queued for retry without claiming email was sent',async()=>{
  const result=await run({kind:'identity',status:'APPROVED',confirmed:false,confirmationFails:true});
  assertEquals(result.confirmationRequests,1);
  assertEquals(result.reviewSaves[0].email_delivery_status,'failed');
  assertEquals(result.saves[0].status,'pending');
  assertEquals(result.deliveries.length,0);
});
Deno.test('sent confirmations are not duplicated and later account restrictions prevent delivery',async()=>{
  const sent=await run({kind:'identity',status:'APPROVED',confirmed:false,alreadySent:true});
  assertEquals(sent.confirmationRequests,0);assertEquals(sent.deliveries.length,1);
  const restricted=await run({kind:'identity',status:'APPROVED',confirmed:false,restricted:true});
  assertEquals(restricted.confirmationRequests,0);assertEquals(restricted.deliveries.length,0);
  assertEquals(restricted.saves[0].status,'skipped');
});
Deno.test('decline notifications reach unconfirmed accounts without requesting confirmation',async()=>{
  const result=await run({kind:'identity',status:'DECLINED',confirmed:false,enabled:false});
  assertEquals(result.confirmationRequests,0);
  assertEquals(result.deliveries.length,1);
  assert(String(result.deliveries[0].subject).includes('Registration declined'));
});
