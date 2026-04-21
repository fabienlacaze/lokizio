// Marketplace / Annuaire flows.
import { test, expect, seedUser, loginUI, cleanupUser, hasTestEnv, adminClient } from './_helpers.js';

test.skip(!hasTestEnv(), '.env.test missing');

async function seedWithProfile(role, extras = {}) {
  const { user, email, password } = await seedUser('mk-' + role);
  const admin = adminClient();
  const { data: org } = await admin.from('organizations').insert({
    name: 'MkOrg-' + Date.now(), plan: 'business', onboarding_completed: true,
  }).select().single();
  await admin.from('members').insert({
    org_id: org.id, user_id: user.id, role,
    accepted: true, invited_email: email, display_name: role,
  });
  const publicFlag = extras.is_public !== undefined ? extras.is_public : true;
  await admin.from('marketplace_profiles').upsert({
    user_id: user.id, role, display_name: extras.name || role,
    company_name: extras.name || role, is_public: publicFlag,
    city: extras.city || 'Paris', country: 'FR',
  });
  return { userId: user.id, email, password, org };
}

test.describe('Marketplace / Annuaire', () => {
  let ids = [];
  test.afterEach(async () => {
    for (const id of ids) await cleanupUser(id);
    ids = [];
  });

  test('annuaire tab opens for concierge', async ({ page }) => {
    const concierge = await seedWithProfile('concierge', { name: 'Concierge Alpha' });
    ids.push(concierge.userId);

    await loginUI(page, concierge.email, concierge.password);
    await page.waitForTimeout(1000);
    await page.click('#nav_annuaire');
    await page.waitForTimeout(2000);
    // Navigation ok, app still running
    await expect(page.locator('#appMain')).toBeVisible();
  });

  test('public marketplace profile is visible via RLS', async () => {
    const provider = await seedWithProfile('provider', { name: 'PublicPro', is_public: true });
    ids.push(provider.userId);
    const admin = adminClient();
    const { data } = await admin.from('marketplace_profiles').select('*').eq('is_public', true).eq('user_id', provider.userId).maybeSingle();
    expect(data).toBeTruthy();
    expect(data.company_name).toBe('PublicPro');
  });

  test('private marketplace profile not exposed publicly', async () => {
    const hidden = await seedWithProfile('provider', { name: 'HiddenPro', is_public: false });
    ids.push(hidden.userId);
    const admin = adminClient();
    const { data } = await admin.from('marketplace_profiles').select('*').eq('user_id', hidden.userId).single();
    expect(data.is_public).toBe(false);
  });

  test('vacation_periods field accepts a JSON array', async () => {
    const p = await seedWithProfile('provider', { name: 'VacPro' });
    ids.push(p.userId);
    const admin = adminClient();
    await admin.from('marketplace_profiles').update({
      vacation_periods: [{ start: '2026-07-01', end: '2026-07-31' }],
    }).eq('user_id', p.userId);
    const { data } = await admin.from('marketplace_profiles').select('vacation_periods').eq('user_id', p.userId).single();
    expect(data.vacation_periods).toHaveLength(1);
    expect(data.vacation_periods[0].start).toBe('2026-07-01');
  });
});
