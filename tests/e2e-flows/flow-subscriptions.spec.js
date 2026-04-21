// Subscription + plan limits + referral codes.
import { test, expect, seedUser, loginUI, cleanupUser, hasTestEnv, adminClient } from './_helpers.js';

test.skip(!hasTestEnv(), '.env.test missing');

async function seedWithPlan(plan = 'free') {
  const { user, email, password } = await seedUser('plan-' + plan);
  const admin = adminClient();
  const { data: org } = await admin.from('organizations').insert({
    name: 'PlanOrg-' + plan + '-' + Date.now(), plan, onboarding_completed: true,
  }).select().single();
  await admin.from('members').insert({
    org_id: org.id, user_id: user.id, role: 'concierge',
    accepted: true, invited_email: email, display_name: 'Concierge',
  });
  await admin.from('subscriptions').upsert({
    user_id: user.id, plan, current_period_end: new Date(Date.now() + 30 * 86400000).toISOString(),
  });
  return { userId: user.id, email, password, org };
}

test.describe('Plans & subscriptions', () => {
  let ctx = null;
  test.afterEach(async () => { if (ctx?.userId) await cleanupUser(ctx.userId); ctx = null; });

  test('free plan user logs in and sees app', async ({ page }) => {
    ctx = await seedWithPlan('free');
    await loginUI(page, ctx.email, ctx.password);
    await page.waitForTimeout(1500);
    await expect(page.locator('#nav_properties')).toBeVisible();
  });

  test('business plan user logs in and sees app', async ({ page }) => {
    ctx = await seedWithPlan('business');
    await loginUI(page, ctx.email, ctx.password);
    await page.waitForTimeout(1500);
    await expect(page.locator('#nav_properties')).toBeVisible();
  });

  test('subscription row exists after plan assignment', async () => {
    ctx = await seedWithPlan('premium');
    const admin = adminClient();
    const { data } = await admin.from('subscriptions').select('*').eq('user_id', ctx.userId).single();
    expect(data).toBeTruthy();
    expect(data.plan).toBe('premium');
  });

  test('invalid plan is rejected by CHECK constraint', async () => {
    const admin = adminClient();
    const { error } = await admin.from('organizations').insert({
      name: 'BadPlan-' + Date.now(), plan: 'enterprise-ultra', onboarding_completed: true,
    });
    expect(error).not.toBeNull();
  });

  test('referral code is unique', async () => {
    const admin = adminClient();
    const code = 'TESTREF' + Date.now();
    const { data: org1 } = await admin.from('organizations').insert({
      name: 'Ref1-' + Date.now(), plan: 'free', referral_code: code, onboarding_completed: true,
    }).select().single();

    const { error } = await admin.from('organizations').insert({
      name: 'Ref2-' + Date.now(), plan: 'free', referral_code: code, onboarding_completed: true,
    });
    expect(error).not.toBeNull();
    await admin.from('organizations').delete().eq('id', org1.id);
  });
});
