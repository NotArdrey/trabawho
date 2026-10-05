import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.104.1';
import nodemailer from 'npm:nodemailer@10.0.13';
import { buildNotificationEmail, canEmail, deliveryFailure, type EmailEvent } from '../_shared/emailNotifications.ts';
import { deliverIdentityConfirmation } from '../_shared/identityConfirmation.ts';

const json = (value: Record<string, unknown>, status = 200) => new Response(JSON.stringify(value), {
  status, headers: { 'Content-Type': 'application/json' },
});

interface NotificationMailer {
  sendMail(message: { from: { name: string; address: string }; to: string; messageId: string; subject: string; text: string; html: string }): Promise<{ accepted?: unknown[] }>;
  close(): void;
}
function createMailer(user: string, password: string): NotificationMailer {
  return nodemailer.createTransport({
    host: 'smtp.gmail.com', port: 465, secure: true, auth: { user, pass: password },
    connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 15000,
    disableFileAccess: true, disableUrlAccess: true,
  });
}

export async function handleSystemEmails(request: Request, mailerFactory = createMailer): Promise<Response> {
  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);
  const secret = Deno.env.get('EMAIL_WORKER_SECRET');
  if (!secret || request.headers.get('x-email-worker-secret') !== secret)
    return json({ error: 'Unauthorized.' }, 401);
  const appUrl = Deno.env.get('TRABAWHO_APP_URL') || '';
  const user = Deno.env.get('SMTP_USER') || '';
  const password = (Deno.env.get('SMTP_PASSWORD') || '').replace(/\s/g, '');
  if (!appUrl || !user || !password) return json({ error: 'Server email configuration is incomplete.' }, 503);
  const client = createClient(Deno.env.get('SUPABASE_URL') || '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '', {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const mailer = mailerFactory(user, password);
  const claimed = await client.rpc('claim_email_notifications', { p_limit: 5 });
  if (claimed.error) return json({ error: 'Email queue could not be loaded.' }, 503);
  const events = (claimed.data || []) as EmailEvent[];
  let sent = 0;
  let failed = 0;
  let skipped = 0;
  for (const event of events) {
    let outcome: Record<string, unknown> | null = null;
    try {
      const [account, preferences] = await Promise.all([
        client.auth.admin.getUserById(event.recipient_id),
        client.from('notification_preferences').select('email_enabled').eq('user_id', event.recipient_id).maybeSingle(),
      ]);
      if (account.error || preferences.error) throw new Error('Recipient could not be loaded.');
      const recipient = account.data.user;
      if (!recipient?.email || !canEmail(event.kind, preferences.data?.email_enabled !== false, !!recipient.email_confirmed_at)) {
        outcome = { status: 'skipped', last_error: null }; skipped++;
      } else {
        // The identity event is durable: retry the inbox link if the immediate
        // admin request failed, before marking its approval notification sent.
        if (event.kind === 'identity' && event.payload.status === 'APPROVED' && !recipient.email_confirmed_at) {
          const review = await client.from('manual_identity_reviews').select('id').eq('user_id',event.recipient_id)
            .eq('status','APPROVED').order('reviewed_at',{ascending:false}).limit(1).maybeSingle();
          if (review.error) throw new Error('Approval review could not be loaded.');
          if (review.data) {
            const confirmation = await deliverIdentityConfirmation(client,String(review.data.id));
            if (confirmation.required && !confirmation.sent) throw new Error('Confirmation delivery is pending.');
            if (!confirmation.required) { outcome = { status: 'skipped', last_error: null }; skipped++; }
          }
        }
        if (!outcome) {
          const result = await mailer.sendMail({
            from: { name: 'TrabaWho', address: user }, to: recipient.email,
            messageId: `<${event.id}@trabawho.notifications>`,
            ...buildNotificationEmail(event, appUrl),
          });
          if (!result.accepted?.length) throw new Error('SMTP did not accept the recipient.');
          outcome = { status: 'sent', sent_at: new Date().toISOString(), last_error: null }; sent++;
        }
      }
    } catch {
      outcome = deliveryFailure(event.attempts); failed++;
    }
    const saved = await client.from('email_notification_outbox').update({ ...outcome, lease_until: null, lease_token: null })
      .eq('id', event.id).eq('lease_token', event.lease_token).select('id');
    if (saved.error || saved.data?.length !== 1) {
      mailer.close();
      return json({ error: 'Email delivery status could not be saved.' }, 503);
    }
  }
  mailer.close();
  return json({ sent, failed, skipped });
}
