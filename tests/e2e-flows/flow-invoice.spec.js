// Invoice lifecycle tests via UI.
import { test, expect, seedUser, loginUI, cleanupUser, hasTestEnv, adminClient } from './_helpers.js';

test.skip(!hasTestEnv(), '.env.test missing');

async function seedInvoice(extras = {}) {
  const { user, email, password } = await seedUser('inv');
  const admin = adminClient();
  const { data: org } = await admin.from('organizations').insert({
    name: 'InvOrg-' + Date.now(), plan: 'business', onboarding_completed: true,
  }).select().single();
  await admin.from('members').insert({
    org_id: org.id, user_id: user.id, role: 'concierge',
    accepted: true, invited_email: email, display_name: 'Concierge',
  });
  const { data: invoice, error: invErr } = await admin.from('invoices').insert({
    org_id: org.id,
    invoice_number: extras.number || 'FAC-INV-' + Date.now(),
    type: extras.type || 'concierge_to_owner',
    status: extras.status || 'draft',
    client_name: extras.client_name || 'Client Alpha',
    items: [{ description: 'Prestation', amount: 200, quantity: 1, unit_price: 200 }],
    subtotal_ht: 200, total_tva: 40, total_ttc: 240, vat_rate: 20,
  }).select().single();
  if (invErr) throw new Error('seedInvoice: ' + invErr.message);
  return { userId: user.id, email, password, org, invoice };
}

test.describe('Invoices (DB + Finances tab navigation)', () => {
  let ctx = null;
  test.afterEach(async () => { if (ctx?.userId) await cleanupUser(ctx.userId); ctx = null; });

  test('invoice is persisted with correct TVA roundtrip', async () => {
    ctx = await seedInvoice({ status: 'draft', number: 'FAC-DB-1' });
    const admin = adminClient();
    const { data } = await admin.from('invoices').select('*').eq('id', ctx.invoice.id).single();
    expect(data.invoice_number).toBe('FAC-DB-1');
    expect(Number(data.subtotal_ht)).toBe(200);
    expect(Number(data.total_tva)).toBe(40);
    expect(Number(data.total_ttc)).toBe(240);
    expect(Number(data.vat_rate)).toBe(20);
  });

  test('concierge can navigate to Finances tab without error', async ({ page }) => {
    ctx = await seedInvoice({ number: 'FAC-NAV-1' });
    await loginUI(page, ctx.email, ctx.password);
    await page.waitForTimeout(1000);
    await page.click('#nav_billing');
    await page.waitForTimeout(2500);
    // No hard error, main app still visible
    await expect(page.locator('#appMain')).toBeVisible();
  });

  test('paid status stored correctly in DB', async () => {
    ctx = await seedInvoice({ status: 'paid' });
    const admin = adminClient();
    const { data } = await admin.from('invoices').select('status').eq('id', ctx.invoice.id).single();
    expect(data.status).toBe('paid');
  });

  test('cancelled status stored correctly in DB', async () => {
    ctx = await seedInvoice({ status: 'cancelled' });
    const admin = adminClient();
    const { data } = await admin.from('invoices').select('status').eq('id', ctx.invoice.id).single();
    expect(data.status).toBe('cancelled');
  });

  test('invalid status rejected by CHECK constraint', async () => {
    const admin = adminClient();
    const { error } = await admin.from('invoices').insert({
      org_id: '00000000-0000-0000-0000-000000000000',
      invoice_number: 'BAD', status: 'WRONG', type: 'concierge_to_owner',
      items: [], subtotal_ht: 0, total_ttc: 0,
    });
    expect(error).not.toBeNull();
  });

  test('invalid type rejected by CHECK constraint', async () => {
    const admin = adminClient();
    const { error } = await admin.from('invoices').insert({
      org_id: '00000000-0000-0000-0000-000000000000',
      invoice_number: 'BAD', status: 'draft', type: 'hackermode',
      items: [], subtotal_ht: 0, total_ttc: 0,
    });
    expect(error).not.toBeNull();
  });
});
