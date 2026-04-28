#!/usr/bin/env node
/**
 * Auto-bump cache busters in index.html based on file content hashes.
 *
 * Replaces every `<script src="<file>.js?v=...">` with a 7-char SHA-1
 * truncated hash of the actual file content. The script is idempotent:
 * running it twice gives the same output if no file has changed.
 *
 * Usage:
 *   node scripts/bump-cache-busters.js          # update in place
 *   node scripts/bump-cache-busters.js --check  # exit 1 if anything is stale (CI guard)
 *
 * Add to npm scripts as `npm run bump` (or wire into a pre-commit hook).
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const indexPath = join(root, 'index.html');
const checkOnly = process.argv.includes('--check');

function shortHash(filePath) {
  const buf = readFileSync(filePath);
  return createHash('sha1').update(buf).digest('hex').slice(0, 7);
}

const html = readFileSync(indexPath, 'utf8');
const SCRIPT_RE = /<script\s+src="([A-Za-z0-9_\-./]+\.js)\?v=([^"]+)"\s*>\s*<\/script>/g;

let changed = false;
const stale = [];
const updated = html.replace(SCRIPT_RE, (full, src, oldVer) => {
  const filePath = join(root, src);
  if (!existsSync(filePath)) {
    console.warn(`! script not found, skipping: ${src}`);
    return full;
  }
  const newVer = shortHash(filePath);
  if (newVer === oldVer) return full;
  changed = true;
  stale.push({ src, old: oldVer, new: newVer });
  return `<script src="${src}?v=${newVer}"></script>`;
});

if (checkOnly) {
  if (changed) {
    console.error('Stale cache busters detected — run `node scripts/bump-cache-busters.js` to fix:');
    for (const s of stale) console.error(`  ${s.src}: ${s.old} -> ${s.new}`);
    process.exit(1);
  }
  console.log('All cache busters up to date.');
  process.exit(0);
}

if (!changed) {
  console.log('No changes needed (everything already up to date).');
  process.exit(0);
}

writeFileSync(indexPath, updated);
console.log(`Updated ${stale.length} cache buster(s):`);
for (const s of stale) console.log(`  ${s.src}: ${s.old} -> ${s.new}`);
