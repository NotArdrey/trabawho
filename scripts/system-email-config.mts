import fs from 'node:fs';
import { parseEnv } from 'node:util';

export type ServerEnvironment = Record<string, string | undefined>;
export interface AuthConfiguration {
  site_url?: string;
  hook_send_email_enabled?: boolean;
}

export function authSmtpConfiguration(user: string, password: string): {
  smtp_host: string; smtp_port: string; smtp_user: string; smtp_pass: string;
  smtp_admin_email: string; smtp_sender_name: string;
} {
  // The Management API requires a string even though mail transports use a number.
  return { smtp_host: 'smtp.gmail.com', smtp_port: '465', smtp_user: user,
    smtp_pass: password.replace(/\s/g, ''), smtp_admin_email: user, smtp_sender_name: 'TrabaWho' };
}

export function readServerEnvironment(files: string[]): ServerEnvironment {
  return Object.assign({}, ...files.map(file => fs.existsSync(file)
    ? parseEnv(fs.readFileSync(file, 'utf8')) : {})) as ServerEnvironment;
}

export function projectTokenCandidates(local: ServerEnvironment, shell: ServerEnvironment): string[] {
  return [...new Set([shell.SUPABASE_ACCESS_TOKEN, local.SUPABASE_ACCESS_TOKEN, local.PAT]
    .map(value => value?.trim()).filter((value): value is string => Boolean(value)))];
}

export async function selectProjectToken(ref: string, candidates: string[], request = fetch): Promise<{
  token: string; auth: AuthConfiguration;
}> {
  for (const token of candidates) {
    const response = await request(`https://api.supabase.com/v1/projects/${ref}/config/auth`, {
      headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(20_000),
    });
    // An inherited CLI token can belong to another account. Only retry read-only
    // access checks; every subsequent mutation uses the project-authorized token.
    if (response.status === 401 || response.status === 403) continue;
    if (!response.ok) throw new Error(`Supabase Auth preflight returned HTTP ${response.status}.`);
    const auth: unknown = await response.json();
    if (!auth || typeof auth !== 'object' || Array.isArray(auth))
      throw new Error('Supabase returned an unexpected Auth configuration.');
    return { token, auth: auth as AuthConfiguration };
  }
  throw new Error('No supplied Supabase access token can access the linked project. Set SUPABASE_ACCESS_TOKEN in the shell or an ignored environment file, or PAT in .env.');
}
