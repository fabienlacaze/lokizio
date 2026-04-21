// Integration tests for Row Level Security (RLS) policies.
// Requires a lokizio-test Supabase project. See .env.test.example.

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  hasTestConfig, adminClient, createTestUser, createTestOrg,
  cleanupOrg, cleanupUser, setupConciergeScenario,
} from './_helpers.js';

const skip = !hasTestConfig();

describe.skipIf(skip)('RLS - org isolation', () => {
  let scenarioA, scenarioB;

  beforeAll(async () => {
    scenarioA = await setupConciergeScenario();
    scenarioB = await setupConciergeScenario();
  }, 60_000);

  afterAll(async () => {
    if (scenarioA) { await cleanupOrg(scenarioA.org.id); await cleanupUser(scenarioA.user.id); }
    if (scenarioB) { await cleanupOrg(scenarioB.org.id); await cleanupUser(scenarioB.user.id); }
  }, 30_000);

  it('user from org A cannot see properties of org B', async () => {
    const { data, error } = await scenarioA.client.from('properties').select('*').eq('org_id', scenarioB.org.id);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it('user from org A cannot UPDATE properties of org B', async () => {
    const { data, error } = await scenarioA.client.from('properties')
      .update({ name: 'HACKED' }).eq('id', scenarioB.property.id).select();
    // Either error OR empty data (silent RLS filter)
    expect(data?.length || 0).toBe(0);
  });

  it('user from org A cannot DELETE org B', async () => {
    await scenarioA.client.from('organizations').delete().eq('id', scenarioB.org.id);
    const admin = adminClient();
    const { data } = await admin.from('organizations').select('id').eq('id', scenarioB.org.id).single();
    expect(data).toBeTruthy(); // Still exists
  });
});

describe.skipIf(skip)('RLS - service_requests role restrictions', () => {
  let concierge, provider, org, propertyId, requestId;

  beforeAll(async () => {
    const scenario = await setupConciergeScenario();
    concierge = scenario;
    org = scenario.org;
    propertyId = scenario.property.id;

    provider = await createTestUser('provider');
    const admin = adminClient();
    await admin.from('members').insert({
      org_id: org.id, user_id: provider.user.id, role: 'provider',
      accepted: true, invited_email: 'p@test.local', display_name: 'Prov',
    });

    const { data } = await admin.from('service_requests').insert({
      org_id: org.id, property_id: propertyId, service_type: 'cleaning_standard',
      requested_date: new Date().toISOString().split('T')[0], status: 'pending',
      provider_id: provider.user.id,
    }).select().single();
    requestId = data.id;
  }, 60_000);

  afterAll(async () => {
    await cleanupOrg(org.id);
    await cleanupUser(concierge.user.id);
    await cleanupUser(provider.user.id);
  }, 30_000);

  it('concierge can validate a service request (status done)', async () => {
    const { data, error } = await concierge.client.from('service_requests')
      .update({ status: 'done' }).eq('id', requestId).select();
    expect(error).toBeNull();
    expect(data?.[0]?.status).toBe('done');
  });

  it('provider can update ONLY their assigned requests', async () => {
    // Reset then provider updates their own
    const admin = adminClient();
    await admin.from('service_requests').update({ status: 'pending' }).eq('id', requestId);

    const { data, error } = await provider.client.from('service_requests')
      .update({ notes: 'Done by provider' }).eq('id', requestId).select();
    expect(error).toBeNull();
    expect(data?.[0]?.notes).toBe('Done by provider');
  });

  it('provider CANNOT update requests NOT assigned to them', async () => {
    const admin = adminClient();
    const { data: other } = await admin.from('service_requests').insert({
      org_id: org.id, property_id: propertyId, service_type: 'windows',
      requested_date: new Date().toISOString().split('T')[0], status: 'pending',
      provider_id: null,
    }).select().single();

    const { data } = await provider.client.from('service_requests')
      .update({ notes: 'stolen' }).eq('id', other.id).select();
    expect(data?.length || 0).toBe(0); // RLS blocked
  });
});
