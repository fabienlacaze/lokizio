// Integration tests: verify the tenant chat data leak fix.
// Tenant should only see messages linked to their reservation/property
// OR messages explicitly addressed to them OR messages they sent themselves.

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  hasTestConfig, adminClient, createTestUser, createTestOrg,
  cleanupOrg, cleanupUser, setupConciergeScenario,
} from './_helpers.js';

const skip = !hasTestConfig();

describe.skipIf(skip)('Tenant chat isolation (data leak fix)', () => {
  let concierge, tenantA, tenantB, orgId, propertyId;
  let reservationA, reservationB;

  beforeAll(async () => {
    concierge = await setupConciergeScenario();
    orgId = concierge.org.id;
    propertyId = concierge.property.id;

    // Create 2 tenants and attach them to DIFFERENT reservations on the same property
    tenantA = await createTestUser('tenantA');
    tenantB = await createTestUser('tenantB');

    const admin = adminClient();
    await admin.from('members').insert([
      { org_id: orgId, user_id: tenantA.user.id, role: 'tenant', accepted: true, invited_email: 'a@t.local' },
      { org_id: orgId, user_id: tenantB.user.id, role: 'tenant', accepted: true, invited_email: 'b@t.local' },
    ]);

    // Two different properties
    const { data: propB } = await admin.from('properties').insert({
      org_id: orgId, name: 'Villa B', address: 'Somewhere',
    }).select().single();

    const today = new Date().toISOString().split('T')[0];
    const later = new Date(Date.now() + 10 * 86400000).toISOString().split('T')[0];
    const { data: resA } = await admin.from('reservations').insert({
      org_id: orgId, property_id: propertyId, tenant_user_id: tenantA.user.id,
      start_date: today, end_date: later, status: 'active',
    }).select().single();
    reservationA = resA;

    const { data: resB } = await admin.from('reservations').insert({
      org_id: orgId, property_id: propB.id, tenant_user_id: tenantB.user.id,
      start_date: today, end_date: later, status: 'active',
    }).select().single();
    reservationB = resB;

    // Concierge sends messages: one to A, one to B, one generic (no tag)
    await admin.from('messages').insert([
      {
        org_id: orgId, sender_id: concierge.user.id, sender_role: 'concierge',
        body: 'Message pour tenant A', property_id: propertyId,
        reservation_id: resA.id, recipient_user_id: tenantA.user.id,
      },
      {
        org_id: orgId, sender_id: concierge.user.id, sender_role: 'concierge',
        body: 'Message pour tenant B', property_id: propB.id,
        reservation_id: resB.id, recipient_user_id: tenantB.user.id,
      },
      {
        org_id: orgId, sender_id: concierge.user.id, sender_role: 'concierge',
        body: 'Message interne (pas de tenant)', property_id: null,
        reservation_id: null, recipient_user_id: null,
      },
    ]);
  }, 90_000);

  afterAll(async () => {
    if (orgId) await cleanupOrg(orgId);
    if (concierge) await cleanupUser(concierge.user.id);
    if (tenantA) await cleanupUser(tenantA.user.id);
    if (tenantB) await cleanupUser(tenantB.user.id);
  }, 30_000);

  it('tenantA sees their own message (via reservation_id)', async () => {
    const { data, error } = await tenantA.client.from('messages').select('*').eq('org_id', orgId);
    expect(error).toBeNull();
    const bodies = data.map(m => m.body);
    expect(bodies).toContain('Message pour tenant A');
  });

  it('tenantA does NOT see tenantB messages (fuite corrigee)', async () => {
    const { data } = await tenantA.client.from('messages').select('*').eq('org_id', orgId);
    const bodies = data.map(m => m.body);
    expect(bodies).not.toContain('Message pour tenant B');
  });

  it('tenantA does NOT see the generic internal message', async () => {
    const { data } = await tenantA.client.from('messages').select('*').eq('org_id', orgId);
    const bodies = data.map(m => m.body);
    expect(bodies).not.toContain('Message interne (pas de tenant)');
  });

  it('concierge sees ALL messages of the org', async () => {
    const { data, error } = await concierge.client.from('messages').select('*').eq('org_id', orgId);
    expect(error).toBeNull();
    expect(data.length).toBeGreaterThanOrEqual(3);
  });

  it('tenantA can post a message with their reservation tagged', async () => {
    const { data, error } = await tenantA.client.from('messages').insert({
      org_id: orgId, sender_id: tenantA.user.id, sender_role: 'tenant',
      body: 'Bonjour conciergerie', reservation_id: reservationA.id, property_id: propertyId,
    }).select();
    expect(error).toBeNull();
    expect(data?.[0]?.body).toBe('Bonjour conciergerie');
  });
});
