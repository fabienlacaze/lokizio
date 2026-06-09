// Auto-billing Edge Function (multi-role: concierge + provider)
// Called daily by pg_cron. Processes both concierge and provider configs.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const sb = createClient(SUPABASE_URL, SERVICE_KEY);

// isoDate: formate en YYYY-MM-DD en UTC, robuste aux fuseaux horaires.
// Attention: mixer toISOString() avec new Date(year,month,day) (local) pouvait
// decaler d'un jour en zone CET/CEST aux frontieres de mois. On construit en UTC.
function isoDate(d: Date): string { return d.toISOString().split('T')[0]; }

// Calcule les montants TVA selon la configuration de billing_settings.
// - Si vat_exempt (art. 293B) ou pas de taux configure: TTC = HT, TVA = 0.
// - Sinon: HT = sum(items), TVA = HT * rate/100, TTC = HT + TVA.
// items: montants HT. Renvoie { subtotal_ht, total_tva, total_ttc, vat_rate }.
function computeAmounts(items: any[], settings: any): { subtotal_ht: number; total_tva: number; total_ttc: number; vat_rate: number } {
  const subtotal_ht = items.reduce((s: number, i: any) => s + (Number(i.amount) || 0), 0);
  const vatExempt = !!(settings && (settings.vat_exempt || settings.vat_free));
  const rate = vatExempt ? 0 : Number(settings?.vat_rate || 0);
  if (!rate || rate <= 0) {
    return { subtotal_ht, total_tva: 0, total_ttc: subtotal_ht, vat_rate: 0 };
  }
  const total_tva = Math.round(subtotal_ht * rate) / 100;
  return { subtotal_ht, total_tva, total_ttc: subtotal_ht + total_tva, vat_rate: rate };
}

function getPeriod(periodType: string, now: Date): { start: string; end: string } {
  // Utilise UTC partout pour eviter les decalages de fuseau aux frontieres de mois.
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  if (periodType === 'current_month') {
    const s = new Date(Date.UTC(y, m, 1));
    const e = new Date(Date.UTC(y, m + 1, 0));
    return { start: isoDate(s), end: isoDate(e) };
  }
  const s = new Date(Date.UTC(y, m - 1, 1));
  const e = new Date(Date.UTC(y, m, 0));
  return { start: isoDate(s), end: isoDate(e) };
}

async function getNextInvoiceNumber(orgId: string): Promise<string> {
  const { count } = await sb.from('invoices').select('*', { count: 'exact', head: true }).eq('org_id', orgId);
  const n = String((count || 0) + 1).padStart(4, '0');
  return 'FAC-' + new Date().getFullYear() + '-' + n;
}

async function alreadyBilled(orgId: string, start: string, end: string, type: string, clientKey: string): Promise<boolean> {
  const { count } = await sb.from('billing_runs').select('*', { count: 'exact', head: true })
    .eq('org_id', orgId).eq('period_start', start).eq('period_end', end)
    .eq('invoice_type', type).eq('client_key', clientKey);
  return (count || 0) > 0;
}

// ─── Concierge role processing (existing logic) ───
async function processConcierge(org: any, settings: any, now: Date, preview = false) {
  const orgId = org.id;
  const { start, end } = getPeriod(settings.period, now);
  const typesEnabled = settings.types_enabled || {};
  let created = 0;
  const previewInvoices: any[] = [];

  const { data: svcReqs } = await sb.from('service_requests')
    .select('*').eq('org_id', orgId).eq('status', 'done')
    .gte('requested_date', start).lte('requested_date', end);

  const propsData = (await sb.from('properties').select('*').eq('org_id', orgId)).data || [];
  const propIds = propsData.map((p: any) => p.id);
  const propMap: Record<string, any> = {};
  propsData.forEach((p: any) => { propMap[p.id] = p; });

  const { data: vals } = await sb.from('cleaning_validations')
    .select('*').in('property_id', propIds)
    .gte('cleaning_date', start).lte('cleaning_date', end).eq('status', 'done');

  const doneCleaningsByProp: Record<string, any[]> = {};
  (vals || []).forEach((v: any) => {
    if (!doneCleaningsByProp[v.property_id]) doneCleaningsByProp[v.property_id] = [];
    doneCleaningsByProp[v.property_id].push(v);
  });

  const { data: admins } = await sb.from('members').select('*').eq('org_id', orgId).eq('role', 'concierge').limit(1);
  const admin = admins?.[0] || {};

  // concierge_to_owner
  if (typesEnabled.concierge_to_owner) {
    const byOwner: Record<string, { items: any[]; clientName: string; propertyName: string }> = {};
    (svcReqs || []).forEach((r: any) => {
      const p = propMap[r.property_id]; if (!p) return;
      const clientKey = p.owner_name || p.owner_email || p.id;
      const clientName = p.owner_name || p.owner_email || 'Client';
      if (!byOwner[clientKey]) byOwner[clientKey] = { items: [], clientName, propertyName: p.name || '' };
      const price = (p.pricing && p.pricing[r.service_type]?.price_owner) || 0;
      byOwner[clientKey].items.push({
        description: (r.service_type || 'Prestation') + ' — ' + (r.requested_date || ''),
        quantity: 1, unit_price: price, amount: price
      });
    });
    Object.entries(doneCleaningsByProp).forEach(([propId, list]) => {
      const p = propMap[propId]; if (!p) return;
      const clientKey = p.owner_name || p.owner_email || p.id;
      const clientName = p.owner_name || p.owner_email || 'Client';
      if (!byOwner[clientKey]) byOwner[clientKey] = { items: [], clientName, propertyName: p.name || '' };
      const price = (p.pricing && p.pricing.cleaning_standard?.price_owner) || 0;
      byOwner[clientKey].items.push({
        description: 'Menages reguliers — ' + (p.name || '') + ' (' + list.length + ')',
        quantity: list.length, unit_price: price, amount: price * list.length
      });
    });

    for (const [clientKey, grp] of Object.entries(byOwner)) {
      if (!grp.items.length) continue;
      if (await alreadyBilled(orgId, start, end, 'concierge_to_owner', clientKey)) continue;
      const amt = computeAmounts(grp.items, settings);
      if (amt.subtotal_ht <= 0) continue;
      const number = preview ? 'PREVIEW' : await getNextInvoiceNumber(orgId);
      const dueDate = new Date(now.getTime() + (settings.due_days || 30) * 86400000);
      const inv = {
        org_id: orgId, invoice_number: number, type: 'concierge_to_owner',
        status: settings.default_status || 'draft',
        issuer_name: admin.company_name || admin.display_name || org.name || '',
        issuer_siret: admin.siret || '', issuer_address: admin.billing_address || admin.address || '',
        issuer_email: admin.invited_email || '',
        client_name: grp.clientName, property_name: grp.propertyName,
        items: grp.items,
        subtotal_ht: amt.subtotal_ht, total_tva: amt.total_tva, total_ttc: amt.total_ttc, vat_rate: amt.vat_rate,
        period_start: start, period_end: end, due_date: isoDate(dueDate),
      };
      if (preview) { previewInvoices.push(inv); created++; continue; }
      const { data: inserted, error: insErr } = await sb.from('invoices').insert(inv).select('id').single();
      if (insErr) { console.error('insert err:', insErr); continue; }
      await sb.from('billing_runs').insert({
        org_id: orgId, period_start: start, period_end: end,
        invoice_type: 'concierge_to_owner', client_key: clientKey, invoice_id: inserted?.id
      });
      created++;
    }
  }

  // provider_to_concierge
  if (typesEnabled.provider_to_concierge) {
    const byProv: Record<string, { items: any[]; providerName: string }> = {};
    (svcReqs || []).forEach((r: any) => {
      const prov = r.assigned_provider; if (!prov) return;
      const p = propMap[r.property_id];
      const cost = (p?.pricing && p.pricing[r.service_type]?.cost_provider) || 0;
      if (!byProv[prov]) byProv[prov] = { items: [], providerName: prov };
      byProv[prov].items.push({
        description: (r.service_type || 'Prestation') + ' — ' + (p?.name || '') + ' — ' + (r.requested_date || ''),
        quantity: 1, unit_price: cost, amount: cost
      });
    });
    Object.entries(doneCleaningsByProp).forEach(([propId, list]) => {
      const p = propMap[propId];
      list.forEach((v: any) => {
        const prov = v.provider_name; if (!prov) return;
        const cost = (p?.pricing && p.pricing.cleaning_standard?.cost_provider) || 0;
        if (!byProv[prov]) byProv[prov] = { items: [], providerName: prov };
        byProv[prov].items.push({
          description: 'Menage — ' + (p?.name || '') + ' — ' + v.cleaning_date,
          quantity: 1, unit_price: cost, amount: cost
        });
      });
    });

    for (const [provName, grp] of Object.entries(byProv)) {
      if (!grp.items.length) continue;
      if (await alreadyBilled(orgId, start, end, 'provider_to_concierge', provName)) continue;
      // TVA non applicable ici: le concierge recoit une facture prestataire (provider est emetteur).
      // Le calcul se fera dans processProvider cote emetteur. Ici on trace HT = TTC (vue concierge).
      const subtotal = grp.items.reduce((s, i) => s + (i.amount || 0), 0);
      if (subtotal <= 0) continue;
      const number = preview ? 'PREVIEW' : await getNextInvoiceNumber(orgId);
      const dueDate = new Date(now.getTime() + (settings.due_days || 30) * 86400000);
      const inv = {
        org_id: orgId, invoice_number: number, type: 'provider_to_concierge',
        status: settings.default_status || 'draft',
        issuer_name: provName,
        client_name: admin.company_name || admin.display_name || org.name || '',
        items: grp.items, subtotal_ht: subtotal, total_tva: 0, total_ttc: subtotal, vat_rate: 0,
        period_start: start, period_end: end, due_date: isoDate(dueDate),
      };
      if (preview) { previewInvoices.push(inv); created++; continue; }
      const { data: inserted, error: insErr } = await sb.from('invoices').insert(inv).select('id').single();
      if (insErr) { console.error('insert err:', insErr); continue; }
      await sb.from('billing_runs').insert({
        org_id: orgId, period_start: start, period_end: end,
        invoice_type: 'provider_to_concierge', client_key: provName, invoice_id: inserted?.id
      });
      created++;
    }
  }

  if (!preview) await sb.from('billing_settings').update({ last_run_at: now.toISOString() })
    .eq('org_id', orgId).eq('role', 'concierge');
  return preview ? { created, previewInvoices } : created;
}

// ─── Provider role processing (new logic) ───
async function processProvider(settings: any, now: Date, preview = false) {
  const userId = settings.user_id;
  if (!userId) return preview ? { created: 0, previewInvoices: [] } : 0;
  const { start, end } = getPeriod(settings.period, now);
  const typesEnabled = settings.types_enabled || {};
  let created = 0;
  const previewInvoices: any[] = [];

  // Provider profile info (for issuer)
  const { data: profile } = await sb.from('profiles').select('*').eq('id', userId).single();
  const { data: provMember } = await sb.from('members').select('*').eq('user_id', userId).eq('role', 'provider').limit(1);
  const provInfo = provMember?.[0] || profile || {};
  const providerName = provInfo.company_name || provInfo.display_name || 'Prestataire';

  // Find all service_requests this provider completed in the period
  const { data: svcReqs } = await sb.from('service_requests')
    .select('*').eq('assigned_provider_user_id', userId).eq('status', 'done')
    .gte('requested_date', start).lte('requested_date', end);

  // Find all cleaning_validations by this provider
  const { data: vals } = await sb.from('cleaning_validations')
    .select('*').eq('provider_user_id', userId)
    .gte('cleaning_date', start).lte('cleaning_date', end).eq('status', 'done');

  // Fetch all related properties
  const allPropIds = new Set<string>();
  (svcReqs || []).forEach((r: any) => r.property_id && allPropIds.add(r.property_id));
  (vals || []).forEach((v: any) => v.property_id && allPropIds.add(v.property_id));
  const { data: propsData } = await sb.from('properties').select('*').in('id', Array.from(allPropIds));
  const propMap: Record<string, any> = {};
  (propsData || []).forEach((p: any) => { propMap[p.id] = p; });

  // Group by org (concierge) and by owner (direct)
  const byOrg: Record<string, { items: any[]; orgName: string; orgId: string }> = {};
  const byOwner: Record<string, { items: any[]; clientName: string; propertyName: string; orgId: string }> = {};

  function addItem(propId: string, desc: string, qty: number, price: number, ownerDirect: boolean) {
    const p = propMap[propId]; if (!p) return;
    if (ownerDirect || !p.org_id) {
      const clientKey = p.owner_name || p.owner_email || p.id;
      const clientName = p.owner_name || p.owner_email || 'Proprietaire';
      if (!byOwner[clientKey]) byOwner[clientKey] = { items: [], clientName, propertyName: p.name || '', orgId: p.org_id || userId };
      byOwner[clientKey].items.push({ description: desc, quantity: qty, unit_price: price, amount: price * qty });
    } else {
      if (!byOrg[p.org_id]) byOrg[p.org_id] = { items: [], orgName: '', orgId: p.org_id };
      byOrg[p.org_id].items.push({ description: desc, quantity: qty, unit_price: price, amount: price * qty });
    }
  }

  (svcReqs || []).forEach((r: any) => {
    const p = propMap[r.property_id]; if (!p) return;
    const cost = (p.pricing && p.pricing[r.service_type]?.cost_provider) || 0;
    const isDirect = !p.org_id || r.direct_to_owner === true;
    addItem(r.property_id,
      (r.service_type || 'Prestation') + ' — ' + (p.name || '') + ' — ' + (r.requested_date || ''),
      1, cost, isDirect);
  });
  (vals || []).forEach((v: any) => {
    const p = propMap[v.property_id]; if (!p) return;
    const cost = (p.pricing && p.pricing.cleaning_standard?.cost_provider) || 0;
    addItem(v.property_id, 'Menage — ' + (p.name || '') + ' — ' + v.cleaning_date, 1, cost, !p.org_id);
  });

  // Fetch org names
  for (const oid of Object.keys(byOrg)) {
    const { data: o } = await sb.from('organizations').select('name').eq('id', oid).single();
    byOrg[oid].orgName = o?.name || 'Conciergerie';
  }

  const dueDate = new Date(now.getTime() + (settings.due_days || 30) * 86400000);

  // provider_to_concierge
  if (typesEnabled.provider_to_concierge) {
    for (const [oid, grp] of Object.entries(byOrg)) {
      if (!grp.items.length) continue;
      const clientKey = 'concierge:' + oid;
      if (await alreadyBilled(oid, start, end, 'provider_to_concierge', clientKey)) continue;
      const amt = computeAmounts(grp.items, settings);
      if (amt.subtotal_ht <= 0) continue;
      const number = preview ? 'PREVIEW' : await getNextInvoiceNumber(oid);
      const inv = {
        org_id: oid, invoice_number: number, type: 'provider_to_concierge',
        status: settings.default_status || 'draft',
        issuer_name: providerName,
        issuer_siret: provInfo.siret || '',
        issuer_address: provInfo.billing_address || provInfo.address || '',
        issuer_email: provInfo.invited_email || profile?.email || '',
        client_name: grp.orgName,
        items: grp.items,
        subtotal_ht: amt.subtotal_ht, total_tva: amt.total_tva, total_ttc: amt.total_ttc, vat_rate: amt.vat_rate,
        period_start: start, period_end: end, due_date: isoDate(dueDate),
        created_by: userId,
      };
      if (preview) { previewInvoices.push(inv); created++; continue; }
      const { data: inserted, error: insErr } = await sb.from('invoices').insert(inv).select('id').single();
      if (insErr) { console.error('prov→concierge err:', insErr); continue; }
      await sb.from('billing_runs').insert({
        org_id: oid, period_start: start, period_end: end,
        invoice_type: 'provider_to_concierge', client_key: clientKey, invoice_id: inserted?.id
      });
      created++;
    }
  }

  // provider_to_owner
  if (typesEnabled.provider_to_owner) {
    for (const [clientKey, grp] of Object.entries(byOwner)) {
      if (!grp.items.length) continue;
      const trackingOrgId = grp.orgId;
      const fullKey = 'owner:' + clientKey + ':' + userId;
      if (await alreadyBilled(trackingOrgId, start, end, 'provider_to_owner', fullKey)) continue;
      const amt = computeAmounts(grp.items, settings);
      if (amt.subtotal_ht <= 0) continue;
      const number = preview ? 'PREVIEW' : await getNextInvoiceNumber(trackingOrgId);
      const inv = {
        org_id: trackingOrgId, invoice_number: number, type: 'provider_to_owner',
        status: settings.default_status || 'draft',
        issuer_name: providerName,
        issuer_siret: provInfo.siret || '',
        issuer_address: provInfo.billing_address || provInfo.address || '',
        issuer_email: provInfo.invited_email || profile?.email || '',
        client_name: grp.clientName, property_name: grp.propertyName,
        items: grp.items,
        subtotal_ht: amt.subtotal_ht, total_tva: amt.total_tva, total_ttc: amt.total_ttc, vat_rate: amt.vat_rate,
        period_start: start, period_end: end, due_date: isoDate(dueDate),
        created_by: userId,
      };
      if (preview) { previewInvoices.push(inv); created++; continue; }
      const { data: inserted, error: insErr } = await sb.from('invoices').insert(inv).select('id').single();
      if (insErr) { console.error('prov→owner err:', insErr); continue; }
      await sb.from('billing_runs').insert({
        org_id: trackingOrgId, period_start: start, period_end: end,
        invoice_type: 'provider_to_owner', client_key: fullKey, invoice_id: inserted?.id
      });
      created++;
    }
  }

  if (!preview) await sb.from('billing_settings').update({ last_run_at: now.toISOString() })
    .eq('user_id', userId).eq('role', 'provider');
  return preview ? { created, previewInvoices } : created;
}

Deno.serve(async (req) => {
  const CORS = { ...corsHeaders(req), 'Access-Control-Allow-Methods': 'POST, GET, OPTIONS' };
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  try {
    const url = new URL(req.url);
    const force = url.searchParams.get('force') === '1';
    const preview = url.searchParams.get('preview') === '1';
    const forceRole = url.searchParams.get('role');
    const forceOrgId = url.searchParams.get('org_id');
    const forceUserId = url.searchParams.get('user_id');
    const now = new Date();
    const day = now.getUTCDate();

    let query = sb.from('billing_settings').select('*').eq('auto_enabled', true);
    if (!force) query = query.eq('billing_day', day);
    if (forceOrgId) query = query.eq('org_id', forceOrgId);
    if (forceUserId) query = query.eq('user_id', forceUserId);
    if (forceRole) query = query.eq('role', forceRole);

    const { data: settings, error } = await query;
    if (error) throw error;

    let totalCreated = 0;
    const results: any[] = [];
    const allPreviewInvoices: any[] = [];
    for (const s of (settings || [])) {
      try {
        if (s.role === 'provider') {
          const r = await processProvider(s, now, preview);
          if (preview) { totalCreated += (r as any).created; allPreviewInvoices.push(...(r as any).previewInvoices); results.push({ role: 'provider', user_id: s.user_id, created: (r as any).created }); }
          else { totalCreated += (r as number); results.push({ role: 'provider', user_id: s.user_id, created: r }); }
        } else {
          const { data: org } = await sb.from('organizations').select('*').eq('id', s.org_id).single();
          if (!org) continue;
          const r = await processConcierge(org, s, now, preview);
          if (preview) { totalCreated += (r as any).created; allPreviewInvoices.push(...(r as any).previewInvoices); results.push({ role: 'concierge', org_id: s.org_id, created: (r as any).created }); }
          else { totalCreated += (r as number); results.push({ role: 'concierge', org_id: s.org_id, created: r }); }
        }
      } catch (e) {
        console.error('process error:', s, e);
        results.push({ error: String(e), setting: s });
      }
    }

    // Send summary email to each concerned admin (non-preview, non-empty runs only)
    if (!preview && totalCreated > 0) {
      const RESEND_KEY = Deno.env.get('RESEND_API_KEY') || '';
      const FROM_EMAIL = Deno.env.get('FROM_EMAIL') || 'onboarding@resend.dev';
      if (RESEND_KEY) {
        for (const r of results) {
          if (!r.created || r.created <= 0) continue;
          let adminEmail: string | null = null;
          if (r.role === 'concierge' && r.org_id) {
            const { data: admins } = await sb.from('members').select('invited_email').eq('org_id', r.org_id).eq('role', 'concierge').limit(1);
            adminEmail = admins?.[0]?.invited_email || null;
          } else if (r.role === 'provider' && r.user_id) {
            const { data: prof } = await sb.from('profiles').select('email').eq('id', r.user_id).maybeSingle();
            adminEmail = prof?.email || null;
          }
          if (!adminEmail) continue;
          try {
            const html = '<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:20px;color:#222;">' +
              '<h2 style="color:#6c63ff;">&#9889; Facturation automatique</h2>' +
              '<p><strong>' + r.created + ' facture(s)</strong> ont ete generees automatiquement aujourd\'hui (' + now.toLocaleDateString('fr-FR') + ').</p>' +
              '<p>Connectez-vous a Lokizio pour les consulter et les envoyer a vos clients.</p>' +
              '<p style="font-size:12px;color:#666;margin-top:20px;">Cet email a ete envoye automatiquement par votre configuration de facturation auto.</p></div>';
            await fetch('https://api.resend.com/emails', {
              method: 'POST',
              headers: { 'Authorization': 'Bearer ' + RESEND_KEY, 'Content-Type': 'application/json' },
              body: JSON.stringify({ from: FROM_EMAIL, to: [adminEmail], subject: 'Lokizio — ' + r.created + ' facture(s) auto-generee(s)', html }),
            });
          } catch (e) { console.error('auto-bill summary email failed:', e); }
        }
      }
    }

    const body: any = { ok: true, day, preview, configs: settings?.length || 0, invoices_created: totalCreated, results };
    if (preview) body.preview_invoices = allPreviewInvoices;
    return new Response(JSON.stringify(body), {
      headers: { 'Content-Type': 'application/json', ...CORS }
    });
  } catch (e) {
    console.error('auto-bill error:', e);
    return new Response(JSON.stringify({ ok: false, error: String(e) }), { status: 500, headers: { 'Content-Type': 'application/json', ...CORS } });
  }
});
