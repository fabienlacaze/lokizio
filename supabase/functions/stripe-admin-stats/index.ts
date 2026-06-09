// Edge Function: stripe-admin-stats
//
// Returns aggregate stats on Lokizio's Stripe Connect revenue (application fees,
// transactions). Only callable by super_admins.
//
// Body: { from?: ISO date, to?: ISO date }
// Auth: Bearer JWT (must be in super_admins table)
// Returns: { total_volume_cents, total_commission_cents, total_count,
//            by_month: [...], top_beneficiaries: [...] }

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, requireAuth } from '../_shared/cors.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

Deno.serve(async (req) => {
  const cors = corsHeaders(req);
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  try {
    const { userId } = await requireAuth(req, SUPABASE_URL, SUPABASE_ANON_KEY);
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Verify super_admin. If the DB lookup errors (connection issue, schema
    // drift, RLS misconfig), FAIL CLOSED — never let a silent error bypass
    // the auth check. Cf. audit finding wmlemqp4r.
    const { data: superAdmin, error: adminErr } = await admin
      .from('super_admins')
      .select('user_id')
      .eq('user_id', userId)
      .maybeSingle();
    if (adminErr) {
      console.error('super_admin lookup failed:', adminErr);
      return Response.json({ error: 'Authorization check failed' }, { status: 500, headers: cors });
    }
    if (!superAdmin) {
      return Response.json({ error: 'Forbidden: super_admin only' }, { status: 403, headers: cors });
    }

    const body = await req.json().catch(() => ({}));
    const fromDate = body.from || new Date(Date.now() - 90 * 86400 * 1000).toISOString();
    const toDate = body.to || new Date().toISOString();

    // Query all succeeded invoices in the period
    const { data: paid, error } = await admin
      .from('invoices')
      .select('id, org_id, total_ttc, stripe_application_fee_amount, stripe_destination_account_id, stripe_paid_at, client_name')
      .eq('stripe_payment_status', 'succeeded')
      .gte('stripe_paid_at', fromDate)
      .lte('stripe_paid_at', toDate)
      .order('stripe_paid_at', { ascending: false });
    if (error) throw error;

    const total_count = paid?.length || 0;
    const total_volume_cents = (paid || []).reduce((s, i) => s + Math.round((i.total_ttc || 0) * 100), 0);
    const total_commission_cents = (paid || []).reduce((s, i) => s + (i.stripe_application_fee_amount || 0), 0);

    // Aggregate by month (YYYY-MM)
    const byMonthMap: Record<string, { count: number; volume_cents: number; commission_cents: number }> = {};
    (paid || []).forEach(i => {
      if (!i.stripe_paid_at) return;
      const key = (i.stripe_paid_at as string).slice(0, 7);
      if (!byMonthMap[key]) byMonthMap[key] = { count: 0, volume_cents: 0, commission_cents: 0 };
      byMonthMap[key].count++;
      byMonthMap[key].volume_cents += Math.round((i.total_ttc || 0) * 100);
      byMonthMap[key].commission_cents += i.stripe_application_fee_amount || 0;
    });
    const by_month = Object.entries(byMonthMap)
      .sort(([a], [b]) => b.localeCompare(a))
      .slice(0, 12)
      .map(([month, s]) => ({ month, ...s }));

    // Top 5 destination accounts (most paid prestataires)
    const byBeneficiaryMap: Record<string, { count: number; volume_cents: number; commission_cents: number }> = {};
    (paid || []).forEach(i => {
      const acct = i.stripe_destination_account_id || 'unknown';
      if (!byBeneficiaryMap[acct]) byBeneficiaryMap[acct] = { count: 0, volume_cents: 0, commission_cents: 0 };
      byBeneficiaryMap[acct].count++;
      byBeneficiaryMap[acct].volume_cents += Math.round((i.total_ttc || 0) * 100);
      byBeneficiaryMap[acct].commission_cents += i.stripe_application_fee_amount || 0;
    });
    const top_beneficiaries = Object.entries(byBeneficiaryMap)
      .map(([acct, s]) => ({ account_id: acct, ...s }))
      .sort((a, b) => b.volume_cents - a.volume_cents)
      .slice(0, 5);

    // Connect accounts overview
    const { count: connectedCount } = await admin
      .from('members')
      .select('id', { count: 'exact', head: true })
      .not('stripe_account_id', 'is', null);

    const { count: activeChargesCount } = await admin
      .from('members')
      .select('id', { count: 'exact', head: true })
      .eq('stripe_charges_enabled', true);

    return Response.json({
      from: fromDate,
      to: toDate,
      total_count,
      total_volume_cents,
      total_commission_cents,
      by_month,
      top_beneficiaries,
      connect_accounts_total: connectedCount || 0,
      connect_accounts_active: activeChargesCount || 0,
    }, { headers: cors });
  } catch (e) {
    console.error('stripe-admin-stats error:', e);
    return Response.json({ error: String(e?.message || e) }, { status: 500, headers: cors });
  }
});
