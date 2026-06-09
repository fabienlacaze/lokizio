import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders as buildCors } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SB_SERVICE_ROLE_KEY")!;
const STRIPE_SECRET = Deno.env.get("STRIPE_SECRET_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

Deno.serve(async (req: Request) => {
  const corsHeaders = buildCors(req);

  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization")?.replace("Bearer ", "") || "";
    
    const supabase = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${authHeader}` } },
    });
    
    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader);
    if (authError || !user) throw new Error("Non authentifie: " + (authError?.message || "no user"));

    const { deleteData, cancelSubscription, stripeSubscriptionId } = await req.json();
    const userId = user.id;

    const headers = {
      "apikey": SERVICE_KEY,
      "Authorization": `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
    };

    if (cancelSubscription && stripeSubscriptionId) {
      await fetch(`https://api.stripe.com/v1/subscriptions/${stripeSubscriptionId}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${STRIPE_SECRET}` },
      });
    }

    if (deleteData) {
      const orgResp = await fetch(`${SUPABASE_URL}/rest/v1/organizations?owner_id=eq.${userId}&select=id`, { headers });
      const orgs = await orgResp.json();
      
      for (const org of orgs) {
        await fetch(`${SUPABASE_URL}/rest/v1/messages?org_id=eq.${org.id}`, { method: "DELETE", headers });
        await fetch(`${SUPABASE_URL}/rest/v1/invoices?org_id=eq.${org.id}`, { method: "DELETE", headers });
        const propsResp = await fetch(`${SUPABASE_URL}/rest/v1/properties?org_id=eq.${org.id}&select=id`, { headers });
        const props = await propsResp.json();
        for (const prop of props) {
          await fetch(`${SUPABASE_URL}/rest/v1/cleaning_validations?property_id=eq.${prop.id}`, { method: "DELETE", headers });
          await fetch(`${SUPABASE_URL}/rest/v1/plannings?property_id=eq.${prop.id}`, { method: "DELETE", headers });
        }
        await fetch(`${SUPABASE_URL}/rest/v1/properties?org_id=eq.${org.id}`, { method: "DELETE", headers });
        await fetch(`${SUPABASE_URL}/rest/v1/members?org_id=eq.${org.id}`, { method: "DELETE", headers });
        await fetch(`${SUPABASE_URL}/rest/v1/organizations?id=eq.${org.id}`, { method: "DELETE", headers });
      }
      await fetch(`${SUPABASE_URL}/rest/v1/user_data?user_id=eq.${userId}`, { method: "DELETE", headers });
      await fetch(`${SUPABASE_URL}/rest/v1/subscriptions?user_id=eq.${userId}`, { method: "DELETE", headers });
      await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}`, { method: "DELETE", headers });
    }

    await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${userId}`, { method: "DELETE", headers });

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
