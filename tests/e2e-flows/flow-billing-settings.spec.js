// Auto-billing settings integration.
import { test, expect, seedUser, cleanupUser, hasTestEnv, adminClient } from './_helpers.js';

test.skip(!hasTestEnv(), '.env.test missing');

test.describe('Auto-billing settings', () => {
  let ctx = null;
  test.afterEach(async () => { if (ctx?.userId) await cleanupUser(ctx.userId); ctx = null; });

  test('billing_settings row can be created for concierge role', async () => {
    const { user, email } = await seedUser('billing');
    ctx = { userId: user.id };
    const admin = adminClient();
    const { data: org } = await admin.from('organizations').insert({
      name: 'BillOrg-' + Date.now(), plan: 'business', onboarding_completed: true,
    }).select().single();
    await admin.from('members').insert({
      org_id: org.id, user_id: user.id, role: 'concierge',
      accepted: true, invited_email: email, display_name: 'Concierge',
    });

    const { data: settings, error } = await admin.from('billing_settings').insert({
      org_id: org.id, role: 'concierge', auto_enabled: true,
      period: 'previous_month', billing_day: 1,
      vat_rate: 20, vat_exempt: false,
      types_enabled: { concierge_to_owner: true, provider_to_concierge: false },
    }).select().single();
    expect(error).toBeNull();
    expect(Number(settings.vat_rate)).toBe(20);
    expect(settings.auto_enabled).toBe(true);
  });

  test('vat_exempt setting persists correctly', async () => {
    const { user, email } = await seedUser('billvat');
    ctx = { userId: user.id };
    const admin = adminClient();
    const { data: org } = await admin.from('organizations').insert({
      name: 'BVOrg-' + Date.now(), plan: 'business', onboarding_completed: true,
    }).select().single();
    await admin.from('members').insert({
      org_id: org.id, user_id: user.id, role: 'concierge',
      accepted: true, invited_email: email, display_name: 'C',
    });
    const { data: s, error } = await admin.from('billing_settings').insert({
      org_id: org.id, role: 'concierge', auto_enabled: false,
      vat_exempt: true, types_enabled: {},
    }).select().single();
    expect(error).toBeNull();
    expect(s.vat_exempt).toBe(true);
    expect(s.auto_enabled).toBe(false);
  });

  test('provider-role billing_settings per user (not org-bound)', async () => {
    const { user, email } = await seedUser('billprov');
    ctx = { userId: user.id };
    const admin = adminClient();
    // Provider-role settings use user_id, not org_id
    const { data, error } = await admin.from('billing_settings').insert({
      user_id: user.id, role: 'provider', auto_enabled: true,
      period: 'current_month', vat_rate: 10, types_enabled: { provider_to_concierge: true },
    }).select().single();
    expect(error).toBeNull();
    expect(data.role).toBe('provider');
  });

  test('invalid period rejected', async () => {
    const admin = adminClient();
    const { error } = await admin.from('billing_settings').insert({
      user_id: '00000000-0000-0000-0000-000000000000',
      role: 'provider', period: 'quarterly', vat_rate: 0,
    });
    expect(error).not.toBeNull();
  });

  test('billing_runs entry trace auto-bill executions', async () => {
    const { user, email } = await seedUser('runs');
    ctx = { userId: user.id };
    const admin = adminClient();
    const { data: org } = await admin.from('organizations').insert({
      name: 'RunsOrg-' + Date.now(), plan: 'business', onboarding_completed: true,
    }).select().single();
    await admin.from('members').insert({
      org_id: org.id, user_id: user.id, role: 'concierge',
      accepted: true, invited_email: email, display_name: 'C',
    });
    const { error } = await admin.from('billing_runs').insert({
      org_id: org.id, period_start: '2026-04-01', period_end: '2026-04-30',
      invoice_type: 'concierge_to_owner', client_key: 'test-client',
    });
    expect(error).toBeNull();
  });
});
