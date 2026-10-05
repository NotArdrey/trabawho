import fs from 'node:fs';
import path from 'node:path';
import { authEmailTemplates } from '../supabase/functions/_shared/authEmailTemplates.ts';
import { buildNotificationEmail, type EmailEvent } from '../supabase/functions/_shared/emailNotifications.ts';
import { projectTokenCandidates, readServerEnvironment, selectProjectToken } from './system-email-config.mts';

const templates = authEmailTemplates();
const previewDirectory = path.resolve('exports/email-design');
fs.mkdirSync(previewDirectory, { recursive: true });
for (const kind of ['confirmation', 'recovery', 'invite', 'magic_link', 'email_change', 'reauthentication']) {
  const html = templates[`mailer_templates_${kind}_content`]
    .replaceAll('{{ .ConfirmationURL }}', 'https://trabawho-kappa.vercel.app/register')
    .replaceAll('{{ .Token }}', '123456');
  fs.writeFileSync(path.join(previewDirectory, `${kind}.html`), html);
}
for (const status of ['PENDING_REVIEW', 'APPROVED']) {
  const event: EmailEvent = { id: 'preview', recipient_id: 'preview', kind: 'identity', attempts: 0, lease_token: '', payload: { status } };
  fs.writeFileSync(path.join(previewDirectory, `identity-${status.toLowerCase()}.html`),
    buildNotificationEmail(event, 'https://trabawho-kappa.vercel.app').html);
}
console.log(`Email previews saved to ${previewDirectory}.`);

if (process.argv.includes('--apply')) {
  try {
    const local = readServerEnvironment(['.env', '.env.local', 'supabase/.env.local']);
    const env = { ...local, ...process.env };
    const projectUrl = env.VITE_SUPABASE_URL || env.REACT_APP_SUPABASE_URL || '';
    const ref = env.SUPABASE_PROJECT_REF || new URL(projectUrl).hostname.split('.')[0];
    const selected = await selectProjectToken(ref, projectTokenCandidates(local, process.env));
    if (selected.auth.hook_send_email_enabled) throw new Error('An Auth email hook controls delivery; its templates must be updated separately.');
    async function management(endpoint: string, init: RequestInit = {}): Promise<Record<string, unknown>> {
      const response = await fetch(`https://api.supabase.com/v1/projects/${ref}/${endpoint}`, {
        ...init, headers: { Authorization: `Bearer ${selected.token}`, ...init.headers }, signal: AbortSignal.timeout(120000),
      });
      if (!response.ok) throw new Error(`Email design ${endpoint.split('?')[0]} returned HTTP ${response.status}.`);
      return response.json() as Promise<Record<string, unknown>>;
    }
    const current = await management('config/auth');
    for (const kind of ['confirmation', 'recovery', 'invite', 'magic_link', 'email_change']) {
      const value = current[`mailer_templates_${kind}_content`];
      if (typeof value === 'string' && value.trim() && !/\{\{\s*\.ConfirmationURL\s*\}\}/.test(value))
        throw new Error(`The ${kind} template uses a custom authentication flow. Preserve that flow before applying the design.`);
    }
    const entrypoint = 'supabase/functions/send-system-emails/index.ts';
    const files = [entrypoint, 'supabase/functions/send-system-emails/handler.ts',
      'supabase/functions/_shared/emailNotifications.ts', 'supabase/functions/_shared/emailLayout.ts'];
    const form = new FormData();
    form.set('metadata', JSON.stringify({ name: 'send-system-emails', entrypoint_path: entrypoint, verify_jwt: false }));
    for (const file of files) form.append('file', new Blob([fs.readFileSync(file)], { type: 'application/typescript' }), file);
    await management('functions/deploy?slug=send-system-emails', { method: 'POST', body: form });
    await management('config/auth', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(templates) });
    const deployed = await management('config/auth');
    for (const [key, value] of Object.entries(templates)) {
      if (deployed[key] !== value) throw new Error(`The deployed ${key} does not match the requested template.`);
    }
    for (const key of ['site_url', 'uri_allow_list', 'mailer_autoconfirm', 'disable_signup', 'smtp_host', 'smtp_port', 'smtp_user']) {
      if (deployed[key] !== current[key]) throw new Error(`The unrelated ${key} configuration changed during deployment.`);
    }
    console.log('Notification worker and six Auth email designs deployed and verified.');
  } catch (cause) {
    console.error(cause instanceof Error ? cause.message : 'Email design deployment failed.');
    process.exitCode = 1;
  }
}
