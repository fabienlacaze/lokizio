// Role switching: same org, different member role = different bottom nav.
import { test, expect, seedUser, loginUI, cleanupUser, hasTestEnv, adminClient } from './_helpers.js';

test.skip(!hasTestEnv(), '.env.test missing');

async function seedWithRole(role) {
  const { user, email, password } = await seedUser('role-' + role);
  const admin = adminClient();
  const { data: org } = await admin.from('organizations').insert({
    name: 'RoleOrg-' + role + '-' + Date.now(), plan: 'business', onboarding_completed: true,
  }).select().single();
  await admin.from('members').insert({
    org_id: org.id, user_id: user.id, role,
    accepted: true, invited_email: email, display_name: role + ' test',
  });
  return { userId: user.id, email, password, orgId: org.id };
}

test.describe('Role-based UI', () => {
  test('provider sees provider nav (overview, prestations, billing)', async ({ page }) => {
    const { userId, email, password } = await seedWithRole('provider');
    try {
      await loginUI(page, email, password);
      await page.waitForTimeout(2000);
      await expect(page.locator('#nav_overview')).toBeVisible({ timeout: 10_000 });
      await expect(page.locator('#nav_prestations')).toBeVisible();
      await expect(page.locator('#nav_billing')).toBeVisible();
    } finally {
      await cleanupUser(userId);
    }
  });

  test('owner sees owner nav (overview, properties, billing)', async ({ page }) => {
    const { userId, email, password } = await seedWithRole('owner');
    try {
      await loginUI(page, email, password);
      await page.waitForTimeout(2000);
      await expect(page.locator('#nav_overview')).toBeVisible({ timeout: 10_000 });
      await expect(page.locator('#nav_properties')).toBeVisible();
      await expect(page.locator('#nav_billing')).toBeVisible();
    } finally {
      await cleanupUser(userId);
    }
  });

  test('tenant with active reservation sees home tab', async ({ page }) => {
    const admin = adminClient();
    const { userId: conciergeId, email: cEmail, orgId } = await seedWithRole('concierge');

    // Seed a tenant in same org + property + reservation
    const { user: tenantUser } = await (async () => {
      const { data: { user }, error } = await admin.auth.admin.createUser({
        email: 'tenant-' + Date.now() + '@lokizio-test.local',
        password: 'ValidTest1!', email_confirm: true,
      });
      if (error) throw new Error(error.message);
      return { user };
    })();
    const tenantPassword = 'ValidTest1!';
    const tenantEmail = tenantUser.email;

    try {
      await admin.from('members').insert({
        org_id: orgId, user_id: tenantUser.id, role: 'tenant',
        accepted: true, invited_email: tenantEmail, display_name: 'Tenant Test',
      });
      const { data: prop } = await admin.from('properties').insert({
        org_id: orgId, name: 'Villa Locataire', address: 'Test',
      }).select().single();
      const today = new Date().toISOString().split('T')[0];
      const later = new Date(Date.now() + 10 * 86400000).toISOString().split('T')[0];
      await admin.from('reservations').insert({
        org_id: orgId, property_id: prop.id, tenant_user_id: tenantUser.id,
        start_date: today, end_date: later, status: 'active',
        access_instructions: 'Cle sous le paillasson',
      });

      await loginUI(page, tenantEmail, tenantPassword);
      await page.waitForTimeout(2500);

      // Tenant nav: home, interventions, chat
      await expect(page.locator('#nav_home')).toBeVisible({ timeout: 10_000 });
      await expect(page.locator('#nav_interventions')).toBeVisible();
      await expect(page.locator('#nav_chat')).toBeVisible();

      // Property name should show on home
      await expect(page.getByText('Villa Locataire').first()).toBeVisible({ timeout: 5_000 });
    } finally {
      await cleanupUser(tenantUser.id);
      await cleanupUser(conciergeId);
    }
  });
});
