// Integration tests: invoices CRUD + TVA calculation at DB level.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  hasTestConfig, adminClient, setupConciergeScenario, cleanupOrg, cleanupUser,
} from './_helpers.js';

const skip = !hasTestConfig();

describe.skipIf(skip)('Invoices CRUD + TVA', () => {
  let scenario;

  beforeAll(async () => {
    scenario = await setupConciergeScenario();
  }, 60_000);

  afterAll(async () => {
    if (scenario) {
      await cleanupOrg(scenario.org.id);
      await cleanupUser(scenario.user.id);
    }
  }, 30_000);

  it('creates an invoice with VAT fields', async () => {
    const { data, error } = await scenario.client.from('invoices').insert({
      org_id: scenario.org.id,
      invoice_number: 'FAC-2026-0001',
      type: 'concierge_to_owner',
      status: 'draft',
      client_name: 'Client Test',
      items: [{ description: 'Menage', amount: 100, quantity: 1, unit_price: 100 }],
      subtotal_ht: 100,
      total_tva: 20,
      total_ttc: 120,
      vat_rate: 20,
    }).select().single();

    expect(error).toBeNull();
    expect(data.total_ttc).toBe(120);
    expect(data.total_tva).toBe(20);
    expect(data.vat_rate).toBe(20);
  });

  it('can list own org invoices', async () => {
    const { data, error } = await scenario.client.from('invoices').select('*').eq('org_id', scenario.org.id);
    expect(error).toBeNull();
    expect(data.length).toBeGreaterThan(0);
  });

  it('enforces status CHECK constraint', async () => {
    const { error } = await scenario.client.from('invoices').insert({
      org_id: scenario.org.id,
      invoice_number: 'FAC-BAD',
      status: 'WRONG_STATUS', // not in allowed list
      client_name: 'X',
      items: [], subtotal_ht: 0, total_ttc: 0,
    });
    expect(error).not.toBeNull();
  });

  it('enforces type CHECK constraint', async () => {
    const { error } = await scenario.client.from('invoices').insert({
      org_id: scenario.org.id,
      invoice_number: 'FAC-BAD2',
      type: 'invalid_type',
      status: 'draft',
      client_name: 'X',
      items: [], subtotal_ht: 0, total_ttc: 0,
    });
    expect(error).not.toBeNull();
  });
});
