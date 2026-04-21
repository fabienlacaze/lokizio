import { spawnSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

export async function checkCoverage({ root }) {
  const res = spawnSync('npx', ['vitest', 'run', '--coverage', '--coverage.reporter=json-summary', '--coverage.reporter=text'], {
    cwd: root, shell: true, encoding: 'utf8', maxBuffer: 50 * 1024 * 1024,
  });

  if (res.error) return { status: 'warn', message: 'Coverage skipped (vitest error)' };

  const summaryPath = join(root, 'coverage', 'coverage-summary.json');
  if (!existsSync(summaryPath)) {
    return { status: 'warn', message: 'No coverage summary generated' };
  }

  let summary;
  try {
    summary = JSON.parse(readFileSync(summaryPath, 'utf8'));
  } catch (e) {
    return { status: 'warn', message: 'Could not parse coverage-summary.json' };
  }

  const total = summary.total || {};
  const lines = total.lines?.pct ?? 0;
  const funcs = total.functions?.pct ?? 0;
  const branches = total.branches?.pct ?? 0;

  // Per-file breakdown (top 5 lowest)
  const files = Object.entries(summary)
    .filter(([k]) => k !== 'total')
    .map(([path, m]) => ({ path, lines: m.lines?.pct ?? 0 }))
    .sort((a, b) => a.lines - b.lines);

  const lowCoverage = files.filter(f => f.lines < 50).slice(0, 5);
  const details = lowCoverage.length
    ? 'Lowest coverage:\n' + lowCoverage.map(f => `  ${f.lines.toFixed(0)}% ${f.path.split(/[\\/]/).pop()}`).join('\n')
    : '';

  // Coverage is informational only — Lokizio is mostly UI glue to Supabase,
  // so 100% coverage is neither practical nor meaningful. We flag low coverage
  // as a warning but never fail the audit on it.
  let status = 'pass';
  if (lines < 20) status = 'warn';

  return {
    status,
    message: `lines ${lines.toFixed(0)}%, funcs ${funcs.toFixed(0)}%, branches ${branches.toFixed(0)}%`,
    metrics: { lines, funcs, branches, files: files.length },
    details,
  };
}
