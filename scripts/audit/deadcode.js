import { readFileSync } from 'node:fs';
import { listJsFiles } from './_util.js';

// Find functions exposed via `window.X = X` and check if X is ever referenced
// anywhere (as onclick="X(", via API.X(), or just `X(`).

export async function checkDeadCode({ root }) {
  const files = listJsFiles(root);
  const htmlContent = (() => {
    try { return readFileSync(root + '/index.html', 'utf8'); }
    catch { return ''; }
  })();

  const exported = []; // { name, file, line }
  for (const file of files) {
    let content;
    try { content = readFileSync(file, 'utf8'); } catch { continue; }
    const rel = file.replace(root, '').replace(/^[\\/]/, '').replaceAll('\\', '/');
    const lines = content.split('\n');
    lines.forEach((line, i) => {
      const m = line.match(/^\s*window\.([a-zA-Z_$][\w$]*)\s*=/);
      if (m) exported.push({ name: m[1], file: rel, line: i + 1 });
    });
  }

  // Combine all JS + index.html into a single blob for usage search
  const allSources = files.map(f => {
    try { return readFileSync(f, 'utf8'); } catch { return ''; }
  }).join('\n') + '\n' + htmlContent;

  const unused = [];
  for (const exp of exported) {
    // Count references to `name` not on the declaration line itself
    const pattern = new RegExp(`\\b${exp.name}\\b`, 'g');
    const matches = allSources.match(pattern) || [];
    // Expect at least: definition line (`function name`), export (`window.name =`), and at least one call
    // If total matches < 3, likely unused externally
    if (matches.length < 3) unused.push(exp);
  }

  let status = 'pass';
  if (unused.length > 5) status = 'warn';
  if (unused.length > 20) status = 'fail';

  return {
    status,
    message: unused.length === 0 ? `${exported.length} exports, all referenced` : `${unused.length}/${exported.length} exports possibly unused`,
    metrics: { exports: exported.length, unused: unused.length },
    details: unused.slice(0, 15).map(u => `${u.file}:${u.line} — window.${u.name}`).join('\n'),
  };
}
