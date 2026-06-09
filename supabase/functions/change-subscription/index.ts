import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsHeaders, requireAuth } from "../_shared/cors.ts";

const STRIPE_SECRET = Deno.env.get("STRIPE_SECRET_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

Deno.serve(async (req: Request) => {
  const CORS = corsHeaders(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const { userId: authUserId } = await requireAuth(req, SUPABASE_URL, ANON_KEY);
    const { newPriceId, action } = await req.json();
    if (!newPriceId) throw new Error("newPriceId required");

    const custResp = await fetch(`https://api.stripe.com/v1/customers/search?query=metadata['user_id']:'${authUserId}'`, {
      headers: { "Authorization": `Bearer ${STRIPE_SECRET}` },
    });
    const custData = await custResp.json();

    if (!custData.data || !custData.data.length) {
      return new Response(JSON.stringify({ error: "No Stripe customer found" }), {
        status: 404, headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    const customerId = custData.data[0].id;

    const subResp = await fetch(`https://api.stripe.com/v1/subscriptions?customer=${customerId}&status=active&limit=1`, {
      headers: { "Authorization": `Bearer ${STRIPE_SECRET}` },
    });
    const subData = await subResp.json();

    if (!subData.data || !subData.data.length) {
      return new Response(JSON.stringify({ error: "No active subscription found" }), {
        status: 404, headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    const subscription = subData.data[0];
    const subscriptionItemId = subscription.items.data[0].id;

    const updateResp = await fetch(`https://api.stripe.com/v1/subscriptions/${subscription.id}`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${STRIPE_SECRET}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        "items[0][id]": subscriptionItemId,
        "items[0][price]": newPriceId,
        "proration_behavior": "create_prorations",
      }).toString(),
    });

    const updatedSub = await updateResp.json();

    if (updatedSub.error) {
      return new Response(JSON.stringify({ error: updatedSub.error.message }), {
        status: 400, headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({
      ok: true,
      action,
      newPrice: newPriceId,
      subscriptionId: updatedSub.id,
    }), {
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
