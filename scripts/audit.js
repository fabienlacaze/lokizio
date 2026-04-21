#!/usr/bin/env node
/**
 * Lokizio audit runner — single entry point for "test everything".
 *
 * Usage:
 *   npm run audit          # full (unit + coverage + E2E + static checks, ~2min)
 *   npm run audit:quick    # skip E2E (~10s)
 *   npm run audit:ci       # JSON output for CI pipelines
 *
 * Exit codes:
 *   0 = all passed (warnings allowed by default)
 *   1 = at least one check failed
 *   2 = warnings treated as failures (with --strict)
 */

import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, statSync, readdirSync, existsSync } from 'node:fs';
import { join, resolve, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';

// Import individual checkers
import { checkUnitTests } from './audit/unit.js';
import { checkCoverage } from './audit/coverage.js';
import { checkE2E } from './audit/e2e.js';
import { checkLint } from './audit/lint.js';
import { checkSecrets } from './audit/secrets.js';
import { checkBundle } from './audit/bundle.js';
import { checkAccessibility } from './audit/accessibility.js';
import { checkI18n } from './audit/i18n.js';
import { checkServiceWorker } from './audit/sw.js';
import { checkDeadCode } from './audit/deadcode.js';
import { renderHTMLReport } from './audit/report.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

// ─────────────────────────────────────────────────
// CLI args
// ─────────────────────────────────────────────────
const args = process.argv.slice(2);
const QUICK = args.includes('--quick');
const CI = args.includes('--ci') || process.env.CI === 'true';
const STRICT = args.includes('--strict');
const SKIP = new Set(
  args.filter(a => a.startsWith('--skip=')).flatMap(a => a.replace('--skip=', '').split(','))
);

// ─────────────────────────────────────────────────
// Color helpers (no deps)
// ─────────────────────────────────────────────────
const c = {
  reset: '\x1b[0m', bold: '\x1b[1m', dim: '\x1b[2m',
  red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m',
  blue: '\x1b[34m', magenta: '\x1b[35m', cyan: '\x1b[36m', gray: '\x1b[90m',
};
const paint = (color, s) => (CI ? s : `${c[color]}${s}${c.reset}`);
const icon = (status) => {
  if (status === 'pass') return paint('green', '✓');
  if (status === 'warn') return paint('yellow', '⚠');
  if (status === 'fail') return paint('red', '✗');
  return paint('gray', '·');
};

// ─────────────────────────────────────────────────
// Checkers registry
// ─────────────────────────────────────────────────
const CHECKERS = [
  { id: 'unit',     label: 'UNIT',     fn: checkUnitTests,     always: true },
  { id: 'coverage', label: 'COVERAGE', fn: checkCoverage,      always: true },
  { id: 'e2e',      label: 'E2E',      fn: checkE2E,           skipOnQuick: true },
  { id: 'lint',     label: 'LINT',     fn: checkLint,          always: true },
  { id: 'bundle',   label: 'BUNDLE',   fn: checkBundle,        always: true },
  { id: 'security', label: 'SECURITY', fn: checkSecrets,       always: true },
  { id: 'dead',     label: 'DEAD',     fn: checkDeadCode,      always: true },
  { id: 'a11y',     label: 'A11Y',     fn: checkAccessibility, always: true },
  { id: 'i18n',     label: 'I18N',     fn: checkI18n,          always: true },
  { id: 'sw',       label: 'SW',       fn: checkServiceWorker, always: true },
];

// ─────────────────────────────────────────────────
// Run
// ─────────────────────────────────────────────────
async function main() {
  if (!CI) {
    console.log();
    console.log(paint('bold', '  Lokizio Audit Report'));
    console.log(paint('gray', '  ' + '═'.repeat(50)));
    console.log();
  }

  const results = [];
  const t0 = performance.now();

  for (const check of CHECKERS) {
    if (SKIP.has(check.id)) {
      results.push({ id: check.id, label: check.label, status: 'skip', message: 'skipped by --skip', duration: 0 });
      continue;
    }
    if (QUICK && check.skipOnQuick) {
      results.push({ id: check.id, label: check.label, status: 'skip', message: 'skipped in --quick mode', duration: 0 });
      continue;
    }

    const checkStart = performance.now();
    if (!CI) process.stdout.write(`  ${paint('cyan', `[${check.label}]`.padEnd(11))} running... `);

    let result;
    try {
      result = await check.fn({ root: ROOT, ci: CI });
    } catch (err) {
      result = { status: 'fail', message: `Checker crashed: ${err.message}`, details: err.stack };
    }
    result.duration = Math.round(performance.now() - checkStart);
    result.id = check.id;
    result.label = check.label;
    results.push(result);

    if (!CI) {
      // Erase "running..." line and print result
      process.stdout.write('\r' + ' '.repeat(80) + '\r');
      const time = paint('gray', `(${(result.duration / 1000).toFixed(1)}s)`);
      console.log(`  ${icon(result.status)} ${paint('cyan', `[${check.label}]`.padEnd(11))} ${result.message} ${time}`);
    }
  }

  const totalTime = ((performance.now() - t0) / 1000).toFixed(1);

  // Summary
  const passed = results.filter(r => r.status === 'pass').length;
  const warned = results.filter(r => r.status === 'warn').length;
  const failed = results.filter(r => r.status === 'fail').length;
  const skipped = results.filter(r => r.status === 'skip').length;

  if (CI) {
    const summary = {
      ok: failed === 0 && (!STRICT || warned === 0),
      totals: { passed, warned, failed, skipped, duration_s: Number(totalTime) },
      results,
    };
    console.log(JSON.stringify(summary, null, 2));
  } else {
    console.log();
    console.log(paint('gray', '  ' + '─'.repeat(50)));
    const parts = [];
    if (passed) parts.push(paint('green', `${passed} passed`));
    if (warned) parts.push(paint('yellow', `${warned} warnings`));
    if (failed) parts.push(paint('red', `${failed} failed`));
    if (skipped) parts.push(paint('gray', `${skipped} skipped`));
    console.log(`  Summary: ${parts.join(', ')} — ${totalTime}s`);
    console.log();
  }

  // HTML report
  try {
    const reportPath = join(ROOT, 'audit-report.html');
    writeFileSync(reportPath, renderHTMLReport(results, { totalTime, passed, warned, failed, skipped }));
    if (!CI) console.log(paint('gray', `  Report: ${relative(process.cwd(), reportPath).replaceAll('\\', '/')}`));
    console.log();
  } catch (e) {
    console.error('Failed to write HTML report:', e.message);
  }

  // Exit code
  if (failed > 0) process.exit(1);
  if (STRICT && warned > 0) process.exit(2);
  process.exit(0);
}

main().catch(err => {
  console.error(paint('red', 'Audit crashed:'), err);
  process.exit(1);
});
