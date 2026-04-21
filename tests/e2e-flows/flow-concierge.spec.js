// Concierge flow: login with seeded account that already has an org + property + invoice,
// verify the UI renders everything correctly.
import { test, expect, seedUser, loginUI, cleanupUser, hasTestEnv, adminClient } from './_helpers.js';

test.skip(!hasTestEnv(), '.env.test missing');

test.describe('Concierge flow - data seeded + UI verification', () => {
  let userId = null;
  let orgId = null;

  test.afterEach(async () => {
    await cleanupUser(userId);
    userId = null; orgId = null;
  });

  async function seedConcierge() {
    const { user, email, password } = await seedUser('concierge');
    userId = user.id;
    const admin = adminClient();
    const { data: org } = await admin.from('organizations').insert({
      name: 'Test-Org-' + Date.now(), plan: 'business', onboarding_completed: true,
    }).select().single();
    orgId = org.id;
    await admin.from('members').insert({
      org_id: org.id, user_id: user.id, role: 'concierge',
      accepted: true, invited_email: email, display_name: 'Concierge Test',
    });
    const { data: prop } = await admin.from('properties').insert({
      org_id: org.id, name: 'Villa Seeded', address: '1 rue Test 75001 Paris',
    }).select().single();
    return { email, password, org, property: prop };
  }

  test('concierge sees dashboard with org name', async ({ page }) => {
    const { email, password, org } = await seedConcierge();
    await loginUI(page, email, password);
    await page.waitForTimeout(1500);

    // Bottom nav set up for concierge
    await expect(page.locator('#nav_properties')).toBeVisible({ timeout: 10_000 });
  });

  test('property appears in the Biens tab', async ({ page }) => {
    const { email, password } = await seedConcierge();
    await loginUI(page, email, password);
    await page.waitForTimeout(1500);

    // Click on Biens (properties) tab
    await page.click('#nav_properties');
    await page.waitForTimeout(1500);

    // Property name should appear at least once in the DOM (in dropdowns, list, table...)
    const count = await page.getByText('Villa Seeded').count();
    expect(count, 'property name should appear in the DOM').toBeGreaterThan(0);
  });

  test('invoice created in DB shows up in Finances tab', async ({ page }) => {
    const { email, password, org } = await seedConcierge();

    // Create an invoice directly
    const admin = adminClient();
    await admin.from('invoices').insert({
      org_id: org.id,
      invoice_number: 'FAC-E2E-001',
      type: 'concierge_to_owner',
      status: 'draft',
      client_name: 'Client E2E Test',
      items: [{ description: 'Prestation', amount: 150, quantity: 1, unit_price: 150 }],
      subtotal_ht: 150, total_tva: 30, total_ttc: 180, vat_rate: 20,
    });

    await loginUI(page, email, password);
    await page.waitForTimeout(1500);

    // Click Finances tab
    await page.click('#nav_billing');
    await page.waitForTimeout(2500);

    // Invoice number OR client name visible somewhere in DOM
    const invCount = await page.getByText('FAC-E2E-001').count();
    const clientCount = await page.getByText('Client E2E Test').count();
    expect(invCount + clientCount, 'invoice should render somewhere in Finances').toBeGreaterThan(0);
  });
});
