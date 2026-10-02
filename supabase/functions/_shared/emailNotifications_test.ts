import { assert, assertEquals, assertThrows } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { buildNotificationEmail, canEmail, deliveryFailure, type EmailEvent, type EmailKind } from './emailNotifications.ts';

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
