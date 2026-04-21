// Dump full list of hardcoded FR strings (not just first 20 from audit).
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const EXCLUDE_DIRS = new Set(['node_modules', '.git', 'coverage', 'playwright-report', 'test-results', 'tests', 'scripts']);
const EXCLUDE_FILES = new Set(['sw.js', 'supabase_config.js', 'i18n.js', 'helpers.js']);

function listJsFiles(root, subdir = '') {
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

const FR_STRING_REGEX = /['"`]([A-ZÀ-Ÿ][A-Za-zÀ-ÿ0-9 ,.'!?éèêàçïîôùûœÉÈÊÀÇÏÎÔÙÛŒ-]{8,80})['"`]/g;
const SKIP_PATTERNS = [
  /^(http|https|www\.|mailto:|tel:)/i,
  /^\d/, /^[A-Z_]{4,}$/, /^[a-z]+\.[a-z]+/i, /^\/|\/$/,
];

const files = listJsFiles(process.cwd());
const byFile = new Map();

for (const file of files) {
  let content;
  try { content = readFileSync(file, 'utf8'); } catch { continue; }
  const rel = file.replace(process.cwd(), '').replace(/^[\\/]/, '').replaceAll('\\', '/');
  const lines = content.split('\n');

  lines.forEach((line, i) => {
    if (/\bt\s*\(\s*['"]/.test(line)) return;
    if (/console\.(log|error|warn|debug|info)/.test(line)) return;
    if (/\bnotifyError\s*\(/.test(line)) return;
    if (/\bshowToast\s*\(/.test(line)) return;
    if (/\bnew\s+Error\s*\(/.test(line)) return;
    if (/\bthrow\s+new\s+Error/.test(line)) return;
    const trimmed = line.trim();
    if (trimmed.startsWith('//') || trimmed.startsWith('*')) return;

    let m;
    FR_STRING_REGEX.lastIndex = 0;
    while ((m = FR_STRING_REGEX.exec(line)) !== null) {
      const str = m[1];
      if (SKIP_PATTERNS.some(p => p.test(str))) continue;
      if (!/[àâçéèêëîïôûùüÿœæ]|\b(le|la|les|un|une|des|de|du|et|ou|avec|pour|votre|vous|nous|cette|ce)\b/i.test(str)) continue;
      if (!byFile.has(rel)) byFile.set(rel, []);
      byFile.get(rel).push({ line: i + 1, text: str });
    }
  });
}

for (const [file, items] of byFile) {
  console.log(`\n=== ${file} (${items.length}) ===`);
  for (const it of items) console.log(`  ${it.line}: ${it.text}`);
}
console.log(`\nTOTAL: ${[...byFile.values()].reduce((a, b) => a + b.length, 0)}`);
