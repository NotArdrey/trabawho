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
const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (character) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character] || character);
const readable = (value: unknown) => typeof value === 'string'
  ? value.slice(0, 100).replaceAll('_', ' ').toLowerCase() : '';

export function buildNotificationEmail(event: EmailEvent, appUrl: string) {
  const origin = new URL(appUrl);
  if (origin.protocol !== 'https:' && !(origin.protocol === 'http:' && ['localhost','127.0.0.1'].includes(origin.hostname)))
    throw new Error('Configure an HTTPS application URL.');
  const url = `${origin.origin}/`;
  const title = labels[event.kind];
  if (!title) throw new Error('Unsupported email notification.');
  const lines = [title];
  if (event.kind === 'message') lines.push('You have a new message in TrabaWho. Open your messages to reply.');
  else if (event.kind === 'review') lines.push('A customer posted or updated a review of your service.');
  else {
    const status = readable(event.kind === 'account' ? event.payload.account_status : event.payload.status);
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
    if (typeof event.payload.reference === 'string') lines.push(`Reference: ${event.payload.reference.slice(0, 64)}`);
  }
  const text = `${lines.join('\n\n')}\n\nOpen TrabaWho: ${url}\n\nTrabaWho`;
  const html = `<!doctype html><html lang="en"><body><main><h1>${escapeHtml(title)}</h1>${lines.slice(1).map((line) => `<p>${escapeHtml(line)}</p>`).join('')}<p><a href="${escapeHtml(url)}">Open TrabaWho</a></p><p>TrabaWho</p></main></body></html>`;
  return { subject: `TrabaWho: ${title}`, text, html };
}

export function canEmail(kind: EmailKind, enabled: boolean, confirmed: boolean) {
  return kind === 'identity' || kind === 'account' || (enabled && confirmed);
}

export function deliveryFailure(attempts: number, now = Date.now()) {
  return {
    status: attempts >= 5 ? 'failed' : 'pending',
    available_at: new Date(now + Math.min(60, 2 ** attempts) * 60_000).toISOString(),
    last_error: 'Email delivery failed. Check SMTP settings and provider availability.',
  };
}
