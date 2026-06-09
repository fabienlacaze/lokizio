// Edge Function: stripe-connect-link
//
// Refreshes an Account Session for a user with an existing Stripe Connect
// account. The Embedded Component client_secret expires after 5 minutes; this
// endpoint lets the browser get a fresh one without going through the full
// onboarding flow.
//
// Body: { component?: "account_onboarding" | "payments" | "payouts" }
// Auth: Bearer JWT
// Returns: { client_secret, expires_at, account_id, charges_enabled, ... }

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, requireAuth } from '../_shared/cors.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY')!;

async function stripeApi(path: string, body: Record<string, string>): Promise<any> {
  const form = new URLSearchParams();
  for (const [k, v] of Object.entries(body)) {
    if (v !== undefined && v !== null) form.append(k, String(v));
  }
  const r = await fetch(`https://api.stripe.com/v1${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: form.toString(),
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
    const body = await req.json().catch(() => ({}));

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
      return Response.json({ error: 'No Stripe account for this user. Call stripe-connect-onboard first.' }, { status: 404, headers: cors });
    }

    const session = await stripeApi('/account_sessions', {
      account: member.stripe_account_id,
      'components[account_onboarding][enabled]': 'true',
      'components[payments][enabled]': 'true',
      'components[payouts][enabled]': 'true',
      'components[notification_banner][enabled]': 'true',
    });

    // Also fetch fresh status
    const accountFetch = await fetch(`https://api.stripe.com/v1/accounts/${member.stripe_account_id}`, {
      headers: { Authorization: `Bearer ${STRIPE_SECRET_KEY}` },
    });
    const account = await accountFetch.json();

    return Response.json({
      account_id: member.stripe_account_id,
      client_secret: session.client_secret,
      expires_at: session.expires_at,
      charges_enabled: !!account.charges_enabled,
      payouts_enabled: !!account.payouts_enabled,
      details_submitted: !!account.details_submitted,
    }, { headers: cors });
  } catch (e) {
    console.error('stripe-connect-link error:', e);
    return Response.json({ error: String(e?.message || e) }, { status: 500, headers: cors });
  }
});
