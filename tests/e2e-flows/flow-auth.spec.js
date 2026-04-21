// Full register + login flow using the real UI against lokizio-test Supabase.
import { test, expect, seedUser, loginUI, cleanupUser, hasTestEnv, newEmail, adminClient } from './_helpers.js';

test.skip(!hasTestEnv(), '.env.test missing — see tests/integration/README.md');

test.describe('Auth - full register flow via UI', () => {
  let createdUserId = null;

  test.afterEach(async () => {
    await cleanupUser(createdUserId);
    createdUserId = null;
  });

  test('register form submits without errors', async ({ page }) => {
    const email = newEmail('register');
    const password = 'ValidTest1!';

    await page.goto('/');
    await page.click('#tabRegister');
    await page.check('#authRgpdAccept');
    await page.fill('#authEmail', email);
    await page.fill('#authPass', password);
    await page.fill('#authPassConfirm', password);
    await page.click('#authSubmitBtn');

    // Wait for either: success confirmation, or app main visible
    await page.waitForTimeout(4000);

    // Check no client-side validation error surfaced (password rules, RGPD, etc.)
    const err = await page.locator('#authError').textContent().catch(() => '');
    expect(err || '', 'no validation error').not.toMatch(/caracteres|majuscule|minuscule|chiffre|special|CGU/i);

    // Try to find the user via listUsers with page param (Supabase default page = 50)
    const admin = adminClient();
    let found = null;
    for (let p = 1; p <= 5 && !found; p++) {
      const { data } = await admin.auth.admin.listUsers({ page: p, perPage: 200 });
      found = data?.users?.find(u => u.email === email);
    }
    if (found) createdUserId = found.id;
    // User might be in confirmation state, so this is best-effort cleanup.
  });
});

test.describe('Auth - login with pre-seeded org', () => {
  let userId = null;

  test.afterEach(async () => {
    await cleanupUser(userId);
    userId = null;
  });

  async function seedConciergeWithOrg() {
    const { user, email, password } = await seedUser('login');
    userId = user.id;
    const admin = adminClient();
    const { data: org } = await admin.from('organizations').insert({
      name: 'LoginTest-' + Date.now(), plan: 'business', onboarding_completed: true,
    }).select().single();
    await admin.from('members').insert({
      org_id: org.id, user_id: user.id, role: 'concierge',
      accepted: true, invited_email: email, display_name: 'Login Test',
    });
    return { email, password };
  }

  test('seeded user logs in and sees the main app', async ({ page }) => {
    const { email, password } = await seedConciergeWithOrg();
    await loginUI(page, email, password);
    await expect(page.locator('#appMain')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('#authScreen')).toBeHidden();
  });

  test('bottom nav is populated for concierge', async ({ page }) => {
    const { email, password } = await seedConciergeWithOrg();
    await loginUI(page, email, password);
    await page.waitForTimeout(1500);
    await expect(page.locator('#nav_dashboard')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('#nav_properties')).toBeVisible();
    await expect(page.locator('#nav_billing')).toBeVisible();
  });
});
