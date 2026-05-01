// Niveau 3 — Monkey testing
// Cliquer aleatoirement sur tout ce qui est cliquable pendant N actions et capturer toutes les erreurs.
//
// Lancer : npx playwright test tests/e2e-monkey/monkey.spec.js --project=flows
// Configurer la duree : MONKEY_ACTIONS=200 npx playwright ...

import { test, expect, seedUser, loginUI, cleanupUser, hasTestEnv, adminClient } from '../e2e-flows/_helpers.js';

test.skip(!hasTestEnv(), '.env.test missing — monkey needs Supabase test creds');

let userId = null;
test.afterEach(async () => { await cleanupUser(userId); userId = null; });

const MONKEY_ACTIONS = parseInt(process.env.MONKEY_ACTIONS || '100', 10);
const MONKEY_SEED = parseInt(process.env.MONKEY_SEED || String(Date.now()), 10);

// Simple seedable PRNG so monkey runs are reproducible if needed
function makeRng(seed) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
}

test.describe.configure({ mode: 'serial' });
test.setTimeout(180_000);

test('monkey clicks the app randomly', async ({ page }) => {
  console.log(`[monkey] Config: actions=${MONKEY_ACTIONS} seed=${MONKEY_SEED}`);
  const rng = makeRng(MONKEY_SEED);
  const errors = [];
  const consoleErrors = [];

  page.on('pageerror', (err) => {
    errors.push({ name: err.name, message: err.message, stack: (err.stack || '').slice(0, 500), at: new Date().toISOString() });
  });
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      const text = msg.text();
      // Filter benign errors (Sentry chatter, network during navigation)
      if (/sentry-cdn|Failed to fetch|NetworkError when attempting/.test(text)) return;
      consoleErrors.push({ text: text.slice(0, 300), at: new Date().toISOString() });
    }
  });

  // Seed user + org + property manuellement
  const { user, email, password } = await seedUser('monkey');
  userId = user.id;
  const admin = adminClient();
  const { data: org } = await admin.from('organizations').insert({
    name: 'Monkey-Org-' + Date.now(), plan: 'business', onboarding_completed: true,
  }).select().single();
  await admin.from('members').insert({
    org_id: org.id, user_id: user.id, role: 'concierge',
    accepted: true, invited_email: email, display_name: 'Monkey',
  });
  await admin.from('properties').insert({
    org_id: org.id, name: 'Villa Monkey', address: '1 rue Test 75001 Paris',
  });

  await loginUI(page, email, password);
  await expect(page.locator('#nav_properties')).toBeVisible({ timeout: 15000 });
  await page.waitForTimeout(1000);

  console.log(`[monkey] Starting ${MONKEY_ACTIONS} random actions (seed=${MONKEY_SEED})`);

  let clicks = 0, navs = 0, escapes = 0, types = 0;
  for (let i = 0; i < MONKEY_ACTIONS; i++) {
    try {
      const action = rng();

      if (action < 0.7) {
        // 70% : click on a random visible clickable element
        const selectors = ['button:visible', 'a:visible', '[onclick]:visible', 'input[type="checkbox"]:visible'];
        const sel = selectors[Math.floor(rng() * selectors.length)];
        const elements = await page.$$(sel);
        if (elements.length === 0) continue;
        const el = elements[Math.floor(rng() * elements.length)];
        // Scroll into view + click with short timeout (ignore if not actionable)
        await el.click({ timeout: 1500, force: false }).catch(() => {});
        clicks++;
      } else if (action < 0.85) {
        // 15% : type random text in a visible input
        const inputs = await page.$$('input:visible:not([type="checkbox"]):not([type="radio"]), textarea:visible');
        if (inputs.length > 0) {
          const inp = inputs[Math.floor(rng() * inputs.length)];
          await inp.fill('test' + Math.floor(rng() * 9999), { timeout: 1000 }).catch(() => {});
          types++;
        }
      } else if (action < 0.95) {
        // 10% : press Escape (close modals)
        await page.keyboard.press('Escape').catch(() => {});
        escapes++;
      } else {
        // 5% : navigate to a hash route
        const hashes = ['#planning', '#finance', '#admin', '#config', '#comm', '#'];
        await page.evaluate((h) => { window.location.hash = h; }, hashes[Math.floor(rng() * hashes.length)]).catch(() => {});
        navs++;
      }

      // Tiny pause to let async errors surface
      if (i % 10 === 0) await page.waitForTimeout(50);
    } catch (e) {
      // Don't stop the monkey — just log
      console.log(`[monkey] action ${i} threw:`, e.message.slice(0, 100));
    }
  }

  console.log(`[monkey] Done. ${clicks} clicks, ${types} types, ${escapes} escapes, ${navs} navs`);
  console.log(`[monkey] Captured ${errors.length} pageerror(s), ${consoleErrors.length} console.error(s)`);

  // Flush Sentry
  await page.evaluate(() => {
    if (typeof Sentry !== 'undefined' && Sentry.flush) return Sentry.flush(3000);
  }).catch(() => {});

  // Print captured errors
  if (errors.length > 0) {
    console.log('\n═══ PAGE ERRORS ═══');
    errors.slice(0, 10).forEach((e, i) => {
      console.log(`#${i + 1} ${e.name}: ${e.message}`);
      console.log(`  ${e.stack.split('\n').slice(0, 3).join('\n  ')}`);
    });
  }
  if (consoleErrors.length > 0) {
    console.log('\n═══ CONSOLE ERRORS ═══');
    const unique = [...new Set(consoleErrors.map((e) => e.text))];
    unique.slice(0, 10).forEach((t, i) => console.log(`#${i + 1} ${t}`));
  }
});
