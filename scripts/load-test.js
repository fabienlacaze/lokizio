#!/usr/bin/env node
// Lightweight load test against Supabase REST + Edge Functions.
// Goal: verify the app's API surface holds up under realistic concurrent load
// without hitting Supabase free-tier limits.
//
// Usage:
//   npm run loadtest                    # default: 50 concurrent reads x 30s
//   LOAD_CONCURRENCY=20 LOAD_DURATION=10 npm run loadtest
//
// What we test:
//   - GET /rest/v1/properties (anon — should return 401 fast)
//   - GET /rest/v1/marketplace_profiles?visible=eq.true (RLS-allowed)
//   - POST /functions/v1/ical-proxy (allowlist check, no real fetch)

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load .env.test
const envPath = path.join(__dirname, '..', '.env.test');
const env = {};
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8').split('\n').forEach((line) => {
    const m = line.match(/^([A-Z_]+)=(.+)$/);
    if (m) env[m[1]] = m[2].trim();
  });
}

const URL_BASE = env.SUPABASE_TEST_URL || 'https://njjaklfqmvspceoulgiu.supabase.co';
const ANON = env.SUPABASE_TEST_ANON_KEY;
const CONCURRENCY = parseInt(process.env.LOAD_CONCURRENCY || '20', 10);
const DURATION_S = parseInt(process.env.LOAD_DURATION || '15', 10);

if (!ANON) {
  console.error('SUPABASE_TEST_ANON_KEY missing in .env.test');
  process.exit(1);
}

const SCENARIOS = [
  {
    name: 'GET marketplace_profiles (visible)',
    fn: () => fetch(`${URL_BASE}/rest/v1/marketplace_profiles?select=display_name,city&visible=eq.true&limit=10`, {
      headers: { apikey: ANON, Authorization: `Bearer ${ANON}` },
    }),
  },
  {
    name: 'OPTIONS ical-proxy',
    fn: () => fetch(`${URL_BASE}/functions/v1/ical-proxy`, { method: 'OPTIONS' }),
  },
  {
    name: 'POST ical-proxy (rejected URL)',
    fn: () => fetch(`${URL_BASE}/functions/v1/ical-proxy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: ANON },
      body: JSON.stringify({ url: 'https://example.com/cal.ics' }),
    }),
  },
];

async function worker(stats, deadline) {
  while (Date.now() < deadline) {
    const sc = SCENARIOS[Math.floor(Math.random() * SCENARIOS.length)];
    const start = Date.now();
    try {
      const r = await sc.fn();
      const elapsed = Date.now() - start;
      stats.total++;
      stats.byScenario[sc.name] = stats.byScenario[sc.name] || { count: 0, totalMs: 0, minMs: Infinity, maxMs: 0, statuses: {} };
      const s = stats.byScenario[sc.name];
      s.count++;
      s.totalMs += elapsed;
      s.minMs = Math.min(s.minMs, elapsed);
      s.maxMs = Math.max(s.maxMs, elapsed);
      s.statuses[r.status] = (s.statuses[r.status] || 0) + 1;
    } catch (e) {
      stats.errors++;
    }
  }
}

console.log(`Load test: ${CONCURRENCY} concurrent workers for ${DURATION_S}s`);
console.log(`Target: ${URL_BASE}`);
console.log('');

const stats = { total: 0, errors: 0, byScenario: {} };
const deadline = Date.now() + DURATION_S * 1000;
const workers = Array.from({ length: CONCURRENCY }, () => worker(stats, deadline));
await Promise.all(workers);

const elapsedS = (Date.now() - (deadline - DURATION_S * 1000)) / 1000;
console.log(`\nResults after ${elapsedS.toFixed(1)}s:`);
console.log(`  Total requests: ${stats.total}`);
console.log(`  Throughput: ${(stats.total / elapsedS).toFixed(1)} req/s`);
console.log(`  Errors: ${stats.errors}`);
console.log('');

for (const [name, s] of Object.entries(stats.byScenario)) {
  console.log(`  ${name}`);
  console.log(`    count: ${s.count}, avg: ${(s.totalMs / s.count).toFixed(0)}ms, min: ${s.minMs}ms, max: ${s.maxMs}ms`);
  console.log(`    statuses: ${JSON.stringify(s.statuses)}`);
}

// Health checks
const totalErrors = stats.errors;
const totalRateLimited = Object.values(stats.byScenario)
  .reduce((sum, s) => sum + (s.statuses[429] || 0), 0);

console.log('\nHealth:');
if (totalErrors === 0 && totalRateLimited === 0) {
  console.log('  ✓ No transport errors, no rate-limiting');
} else {
  console.log(`  ⚠ ${totalErrors} transport errors, ${totalRateLimited} HTTP 429 (rate-limited)`);
}
