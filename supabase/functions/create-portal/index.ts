// Edge Function: create-portal
// Creates a Stripe Customer Portal session for the authenticated user.
// The portal lets the user manage their subscription (cancel, update card, view invoices).
//
// Body: {} (user is identified by JWT)
// Returns: { url: "https://billing.stripe.com/session/..." }

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsHeaders, requireAuth } from "../_shared/cors.ts";

const STRIPE_SECRET = Deno.env.get("STRIPE_SECRET_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SITE_URL = "https://fabienlacaze.github.io/menage-manager-app";

Deno.serve(async (req: Request) => {
  const CORS = corsHeaders(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const { userId: authUserId } = await requireAuth(req, SUPABASE_URL, ANON_KEY);

    // Find the Stripe customer by metadata[user_id]
    const custResp = await fetch(
      `https://api.stripe.com/v1/customers/search?query=metadata['user_id']:'${authUserId}'`,
      { headers: { Authorization: `Bearer ${STRIPE_SECRET}` } },
    );
    const custData = await custResp.json();

    if (!custData.data || !custData.data.length) {
      return new Response(JSON.stringify({ error: "No Stripe customer found. Subscribe first." }), {
        status: 404, headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    const customerId = custData.data[0].id;

    // Create Billing Portal session
    const portalResp = await fetch("https://api.stripe.com/v1/billing_portal/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${STRIPE_SECRET}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        customer: customerId,
        return_url: SITE_URL,
      }).toString(),
    });

    const session = await portalResp.json();
    if (!portalResp.ok || !session.url) {
      return new Response(JSON.stringify({ error: session.error?.message || "Portal creation failed" }), {
        status: 500, headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    const msg = e?.message || String(e);
    const status = /auth|token/i.test(msg) ? 401 : 500;
    return new Response(JSON.stringify({ error: msg }), {
      status, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});
