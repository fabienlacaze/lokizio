import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const EXCLUDE_DIRS = new Set(['node_modules', '.git', 'coverage', 'playwright-report', 'test-results', 'tests']);
const EXCLUDE_FILES = new Set(['sw.js', 'supabase_config.js']);

export function listJsFiles(root, subdir = '') {
  const dir = subdir ? join(root, subdir) : root;
  const out = [];
  let entries;
  try { entries = readdirSync(dir); } catch { return out; }
  for (const e of entries) {
    const full = join(dir, e);
    let s;
    try { s = statSync(full); } catch { continue; }
    if (s.isDirectory()) {
      if (EXCLUDE_DIRS.has(e) || e.startsWith('.')) continue;
      out.push(...listJsFiles(root, join(subdir, e)));
    } else if (e.endsWith('.js') && !EXCLUDE_FILES.has(e) && !e.endsWith('.test.js') && !e.endsWith('.spec.js') && !e.endsWith('.config.js')) {
      out.push(full);
    }
  }
  return out;
}

export function fileSizeKB(path) {
  try { return Math.round(statSync(path).size / 1024); }
  catch { return 0; }
}
