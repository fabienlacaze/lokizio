#!/usr/bin/env node
// Build script: minify each .js file individually using esbuild.
//
// Strategy: NO bundling (preserves global script load order + window.X exports
// + makes the change zero-risk vs the source-only deploy we have today).
// Just minify + source maps for Sentry.
//
// Output: each foo.js gets a foo.min.js sibling. The choice to use one or the
// other is made in index.html by the user (typically: src.js for dev, min.js
// for prod). Source maps are emitted next to the min files (foo.min.js.map).
//
// Usage:
//   npm run build           # rebuild all .min.js
//   npm run build -- --check # exit 1 if any min file is stale (CI guard)

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const checkOnly = process.argv.includes('--check');

// JS files we want to minify (top-level only, NOT tests, scripts, node_modules)
const SOURCES = [
  'helpers.js',
  'i18n.js',
  'ical_parser.js',
  'api_bridge.js',
  'auth.js',
  'dashboard.js',
  'account.js',
  'admin-prestations.js',
  'auto-billing.js',
  'invoice-create.js',
  'invoices.js',
  'legal.js',
  'legal-fill.js',
  'marketplace.js',
  'owner.js',
  'properties.js',
  'provider.js',
  'push.js',
  'quotes.js',
  'search.js',
  'tenant.js',
  'vacation.js',
  'sentry-init.js',
  'admin-sentry.js',
  'stripe-connect-embed.js',
  'admin-stripe.js',
  'feedback-widget.js',
  'admin-dev-tools.js',
  'admin-compliance.js',
  'photo-consent.js',
  'provider-kyc.js',
  'analytics-init.js',
];

let totalSrcBytes = 0;
let totalMinBytes = 0;
let stale = 0;

for (const src of SOURCES) {
  const srcPath = path.join(root, src);
  const minPath = srcPath.replace(/\.js$/, '.min.js');
  if (!fs.existsSync(srcPath)) {
    console.warn(`! source missing, skipping: ${src}`);
    continue;
  }

  const srcStat = fs.statSync(srcPath);
  const srcContent = fs.readFileSync(srcPath, 'utf8');
  totalSrcBytes += srcStat.size;

  // Skip rebuild if min file is fresher than source
  if (fs.existsSync(minPath)) {
    const minStat = fs.statSync(minPath);
    if (minStat.mtimeMs > srcStat.mtimeMs && !checkOnly) {
      totalMinBytes += minStat.size;
      continue;
    }
  } else {
    stale++;
  }

  if (checkOnly) {
    if (!fs.existsSync(minPath)) { console.error(`STALE: ${src} → no .min.js`); stale++; continue; }
    const minStat = fs.statSync(minPath);
    if (minStat.mtimeMs < srcStat.mtimeMs) { console.error(`STALE: ${src} → .min.js older than source`); stale++; }
    totalMinBytes += minStat.size;
    continue;
  }

  // esbuild minify — keep top-level identifiers (minifyIdentifiers:false)
  // so window.X exports keep working without us touching them.
  //
  // We intentionally DO NOT use keepNames:true because it injects a
  //   var X = (o,e) => Object.defineProperty(o, "name", {value:e,configurable:true})
  // shim at the top of every .min.js. In some Chrome environments (AV like
  // Kaspersky monkey-patches Object.defineProperty, or browser extensions),
  // that shim throws "Property description must be an object: undefined" at
  // load time, breaking the whole module (LOKIZIO-5). Anonymous function
  // names aren't worth that risk — stack traces just show `(anonymous)`,
  // which is fine.
  await build({
    entryPoints: [srcPath],
    outfile: minPath,
    minify: true,
    sourcemap: true,
    target: 'es2020',
    bundle: false,
    keepNames: false,             // see comment above
    minifyIdentifiers: false,     // don't rename top-level identifiers
    legalComments: 'none',
    logLevel: 'silent',
  });

  const minStat = fs.statSync(minPath);
  totalMinBytes += minStat.size;
  const ratio = ((1 - minStat.size / srcStat.size) * 100).toFixed(1);
  console.log(`  ${src.padEnd(28)} ${(srcStat.size / 1024).toFixed(1).padStart(6)} KB → ${(minStat.size / 1024).toFixed(1).padStart(6)} KB  (-${ratio}%)`);
}

// ── v9.98 perf: bundle the <head>'s same-origin scripts into ONE file ──
// index.html loaded 30 scripts one-by-one = 30 requests, each scanned in series
// by AV (Kaspersky) → ~15s boot. We concatenate them in the EXACT <head> order
// into a single app.bundle.min.js: 1 request, identical JS behaviour. These are
// global-scope scripts (NOT ES modules) → plain ordered concatenation preserves
// execution order (strict superset of `defer`, without its black-screen risk).
// ASI-safe '\n;\n' separator. supabase_config.js is FIRST (it calls
// supabase.createClient(); the bundle tag sits AFTER the jsdelivr supabase tag).
// sentry-init.min.js stays a SEPARATE tag (must load before the Sentry CDN).
const BUNDLE_FILE = 'app.bundle.min.js';
const BUNDLE_ORDER = [
  'supabase_config.js',
  'i18n.min.js', 'ical_parser.min.js', 'helpers.min.js', 'api_bridge.min.js',
  'vacation.min.js', 'push.min.js', 'legal.min.js', 'quotes.min.js',
  'search.min.js', 'tenant.min.js', 'auto-billing.min.js', 'invoices.min.js',
  'invoice-create.min.js', 'auth.min.js', 'provider.min.js', 'owner.min.js',
  'marketplace.min.js', 'properties.min.js', 'dashboard.min.js',
  'admin-prestations.min.js', 'account.min.js', 'admin-sentry.min.js',
  'stripe-connect-embed.min.js', 'admin-stripe.min.js', 'feedback-widget.min.js',
  'admin-dev-tools.min.js', 'admin-compliance.min.js', 'photo-consent.min.js',
  'analytics-init.min.js',
];
const bundlePath = path.join(root, BUNDLE_FILE);

// Single source of truth for the bundle bytes — used by BOTH build and --check
// so the CI guard compares CONTENT (not mtime). Audit wniekj2xi: an mtime-based
// check could greenlight a content-stale bundle (e.g. after a git clone sets
// arbitrary mtimes, or a manual edit + touch) -> stale bundle to GitHub Pages.
function buildBundleString() {
  let bundle = '';
  let n = 0;
  for (const f of BUNDLE_ORDER) {
    const p = path.join(root, f);
    if (!fs.existsSync(p)) { console.warn(`! bundle input missing, skipping: ${f}`); continue; }
    let c = fs.readFileSync(p, 'utf8');
    c = c.replace(/\r\n/g, '\n');                          // normalise CRLF->LF => bundle deterministe (cross-platform / autocrlf)
    c = c.replace(/\n?\/\/# sourceMappingURL=.*$/m, '');   // drop per-file sourcemap ref
    bundle += c + '\n;\n';
    n++;
  }
  return { bundle, n };
}

if (checkOnly) {
  // CI guard: bundle must exist AND match a fresh re-concatenation byte-for-byte.
  if (!fs.existsSync(bundlePath)) {
    console.error(`STALE: ${BUNDLE_FILE} missing — run \`npm run build\``); stale++;
  } else {
    const { bundle } = buildBundleString();
    const onDisk = fs.readFileSync(bundlePath, 'utf8');
    if (bundle !== onDisk) { console.error(`STALE: ${BUNDLE_FILE} content does not match its inputs — run \`npm run build\``); stale++; }
  }
} else {
  const { bundle, n } = buildBundleString();
  fs.writeFileSync(bundlePath, bundle);
  console.log(`  ${BUNDLE_FILE.padEnd(28)} ← ${n} scripts concatenated (${(bundle.length / 1024).toFixed(1)} KB)`);
}

if (checkOnly && stale > 0) {
  console.error(`\n${stale} stale .min.js file(s). Run \`npm run build\`.`);
  process.exit(1);
}

const totalReduction = ((1 - totalMinBytes / totalSrcBytes) * 100).toFixed(1);
console.log('─'.repeat(60));
console.log(`Total: ${(totalSrcBytes / 1024).toFixed(1)} KB → ${(totalMinBytes / 1024).toFixed(1)} KB  (-${totalReduction}%)`);
