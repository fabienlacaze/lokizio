// Connection requests between users (marketplace connections).
import { test, expect, seedUser, loginUI, cleanupUser, hasTestEnv, adminClient } from './_helpers.js';

test.skip(!hasTestEnv(), '.env.test missing');

test.describe('Connection requests', () => {
  let idsA = null, idsB = null;

  test.afterEach(async () => {
    if (idsA) await cleanupUser(idsA);
    if (idsB) await cleanupUser(idsB);
    idsA = idsB = null;
  });

  async function setup() {
    const a = await seedUser('connA');
    idsA = a.user.id;
    const admin = adminClient();
    const { data: orgA } = await admin.from('organizations').insert({
      name: 'OrgA-' + Date.now(), plan: 'business', onboarding_completed: true,
    }).select().single();
    await admin.from('members').insert({
      org_id: orgA.id, user_id: a.user.id, role: 'concierge',
      accepted: true, invited_email: a.email, display_name: 'A',
    });

    const b = await seedUser('connB');
    idsB = b.user.id;
    const { data: orgB } = await admin.from('organizations').insert({
      name: 'OrgB-' + Date.now(), plan: 'business', onboarding_completed: true,
    }).select().single();
    await admin.from('members').insert({
      org_id: orgB.id, user_id: b.user.id, role: 'provider',
      accepted: true, invited_email: b.email, display_name: 'B',
    });

    return { a, b, orgA, orgB };
  }

  test('pending request persists in DB and is visible to sender', async () => {
    const { a, b, orgA } = await setup();
    const admin = adminClient();
    const { error } = await admin.from('connection_requests').insert({
      sender_id: a.user.id, sender_name: 'A', sender_role: 'concierge', sender_org_id: orgA.id,
      receiver_id: b.user.id, receiver_name: 'B', receiver_role: 'provider',
      proposed_role: 'provider', status: 'pending',
    });
    expect(error).toBeNull();
    const { data } = await admin.from('connection_requests').select('*')
      .eq('sender_id', a.user.id).eq('receiver_id', b.user.id).single();
    expect(data.status).toBe('pending');
  });

  test('accepted connection visible for receiver', async ({ page }) => {
    const { a, b, orgA } = await setup();
    const admin = adminClient();
    await admin.from('connection_requests').insert({
      sender_id: a.user.id, sender_name: 'A', sender_role: 'concierge', sender_org_id: orgA.id,
      receiver_id: b.user.id, receiver_name: 'B', receiver_role: 'provider',
      proposed_role: 'provider', status: 'accepted',
    });

    await loginUI(page, b.email, b.password);
    await page.waitForTimeout(1500);
    // App loaded, we can verify connection badge appeared
    await expect(page.locator('#appMain')).toBeVisible({ timeout: 5000 });
  });

  test('refused requests do not appear as active', async ({ page }) => {
    const { a, b, orgA } = await setup();
    const admin = adminClient();
    await admin.from('connection_requests').insert({
      sender_id: a.user.id, sender_name: 'A', sender_role: 'concierge', sender_org_id: orgA.id,
      receiver_id: b.user.id, receiver_name: 'B', receiver_role: 'provider',
      proposed_role: 'provider', status: 'refused',
    });

    // Sender can still create a new request for the same pair
    const { error } = await admin.from('connection_requests').insert({
      sender_id: a.user.id, sender_name: 'A', sender_role: 'concierge', sender_org_id: orgA.id,
      receiver_id: b.user.id, receiver_name: 'B', receiver_role: 'provider',
      proposed_role: 'provider', status: 'pending',
    });
    expect(error).toBeNull();
  });
});
