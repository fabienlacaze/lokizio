// Chat flows: tenant sees filtered messages, concierge sees all.
import { test, expect, seedUser, loginUI, cleanupUser, hasTestEnv, adminClient } from './_helpers.js';

test.skip(!hasTestEnv(), '.env.test missing');

test.describe('Chat messaging', () => {
  let conciergeUserId = null;
  let tenantUserId = null;

  test.afterEach(async () => {
    if (tenantUserId) await cleanupUser(tenantUserId);
    if (conciergeUserId) await cleanupUser(conciergeUserId);
    tenantUserId = conciergeUserId = null;
  });

  async function setupChat() {
    const concierge = await seedUser('chatC');
    conciergeUserId = concierge.user.id;
    const admin = adminClient();
    const { data: org } = await admin.from('organizations').insert({
      name: 'ChatOrg-' + Date.now(), plan: 'business', onboarding_completed: true,
    }).select().single();
    await admin.from('members').insert({
      org_id: org.id, user_id: concierge.user.id, role: 'concierge',
      accepted: true, invited_email: concierge.email, display_name: 'Concierge',
    });
    const tenant = await seedUser('chatT');
    tenantUserId = tenant.user.id;
    await admin.from('members').insert({
      org_id: org.id, user_id: tenant.user.id, role: 'tenant',
      accepted: true, invited_email: tenant.email, display_name: 'Tenant',
    });
    const { data: prop } = await admin.from('properties').insert({
      org_id: org.id, name: 'Maison Chat', address: 'chat',
    }).select().single();
    const today = new Date().toISOString().split('T')[0];
    const later = new Date(Date.now() + 10 * 86400000).toISOString().split('T')[0];
    const { data: resa } = await admin.from('reservations').insert({
      org_id: org.id, property_id: prop.id, tenant_user_id: tenant.user.id,
      start_date: today, end_date: later, status: 'active',
    }).select().single();
    await admin.from('messages').insert([
      { org_id: org.id, sender_id: concierge.user.id, sender_role: 'concierge',
        body: 'Bienvenue dans votre logement', property_id: prop.id,
        reservation_id: resa.id, recipient_user_id: tenant.user.id },
      { org_id: org.id, sender_id: concierge.user.id, sender_role: 'concierge',
        body: 'Note interne: checkout', property_id: null, reservation_id: null },
    ]);
    return { concierge, tenant, org };
  }

  test('tenant sees their reservation message but not internal ones', async ({ page }) => {
    const { tenant } = await setupChat();
    await loginUI(page, tenant.email, tenant.password);
    await page.waitForTimeout(2000);
    await page.click('#nav_chat');
    await page.waitForTimeout(1500);
    // Reservation-tagged message
    expect(await page.getByText('Bienvenue dans votre logement').count()).toBeGreaterThan(0);
    // Internal note should NOT leak
    expect(await page.getByText('Note interne: checkout').count()).toBe(0);
  });

  test('tenant can send a message via the chat input', async ({ page }) => {
    const { tenant } = await setupChat();
    await loginUI(page, tenant.email, tenant.password);
    await page.waitForTimeout(2000);
    await page.click('#nav_chat');
    await page.waitForTimeout(1500);

    const input = page.locator('#tenantChatInput');
    await input.fill('Message test depuis E2E');
    await page.click('button:has-text("Envoyer")');
    await page.waitForTimeout(1500);

    // Should appear in the chat
    expect(await page.getByText('Message test depuis E2E').count()).toBeGreaterThan(0);
  });
});
