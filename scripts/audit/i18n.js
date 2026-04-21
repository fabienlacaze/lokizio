import { readFileSync } from 'node:fs';
import { listJsFiles } from './_util.js';

// French strings that look like UI text (short sentences with accents/punctuation)
// We skip strings that are clearly data (URLs, tech keys, dates).
const FR_STRING_REGEX = /['"`]([A-ZÀ-Ÿ][A-Za-zÀ-ÿ0-9 ,.'!?éèêàçïîôùûœÉÈÊÀÇÏÎÔÙÛŒ-]{8,80})['"`]/g;

const SKIP_PATTERNS = [
  /^(http|https|www\.|mailto:|tel:)/i,  // URLs
  /^\d/,                                 // starts with digit
  /^[A-Z_]{4,}$/,                        // CONST_NAMES
  /^[a-z]+\.[a-z]+/i,                    // dotted.identifiers
  /^\/|\/$/,                              // paths
];

const SKIP_FILES = new Set(['i18n.js', 'helpers.js']);

export async function checkI18n({ root }) {
  const files = listJsFiles(root).filter(f => !SKIP_FILES.has(f.split(/[\\/]/).pop()));
  const findings = [];
  let count = 0;

  for (const file of files) {
    let content;
    try { content = readFileSync(file, 'utf8'); } catch { continue; }
    const rel = file.replace(root, '').replace(/^[\\/]/, '').replaceAll('\\', '/');
    const lines = content.split('\n');

    lines.forEach((line, i) => {
      // Skip lines that already call t() nearby
      if (/\bt\s*\(\s*['"]/.test(line)) return;
      // Skip console/debug
      if (/console\.(log|error|warn|debug|info)/.test(line)) return;
      // Skip notifyError (errors use native strings — acceptable)
      if (/\bnotifyError\s*\(/.test(line)) return;
      // Skip showToast (transient UI feedback, often status messages — acceptable to not i18n)
      if (/\bshowToast\s*\(/.test(line)) return;
      // Skip error thrown messages (Error('...'))
      if (/\bnew\s+Error\s*\(/.test(line)) return;
      if (/\bthrow\s+new\s+Error/.test(line)) return;
      // Skip comments (simple heuristic)
      const trimmed = line.trim();
      if (trimmed.startsWith('//') || trimmed.startsWith('*')) return;

      let m;
      FR_STRING_REGEX.lastIndex = 0;
      while ((m = FR_STRING_REGEX.exec(line)) !== null) {
        const str = m[1];
        if (SKIP_PATTERNS.some(p => p.test(str))) continue;
        // Only count if it looks French: has accent or common FR keyword
        if (!/[àâçéèêëîïôûùüÿœæ]|\b(le|la|les|un|une|des|de|du|et|ou|avec|pour|votre|vous|nous|cette|ce)\b/i.test(str)) continue;
        count++;
        if (findings.length < 20) findings.push({ file: rel, line: i + 1, text: str.slice(0, 60) });
      }
    });
  }

  // i18n migration is a gradual effort; warn only.
  let status = 'pass';
  if (count > 20) status = 'warn';

  return {
    status,
    message: count === 0 ? 'all French UI strings go through t()' : `${count} hardcoded French string(s)`,
    metrics: { count },
    details: findings.map(f => `${f.file}:${f.line} "${f.text}"`).join('\n'),
  };
}
