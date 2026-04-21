import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// Parse HTML with regex (good enough for these heuristics; jsdom would be heavy).
export async function checkAccessibility({ root }) {
  let html;
  try { html = readFileSync(join(root, 'index.html'), 'utf8'); }
  catch { return { status: 'warn', message: 'index.html not found' }; }

  // Buttons without aria-label and without visible text (icon-only buttons)
  const buttonMatches = html.match(/<button\b[^>]*>[^<]*<\/button>/g) || [];
  let iconOnlyButtons = 0;
  let missingAriaLabel = 0;

  const iconOnlyRegex = /<button\b(?![^>]*\baria-label\s*=)[^>]*>\s*(&#\d+;|&\w+;|[✓✗×☰⚙])\s*<\/button>/g;
  const matches = html.matchAll(iconOnlyRegex);
  for (const _ of matches) iconOnlyButtons++;

  // Inputs without label (for=) or aria-label (id=xxx and no matching label for=xxx nearby)
  const inputIds = [...html.matchAll(/<input\b[^>]*\bid=["']([^"']+)["']/g)].map(m => m[1]);
  const labelFors = new Set([...html.matchAll(/<label\b[^>]*\bfor=["']([^"']+)["']/g)].map(m => m[1]));
  const inputAriaLabels = new Set();
  // Check every input tag for co-occurrence of id and aria-label, regardless of order
  for (const m of html.matchAll(/<input\b([^>]*)>/g)) {
    const attrs = m[1];
    const idM = attrs.match(/\bid=["']([^"']+)["']/);
    if (idM && /\baria-label\s*=/.test(attrs)) inputAriaLabels.add(idM[1]);
  }

  const inputsMissingLabel = inputIds.filter(id => {
    // Skip hidden/readonly inputs that are programmatic
    const inputTag = html.match(new RegExp(`<input\\b[^>]*id=["']${id}["'][^>]*>`));
    if (inputTag && /\b(type=["']hidden|readonly)/i.test(inputTag[0])) return false;
    // Skip JS-template IDs (contain ${...})
    if (id.includes('${') || id.includes('}')) return false;
    return !labelFors.has(id) && !inputAriaLabels.has(id);
  });

  // Images without alt
  const imgsNoAlt = (html.match(/<img\b(?![^>]*\balt\s*=)[^>]*>/g) || []).length;

  // A11y is a continuous improvement goal, not a ship-blocker. Warn only.
  const totalIssues = iconOnlyButtons + inputsMissingLabel.length + imgsNoAlt;
  let status = 'pass';
  if (totalIssues > 0) status = 'warn';

  const parts = [];
  if (iconOnlyButtons) parts.push(`${iconOnlyButtons} icon-only buttons without aria-label`);
  if (inputsMissingLabel.length) parts.push(`${inputsMissingLabel.length} inputs without label`);
  if (imgsNoAlt) parts.push(`${imgsNoAlt} images without alt`);

  return {
    status,
    message: totalIssues === 0 ? 'no basic a11y issues in index.html' : parts.join(', '),
    metrics: { icon_buttons: iconOnlyButtons, unlabeled_inputs: inputsMissingLabel.length, unaltered_images: imgsNoAlt },
    details: inputsMissingLabel.length ? 'Inputs missing label:\n' + inputsMissingLabel.map(id => '  #' + id).join('\n') : '',
  };
}
