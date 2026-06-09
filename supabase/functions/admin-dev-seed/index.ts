// Edge Function: admin-dev-seed
//
// Super-admin only. Lets Fabien populate his org with synthetic data for
// testing (properties, invoices, plannings, etc.) without having to manually
// click through the UI. Or reset his org back to a clean state.
//
// Body: { action: 'seed_full' | 'seed_invoices' | 'seed_plannings' | 'reset_my_org' | 'reset_demo_org' }
// Auth: Bearer JWT (must be super_admin)
// Returns: { action, created_counts | reset: true, took_ms }

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, requireAuth } from '../_shared/cors.ts';
import { audit } from '../_shared/security.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const VALID_ACTIONS = ['seed_full', 'seed_invoices', 'seed_plannings', 'reset_my_org'];

interface SeedCounts {
  properties: number;
  invoices: number;
  plannings: number;
  cleanings: number;
}

function randomPick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function fakeName() {
  return randomPick(['Marie', 'Pierre', 'Sophie', 'Jean', 'Lucie', 'Marc', 'Camille', 'Paul', 'Julie', 'Antoine']) + ' ' +
    randomPick(['Dupont', 'Martin', 'Dubois', 'Leclerc', 'Bernard', 'Robert', 'Petit', 'Durand']);
}

function fakeAddress() {
  const num = Math.floor(Math.random() * 200) + 1;
  const streets = ['rue de la Paix', 'avenue des Champs', 'boulevard Saint-Germain', 'rue Victor Hugo', 'place du Marche'];
  const cities = [{ p: '75001', c: 'Paris' }, { p: '69001', c: 'Lyon' }, { p: '13001', c: 'Marseille' }, { p: '33000', c: 'Bordeaux' }];
  const city = randomPick(cities);
  return `${num} ${randomPick(streets)}, ${city.p} ${city.c}`;
}

Deno.serve(async (req) => {
  const cors = corsHeaders(req);
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  try {
    const { userId } = await requireAuth(req, SUPABASE_URL, SUPABASE_ANON_KEY);
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Verify super_admin
    const { data: sa, error: saErr } = await admin
      .from('super_admins').select('user_id').eq('user_id', userId).maybeSingle();
    if (saErr) {
      return Response.json({ error: 'Auth lookup failed' }, { status: 500, headers: cors });
    }
    if (!sa) {
      return Response.json({ error: 'Forbidden: super_admin only' }, { status: 403, headers: cors });
    }

    const body = await req.json().catch(() => ({}));
    const action = body.action;
    if (!VALID_ACTIONS.includes(action)) {
      return Response.json({ error: 'Invalid action. Allowed: ' + VALID_ACTIONS.join(', ') }, { status: 400, headers: cors });
    }

    // Determine target org: the super_admin's primary org
    const { data: callerMember } = await admin
      .from('members').select('org_id').eq('user_id', userId).eq('accepted', true).limit(1).maybeSingle();
    if (!callerMember?.org_id) {
      return Response.json({ error: 'Super admin has no accepted org membership' }, { status: 400, headers: cors });
    }
    const orgId = callerMember.org_id;
    const startTs = Date.now();

    if (action === 'reset_my_org') {
      // Hard reset: delete dependent data from the org. Members + org itself preserved.
      // Order matters due to FKs. We use service_role to bypass RLS.
      const tables = ['cleaning_validations', 'invoices', 'plannings', 'service_requests', 'properties'];
      const deleted: Record<string, number> = {};
      for (const t of tables) {
        // Some tables use property_id (need to resolve via properties first)
        if (t === 'cleaning_validations' || t === 'plannings') {
          const { data: props } = await admin.from('properties').select('id').eq('org_id', orgId);
          const propIds = (props || []).map((p: any) => p.id);
          if (propIds.length) {
            const { error } = await admin.from(t).delete().in('property_id', propIds);
            if (!error) deleted[t] = propIds.length;
          }
        } else {
          const { error } = await admin.from(t).delete().eq('org_id', orgId);
          if (!error) deleted[t] = 1; // approximation
        }
      }
      audit({
        user_id: userId, org_id: orgId, action: 'admin.org_reset',
        metadata: { tables: deleted }, severity: 'warning',
      }).catch(() => {});
      return Response.json({ action, reset: true, deleted, took_ms: Date.now() - startTs }, { headers: cors });
    }

    const counts: SeedCounts = { properties: 0, invoices: 0, plannings: 0, cleanings: 0 };

    if (action === 'seed_full' || action === 'seed_plannings') {
      // Create 3 properties
      const props = Array.from({ length: 3 }, (_, i) => ({
        org_id: orgId,
        name: `Bien test ${Date.now() % 10000}-${i + 1}`,
        address: fakeAddress(),
        owner_name: fakeName(),
        owner_email: `owner${i + 1}@example-test.lokizio.local`,
        bedrooms: 2 + i,
        max_guests: 4 + i,
      }));
      const { data: propsInserted, error: propErr } = await admin.from('properties').insert(props).select('id');
      if (!propErr && propsInserted) counts.properties = propsInserted.length;
      const propertyIds = (propsInserted || []).map((p: any) => p.id);

      // Create a planning + cleanings for each property
      const today = new Date();
      for (const propId of propertyIds) {
        const cleanings = [];
        for (let w = 0; w < 4; w++) {
          const d = new Date(today.getTime() + w * 7 * 86400000);
          cleanings.push({
            date: d.toISOString().split('T')[0],
            cleaningDate: d.toISOString().split('T')[0],
            provider: fakeName(),
            source: 'manual',
          });
        }
        const { error } = await admin.from('plannings').upsert({
          property_id: propId,
          cleanings,
        }, { onConflict: 'property_id' });
        if (!error) {
          counts.plannings++;
          counts.cleanings += cleanings.length;
        }
      }
    }

    if (action === 'seed_full' || action === 'seed_invoices') {
      // Create 10 fake invoices, various statuses
      const statuses = ['draft', 'sent', 'paid', 'sent', 'paid', 'sent', 'paid', 'draft', 'sent', 'paid'];
      const invoices = statuses.map((st, i) => {
        const total = Math.round((80 + Math.random() * 200) * 100) / 100;
        return {
          org_id: orgId,
          created_by: userId,
          invoice_number: `FAC-TEST-${Date.now() % 100000}-${(i + 1).toString().padStart(3, '0')}`,
          client_name: fakeName(),
          client_email: `client${i + 1}@example-test.lokizio.local`,
          property_name: `Bien ${i + 1}`,
          issuer_name: 'Mon Entreprise',
          status: st,
          total_ht: total,
          total_ttc: total,
          total_tva: 0,
          items: [{ description: 'Prestation menage standard', quantity: 1, unit_price: total, amount: total }],
          created_at: new Date(Date.now() - i * 86400000).toISOString(),
        };
      });
      const { data, error } = await admin.from('invoices').insert(invoices).select('id');
      if (!error && data) counts.invoices = data.length;
    }

    audit({
      user_id: userId, org_id: orgId, action: 'admin.seed',
      metadata: { action, counts }, severity: 'info',
    }).catch(() => {});

    return Response.json({ action, created_counts: counts, took_ms: Date.now() - startTs }, { headers: cors });
  } catch (e: any) {
    console.error('admin-dev-seed error:', e);
    return Response.json({ error: String(e?.message || e) }, { status: 500, headers: cors });
  }
});
