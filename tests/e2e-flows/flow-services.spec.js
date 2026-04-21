// Service requests (prestations) lifecycle.
import { test, expect, seedUser, loginUI, cleanupUser, hasTestEnv, adminClient } from './_helpers.js';

test.skip(!hasTestEnv(), '.env.test missing');

async function seedConciergeWithServices() {
  const { user, email, password } = await seedUser('svc');
  const admin = adminClient();
  const { data: org } = await admin.from('organizations').insert({
    name: 'SvcOrg-' + Date.now(), plan: 'business', onboarding_completed: true,
  }).select().single();
  await admin.from('members').insert({
    org_id: org.id, user_id: user.id, role: 'concierge',
    accepted: true, invited_email: email, display_name: 'Concierge',
  });
  const { data: prop } = await admin.from('properties').insert({
    org_id: org.id, name: 'Maison Svc', address: 'Addr',
  }).select().single();
  const today = new Date().toISOString().split('T')[0];
  const { data: sr } = await admin.from('service_requests').insert([
    { org_id: org.id, property_id: prop.id, service_type: 'cleaning_standard', requested_date: today, status: 'pending' },
    { org_id: org.id, property_id: prop.id, service_type: 'windows', requested_date: today, status: 'done' },
    { org_id: org.id, property_id: prop.id, service_type: 'laundry', requested_date: today, status: 'assigned' },
  ]).select();
  return { userId: user.id, email, password, org, property: prop, services: sr };
}

test.describe('Service requests (prestations)', () => {
  let ctx = null;
  test.afterEach(async () => { if (ctx?.userId) await cleanupUser(ctx.userId); ctx = null; });

  test('prestations tab shows seeded services', async ({ page }) => {
    ctx = await seedConciergeWithServices();
    await loginUI(page, ctx.email, ctx.password);
    await page.waitForTimeout(1000);
    await page.click('#nav_prestations');
    await page.waitForTimeout(2000);
    // At least the property name should be visible (each service card links to its property)
    expect(await page.getByText('Maison Svc').count()).toBeGreaterThan(0);
  });

  test('only current org services are visible (RLS)', async ({ page }) => {
    ctx = await seedConciergeWithServices();
    // Create another org with its own services; they should NOT be visible
    const admin = adminClient();
    const { data: otherOrg } = await admin.from('organizations').insert({
      name: 'OtherOrg-' + Date.now(), plan: 'free', onboarding_completed: true,
    }).select().single();
    const { data: otherProp } = await admin.from('properties').insert({
      org_id: otherOrg.id, name: 'HiddenProp', address: 'Nope',
    }).select().single();
    await admin.from('service_requests').insert({
      org_id: otherOrg.id, property_id: otherProp.id, service_type: 'cleaning_standard',
      requested_date: new Date().toISOString().split('T')[0], status: 'pending',
    });

    await loginUI(page, ctx.email, ctx.password);
    await page.waitForTimeout(1000);
    await page.click('#nav_prestations');
    await page.waitForTimeout(2000);

    expect(await page.getByText('HiddenProp').count()).toBe(0);

    await admin.from('organizations').delete().eq('id', otherOrg.id);
  });
});
