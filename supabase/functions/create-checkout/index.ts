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
    const { priceId } = await req.json();
    if (!priceId) throw new Error("priceId required");

    const resp = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${STRIPE_SECRET}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        "mode": "subscription",
        "payment_method_types[0]": "card",
        "line_items[0][price]": priceId,
        "line_items[0][quantity]": "1",
        "success_url": `${SITE_URL}/?premium=success`,
        "cancel_url": `${SITE_URL}/?premium=cancel`,
        "client_reference_id": authUserId,
        "metadata[user_id]": authUserId,
      }).toString(),
    });

    const session = await resp.json();
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
