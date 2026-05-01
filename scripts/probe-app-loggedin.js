// Probe the local app AS A LOGGED-IN USER and capture all errors.
// Uses .env.test credentials to seed a real account.
//
// Usage:
//   npm run serve  (in another terminal)
//   node scripts/probe-app-loggedin.js

import { chromium } from 'playwright';
import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load .env.test
const envPath = path.join(__dirname, '..', '.env.test');
const env = {};
fs.readFileSync(envPath, 'utf8').split('\n').forEach((line) => {
  const m = line.match(/^([A-Z_]+)=(.+)$/);
  if (m) env[m[1]] = m[2].trim();
});

const URL = process.argv[2] || 'http://localhost:8000';
const TEST_URL = env.SUPABASE_TEST_URL;
const TEST_ANON = env.SUPABASE_TEST_ANON_KEY;
const TEST_SVC = env.SUPABASE_TEST_SERVICE_KEY;

const admin = createClient(TEST_URL, TEST_SVC, { auth: { persistSession: false } });

// Seed a fresh test user with org+property
const email = `probe-${Date.now()}@lokizio-test.local`;
const password = 'ValidTest1!';

console.log(`Seeding user ${email}...`);
const { data: { user }, error: userErr } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
if (userErr) { console.error('user create:', userErr); process.exit(1); }

const { data: org } = await admin.from('organizations').insert({
  name: 'Probe-Org-' + Date.now(), plan: 'business', onboarding_completed: true,
}).select().single();
await admin.from('members').insert({
  org_id: org.id, user_id: user.id, role: 'concierge',
  accepted: true, invited_email: email, display_name: 'Probe',
});
await admin.from('properties').insert({
  org_id: org.id, name: 'Villa Probe', address: '1 rue Test 75001 Paris',
});

console.log(`Seeded. Logging in via UI at ${URL}...`);

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext();
const page = await ctx.newPage();

const consoleMessages = [];
const networkErrors = [];
const pageErrors = [];

page.on('console', (msg) => {
  consoleMessages.push({ type: msg.type(), text: msg.text(), at: Date.now() });
});
page.on('pageerror', (err) => {
  pageErrors.push({ name: err.name, message: err.message, stack: (err.stack || '').slice(0, 800) });
});
page.on('response', (resp) => {
  if (resp.status() >= 400) {
    networkErrors.push({
      url: resp.url(),
      method: resp.request().method(),
      status: resp.status(),
      timing: resp.request().timing()?.startTime,
    });
  }
});

// Inject test Supabase URLs ONLY when probing localhost.
// Against prod, we'd be seeding a test user that doesn't exist there.
const isLocal = /^https?:\/\/(localhost|127\.0\.0\.1)/.test(URL);
if (isLocal) {
  await ctx.addInitScript(({ url, anon }) => {
    try {
      localStorage.setItem('__lokizio_test_url', url);
      localStorage.setItem('__lokizio_test_anon', anon);
      localStorage.setItem('mm_lang', 'fr');
    } catch (_) {}
  }, { url: TEST_URL, anon: TEST_ANON });
} else {
  console.log('[probe] Targeting prod — seeded test user is for lokizio-test only.');
  console.log('[probe] Will not be able to log in to prod. Reading anonymous-only state.');
  await ctx.addInitScript(() => {
    try { localStorage.setItem('mm_lang', 'fr'); } catch (_) {}
  });
}

await page.goto(URL, { waitUntil: 'domcontentloaded' });

// Login via UI
await page.fill('#authEmail', email);
await page.fill('#authPass', password);
await page.click('#authSubmitBtn');

// Wait for app to render (nav appears)
try {
  await page.waitForSelector('#nav_properties', { state: 'visible', timeout: 15_000 });
} catch (e) {
  console.log('Login may have failed — will dump what we have');
}

// Let app fully load + trigger any background errors
await page.waitForTimeout(5000);

// Visit a few tabs
for (const tab of ['planning', 'finance', 'admin', 'config', 'comm']) {
  try {
    await page.evaluate((t) => { if (typeof switchNav === 'function') switchNav(t); }, tab);
    await page.waitForTimeout(800);
  } catch (_) {}
}

// Force flush Sentry
await page.evaluate(() => {
  if (typeof Sentry !== 'undefined' && Sentry.flush) return Sentry.flush(3000);
}).catch(() => {});

// REPORT
console.log('\n═══ CONSOLE ERRORS ═══');
const errors = consoleMessages.filter((m) => m.type === 'error');
errors.forEach((m, i) => console.log(`[ERR #${i + 1}] ${m.text.slice(0, 400)}`));

console.log('\n═══ CONSOLE WARNINGS ═══');
const warnings = consoleMessages.filter((m) => m.type === 'warning');
warnings.forEach((m, i) => console.log(`[WARN #${i + 1}] ${m.text.slice(0, 300)}`));

console.log('\n═══ PAGE ERRORS (uncaught JS) ═══');
pageErrors.forEach((e, i) => {
  console.log(`#${i + 1} ${e.name}: ${e.message}`);
  console.log(e.stack.split('\n').slice(0, 4).map((l) => '  ' + l).join('\n'));
});

console.log('\n═══ NETWORK ERRORS (HTTP >= 400) ═══');
networkErrors.forEach((n, i) => {
  // Strip query for readability but keep table name visible
  const u = n.url.replace(/\?.*$/, (q) => q.length > 100 ? q.slice(0, 100) + '...' : q);
  console.log(`#${i + 1} ${n.method} ${n.status} ${u}`);
});

// Cleanup: delete the seeded user
console.log('\nCleaning up...');
try {
  const { data: members } = await admin.from('members').select('org_id').eq('user_id', user.id);
  for (const m of members || []) await admin.from('organizations').delete().eq('id', m.org_id);
  await admin.auth.admin.deleteUser(user.id);
} catch (_) {}

await browser.close();
console.log('Done.');
