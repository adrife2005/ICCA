const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

// Mini lector de .env (sin dependencias)
try {
  const envFile = fs.readFileSync(path.join(ROOT, '.env'), 'utf8');
  for (const line of envFile.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !line.trim().startsWith('#') && process.env[m[1]] === undefined) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  }
} catch { /* no hay .env, ok */ }

const DATA_DIR = process.env.DATA_DIR || path.join(ROOT, 'data');
const UPLOADS_DIR = process.env.UPLOADS_DIR || path.join(ROOT, 'uploads');
fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(UPLOADS_DIR, { recursive: true });

function getSecret() {
  if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET;
  const f = path.join(DATA_DIR, '.secret');
  try { return fs.readFileSync(f, 'utf8'); } catch {}
  const s = require('crypto').randomBytes(48).toString('hex');
  fs.writeFileSync(f, s, { mode: 0o600 });
  return s;
}

module.exports = {
  ROOT,
  PUBLIC_DIR: path.join(ROOT, 'public'),
  DATA_DIR,
  UPLOADS_DIR,
  PORT: Number(process.env.PORT) || 3000,
  PROD: process.env.NODE_ENV === 'production',
  TRUST_PROXY: process.env.TRUST_PROXY === '1',
  SECRET: getSecret(),
  MAX_UPLOAD: 25 * 1024 * 1024,
};
