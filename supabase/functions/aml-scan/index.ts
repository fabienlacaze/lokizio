// Edge Function: aml-scan
//
// Anti-Money-Laundering monitoring for Lokizio. Scans recent payments and
// detects:
//   1. threshold_30d: a single user's cumulative volume > 7500€ in 30 days
//      (the TRACFIN obligation threshold in France for marketplaces)
//   2. fragmentation: 10+ payments < 750€ within 24h for the same beneficiary
//   3. self_billing: invoice creator and client_email belong to the same org member
//
// Body: { trigger?: 'cron' | 'manual' }
// Auth: super_admin Bearer JWT OR CRON_TOKEN bearer (for scheduled runs)
// Returns: { new_alerts, scanned_users }

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, requireAuth } from '../_shared/cors.ts';
import { audit } from '../_shared/security.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const CRON_TOKEN = Deno.env.get('CRON_TOKEN') || '';

const THRESHOLD_30D_EUR = 7500;
const FRAGMENTATION_COUNT = 10;
const FRAGMENTATION_AMOUNT_EUR = 750;
const FRAGMENTATION_WINDOW_HOURS = 24;

Deno.serve(async (req) => {
  const cors = corsHeaders(req);
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  try {
    // Allow two auth modes: user JWT (super_admin) or CRON_TOKEN
    const authHeader = req.headers.get('Authorization') || '';
    const bearer = authHeader.replace(/^Bearer\s+/i, '').trim();
    const isCronCall = CRON_TOKEN && bearer === CRON_TOKEN;
    let triggeredBy: string | null = null;
    if (!isCronCall) {
      const { userId } = await requireAuth(req, SUPABASE_URL, SUPABASE_ANON_KEY);
      const admin0 = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
      const { data: sa } = await admin0.from('super_admins').select('user_id').eq('user_id', userId).maybeSingle();
      if (!sa) {
        return Response.json({ error: 'Forbidden: super_admin or CRON only' }, { status: 403, headers: cors });
      }
      triggeredBy = userId;
    }

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    let newAlerts = 0;

    // Helper: check we haven't already raised the same alert in the last 24h
    async function alertExistsRecently(user_id: string | null, alert_type: string): Promise<boolean> {
      const since = new Date(Date.now() - 86400 * 1000).toISOString();
      const q = admin.from('aml_alerts')
        .select('id', { count: 'exact', head: true })
        .eq('alert_type', alert_type)
        .gte('created_at', since)
        .in('status', ['open', 'reviewed']);
      const { count } = user_id ? await q.eq('user_id', user_id) : await q;
      return (count || 0) > 0;
    }

    // ── #1 Threshold 30d ──
    const { data: thresholds, error: thrErr } = await admin
      .from('aml_30day_volume_per_user')
      .select('*')
      .gt('total_volume_eur_30d', THRESHOLD_30D_EUR);
    if (thrErr) throw thrErr;
    for (const r of (thresholds || [])) {
      if (!r.user_id) continue;
      if (await alertExistsRecently(r.user_id, 'threshold_30d')) continue;
      const severity = r.total_volume_eur_30d > 25000 ? 'critical' : (r.total_volume_eur_30d > 15000 ? 'high' : 'medium');
      const { data: row } = await admin.from('aml_alerts').insert({
        user_id: r.user_id, org_id: r.org_id, alert_type: 'threshold_30d', severity,
        details: { volume_eur: r.total_volume_eur_30d, tx_count: r.tx_count_30d, last_tx_at: r.last_tx_at, threshold_eur: THRESHOLD_30D_EUR },
      }).select('id').maybeSingle();
      if (row) newAlerts++;
    }

    // ── #2 Fragmentation (many small tx in a short window) ──
    const sinceFrag = new Date(Date.now() - FRAGMENTATION_WINDOW_HOURS * 3600 * 1000).toISOString();
    const { data: smallTx } = await admin
      .from('invoices')
      .select('created_by, org_id, total_ttc, stripe_paid_at')
      .eq('stripe_payment_status', 'succeeded')
      .lt('total_ttc', FRAGMENTATION_AMOUNT_EUR)
      .gte('stripe_paid_at', sinceFrag);
    const fragByUser: Record<string, { org_id: string; count: number; sum: number }> = {};
    (smallTx || []).forEach((tx: any) => {
      if (!tx.created_by) return;
      if (!fragByUser[tx.created_by]) fragByUser[tx.created_by] = { org_id: tx.org_id, count: 0, sum: 0 };
      fragByUser[tx.created_by].count++;
      fragByUser[tx.created_by].sum += tx.total_ttc || 0;
    });
    for (const [uid, info] of Object.entries(fragByUser)) {
      if (info.count < FRAGMENTATION_COUNT) continue;
      if (await alertExistsRecently(uid, 'fragmentation')) continue;
      const { data: row } = await admin.from('aml_alerts').insert({
        user_id: uid, org_id: info.org_id, alert_type: 'fragmentation', severity: 'high',
        details: { count: info.count, sum_eur: info.sum, window_hours: FRAGMENTATION_WINDOW_HOURS, threshold_count: FRAGMENTATION_COUNT, threshold_eur: FRAGMENTATION_AMOUNT_EUR },
      }).select('id').maybeSingle();
      if (row) newAlerts++;
    }

    // ── #3 Self-billing (invoice creator's email == client_email in same org) ──
    const since = new Date(Date.now() - 7 * 86400 * 1000).toISOString();
    const { data: recents } = await admin
      .from('invoices')
      .select('id, org_id, created_by, client_email')
      .eq('stripe_payment_status', 'succeeded')
      .gte('stripe_paid_at', since)
      .not('client_email', 'is', null);
    for (const inv of (recents || [])) {
      if (!inv.created_by || !inv.client_email) continue;
      // Check if the client_email matches a member of the same org with the same user_id as created_by
      const { data: selfMember } = await admin
        .from('members')
        .select('user_id, invited_email')
        .eq('org_id', inv.org_id)
        .eq('invited_email', inv.client_email)
        .eq('user_id', inv.created_by)
        .maybeSingle();
      if (!selfMember) continue;
      if (await alertExistsRecently(inv.created_by, 'self_billing')) continue;
      const { data: row } = await admin.from('aml_alerts').insert({
        user_id: inv.created_by, org_id: inv.org_id, alert_type: 'self_billing', severity: 'critical',
        details: { invoice_id: inv.id, client_email: inv.client_email },
      }).select('id').maybeSingle();
      if (row) newAlerts++;
    }

    audit({
      user_id: triggeredBy,
      action: 'aml.scan_run',
      metadata: { new_alerts: newAlerts, trigger: isCronCall ? 'cron' : 'manual' },
      severity: newAlerts > 0 ? 'warning' : 'info',
    }).catch(() => {});

    return Response.json({
      new_alerts: newAlerts,
      scanned_users: (thresholds?.length || 0) + Object.keys(fragByUser).length + (recents?.length || 0),
      trigger: isCronCall ? 'cron' : 'manual',
    }, { headers: cors });
  } catch (e: any) {
    console.error('aml-scan error:', e);
    return Response.json({ error: String(e?.message || e) }, { status: 500, headers: cors });
  }
});
