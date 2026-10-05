import fs from 'node:fs';
import { randomBytes } from 'node:crypto';
import { authSmtpConfiguration, projectTokenCandidates, readServerEnvironment, selectProjectToken } from './system-email-config.mts';

const environmentFile = 'supabase/.env.local';
const localEnvironment = readServerEnvironment(['.env', '.env.local', environmentFile]);
const environment = { ...localEnvironment, ...process.env };
const ref = process.env.SUPABASE_PROJECT_REF || fs.readFileSync('supabase/.temp/project-ref', 'utf8').trim();
const candidates = projectTokenCandidates(localEnvironment, process.env);
let token = '';
const smtpUser = environment.SMTP_USER;
const smtpPassword = (environment.SMTP_PASSWORD || '').replace(/\s/g, '');
if (!/^[a-z0-9]{20}$/.test(ref) || !candidates.length || !smtpUser || !smtpPassword)
  throw new Error('Set a project access token and the server SMTP_USER/SMTP_PASSWORD before configuring email.');

async function management(path: string, init: RequestInit = {}): Promise<unknown> {
  const response = await fetch(`https://api.supabase.com/v1/projects/${ref}/${path}`, {
    ...init, headers: { Authorization: `Bearer ${token}`, ...init.headers }, signal: AbortSignal.timeout(120_000),
  });
  if (!response.ok) throw new Error(`Supabase ${path.split('?')[0]} returned HTTP ${response.status}. No credentials or server diagnostics were printed.`);
  const text = await response.text();
  return text ? JSON.parse(text) as unknown : null;
}
const sqlString = (value: string) => `'${value.replaceAll("'", "''")}'`;
const query = (sql: string) => management('database/query', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: sql }),
});

try {
  // Preflight before changing any remote settings or deploying code.
  const selected = await selectProjectToken(ref, candidates);
  token = selected.token;
  const auth = selected.auth;
  if (auth.hook_send_email_enabled) throw new Error('An existing Auth email hook overrides SMTP. Review its configuration before deploying.');
  const appUrl = environment.TRABAWHO_APP_URL || auth.site_url || '';
  const url = new URL(appUrl);
  if (url.protocol !== 'https:' || ['localhost', '127.0.0.1'].includes(url.hostname))
    throw new Error('Set TRABAWHO_APP_URL to the deployed HTTPS application origin.');
  await query('select 1');
  const workerSecret = environment.EMAIL_WORKER_SECRET || randomBytes(32).toString('hex');
  if (!/^[a-f0-9]{64}$/.test(workerSecret)) throw new Error('EMAIL_WORKER_SECRET must contain 64 hexadecimal characters.');
  if (!environment.EMAIL_WORKER_SECRET) fs.appendFileSync(environmentFile, `\nEMAIL_WORKER_SECRET=${workerSecret}\n`);
  await management('secrets', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(Object.entries({ SMTP_USER: smtpUser, SMTP_PASSWORD: smtpPassword,
      EMAIL_WORKER_SECRET: workerSecret, TRABAWHO_APP_URL: url.origin }).map(([name, value]) => ({ name, value }))),
  });
  const entrypoint = 'supabase/functions/send-system-emails/index.ts';
  const files = [entrypoint, 'supabase/functions/send-system-emails/handler.ts', 'supabase/functions/_shared/emailNotifications.ts', 'supabase/functions/_shared/emailLayout.ts'];
  const form = new FormData();
  form.set('metadata', JSON.stringify({ name: 'send-system-emails', entrypoint_path: entrypoint, verify_jwt: false }));
  for (const file of files) form.append('file', new Blob([fs.readFileSync(file)], { type: 'application/typescript' }), file);
  await management('functions/deploy?slug=send-system-emails', { method: 'POST', body: form });
  const version = '20261005110000';
  const migrationPath = `supabase/migrations/${version}_system_email_notifications.sql`;
  const applied = await query(`select version from supabase_migrations.schema_migrations where version = '${version}'`) as unknown[];
  if (!applied.length) {
    const sql = fs.readFileSync(migrationPath, 'utf8');
    await query(`begin; ${sql}\ninsert into supabase_migrations.schema_migrations(version,name,statements)
      values ('${version}','system_email_notifications',array[${sqlString(sql)}]); commit;`);
  }
  // Vault and Edge Function use the same worker secret. Repeated runs preserve it.
  const endpoint = `https://${ref}.supabase.co/functions/v1/send-system-emails`;
  for (const [name, value] of [['system_email_worker_url', endpoint], ['system_email_worker_secret', workerSecret]]) {
    await query(`do $$ declare existing uuid; begin
      select id into existing from vault.secrets where name = ${sqlString(name)};
      if existing is null then perform vault.create_secret(${sqlString(value)},${sqlString(name)});
      else perform vault.update_secret(existing,${sqlString(value)}); end if; end $$;`);
  }
  await management('config/auth', {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(authSmtpConfiguration(smtpUser, smtpPassword)),
  });
  console.log('Gmail SMTP configured for Auth and all system notification events. Worker deployed and scheduled.');
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Email configuration failed.');
  process.exitCode = 1;
}
