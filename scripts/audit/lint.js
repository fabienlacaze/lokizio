import { readFileSync } from 'node:fs';
import { listJsFiles } from './_util.js';

export async function checkLint({ root }) {
  const files = listJsFiles(root);
  const findings = [];
  let consoleCount = 0;
  let todoCount = 0;
  let emptyCatchCount = 0;

  for (const file of files) {
    let content;
    try { content = readFileSync(file, 'utf8'); } catch { continue; }
    const lines = content.split('\n');

    lines.forEach((line, i) => {
      const ln = i + 1;
      const rel = file.replace(root, '').replace(/^[\\/]/, '').replaceAll('\\', '/');

      // console.log in prod code (allow .error, .warn)
      if (/\bconsole\.(log|debug|info)\s*\(/.test(line) && !/\/\//.test(line.slice(0, line.indexOf('console.')))) {
        consoleCount++;
        if (findings.length < 20) findings.push({ file: rel, line: ln, type: 'console', text: line.trim().slice(0, 100) });
      }

      // TODO / FIXME / HACK
      if (/\b(TODO|FIXME|HACK|XXX)\b/.test(line)) {
        todoCount++;
        if (findings.length < 20) findings.push({ file: rel, line: ln, type: 'todo', text: line.trim().slice(0, 100) });
      }

      // Empty catch blocks on same line: catch(e) {}
      if (/catch\s*\([^)]*\)\s*\{\s*\}/.test(line)) {
        emptyCatchCount++;
        if (findings.length < 20) findings.push({ file: rel, line: ln, type: 'empty_catch', text: line.trim().slice(0, 100) });
      }
    });
  }

  const totalIssues = consoleCount + emptyCatchCount;
  let status = 'pass';
  let message;

  if (totalIssues === 0 && todoCount === 0) {
    message = 'clean — no console.log, TODO, or empty catch';
  } else {
    const parts = [];
    if (consoleCount) parts.push(`${consoleCount} console.log`);
    if (emptyCatchCount) parts.push(`${emptyCatchCount} empty catch`);
    if (todoCount) parts.push(`${todoCount} TODO/FIXME`);
    message = parts.join(', ');
    if (consoleCount > 0 || emptyCatchCount > 5) status = 'warn';
  }

  return {
    status,
    message,
    metrics: { console: consoleCount, todos: todoCount, empty_catch: emptyCatchCount },
    details: findings.map(f => `${f.file}:${f.line} [${f.type}] ${f.text}`).join('\n'),
  };
}
