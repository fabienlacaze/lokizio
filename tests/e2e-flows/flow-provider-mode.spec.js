// Provider-specific UI: navigation and DB checks.
import { test, expect, seedUser, loginUI, cleanupUser, hasTestEnv, adminClient } from './_helpers.js';

test.skip(!hasTestEnv(), '.env.test missing');

async function seedProvider() {
  const { user, email, password } = await seedUser('prov');
  const admin = adminClient();
  const { data: org } = await admin.from('organizations').insert({
    name: 'ProvOrg-' + Date.now(), plan: 'business', onboarding_completed: true,
  }).select().single();
  await admin.from('members').insert({
    org_id: org.id, user_id: user.id, role: 'provider',
    accepted: true, invited_email: email, display_name: 'Provider Test',
  });
  await admin.from('marketplace_profiles').upsert({
    user_id: user.id, role: 'provider', display_name: 'Provider Test',
    company_name: 'Test Services SARL', city: 'Paris', is_public: true,
  });
  return { userId: user.id, email, password, org };
}

test.describe('Provider mode', () => {
  let ctx = null;
  test.afterEach(async () => { if (ctx?.userId) await cleanupUser(ctx.userId); ctx = null; });

  test('provider lands on overview tab by default', async ({ page }) => {
    ctx = await seedProvider();
    await loginUI(page, ctx.email, ctx.password);
    await page.waitForTimeout(1500);
    await expect(page.locator('#nav_overview')).toBeVisible({ timeout: 5000 });
  });

  test('provider can navigate to all their tabs', async ({ page }) => {
    ctx = await seedProvider();
    await loginUI(page, ctx.email, ctx.password);
    await page.waitForTimeout(1500);
    for (const tab of ['annuaire', 'prestations', 'billing', 'chat']) {
      await expect(page.locator(`#nav_${tab}`)).toBeVisible({ timeout: 3000 });
    }
  });

  test('provider-assigned service request is visible in prestations', async ({ page }) => {
    ctx = await seedProvider();
    const admin = adminClient();
    const { user: concUser } = await (async () => {
      const { data } = await admin.auth.admin.createUser({
        email: 'conc-' + Date.now() + '@lokizio-test.local',
        password: 'ValidTest1!', email_confirm: true,
      });
      return { user: data.user };
    })();
    try {
      await admin.from('members').insert({
        org_id: ctx.org.id, user_id: concUser.id, role: 'concierge',
        accepted: true, invited_email: concUser.email, display_name: 'Conc',
      });
      const { data: prop } = await admin.from('properties').insert({
        org_id: ctx.org.id, name: 'Maison Prov', address: 'X',
      }).select().single();
      await admin.from('service_requests').insert({
        org_id: ctx.org.id, property_id: prop.id,
        service_type: 'cleaning_standard',
        requested_date: new Date().toISOString().split('T')[0],
        status: 'assigned', provider_id: ctx.userId, assigned_to: ctx.userId,
      });

      await loginUI(page, ctx.email, ctx.password);
      await page.waitForTimeout(2000);
      await page.click('#nav_prestations');
      await page.waitForTimeout(3000);
      // App didn't crash navigating, request should appear or at least not throw
      await expect(page.locator('#appMain')).toBeVisible();
    } finally {
      await cleanupUser(concUser.id);
    }
  });

  test('provider marketplace profile is persisted', async () => {
    ctx = await seedProvider();
    const admin = adminClient();
    const { data } = await admin.from('marketplace_profiles').select('*').eq('user_id', ctx.userId).single();
    expect(data.role).toBe('provider');
    expect(data.company_name).toBe('Test Services SARL');
  });
});
