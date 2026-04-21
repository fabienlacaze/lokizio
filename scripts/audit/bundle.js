import { statSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileSizeKB, listJsFiles } from './_util.js';

// Soft limits (warn above)
const LIMITS = {
  'index.html': 700,
  'app.css': 100,
  'i18n.js': 150,
  'api_bridge.js': 50,
  // Default for modules
  default: 80,
};

export async function checkBundle({ root }) {
  const critical = ['index.html', 'app.css'];
  const sizes = {};
  let totalKB = 0;

  // Root-level files we care about
  const rootFiles = readdirSync(root).filter(f => /\.(js|html|css)$/.test(f));
  for (const f of rootFiles) {
    const kb = fileSizeKB(join(root, f));
    sizes[f] = kb;
    totalKB += kb;
  }

  const warnings = [];
  for (const [file, kb] of Object.entries(sizes)) {
    const limit = LIMITS[file] || LIMITS.default;
    if (kb > limit) warnings.push(`${file}: ${kb}KB (> ${limit}KB)`);
  }

  // Top 5 largest
  const top5 = Object.entries(sizes).sort((a, b) => b[1] - a[1]).slice(0, 5);

  let status = 'pass';
  let message = `total ${totalKB}KB across ${Object.keys(sizes).length} files`;
  if (warnings.length > 0) {
    status = 'warn';
    message = `${warnings.length} file(s) over soft limit — largest: ${top5[0][0]} ${top5[0][1]}KB`;
  }

  return {
    status,
    message,
    metrics: { total_kb: totalKB, files: Object.keys(sizes).length },
    details: 'Top 5:\n' + top5.map(([f, kb]) => `  ${kb.toString().padStart(5)}KB ${f}`).join('\n')
      + (warnings.length ? '\n\nOver limit:\n' + warnings.map(w => '  ' + w).join('\n') : ''),
  };
}
