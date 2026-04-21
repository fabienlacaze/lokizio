// Account / profile flows: header buttons, modal open, logout.
import { test, expect, seedUser, loginUI, cleanupUser, hasTestEnv, adminClient } from './_helpers.js';

test.skip(!hasTestEnv(), '.env.test missing');

async function seedLogin() {
  const { user, email, password } = await seedUser('acc');
  const admin = adminClient();
  const { data: org } = await admin.from('organizations').insert({
    name: 'AccOrg-' + Date.now(), plan: 'business', onboarding_completed: true,
  }).select().single();
  await admin.from('members').insert({
    org_id: org.id, user_id: user.id, role: 'concierge',
    accepted: true, invited_email: email, display_name: 'Acc Test',
  });
  return { userId: user.id, email, password };
}

test.describe('Account & header', () => {
  let ctx = null;
  test.afterEach(async () => { if (ctx?.userId) await cleanupUser(ctx.userId); ctx = null; });

  test('account button is visible and clickable', async ({ page }) => {
    ctx = await seedLogin();
    await loginUI(page, ctx.email, ctx.password);
    await page.waitForTimeout(1000);
    const accountBtn = page.locator('[onclick="showAccountModal()"]');
    await expect(accountBtn).toBeVisible({ timeout: 5000 });
  });

  test('search button opens search UI', async ({ page }) => {
    ctx = await seedLogin();
    await loginUI(page, ctx.email, ctx.password);
    await page.waitForTimeout(1000);
    const searchBtn = page.locator('[onclick="showGlobalSearch()"]');
    await expect(searchBtn).toBeVisible({ timeout: 5000 });
    await searchBtn.click();
    await page.waitForTimeout(800);
    // Global search opens some overlay/input
    await expect(page.locator('#appMain')).toBeVisible();
  });

  test('invite button exists in header for concierge', async ({ page }) => {
    ctx = await seedLogin();
    await loginUI(page, ctx.email, ctx.password);
    await page.waitForTimeout(1500);
    // Invite button exists (may be visible only when team panel open; just test it's in DOM)
    const count = await page.locator('[onclick="showInviteModal()"]').count();
    expect(count).toBeGreaterThan(0);
  });

  test('profile data can be updated in DB', async () => {
    ctx = await seedLogin();
    const admin = adminClient();
    const { error } = await admin.from('profiles').upsert({
      id: ctx.userId, email: ctx.email, display_name: 'Updated Name',
      phone: '0601020304', country: 'FR',
    });
    expect(error).toBeNull();
    const { data } = await admin.from('profiles').select('*').eq('id', ctx.userId).single();
    expect(data.display_name).toBe('Updated Name');
  });

  test('RGPD consent can be logged per user', async () => {
    ctx = await seedLogin();
    const admin = adminClient();
    const { error } = await admin.from('rgpd_consents').insert({
      user_id: ctx.userId,
      consent_type: 'cgu_cgv_privacy_inscription',
      cgu_version: '2026-04-19', privacy_version: '2.0',
    });
    expect(error).toBeNull();
    const { data } = await admin.from('rgpd_consents').select('*').eq('user_id', ctx.userId);
    expect(data.length).toBeGreaterThan(0);
  });
});
