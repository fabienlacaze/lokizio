// Property CRUD via UI.
import { test, expect, seedUser, loginUI, cleanupUser, hasTestEnv, adminClient } from './_helpers.js';

test.skip(!hasTestEnv(), '.env.test missing');

async function seedConciergeWithProperty(nameOverride) {
  const { user, email, password } = await seedUser('prop');
  const admin = adminClient();
  const { data: org } = await admin.from('organizations').insert({
    name: 'PropOrg-' + Date.now(), plan: 'business', onboarding_completed: true,
  }).select().single();
  await admin.from('members').insert({
    org_id: org.id, user_id: user.id, role: 'concierge',
    accepted: true, invited_email: email, display_name: 'Concierge',
  });
  const { data: prop } = await admin.from('properties').insert({
    org_id: org.id, name: nameOverride || 'Villa Prop Test', address: '10 rue Paris 75015',
  }).select().single();
  return { userId: user.id, email, password, org, property: prop };
}

test.describe('Properties', () => {
  let ctx = null;

  test.afterEach(async () => {
    if (ctx?.userId) await cleanupUser(ctx.userId);
    ctx = null;
  });

  test('properties tab renders the property in list', async ({ page }) => {
    ctx = await seedConciergeWithProperty('Maison Alpha');
    await loginUI(page, ctx.email, ctx.password);
    await page.waitForTimeout(1000);
    await page.click('#nav_properties');
    await page.waitForTimeout(1500);
    const count = await page.getByText('Maison Alpha').count();
    expect(count).toBeGreaterThan(0);
  });

  test('multiple properties all show up', async ({ page }) => {
    ctx = await seedConciergeWithProperty('Prop1');
    const admin = adminClient();
    await admin.from('properties').insert([
      { org_id: ctx.org.id, name: 'Prop2', address: 'Addr2' },
      { org_id: ctx.org.id, name: 'Prop3', address: 'Addr3' },
    ]);
    await loginUI(page, ctx.email, ctx.password);
    await page.waitForTimeout(1000);
    await page.click('#nav_properties');
    await page.waitForTimeout(1500);
    expect(await page.getByText('Prop1').count()).toBeGreaterThan(0);
    expect(await page.getByText('Prop2').count()).toBeGreaterThan(0);
    expect(await page.getByText('Prop3').count()).toBeGreaterThan(0);
  });

  test('property deletion via admin is reflected after reload', async ({ page }) => {
    ctx = await seedConciergeWithProperty('ToDelete');
    const admin = adminClient();
    await admin.from('properties').delete().eq('id', ctx.property.id);
    await loginUI(page, ctx.email, ctx.password);
    await page.waitForTimeout(1000);
    await page.click('#nav_properties');
    await page.waitForTimeout(1500);
    expect(await page.getByText('ToDelete').count()).toBe(0);
  });

  test('property with address shows address text', async ({ page }) => {
    ctx = await seedConciergeWithProperty('AddrTest');
    await loginUI(page, ctx.email, ctx.password);
    await page.waitForTimeout(1000);
    await page.click('#nav_properties');
    await page.waitForTimeout(1500);
    const addressCount = await page.getByText('75015').count();
    expect(addressCount).toBeGreaterThan(0);
  });
});
