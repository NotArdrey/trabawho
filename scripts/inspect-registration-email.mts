import fs from 'node:fs';
import { readServerEnvironment, projectTokenCandidates, selectProjectToken } from './system-email-config.mts';

const local = readServerEnvironment(['.env', '.env.local', 'supabase/.env.local']);
const ref = fs.readFileSync('supabase/.temp/project-ref', 'utf8').trim();
const selected = await selectProjectToken(ref, projectTokenCandidates(local, process.env));
const auth = selected.auth as Record<string, unknown>;
console.log(JSON.stringify({ smtpConfigured: Boolean(auth.smtp_host && auth.smtp_user && auth.smtp_pass),
  smtpHost: auth.smtp_host, smtpPort: auth.smtp_port, emailConfirmationRequired: !auth.mailer_autoconfirm,
  emailHook: Boolean(auth.hook_send_email_enabled), localSmtpPasswordPresent: Boolean(local.SMTP_PASSWORD) }));
for (const query of [
  'select status,kind,count(*) from public.email_notification_outbox group by status,kind order by status,kind',
  "select jobname,active from cron.job where jobname like '%email%'",
  'select status,email_delivery_status,count(*) from public.manual_identity_reviews group by status,email_delivery_status',
  'select provider_status,count(*) from public.registration_drafts where finalized_at is null group by provider_status',
  "select status,count(*),max(end_time) as latest from cron.job_run_details where jobid in (select jobid from cron.job where jobname like '%email%') group by status",
]) {
  const response = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: 'POST', headers: { Authorization: `Bearer ${selected.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }), signal: AbortSignal.timeout(20_000),
  });
  console.log(JSON.stringify({ http: response.status, data: response.ok ? await response.json() : null }));
}
