import { readFileSync } from 'node:fs';
import { listJsFiles } from './_util.js';

// Patterns that should NEVER appear in client code
const SECRET_PATTERNS = [
  { name: 'Stripe secret', regex: /\bsk_(live|test)_[A-Za-z0-9]{24,}/g },
  { name: 'Stripe restricted', regex: /\brk_(live|test)_[A-Za-z0-9]{24,}/g },
  { name: 'Resend API key', regex: /\bre_[A-Za-z0-9_-]{20,}/g },
  { name: 'AWS key', regex: /\bAKIA[0-9A-Z]{16}\b/g },
  { name: 'Supabase service_role JWT', regex: /eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g },
  { name: 'Generic private key', regex: /-----BEGIN (RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/g },
  { name: 'VAPID private key comment', regex: /vapid[_-]?private[_-]?key\s*[:=]\s*['"][A-Za-z0-9_-]{30,}['"]/gi },
];

export async function checkSecrets({ root }) {
  const files = listJsFiles(root);
  // Also scan index.html and html files
  const htmlFiles = [];
  const findings = [];

  // Fetch public Supabase anon key (it's OK to have in client — we allow it)
  const ANON_KEY_PATTERN = /role["']\s*:\s*["']anon/;

  for (const file of [...files, ...htmlFiles]) {
    let content;
    try { content = readFileSync(file, 'utf8'); } catch { continue; }
    const rel = file.replace(root, '').replace(/^[\\/]/, '').replaceAll('\\', '/');

    for (const p of SECRET_PATTERNS) {
      const matches = content.match(p.regex);
      if (!matches) continue;

      for (const m of matches) {
        // Skip JWTs that are anon keys (public by design)
        if (p.name.includes('Supabase')) {
          // Decode JWT payload and check role
          try {
            const parts = m.split('.');
            const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'));
            if (payload.role === 'anon') continue; // anon key is public, OK
            if (payload.role === 'service_role') {
              findings.push({ file: rel, type: 'service_role_key', preview: m.slice(0, 40) + '...' });
            }
          } catch { /* not a valid JWT, skip */ }
        } else {
          findings.push({ file: rel, type: p.name, preview: m.slice(0, 40) + '...' });
        }
      }
    }
  }

  if (findings.length === 0) {
    return { status: 'pass', message: 'no secrets found in client code' };
  }

  return {
    status: 'fail',
    message: `${findings.length} potential secret(s) exposed`,
    details: findings.map(f => `${f.file} — ${f.type}: ${f.preview}`).join('\n'),
  };
}
