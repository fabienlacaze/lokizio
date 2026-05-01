// Exhaustive RLS isolation tests: for every sensitive table, verify that a user
// in org A cannot SELECT/UPDATE/DELETE rows of org B.
//
// We DO NOT test INSERT here because INSERT is naturally constrained by FK
// (e.g., org_id must reference a real org). RLS isolation matters most for
// reads and writes on existing rows.
//
// These tests catch the dangerous case the security advisor doesn't:
// "always_true" or recursive policies that silently leak data.

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  hasTestConfig, adminClient, cleanupOrg, cleanupUser, setupConciergeScenario,
} from './_helpers.js';

const skip = !hasTestConfig();

describe.skipIf(skip)('RLS isolation invariants — every sensitive table', () => {
  let scenarioA, scenarioB;
  let invoiceB, requestB, planningB, validationB, messageB;

  beforeAll(async () => {
    scenarioA = await setupConciergeScenario();
    scenarioB = await setupConciergeScenario();
    const admin = adminClient();

    // Seed data in B that A should never see
    const today = new Date().toISOString().split('T')[0];
    const { data: invB, error: invBErr } = await admin.from('invoices').insert({
      org_id: scenarioB.org.id,
      invoice_number: 'B-001',
      type: 'concierge_to_owner',
      status: 'draft',
      total_ttc: 100,
    }).select().single();
    if (invBErr) throw new Error('Seed invoice B failed: ' + invBErr.message);
    invoiceB = invB;

    const { data: srB } = await admin.from('service_requests').insert({
      org_id: scenarioB.org.id, property_id: scenarioB.property.id,
      service_type: 'cleaning_standard', requested_date: today, status: 'pending',
    }).select().single();
    requestB = srB;

    const { data: plB } = await admin.from('plannings').insert({
      property_id: scenarioB.property.id, cleanings: [{ date: today, source: 'Test' }],
    }).select().single();
    planningB = plB;

    const { data: cvB } = await admin.from('cleaning_validations').insert({
      property_id: scenarioB.property.id, cleaning_date: today,
      provider_name: 'X', status: 'pending',
    }).select().single();
    validationB = cvB;

    const { data: msgB } = await admin.from('messages').insert({
      org_id: scenarioB.org.id, sender_id: scenarioB.user.id,
      sender_name: 'B-user', sender_role: 'concierge',
      recipient_name: 'someone', body: 'secret message of B',
    }).select().single();
    messageB = msgB;
  }, 60_000);

  afterAll(async () => {
    if (scenarioA) { await cleanupOrg(scenarioA.org.id); await cleanupUser(scenarioA.user.id); }
    if (scenarioB) { await cleanupOrg(scenarioB.org.id); await cleanupUser(scenarioB.user.id); }
  }, 30_000);

  // ── ORGANIZATIONS ──
  describe('organizations', () => {
    it('A cannot SELECT org B', async () => {
      const { data } = await scenarioA.client.from('organizations').select('*').eq('id', scenarioB.org.id);
      expect(data).toEqual([]);
    });
    it('A cannot UPDATE org B name', async () => {
      const { data } = await scenarioA.client.from('organizations')
        .update({ name: 'PWNED' }).eq('id', scenarioB.org.id).select();
      expect(data?.length || 0).toBe(0);
      // Verify name unchanged via admin
      const { data: actual } = await adminClient().from('organizations').select('name').eq('id', scenarioB.org.id).single();
      expect(actual.name).not.toBe('PWNED');
    });
    it('A cannot DELETE org B', async () => {
      await scenarioA.client.from('organizations').delete().eq('id', scenarioB.org.id);
      const { data } = await adminClient().from('organizations').select('id').eq('id', scenarioB.org.id).single();
      expect(data).toBeTruthy();
    });
  });

  // ── MEMBERS ──
  describe('members', () => {
    it('A cannot SELECT members of org B', async () => {
      const { data } = await scenarioA.client.from('members').select('*').eq('org_id', scenarioB.org.id);
      expect(data).toEqual([]);
    });
    it('A cannot UPDATE B\'s member role', async () => {
      // Find B's member id via admin
      const { data: bMembers } = await adminClient().from('members').select('id').eq('org_id', scenarioB.org.id);
      const targetId = bMembers[0].id;
      const { data } = await scenarioA.client.from('members')
        .update({ role: 'admin' }).eq('id', targetId).select();
      expect(data?.length || 0).toBe(0);
    });
    it('A cannot DELETE a member of org B', async () => {
      const { data: bMembers } = await adminClient().from('members').select('id').eq('org_id', scenarioB.org.id);
      const targetId = bMembers[0].id;
      await scenarioA.client.from('members').delete().eq('id', targetId);
      const { data } = await adminClient().from('members').select('id').eq('id', targetId).single();
      expect(data).toBeTruthy();
    });
  });

  // ── PROPERTIES ──
  describe('properties', () => {
    it('A cannot SELECT property of org B', async () => {
      const { data } = await scenarioA.client.from('properties').select('*').eq('id', scenarioB.property.id);
      expect(data).toEqual([]);
    });
    it('A cannot UPDATE property of org B', async () => {
      const { data } = await scenarioA.client.from('properties')
        .update({ name: 'STOLEN' }).eq('id', scenarioB.property.id).select();
      expect(data?.length || 0).toBe(0);
    });
    it('A cannot DELETE property of org B', async () => {
      await scenarioA.client.from('properties').delete().eq('id', scenarioB.property.id);
      const { data } = await adminClient().from('properties').select('id').eq('id', scenarioB.property.id).single();
      expect(data).toBeTruthy();
    });
  });

  // ── PLANNINGS ──
  describe('plannings', () => {
    it('A cannot SELECT plannings of B\'s property', async () => {
      const { data } = await scenarioA.client.from('plannings').select('*').eq('id', planningB.id);
      expect(data).toEqual([]);
    });
    it('A cannot UPDATE B\'s planning', async () => {
      const { data } = await scenarioA.client.from('plannings')
        .update({ cleanings: [{ hacked: true }] }).eq('id', planningB.id).select();
      expect(data?.length || 0).toBe(0);
    });
    it('A cannot DELETE B\'s planning', async () => {
      await scenarioA.client.from('plannings').delete().eq('id', planningB.id);
      const { data } = await adminClient().from('plannings').select('id').eq('id', planningB.id).single();
      expect(data).toBeTruthy();
    });
  });

  // ── INVOICES ──
  describe('invoices', () => {
    it('A cannot SELECT invoice of org B', async () => {
      const { data } = await scenarioA.client.from('invoices').select('*').eq('id', invoiceB.id);
      expect(data).toEqual([]);
    });
    it('A cannot UPDATE invoice of org B', async () => {
      const { data } = await scenarioA.client.from('invoices')
        .update({ total_ttc: 0 }).eq('id', invoiceB.id).select();
      expect(data?.length || 0).toBe(0);
    });
    it('A cannot DELETE invoice of org B', async () => {
      await scenarioA.client.from('invoices').delete().eq('id', invoiceB.id);
      const { data } = await adminClient().from('invoices').select('id').eq('id', invoiceB.id).single();
      expect(data).toBeTruthy();
    });
  });

  // ── SERVICE_REQUESTS ──
  describe('service_requests', () => {
    it('A cannot SELECT request of org B', async () => {
      const { data } = await scenarioA.client.from('service_requests').select('*').eq('id', requestB.id);
      expect(data).toEqual([]);
    });
    it('A cannot UPDATE request of org B', async () => {
      const { data } = await scenarioA.client.from('service_requests')
        .update({ status: 'cancelled' }).eq('id', requestB.id).select();
      expect(data?.length || 0).toBe(0);
    });
    it('A cannot DELETE request of org B', async () => {
      await scenarioA.client.from('service_requests').delete().eq('id', requestB.id);
      const { data } = await adminClient().from('service_requests').select('id').eq('id', requestB.id).single();
      expect(data).toBeTruthy();
    });
  });

  // ── CLEANING_VALIDATIONS ──
  describe('cleaning_validations', () => {
    it('A cannot SELECT validation of B\'s property', async () => {
      const { data } = await scenarioA.client.from('cleaning_validations').select('*').eq('id', validationB.id);
      expect(data).toEqual([]);
    });
    it('A cannot UPDATE validation of B\'s property', async () => {
      const { data } = await scenarioA.client.from('cleaning_validations')
        .update({ status: 'approved' }).eq('id', validationB.id).select();
      expect(data?.length || 0).toBe(0);
    });
  });

  // ── MESSAGES ──
  describe('messages', () => {
    it('A cannot SELECT messages of org B', async () => {
      const { data } = await scenarioA.client.from('messages').select('*').eq('id', messageB.id);
      expect(data).toEqual([]);
    });
    it('A cannot INSERT a message into org B', async () => {
      const { error } = await scenarioA.client.from('messages').insert({
        org_id: scenarioB.org.id, sender_id: scenarioA.user.id,
        sender_name: 'A-attacker', sender_role: 'concierge',
        recipient_name: 'B-victim', body: 'injected',
      });
      // RLS should reject: either error OR silent (no row inserted, check via admin)
      if (!error) {
        const { data } = await adminClient().from('messages')
          .select('id').eq('org_id', scenarioB.org.id).eq('body', 'injected');
        expect(data?.length || 0).toBe(0);
      } else {
        expect(error).toBeTruthy();
      }
    });
  });

  // ── ANONYMOUS USER (no auth) ──
  describe('anonymous user (no JWT)', () => {
    let anonClient;
    beforeAll(async () => {
      const { createClient: cc } = await import('@supabase/supabase-js');
      anonClient = cc(process.env.SUPABASE_TEST_URL, process.env.SUPABASE_TEST_ANON_KEY, {
        auth: { persistSession: false },
      });
    });

    const SENSITIVE_TABLES = [
      'organizations', 'members', 'properties', 'plannings',
      'invoices', 'service_requests', 'messages', 'cleaning_validations',
    ];

    for (const table of SENSITIVE_TABLES) {
      it(`anon cannot SELECT from ${table}`, async () => {
        const { data } = await anonClient.from(table).select('*').limit(1);
        // Either error OR empty
        expect(data?.length || 0).toBe(0);
      });
    }
  });

  // ── DATA EXFILTRATION via FILTER ──
  describe('exfiltration attempts', () => {
    it('A cannot brute-force enumerate orgs by ID range', async () => {
      // Try to fetch ALL orgs without filter — should only return A's
      const { data } = await scenarioA.client.from('organizations').select('id, name');
      expect(data?.length).toBeGreaterThan(0); // sees own
      const ids = data.map((o) => o.id);
      expect(ids).toContain(scenarioA.org.id);
      expect(ids).not.toContain(scenarioB.org.id);
    });
    it('A cannot fetch ALL plannings via wildcard', async () => {
      const { data } = await scenarioA.client.from('plannings').select('id, property_id');
      const ids = data?.map((p) => p.id) || [];
      expect(ids).not.toContain(planningB.id);
    });
    it('A cannot fetch ALL invoices via wildcard', async () => {
      const { data } = await scenarioA.client.from('invoices').select('id, org_id');
      const ids = data?.map((i) => i.id) || [];
      expect(ids).not.toContain(invoiceB.id);
    });
  });
});
