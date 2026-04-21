// Helpers for authenticated E2E flows.
// Creates/destroys users directly via Supabase admin API, then navigates the real UI.

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { test as base, expect } from '@playwright/test';

const envPath = resolve(process.cwd(), '.env.test');
if (existsSync(envPath)) dotenv.config({ path: envPath });

export const TEST_URL = process.env.SUPABASE_TEST_URL;
export const TEST_ANON_KEY = process.env.SUPABASE_TEST_ANON_KEY;
export const TEST_SERVICE_KEY = process.env.SUPABASE_TEST_SERVICE_KEY;

export function hasTestEnv() {
  return !!(TEST_URL && TEST_ANON_KEY && TEST_SERVICE_KEY);
}

export function adminClient() {
  if (!hasTestEnv()) throw new Error('.env.test missing');
  return createClient(TEST_URL, TEST_SERVICE_KEY, { auth: { persistSession: false } });
}

// Generate unique test email. Reused for seed + login.
export function newEmail(label = 'e2e') {
  return `${label}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@lokizio-test.local`;
}

// Create user via admin API + return credentials. Used to seed a test account
// before navigating the UI to log in.
export async function seedUser(label = 'e2e') {
  const admin = adminClient();
  const email = newEmail(label);
  const password = 'ValidTest1!';
  const { data, error } = await admin.auth.admin.createUser({
    email, password, email_confirm: true,
  });
  if (error) throw new Error(`seedUser failed: ${error.message}`);
  return { user: data.user, email, password };
}

// Playwright fixture: inject test Supabase endpoint BEFORE page scripts run.
// This makes the real UI talk to the test project instead of production.
export const test = base.extend({
  page: async ({ page }, use) => {
    // Set localStorage override before any page script loads.
    await page.addInitScript(({ url, anon }) => {
      try {
        window.localStorage.setItem('__lokizio_test_url', url);
        window.localStorage.setItem('__lokizio_test_anon', anon);
      } catch (_) {}
    }, { url: TEST_URL, anon: TEST_ANON_KEY });
    await use(page);
  },
});

export { expect };

// Log in via the real UI (register tab not needed, user is seeded by admin API).
export async function loginUI(page, email, password) {
  // Pre-set language to skip the first-run language picker modal.
  await page.addInitScript(() => {
    try { localStorage.setItem('mm_lang', 'fr'); } catch (_) {}
  });
  await page.goto('/');
  await page.fill('#authEmail', email);
  await page.fill('#authPass', password);
  await page.click('#authSubmitBtn');
  // Wait for auth screen to disappear and main app to show
  await expect(page.locator('#authScreen')).toBeHidden({ timeout: 15_000 });
  // Dismiss any language modal that slipped through
  const langBtn = page.getByRole('button', { name: 'Francais', exact: false });
  if (await langBtn.isVisible().catch(() => false)) await langBtn.click();
  // Dismiss other common first-run modals
  const closeBtn = page.locator('button:has-text("×")').first();
  if (await closeBtn.isVisible().catch(() => false)) {
    try { await closeBtn.click({ timeout: 1000 }); } catch (_) {}
  }
}

// Cleanup: delete user + their org(s) via admin. Call in afterEach / afterAll.
export async function cleanupUser(userId) {
  if (!userId) return;
  const admin = adminClient();
  try {
    // Delete any org owned by the user (cascades to members/properties/etc)
    const { data: memberships } = await admin.from('members').select('org_id').eq('user_id', userId);
    for (const m of memberships || []) {
      await admin.from('organizations').delete().eq('id', m.org_id);
    }
    await admin.auth.admin.deleteUser(userId);
  } catch (e) {
    // Best-effort cleanup; don't fail the test on teardown errors.
    console.warn('cleanupUser:', e.message);
  }
}
