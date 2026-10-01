const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..', '..', '..');

function loadRepoEnv() {
  for (const filename of ['.env', '.env.local']) {
    const envPath = path.join(repoRoot, filename);
    if (!fs.existsSync(envPath)) continue;

    const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;

      const match = trimmed.match(/^([^=\s]+)\s*=\s*(.*)$/);
      if (!match) continue;

      const [, key, rawValue] = match;
      if (process.env[key]) continue;

      process.env[key] = rawValue.replace(/^['"]|['"]$/g, '');
    }
  }

  process.env.REACT_APP_SUPABASE_URL ||= process.env.VITE_SUPABASE_URL;
  process.env.REACT_APP_SUPABASE_ANON_KEY ||= process.env.VITE_SUPABASE_ANON_KEY;
}

function requireEnv(name) {
  loadRepoEnv();
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

module.exports = {
  loadRepoEnv,
  repoRoot,
  requireEnv,
};
