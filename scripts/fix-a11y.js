#!/usr/bin/env node
// Batch-fix common a11y issues in index.html:
// - add aria-label="Fermer" to close buttons (×, &times;, &#10005;)
// - add aria-label to other icon-only buttons based on title attribute
// - add alt="" to decorative images (flag icons, chart previews)
// - add aria-label to inputs missing labels, based on placeholder

import { readFileSync, writeFileSync } from 'node:fs';

const FILE = 'index.html';
let html = readFileSync(FILE, 'utf8');
let changes = 0;

// 1. Close buttons: any <button> containing × &times; &#10005; without aria-label
const CLOSE_CHARS = '(?:×|&times;|&#10005;|&#215;)';
const closeBtnRe = new RegExp(`<button\\b(?![^>]*\\baria-label\\b)([^>]*)>\\s*${CLOSE_CHARS}\\s*</button>`, 'g');
html = html.replace(closeBtnRe, (m, attrs) => {
  changes++;
  return `<button aria-label="Fermer"${attrs}>${m.match(new RegExp(CLOSE_CHARS))[0]}</button>`;
});

// 2. Icon-only buttons with a title="X" but no aria-label: copy title to aria-label
// Matches: <button ... title="X" ...>&#XXX;</button>
const titledBtnRe = /<button\b([^>]*\btitle="([^"]+)"[^>]*)>\s*(&#\d+;|&\w+;)\s*<\/button>/g;
html = html.replace(titledBtnRe, (full, attrs, title, icon) => {
  if (/\baria-label\b/.test(attrs)) return full;
  changes++;
  return `<button aria-label="${title}"${attrs}>${icon}</button>`;
});

// 3. Images (flagcdn) without alt: add empty alt as decorative
const flagImgRe = /(<img\b[^>]*src="https:\/\/flagcdn[^"]*"[^>]*)(?<!\balt="[^"]*")>/g;
html = html.replace(flagImgRe, (full, attrs) => {
  if (/\balt=/.test(attrs)) return full;
  changes++;
  return attrs + ' alt="">';
});

// 4. Other <img> tags without alt: add empty alt (decorative by default)
const imgNoAltRe = /<img\b(?![^>]*\balt=)([^>]*)>/g;
html = html.replace(imgNoAltRe, (full, attrs) => {
  changes++;
  return `<img alt=""${attrs}>`;
});

// 5. Inputs: add aria-label based on placeholder if no label for= and no aria-label
const inputRe = /<input\b([^>]*\bid="([^"]+)"[^>]*\bplaceholder="([^"]+)"[^>]*)>/g;
const labelFors = new Set([...html.matchAll(/<label\b[^>]*\bfor="([^"]+)"/g)].map(m => m[1]));
html = html.replace(inputRe, (full, attrs, id, placeholder) => {
  if (labelFors.has(id)) return full;
  if (/\baria-label\b/.test(attrs)) return full;
  if (/\btype="hidden"/.test(attrs)) return full;
  changes++;
  return `<input aria-label="${placeholder.replace(/"/g, '')}"${attrs}>`;
});

// 6. Checkboxes / special inputs (authRgpdAccept etc.)
// Use nearby text or specific heuristics; fallback: id-based labels in a map
const SPECIFIC_LABELS = {
  authRgpdAccept: 'Accepter les CGU et la politique de confidentialite',
  themeToggleAccount: 'Basculer le theme sombre/clair',
};
for (const [id, label] of Object.entries(SPECIFIC_LABELS)) {
  const re = new RegExp(`<input\\b([^>]*\\bid="${id}"[^>]*?)>`, 'g');
  html = html.replace(re, (full, attrs) => {
    if (/\baria-label\b/.test(attrs)) return full;
    changes++;
    return `<input aria-label="${label}"${attrs}>`;
  });
}

writeFileSync(FILE, html);
console.log(`a11y fixes applied: ${changes} changes`);
