// Edge Function: stripe-connect-link
//
// Regenerates an onboarding link for a user who already has an account (e.g.
// they bounced from Stripe before completing KYC). Account link expires in 5
// minutes per Stripe spec.
//
// Body: { return_url?, refresh_url? }
// Auth: Bearer JWT
// Returns: { onboarding_url, expires_at }

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, requireAuth } from '../_shared/cors.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY')!;
const APP_URL = Deno.env.get('LOKIZIO_APP_URL') || 'https://fabienlacaze.github.io/lokizio/';

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
    const returnUrl = body.return_url || `${APP_URL}#stripe-onboard-return`;
    const refreshUrl = body.refresh_url || `${APP_URL}#stripe-onboard-refresh`;

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

    const link = await stripeApi('/account_links', {
      account: member.stripe_account_id,
      refresh_url: refreshUrl,
      return_url: returnUrl,
      type: 'account_onboarding',
    });

    return Response.json({
      onboarding_url: link.url,
      expires_at: link.expires_at,
    }, { headers: cors });
  } catch (e) {
    console.error('stripe-connect-link error:', e);
    return Response.json({ error: String(e?.message || e) }, { status: 500, headers: cors });
  }
});
