import { renderEmailLayout } from './emailLayout.ts';

export type EmailKind = 'booking' | 'message' | 'payment' | 'refund' | 'quote' | 'reschedule' | 'support' | 'review' | 'identity' | 'account' | 'boost';
export interface EmailEvent {
  id: string;
  recipient_id: string;
  kind: EmailKind;
  payload: Record<string, unknown>;
  attempts: number;
  lease_token: string;
}

const labels: Record<EmailKind, string> = {
  booking: 'Booking update', message: 'New message', payment: 'Payment update',
  refund: 'Refund update', quote: 'Quote update', reschedule: 'Rescheduling update',
  support: 'Support case update', review: 'New or updated review',
  identity: 'Identity verification update', account: 'Account status update', boost: 'Service boost update',
};
const introductions: Record<EmailKind, string> = {
  booking: 'Your booking has an update. Review the latest service, schedule, and payment details in TrabaWho.',
  message: 'A new message is waiting in your TrabaWho conversation. Open your messages to read it and reply.',
  payment: 'The payment status has changed. Open TrabaWho to review the payment details.',
  refund: 'Your refund has an update. Open TrabaWho to check its progress and any next steps.',
  quote: 'A service quotation has an update. Review the scope, price, and proposed schedule in TrabaWho.',
  reschedule: 'There is an update to a schedule change. Open TrabaWho to review the requested appointment.',
  support: 'A support case has an update. Open TrabaWho to view its progress and respond when needed.',
  review: 'A customer posted or updated a service review. Open TrabaWho to read their feedback.',
  identity: 'Your identity verification has an update. Open TrabaWho to view the next step.',
  account: 'Your account status has changed. Open TrabaWho to see the current status and any next steps.',
  boost: 'Your service boost has an update. Open TrabaWho to review the payment and promotion details.',
};
const readable = (value: unknown) => typeof value === 'string'
  ? value.slice(0, 100).replaceAll('_', ' ').toLowerCase() : '';

export function buildNotificationEmail(event: EmailEvent, appUrl: string) {
  const origin = new URL(appUrl);
  if (origin.protocol !== 'https:' && !(origin.protocol === 'http:' && ['localhost','127.0.0.1'].includes(origin.hostname)))
    throw new Error('Configure an HTTPS application URL.');
  const url = `${origin.origin}/`;
  let title = labels[event.kind];
  if (!title) throw new Error('Unsupported email notification.');
  let intro = introductions[event.kind];
  const status = readable(event.kind === 'account' ? event.payload.account_status : event.payload.status);
  if (event.kind === 'identity') {
    if (status === 'pending review') {
      title = 'Identity review pending';
      intro = 'This identity verification needs an administrator to review the evidence. We will email you when a decision is recorded.';
    } else if (status === 'approved') {
      title = 'Identity review approved';
      intro = 'The identity review has been approved. If your email is not yet confirmed, look for the separate confirmation email and use its secure link to finish registration.';
    } else if (status === 'declined') {
      title = 'Registration declined';
      intro = 'Your identity review was declined. Your account cannot access the marketplace. Contact TrabaWho support to review the decision and the next steps.';
    } else if (['expired', 'abandoned'].includes(status)) {
      title = 'Identity verification needs attention';
      intro = 'Identity verification is incomplete. Open TrabaWho to see the result and the available next steps.';
    } else {
      title = 'Identity verification in progress';
      intro = 'Registration is in progress. Complete identity verification in TrabaWho to move to the next step.';
    }
  }
  const lines = [title, intro];
  if (!['message', 'review'].includes(event.kind)) {
    if (status) lines.push(`Status: ${status}.`);
    if (event.kind === 'booking') {
      for (const [key, label] of [['payment_status','Payment'], ['delivery_status','Delivery'], ['dispute_status','Dispute']]) {
        const value = readable(event.payload[key]);
        if (value) lines.push(`${label}: ${value}.`);
      }
      if (typeof event.payload.start_ts === 'string') {
        const time = new Date(event.payload.start_ts);
        if (!Number.isNaN(time.getTime())) lines.push(`Schedule: ${new Intl.DateTimeFormat('en-PH', {
          dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Manila',
        }).format(time)} (Philippine time).`);
      }
    }
    if (event.kind === 'support' && readable(event.payload.action)) lines.push(`Support action: ${readable(event.payload.action)}.`);
    if (!['identity', 'account'].includes(event.kind) && typeof event.payload.reference === 'string') lines.push(`Reference: ${event.payload.reference.slice(0, 64)}`);
  }
  const details: Array<{ label: string; value: string }> = [];
  const paragraphs: string[] = [];
  for (const line of lines.slice(2)) {
    const split = line.indexOf(': ');
    if (split < 0) paragraphs.push(line);
    else details.push({ label: line.slice(0, split), value: line.slice(split + 2).replace(/\.$/, '') });
  }
  const footnote = event.kind === 'identity'
    ? 'This is an identity status update. Email confirmation, when available, arrives separately with a secure confirmation link.'
    : 'You received this email because of activity connected to your TrabaWho account.';
  const text = `${lines.join('\n\n')}\n\nOpen TrabaWho: ${url}\n\n${footnote}\n\nTrabaWho`;
  const html = renderEmailLayout({ eyebrow: event.kind === 'identity' ? 'Identity verification' : 'Your TrabaWho activity',
    title, intro, paragraphs, details, action: { label: 'Open TrabaWho', url }, footnote });
  return { subject: `TrabaWho: ${title}`, text, html };
}

export function canEmail(kind: EmailKind, enabled: boolean, confirmed: boolean) {
  return kind === 'identity' || kind === 'account' || (enabled && confirmed);
}

export function isReservedEmailAddress(email: string): boolean {
  const domain = email.trim().toLowerCase().split('@').at(-1) || '';
  return /(^|\.)(test|invalid|example|localhost)$/.test(domain)
    || /(^|\.)example\.(com|net|org)$/.test(domain);
}

export function deliveryFailure(attempts: number, now = Date.now()) {
  return {
    status: attempts >= 5 ? 'failed' : 'pending',
    available_at: new Date(now + Math.min(60, 2 ** attempts) * 60_000).toISOString(),
    last_error: 'Email delivery failed. Check SMTP settings and provider availability.',
  };
}
