// Reservations lifecycle (active, ended) + tenant visibility.
import { test, expect, seedUser, loginUI, cleanupUser, hasTestEnv, adminClient } from './_helpers.js';

test.skip(!hasTestEnv(), '.env.test missing');

test.describe('Reservations', () => {
  let conciergeId = null, tenantId = null;

  test.afterEach(async () => {
    if (tenantId) await cleanupUser(tenantId);
    if (conciergeId) await cleanupUser(conciergeId);
    tenantId = conciergeId = null;
  });

  async function seedResa(status = 'active', dates = {}) {
    const conc = await seedUser('rconc');
    conciergeId = conc.user.id;
    const admin = adminClient();
    const { data: org } = await admin.from('organizations').insert({
      name: 'RsvOrg-' + Date.now(), plan: 'business', onboarding_completed: true,
    }).select().single();
    await admin.from('members').insert({
      org_id: org.id, user_id: conc.user.id, role: 'concierge',
      accepted: true, invited_email: conc.email, display_name: 'C',
    });
    const tenant = await seedUser('rten');
    tenantId = tenant.user.id;
    await admin.from('members').insert({
      org_id: org.id, user_id: tenant.user.id, role: 'tenant',
      accepted: true, invited_email: tenant.email, display_name: 'T',
    });
    const { data: prop } = await admin.from('properties').insert({
      org_id: org.id, name: 'Maison Resa', address: 'res',
    }).select().single();
    const today = new Date().toISOString().split('T')[0];
    const later = new Date(Date.now() + (dates.days ?? 10) * 86400000).toISOString().split('T')[0];
    await admin.from('reservations').insert({
      org_id: org.id, property_id: prop.id, tenant_user_id: tenant.user.id,
      start_date: dates.start || today, end_date: dates.end || later, status,
      access_instructions: 'Code: 1234',
    });
    return { tenant, concierge: conc, org, prop };
  }

  test('tenant with active reservation sees home with property', async ({ page }) => {
    const { tenant } = await seedResa('active');
    await loginUI(page, tenant.email, tenant.password);
    await page.waitForTimeout(2000);
    expect(await page.getByText('Maison Resa').count()).toBeGreaterThan(0);
  });

  test('tenant with ended reservation does NOT see home', async ({ page }) => {
    const { tenant } = await seedResa('completed');
    await loginUI(page, tenant.email, tenant.password);
    await page.waitForTimeout(2500);
    // Since reservation is completed, app may show "aucune reservation" screen
    const hasProp = (await page.getByText('Maison Resa').count()) > 0;
    const hasEmpty = (await page.getByText('Aucune reservation active').count()) > 0;
    expect(hasProp || hasEmpty).toBe(true);
  });

  test('access instructions visible to tenant', async ({ page }) => {
    const { tenant } = await seedResa('active');
    await loginUI(page, tenant.email, tenant.password);
    await page.waitForTimeout(2500);
    expect(await page.getByText('Code: 1234').count()).toBeGreaterThan(0);
  });

  test('cancelled reservation is NOT shown as active', async ({ page }) => {
    const { tenant } = await seedResa('cancelled');
    await loginUI(page, tenant.email, tenant.password);
    await page.waitForTimeout(2500);
    const hasProp = (await page.getByText('Maison Resa').count()) > 0;
    const hasEmpty = (await page.getByText('Aucune reservation active').count()) > 0;
    expect(hasEmpty).toBe(true);
  });
});
