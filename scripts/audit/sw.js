import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

export async function checkServiceWorker({ root }) {
  let sw;
  try { sw = readFileSync(join(root, 'sw.js'), 'utf8'); }
  catch { return { status: 'warn', message: 'sw.js not found' }; }

  // Extract APP_SHELL array
  const m = sw.match(/APP_SHELL\s*=\s*\[([\s\S]*?)\]/);
  if (!m) return { status: 'warn', message: 'APP_SHELL array not found in sw.js' };

  const cached = [...m[1].matchAll(/['"]\.?\/?([^'"]+)['"]/g)]
    .map(x => x[1])
    .filter(x => x && !x.endsWith('/') && !x.includes('icons/') && x !== 'manifest.json' && x !== '');

  // Find all JS files at root (actual modules)
  const jsFiles = readdirSync(root)
    .filter(f => f.endsWith('.js'))
    .filter(f => !f.endsWith('.config.js'))
    .filter(f => !['sw.js'].includes(f));

  const cachedSet = new Set(cached.map(p => p.split('/').pop()));
  const missing = jsFiles.filter(f => !cachedSet.has(f));

  // Extract APP_VERSION and compare with index.html
  const swVer = (sw.match(/APP_VERSION\s*=\s*['"]([^'"]+)/) || [])[1];
  let htmlVer;
  try {
    const html = readFileSync(join(root, 'index.html'), 'utf8');
    htmlVer = (html.match(/v(\d+\.\d+)/) || [])[1];
  } catch {}

  const issues = [];
  if (missing.length > 0) issues.push(`${missing.length} JS module(s) not in APP_SHELL`);
  if (swVer && htmlVer && swVer !== htmlVer) issues.push(`APP_VERSION mismatch: sw.js=${swVer} vs index.html=${htmlVer}`);

  if (issues.length === 0) {
    return {
      status: 'pass',
      message: `all ${jsFiles.length} modules cached (v${swVer})`,
      metrics: { cached: cachedSet.size, modules: jsFiles.length },
    };
  }

  return {
    status: 'warn',
    message: issues.join(', '),
    metrics: { missing: missing.length },
    details: missing.length ? 'Missing from APP_SHELL:\n' + missing.map(f => '  ' + f).join('\n') : '',
  };
}
