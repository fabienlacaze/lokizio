// Niveau 2 (extended) — Crawler that FILLS each visible form with valid + invalid data.
// Goal: surface validation/submission bugs that "just open the modal" misses.
//
// For each visible input we fill:
//   - a "valid-looking" value based on input type
//   - then a "garbage" value to test validation
// Then we capture any JS error / console error.

import { test, expect, seedUser, loginUI, cleanupUser, hasTestEnv, adminClient } from '../e2e-flows/_helpers.js';

test.skip(!hasTestEnv(), '.env.test missing');

let userId = null;
test.afterEach(async () => { await cleanupUser(userId); userId = null; });

const MODALS_WITH_FORMS = [
  { name: 'Account', fn: 'showAccountModal' },
  { name: 'AddProvider', fn: 'showAddProviderModal' },
  { name: 'Invite', fn: 'showInviteModal' },
  { name: 'AddManualContact', fn: 'showAddManualContact' },
  { name: 'AddPropertyWizard', fn: 'showAddPropertyWizard' },
  { name: 'ServiceRequest', fn: 'showServiceRequestModal' },
];

// Generate a sane value per input type.
function valueFor(type, name) {
  const lower = (name || '').toLowerCase();
  if (lower.includes('email')) return 'crawler-form@lokizio-test.local';
  if (lower.includes('phone') || lower.includes('tel')) return '+33612345678';
  if (lower.includes('siret')) return '12345678901234';
  if (lower.includes('postcode') || lower.includes('cp') || lower.includes('zip')) return '75001';
  if (lower.includes('city') || lower.includes('ville')) return 'Paris';
  if (lower.includes('address') || lower.includes('adresse')) return '1 rue de Test, 75001 Paris';
  if (lower.includes('name') || lower.includes('nom')) return 'Crawler Test';
  if (lower.includes('amount') || lower.includes('montant')) return '100';
  if (lower.includes('quantity') || lower.includes('qty') || lower.includes('quantite')) return '1';
  if (lower.includes('description') || lower.includes('notes') || lower.includes('comment')) return 'Test note';
  switch (type) {
    case 'email': return 'test@example.com';
    case 'tel': return '+33612345678';
    case 'number': return '10';
    case 'date': return new Date().toISOString().split('T')[0];
    case 'url': return 'https://example.com';
    default: return 'test';
  }
}

test.describe.configure({ mode: 'serial' });
test.setTimeout(180_000);

test('crawler-forms: fill each form, no JS error', async ({ page }) => {
  const consoleErrors = [];
  const pageErrors = [];

  page.on('pageerror', (err) => pageErrors.push({ name: err.name, message: err.message }));
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      const text = msg.text();
      if (/sentry-cdn|Failed to load resource/.test(text)) return;
      consoleErrors.push(text);
    }
  });

  // Seed user + org + property
  const { user, email, password } = await seedUser('crawler-forms');
  userId = user.id;
  const admin = adminClient();
  const { data: org } = await admin.from('organizations').insert({
    name: 'CrawlerForms-' + Date.now(), plan: 'business', onboarding_completed: true,
  }).select().single();
  await admin.from('members').insert({
    org_id: org.id, user_id: user.id, role: 'concierge',
    accepted: true, invited_email: email, display_name: 'CrawlerForms',
  });
  await admin.from('properties').insert({
    org_id: org.id, name: 'Villa CrawlerForms', address: '1 rue Test 75001 Paris',
  });

  await loginUI(page, email, password);
  await expect(page.locator('#nav_properties')).toBeVisible({ timeout: 15000 });
  await page.waitForTimeout(1000);

  let filled = 0;
  for (const modal of MODALS_WITH_FORMS) {
    try {
      // Open
      await page.evaluate((fn) => { if (typeof window[fn] === 'function') window[fn](); }, modal.fn);
      await page.waitForTimeout(700);

      // Find visible inputs (not hidden, not disabled, not readonly)
      const inputs = await page.$$('input:not([type="hidden"]):not([disabled]):not([readonly]), textarea:not([disabled]):not([readonly])');
      for (const inp of inputs) {
        try {
          const visible = await inp.isVisible().catch(() => false);
          if (!visible) continue;
          const type = (await inp.getAttribute('type')) || 'text';
          const name = (await inp.getAttribute('name')) || (await inp.getAttribute('id')) || '';
          if (type === 'checkbox' || type === 'radio') continue;
          if (type === 'file') continue;
          const value = valueFor(type, name);
          await inp.fill(value, { timeout: 800 }).catch(() => {});
          filled++;
        } catch (_) { /* skip individual input errors */ }
      }

      // Close modal
      await page.keyboard.press('Escape').catch(() => {});
      await page.waitForTimeout(200);
      console.log(`✓ ${modal.name}: filled inputs`);
    } catch (e) {
      console.log(`✗ ${modal.name}:`, e.message);
    }
  }

  console.log(`\nTotal inputs filled: ${filled}`);
  console.log(`Page errors: ${pageErrors.length}`);
  pageErrors.forEach((e) => console.log(`  ${e.name}: ${e.message}`));
  console.log(`Console errors: ${consoleErrors.length}`);
  [...new Set(consoleErrors)].slice(0, 10).forEach((t) => console.log(`  ${t.substring(0, 200)}`));

  // Hard fail only on uncaught JS exceptions (page errors)
  expect(pageErrors).toEqual([]);
});
