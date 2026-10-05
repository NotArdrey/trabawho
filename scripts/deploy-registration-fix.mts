import fs from 'node:fs';
import path from 'node:path';
import { projectTokenCandidates, readServerEnvironment, selectProjectToken } from './system-email-config.mts';

const version = '20261006121000';
const migrationName = 'registration_review_and_reset';
const migrationFile = `supabase/migrations/${version}_${migrationName}.sql`;
const names = ['account-registration', 'account-didit-session', 'account-manual-review',
  'account-identity-name', 'account-admin-identity-review', 'didit-webhook', 'send-system-emails'];
const functionRoot = path.resolve('supabase/functions');

function functionFiles(entrypoint: string): string[] {
  const files = new Set<string>();
  function visit(file: string) {
    const resolved = path.resolve(file);
    if (!resolved.startsWith(functionRoot + path.sep)) throw new Error('Function dependency is outside the function directory.');
    if (files.has(resolved)) return;
    const source = fs.readFileSync(resolved, 'utf8');
    files.add(resolved);
    for (const match of source.matchAll(/(?:from\s+|import\s*)["'](\.[^"']+)["']/g)) {
      visit(path.resolve(path.dirname(resolved), match[1]));
    }
  }
  visit(entrypoint);
  return [...files].map(file => path.relative(process.cwd(), file).replaceAll('\\', '/'));
}

const bundles = names.map(name => {
  const entrypoint = `supabase/functions/${name}/index.ts`;
  return { name, entrypoint, files: functionFiles(entrypoint) };
});
const sql = fs.readFileSync(migrationFile, 'utf8');
console.log(JSON.stringify({ migration: migrationFile,
  functions: bundles.map(bundle => ({ name: bundle.name, files: bundle.files.length })),
  apply: process.argv.includes('--apply') }, null, 2));

if (process.argv.includes('--apply')) {
  const local = readServerEnvironment(['.env', '.env.local', 'supabase/.env.local']);
  const ref = fs.readFileSync('supabase/.temp/project-ref', 'utf8').trim();
  const selected = await selectProjectToken(ref, projectTokenCandidates(local, process.env));
  async function management(endpoint: string, init: RequestInit = {}): Promise<unknown> {
    const response = await fetch(`https://api.supabase.com/v1/projects/${ref}/${endpoint}`, {
      ...init, headers: { Authorization: `Bearer ${selected.token}`, ...init.headers },
      signal: AbortSignal.timeout(120000),
    });
    if (!response.ok) throw new Error(`Registration deployment ${endpoint.split('?')[0]} returned HTTP ${response.status}.`);
    return response.json() as Promise<unknown>;
  }
  const query = (statement: string) => management('database/query', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: statement }),
  });
  const history = await query(`select version,name,statements from supabase_migrations.schema_migrations
    where version in ('20261006112000','${version}')`) as Array<{ version: string; name: string; statements: string[] }>;
  if (!history.some(row => row.version === '20261006112000')) throw new Error('Deploy the registration draft migrations before this correction.');
  const existing = history.find(row => row.version === version);
  if (existing && (existing.name !== migrationName || existing.statements.length !== 1 ||
    existing.statements[0].replaceAll('\r\n', '\n').trim() !== sql.replaceAll('\r\n', '\n').trim()))
    throw new Error('This migration version is already recorded with different SQL. Choose an unused version before deploying.');
  if (!existing) {
    const literal = (value: string) => `'${value.replaceAll("'", "''")}'`;
    await query(`begin; ${sql}\ninsert into supabase_migrations.schema_migrations(version,name,statements)
      values (${literal(version)},${literal(migrationName)},array[${literal(sql)}]); commit;`);
    console.log('Registration migration applied and recorded.');
  }
  for (const bundle of bundles) {
    const form = new FormData();
    form.set('metadata', JSON.stringify({ name: bundle.name, entrypoint_path: bundle.entrypoint, verify_jwt: false }));
    for (const file of bundle.files) form.append('file', new Blob([fs.readFileSync(file)], { type: 'application/typescript' }), file);
    await management(`functions/deploy?slug=${bundle.name}`, { method: 'POST', body: form });
    console.log(`Deployed ${bundle.name}.`);
  }
  console.log('Backend deployed. Publish the verified frontend build next. SMTP credentials and Auth configuration were preserved.');
}
