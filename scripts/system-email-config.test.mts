import assert from 'node:assert/strict';
import { test } from 'node:test';
import { authSmtpConfiguration, projectTokenCandidates, selectProjectToken } from './system-email-config.mts';

test('Auth SMTP uses the Management API string port and preserves unrelated Auth settings', () => {
  const config = authSmtpConfiguration('sender@example.com', 'abcd efgh ijkl mnop');
  assert.equal(config.smtp_port, '465');
  assert.equal(config.smtp_pass, 'abcdefghijklmnop');
  assert.deepEqual(Object.keys(config).sort(), ['smtp_admin_email', 'smtp_host', 'smtp_pass', 'smtp_port', 'smtp_sender_name', 'smtp_user']);
});

test('includes the local project token when an inherited CLI token belongs to another account', async () => {
  const candidates = projectTokenCandidates({ PAT: 'project-token' }, { SUPABASE_ACCESS_TOKEN: 'stale-cli-token' });
  const calls: string[] = [];
  const request: typeof fetch = (_url, options) => {
    const authorization = new Headers(options?.headers).get('Authorization') || '';
    calls.push(authorization);
    return Promise.resolve(authorization === 'Bearer project-token'
      ? Response.json({ site_url: 'https://app.example.com', hook_send_email_enabled: false })
      : new Response(null, { status: 403 }));
  };
  const selected = await selectProjectToken('test-project', candidates, request);
  assert.equal(selected.token, 'project-token');
  assert.equal(selected.auth.site_url, 'https://app.example.com');
  assert.deepEqual(calls, ['Bearer stale-cli-token', 'Bearer project-token']);
});

test('preserves explicit token precedence and avoids duplicate access checks', () => {
  assert.deepEqual(projectTokenCandidates({ SUPABASE_ACCESS_TOKEN: 'local', PAT: ' local ' },
    { SUPABASE_ACCESS_TOKEN: 'shell' }), ['shell', 'local']);
});

test('access denial hides response diagnostics and supplied credentials', async () => {
  const request: typeof fetch = () => Promise.resolve(new Response('private provider diagnostic', { status: 403 }));
  await assert.rejects(selectProjectToken('test-project', ['private-token'], request), error => {
    assert.ok(error instanceof Error);
    assert.match(error.message, /No supplied Supabase access token/);
    assert.ok(!error.message.includes('private-token'));
    assert.ok(!error.message.includes('private provider diagnostic'));
    return true;
  });
});

test('service failures stop preflight instead of trying another account', async () => {
  let calls = 0;
  const request: typeof fetch = () => { calls++; return Promise.resolve(new Response(null, { status: 503 })); };
  await assert.rejects(selectProjectToken('test-project', ['first', 'second'], request), /HTTP 503/);
  assert.equal(calls, 1);
});
