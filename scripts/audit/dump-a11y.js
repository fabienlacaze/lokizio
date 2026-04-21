// Quick dump of a11y issues with line hints
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const html = readFileSync(resolve('index.html'), 'utf8');
const lines = html.split('\n');

console.log('=== Icon-only buttons without aria-label ===');
const iconOnlyRegex = /<button\b(?![^>]*\baria-label\s*=)[^>]*>\s*(&#\d+;|&\w+;|[✓✗×☰⚙])\s*<\/button>/g;
for (let i = 0; i < lines.length; i++) {
  if (iconOnlyRegex.test(lines[i])) {
    console.log(`Line ${i + 1}: ${lines[i].trim().slice(0, 120)}`);
    iconOnlyRegex.lastIndex = 0;
  }
}

console.log('\n=== Images without alt ===');
const imgNoAlt = /<img\b(?![^>]*\balt\s*=)[^>]*>/g;
for (let i = 0; i < lines.length; i++) {
  if (imgNoAlt.test(lines[i])) {
    console.log(`Line ${i + 1}: ${lines[i].trim().slice(0, 120)}`);
    imgNoAlt.lastIndex = 0;
  }
}

console.log('\n=== Inputs without associated label (missing for= and aria-label) ===');
const inputIds = [...html.matchAll(/<input\b[^>]*\bid=["']([^"']+)["']/g)].map(m => m[1]);
const labelFors = new Set([...html.matchAll(/<label\b[^>]*\bfor=["']([^"']+)["']/g)].map(m => m[1]));
const inputAriaLabels = new Set();
for (const m of html.matchAll(/<input\b[^>]*\bid=["']([^"']+)["'][^>]*\baria-label\s*=/g)) {
  inputAriaLabels.add(m[1]);
}

for (const id of inputIds) {
  const inputTag = html.match(new RegExp(`<input\\b[^>]*id=["']${id}["'][^>]*>`));
  if (inputTag && /\b(type=["']hidden|readonly)/i.test(inputTag[0])) continue;
  if (!labelFors.has(id) && !inputAriaLabels.has(id)) {
    console.log(`#${id}`);
  }
}
