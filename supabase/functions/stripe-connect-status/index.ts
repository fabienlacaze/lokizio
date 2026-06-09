// Edge Function: stripe-connect-status
//
// Polls Stripe for the latest KYC status of a user's Connect account and
// syncs the cached flags in members. Called by the UI when:
//   - User returns from onboarding (account.updated webhook is the canonical source
//     but client-side refresh is needed for instant feedback).
//   - The "Refresh" button on the payment settings page.
//
// Auth: Bearer JWT
// Returns: { account_id, charges_enabled, payouts_enabled, details_submitted,
//            requirements: { currently_due, eventually_due, past_due } }

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, requireAuth } from '../_shared/cors.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY')!;

async function stripeGet(path: string): Promise<any> {
  const r = await fetch(`https://api.stripe.com/v1${path}`, {
    headers: { Authorization: `Bearer ${STRIPE_SECRET_KEY}` },
  });
  const json = await r.json();
  if (!r.ok) throw new Error(`Stripe API ${r.status}: ${json.error?.message || JSON.stringify(json)}`);
  return json;
}

Deno.serve(async (req) => {
  const cors = corsHeaders(req);
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  try {
    if (!STRIPE_SECRET_KEY) {
      return Response.json({ error: 'STRIPE_SECRET_KEY not configured' }, { status: 500, headers: cors });
    }
    const { userId } = await requireAuth(req, SUPABASE_URL, SUPABASE_ANON_KEY);

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const { data: member } = await admin
      .from('members')
      .select('stripe_account_id')
      .eq('user_id', userId)
      .eq('accepted', true)
      .not('stripe_account_id', 'is', null)
      .limit(1)
      .maybeSingle();
    if (!member?.stripe_account_id) {
      return Response.json({ account_id: null, charges_enabled: false, payouts_enabled: false, details_submitted: false }, { headers: cors });
    }

    const account = await stripeGet(`/accounts/${member.stripe_account_id}`);

    // Sync cached flags across all member rows for this user
    await admin.from('members')
      .update({
        stripe_charges_enabled: !!account.charges_enabled,
        stripe_payouts_enabled: !!account.payouts_enabled,
        stripe_details_submitted: !!account.details_submitted,
        stripe_account_updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId);

    return Response.json({
      account_id: account.id,
      charges_enabled: !!account.charges_enabled,
      payouts_enabled: !!account.payouts_enabled,
      details_submitted: !!account.details_submitted,
      requirements: account.requirements || {},
    }, { headers: cors });
  } catch (e) {
    console.error('stripe-connect-status error:', e);
    return Response.json({ error: String(e?.message || e) }, { status: 500, headers: cors });
  }
});
