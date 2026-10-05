import { assert, assertEquals, assertThrows } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { buildNotificationEmail, canEmail, deliveryFailure, type EmailEvent, type EmailKind } from './emailNotifications.ts';
import { authEmailTemplates } from './authEmailTemplates.ts';

const event: EmailEvent = { id: 'event-1', recipient_id: 'user-1', kind: 'booking', attempts: 1,
  lease_token: 'lease-1', payload: { status: 'confirmed', payment_status: 'paid', reference: 'booking-1' } };

Deno.test('all system event types have text and escaped HTML emails', () => {
  const kinds: EmailKind[] = ['booking','message','payment','refund','quote','reschedule','support','review','identity','account','boost'];
  for (const kind of kinds) {
    const result = buildNotificationEmail({ ...event, kind }, 'https://trabawho.example/path');
    assert(result.subject.startsWith('TrabaWho: '));
    assert(result.text.includes('https://trabawho.example/'));
    assert(result.html.includes('Open TrabaWho'));
  }
  const result = buildNotificationEmail({ ...event, payload: { status: '<script>alert(1)</script>', reference: '"<img>' } }, 'https://trabawho.example');
  assert(!result.html.includes('<script>') && !result.html.includes('<img>'));
  assert(result.html.includes('&lt;script&gt;'));
});
Deno.test('emails exclude private bodies and notes and render Philippine schedules', () => {
  const result = buildNotificationEmail({ ...event, payload: { body: 'private message', admin_notes: 'private notes',
    start_ts: '2026-10-03T02:00:00Z' } }, 'https://trabawho.example');
  assert(!result.text.includes('private'));
  assert(result.text.includes('10:00') && result.text.includes('Philippine time'));
});
Deno.test('unsafe application URLs are rejected', () => {
  assertThrows(() => buildNotificationEmail(event, 'javascript:alert(1)'));
  assertThrows(() => buildNotificationEmail(event, 'http://public.example'));
});
Deno.test('identity notifications distinguish review from confirmation and omit internal user IDs', () => {
  const pending = buildNotificationEmail({ ...event, kind: 'identity', payload: { status: 'PENDING_REVIEW', reference: 'internal-user-id' } }, 'https://trabawho.example');
  assert(pending.text.includes('administrator') && pending.html.includes('confirmation, when available, arrives separately'));
  assert(!pending.text.includes('internal-user-id') && !pending.html.includes('internal-user-id'));
  const approved = buildNotificationEmail({ ...event, kind: 'identity', payload: { status: 'APPROVED' } }, 'https://trabawho.example');
  assert(approved.text.includes('separate confirmation email'));
  assert(!approved.html.includes('Confirm my email'));
});
Deno.test('Auth designs preserve secure link and code placeholders with a distinct confirmation action', () => {
  const templates = authEmailTemplates();
  assertEquals(Object.keys(templates).length, 12);
  for (const kind of ['confirmation', 'recovery', 'invite', 'magic_link', 'email_change']) {
    const html = templates[`mailer_templates_${kind}_content`];
    assert(html.includes('href="{{ .ConfirmationURL }}"'));
    assert(!html.includes('.TokenHash') && !html.includes('javascript:'));
    assert(html.includes('role="presentation"') && html.includes('name="viewport"'));
  }
  assert(templates.mailer_templates_confirmation_content.includes('Confirm my email'));
  assert(templates.mailer_templates_reauthentication_content.includes('{{ .Token }}'));
  assert(!templates.mailer_templates_reauthentication_content.includes('.ConfirmationURL'));
});
Deno.test('optional notifications respect confirmed email and preferences; security alerts remain enabled', () => {
  assertEquals(canEmail('booking', false, true), false);
  assertEquals(canEmail('message', true, false), false);
  assertEquals(canEmail('payment', true, true), true);
  assertEquals(canEmail('identity', false, false), true);
  assertEquals(canEmail('account', false, true), true);
});
Deno.test('delivery retries back off and stop at five attempts with sanitized diagnostics', () => {
  assertEquals(deliveryFailure(1, 0).available_at, '1970-01-01T00:02:00.000Z');
  assertEquals(deliveryFailure(4, 0).status, 'pending');
  assertEquals(deliveryFailure(5, 0).status, 'failed');
});
