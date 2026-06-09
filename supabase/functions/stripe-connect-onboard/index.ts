// Edge Function: stripe-connect-onboard
//
// Creates a Stripe Express account for the authenticated user (if not already)
// and returns an **Account Session client_secret** for use with Stripe Connect
// Embedded Components (account-onboarding component).
//
// This is the EMBEDDED flow: the form is rendered in an iframe INSIDE Lokizio,
// not as a redirect. See connect.stripe.com/docs/connect/embedded-components/quickstart
//
// Body: { country?: "FR" | "BE" | ... (default "FR") }
// Auth: Bearer JWT (member of an org)
// Returns: { account_id, client_secret, expires_at, charges_enabled,
//            payouts_enabled, details_submitted }
//
// Idempotent: if member already has stripe_account_id, just creates a new
// account_session for the existing account.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, requireAuth } from '../_shared/cors.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY')!;

const APP_URL = Deno.env.get('LOKIZIO_APP_URL') || 'https://fabienlacaze.github.io/lokizio/';

async function stripeApi(path: string, body: Record<string, string>): Promise<any> {
  // Stripe Connect uses form-urlencoded, not JSON
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
    const country = (body.country || 'FR').toUpperCase();

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Find ANY accepted member row for this user (we attach Connect at the
    // user-level, not per-org; reusing one member.stripe_account_id across orgs).
    // We pick the first accepted member to update.
    const { data: members, error: mErr } = await admin
      .from('members')
      .select('id, org_id, stripe_account_id, role')
      .eq('user_id', userId)
      .eq('accepted', true)
      .order('created_at', { ascending: true })
      .limit(1);
    if (mErr) throw mErr;
    if (!members || !members.length) {
      return Response.json({ error: 'No accepted member found for this user' }, { status: 403, headers: cors });
    }

    let member = members[0];
    let accountId = member.stripe_account_id;

    if (!accountId) {
      // Get user email from auth
      const { data: { user } } = await admin.auth.admin.getUserById(userId);
      const email = user?.email;

      // Create Express account
      const account = await stripeApi('/accounts', {
        type: 'express',
        country,
        email: email || '',
        'capabilities[card_payments][requested]': 'true',
        'capabilities[transfers][requested]': 'true',
        'business_type': 'individual',
        'metadata[lokizio_user_id]': userId,
        'metadata[lokizio_member_id]': member.id,
      });

      accountId = account.id;

      // Persist on ALL member rows for this user (cross-org support).
      // This way if the user is concierge in org A and provider in org B, both
      // rows share the same Stripe account.
      await admin.from('members')
        .update({
          stripe_account_id: accountId,
          stripe_account_country: country,
          stripe_onboarding_started_at: new Date().toISOString(),
        })
        .eq('user_id', userId);
    }

    // Generate an Account Session for Embedded Components.
    // The client_secret is short-lived (5 min); the browser uses it to
    // initialize StripeConnect.init() and mount components like
    // <stripe-connect-account-onboarding>.
    // See https://docs.stripe.com/api/account_sessions/create
    const session = await stripeApi('/account_sessions', {
      account: accountId!,
      'components[account_onboarding][enabled]': 'true',
      // Also enable the dashboard for users who already onboarded — they can
      // see their balance, payouts, etc. from within Lokizio.
      'components[payments][enabled]': 'true',
      'components[payouts][enabled]': 'true',
      'components[notification_banner][enabled]': 'true',
    });

    // Fetch fresh account state so the client knows whether to render
    // onboarding (incomplete) or the dashboard (complete).
    const accountFetch = await fetch(`https://api.stripe.com/v1/accounts/${accountId}`, {
      headers: { Authorization: `Bearer ${STRIPE_SECRET_KEY}` },
    });
    const account = await accountFetch.json();

    return Response.json({
      account_id: accountId,
      client_secret: session.client_secret,
      expires_at: session.expires_at,
      charges_enabled: !!account.charges_enabled,
      payouts_enabled: !!account.payouts_enabled,
      details_submitted: !!account.details_submitted,
    }, { headers: cors });
  } catch (e) {
    console.error('stripe-connect-onboard error:', e);
    return Response.json({ error: String(e?.message || e) }, { status: 500, headers: cors });
  }
});
