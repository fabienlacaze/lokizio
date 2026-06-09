import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const STRIPE_SECRET = Deno.env.get("STRIPE_SECRET_KEY")!;
const STRIPE_WEBHOOK_SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET") || "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SB_SERVICE_ROLE_KEY")!;
const TOLERANCE_SECONDS = 300; // Reject events older than 5 min (replay protection)

// Manually verify the Stripe webhook signature (Stripe-Signature header).
// Format: "t=<timestamp>,v1=<sig1>[,v1=<sig2>...]". We HMAC-SHA256 the
// signed_payload = timestamp + "." + body and compare to any v1 value.
async function verifyStripeSignature(
  body: string,
  header: string,
  secret: string,
): Promise<boolean> {
  if (!header || !secret) return false;
  const parts = Object.fromEntries(
    header.split(",").map((kv) => {
      const [k, v] = kv.split("=");
      return [k.trim(), (v || "").trim()];
    }),
  );
  const timestamp = parts.t;
  const v1 = header
    .split(",")
    .filter((kv) => kv.trim().startsWith("v1="))
    .map((kv) => kv.split("=")[1].trim());
  if (!timestamp || v1.length === 0) return false;
  // Replay protection: reject old events
  const ts = parseInt(timestamp, 10);
  if (!Number.isFinite(ts)) return false;
  if (Math.abs(Date.now() / 1000 - ts) > TOLERANCE_SECONDS) return false;

  const signedPayload = `${timestamp}.${body}`;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sigBytes = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(signedPayload),
  );
  const expected = Array.from(new Uint8Array(sigBytes))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  // Constant-time-ish compare against any provided v1 signature
  for (const candidate of v1) {
    if (candidate.length === expected.length) {
      let diff = 0;
      for (let i = 0; i < expected.length; i++) {
        diff |= expected.charCodeAt(i) ^ candidate.charCodeAt(i);
      }
      if (diff === 0) return true;
    }
  }
  return false;
}

const PRICE_PRO = "price_1TEBJA3uvj2cFz0kVaA3CLPb";
const PRICE_BUSINESS = "price_1TEwgr3uvj2cFz0kQ29jzCbR";

function priceIdToPlan(priceId: string): string {
  if (priceId === PRICE_BUSINESS) return "business";
  if (priceId === PRICE_PRO) return "pro";
  return "premium";
}

async function supabaseRequest(path: string, method: string, body?: Record<string, unknown>) {
  const opts: RequestInit = {
    method,
    headers: {
      "apikey": SUPABASE_SERVICE_KEY,
      "Authorization": `Bearer ${SUPABASE_SERVICE_KEY}`,
      "Content-Type": "application/json",
      "Prefer": "return=minimal",
    },
  };
  if (body) opts.body = JSON.stringify(body);
  return fetch(`${SUPABASE_URL}/rest/v1/${path}`, opts);
}

async function updateUserPlan(userId: string, plan: string, stripeCustomerId?: string, stripeSubId?: string, periodEnd?: string) {
  // Update subscriptions table
  const subBody: Record<string, string> = { plan, updated_at: new Date().toISOString() };
  if (stripeCustomerId) subBody.stripe_customer_id = stripeCustomerId;
  if (stripeSubId) subBody.stripe_subscription_id = stripeSubId;
  if (periodEnd) subBody.current_period_end = periodEnd;
  await supabaseRequest(`subscriptions?user_id=eq.${userId}`, "PATCH", subBody);

  // Update organizations table (where the app reads the plan)
  const { data: members } = await (await fetch(`${SUPABASE_URL}/rest/v1/members?user_id=eq.${userId}&select=org_id`, {
    headers: { "apikey": SUPABASE_SERVICE_KEY, "Authorization": `Bearer ${SUPABASE_SERVICE_KEY}` },
  })).json();
  
  if (members && members.length > 0) {
    await supabaseRequest(`organizations?id=eq.${members[0].org_id}`, "PATCH", { plan });
    console.log(`Updated org ${members[0].org_id} plan to ${plan}`);
  }
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const body = await req.text();

    // Verify the Stripe-Signature header before trusting any payload.
    // STRIPE_WEBHOOK_SECRET must be set in Supabase secrets — get it from
    // Stripe Dashboard > Developers > Webhooks > endpoint > Signing secret.
    if (!STRIPE_WEBHOOK_SECRET) {
      console.error("STRIPE_WEBHOOK_SECRET not configured — refusing webhook");
      return new Response("Webhook secret not configured", { status: 500 });
    }
    const sigHeader = req.headers.get("stripe-signature") || "";
    const valid = await verifyStripeSignature(body, sigHeader, STRIPE_WEBHOOK_SECRET);
    if (!valid) {
      console.warn("Invalid Stripe signature — rejected");
      return new Response("Invalid signature", { status: 400 });
    }

    const event = JSON.parse(body);
    const type = event.type;
    const obj = event.data?.object;

    console.log(`Stripe event: ${type}`);

    // ─────────────────────────────────────────────────────────────
    // STRIPE CONNECT events (v9.66+)
    // ─────────────────────────────────────────────────────────────
    if (type === "account.updated") {
      // KYC status change for a connected account. Sync to members.
      const accountId = obj.id;
      const patch = {
        stripe_charges_enabled: !!obj.charges_enabled,
        stripe_payouts_enabled: !!obj.payouts_enabled,
        stripe_details_submitted: !!obj.details_submitted,
        stripe_account_updated_at: new Date().toISOString(),
      };
      await supabaseRequest(`members?stripe_account_id=eq.${accountId}`, "PATCH", patch);
      console.log(`account.updated: ${accountId} charges=${obj.charges_enabled} payouts=${obj.payouts_enabled}`);

      // Quick Win #5 — bank account / IBAN change detection.
      // Stripe doesn't include the previous_attributes by default unless we
      // listen to `account.external_account.updated`. Here we check if
      // `external_accounts.data[0].last4` is set and audit it as a critical
      // event. We also notify the owner (push + audit) so they can react if
      // it wasn't them.
      try {
        const externalAccts = obj.external_accounts?.data || [];
        if (externalAccts.length > 0) {
          const ext = externalAccts[0];
          const newLast4 = ext.last4 || ext.bank_account_last4 || '';
          // Look up the cached last4 from members metadata (if we track it).
          // Without history, we conservatively log every update on payout-eligible accounts.
          const r = await fetch(`${SUPABASE_URL}/rest/v1/members?stripe_account_id=eq.${accountId}&select=user_id,org_id,display_name,stripe_payouts_enabled`, {
            headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` },
          });
          const members = await r.json();
          for (const m of (members || [])) {
            // Insert audit_log directly via REST (we cannot import the helper here without breaking the existing webhook structure)
            await fetch(`${SUPABASE_URL}/rest/v1/audit_log`, {
              method: 'POST',
              headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
              body: JSON.stringify({
                user_id: m.user_id, org_id: m.org_id,
                action: 'stripe.account_external_account_updated',
                resource_type: 'stripe_account', resource_id: accountId,
                metadata: { last4: newLast4, type: ext.object || 'bank_account', charges_enabled: obj.charges_enabled, payouts_enabled: obj.payouts_enabled },
                severity: 'warning',
              }),
            });
            // Try to send a push notification to the affected user (best-effort)
            if (m.user_id) {
              await fetch(`${SUPABASE_URL}/functions/v1/send-push`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  user_id: m.user_id,
                  title: '🔔 Modification de ton compte de paiement',
                  body: 'Tes informations bancaires Stripe ont ete modifiees. Si ce n\'est pas toi, contacte le support immediatement.',
                  tag: 'stripe-iban-' + accountId.slice(-8),
                }),
              }).catch(() => {});
            }
          }
        }
      } catch (e) {
        console.error('account.updated audit/notify error:', e);
      }
      return new Response(JSON.stringify({ received: true }), { headers: { "Content-Type": "application/json" } });
    }

    if (type === "payment_intent.succeeded") {
      // Could be Lokizio subscription OR an invoice payment via Connect.
      // We distinguish by metadata.lokizio_invoice_id.
      const invoiceId = obj.metadata?.lokizio_invoice_id;
      if (invoiceId) {
        // Sprint 3A: don't go straight to 'paid' — enter the review window.
        // The client has 7 days to dispute; auto-refund if they do. After the
        // window expires (cron job), status flips to 'paid' definitively.
        const REVIEW_WINDOW_DAYS = 7;
        const reviewUntil = new Date(Date.now() + REVIEW_WINDOW_DAYS * 86400 * 1000).toISOString();
        // Generate one-time tokens for the client (no auth required).
        // 32 random hex chars each = 128 bits of entropy.
        const mkToken = () => {
          const b = new Uint8Array(16);
          crypto.getRandomValues(b);
          return Array.from(b).map(x => x.toString(16).padStart(2, '0')).join('');
        };
        const disputeToken = mkToken();           // expires at review_window_until (7j)
        const reviewToken = mkToken();             // expires at review_token_expires_at (90j)
        const REVIEW_TOKEN_DAYS = 90;
        const reviewTokenExpires = new Date(Date.now() + REVIEW_TOKEN_DAYS * 86400 * 1000).toISOString();
        await supabaseRequest(`invoices?id=eq.${invoiceId}`, "PATCH", {
          stripe_payment_status: "succeeded",
          stripe_paid_at: new Date().toISOString(),
          status: "paid_pending_review",
          review_window_until: reviewUntil,
          client_dispute_token: disputeToken,
          client_review_token: reviewToken,
          review_token_expires_at: reviewTokenExpires,
        });
        console.log(`payment_intent.succeeded: invoice ${invoiceId} -> paid_pending_review until ${reviewUntil} (review until ${reviewTokenExpires})`);
        return new Response(JSON.stringify({ received: true }), { headers: { "Content-Type": "application/json" } });
      }
    }

    if (type === "payment_intent.payment_failed" || type === "payment_intent.canceled") {
      const invoiceId = obj.metadata?.lokizio_invoice_id;
      if (invoiceId) {
        await supabaseRequest(`invoices?id=eq.${invoiceId}`, "PATCH", {
          stripe_payment_status: type === "payment_intent.canceled" ? "canceled" : "failed",
        });
        console.log(`${type}: invoice ${invoiceId}`);
        return new Response(JSON.stringify({ received: true }), { headers: { "Content-Type": "application/json" } });
      }
    }

    if (type === "charge.refunded") {
      // Refund completed. Find invoice by payment_intent (charge.payment_intent is set).
      const piId = obj.payment_intent;
      if (piId) {
        await supabaseRequest(`invoices?stripe_payment_intent_id=eq.${piId}`, "PATCH", {
          stripe_payment_status: "refunded",
        });
        console.log(`charge.refunded: PI ${piId} marked refunded`);
        return new Response(JSON.stringify({ received: true }), { headers: { "Content-Type": "application/json" } });
      }
    }

    if (type === "charge.dispute.created") {
      // Customer initiated a chargeback — log + mark invoice as disputed.
      const piId = obj.payment_intent;
      if (piId) {
        await supabaseRequest(`invoices?stripe_payment_intent_id=eq.${piId}`, "PATCH", {
          stripe_payment_status: "disputed",
        });
        console.error(`DISPUTE OPENED on PI ${piId} reason=${obj.reason} amount=${obj.amount}`);
        return new Response(JSON.stringify({ received: true }), { headers: { "Content-Type": "application/json" } });
      }
    }

    // ─────────────────────────────────────────────────────────────
    // SUBSCRIPTION events (existing Lokizio Pro/Business plan)
    // ─────────────────────────────────────────────────────────────
    if (type === "checkout.session.completed") {
      const userId = obj.client_reference_id || obj.metadata?.user_id;
      if (userId) {
        // Get the price from the subscription to determine plan
        let plan = "business";
        if (obj.subscription) {
          const subResp = await fetch(`https://api.stripe.com/v1/subscriptions/${obj.subscription}`, {
            headers: { "Authorization": `Bearer ${STRIPE_SECRET}` },
          });
          const sub = await subResp.json();
          if (sub.items?.data?.[0]?.price?.id) {
            plan = priceIdToPlan(sub.items.data[0].price.id);
          }
        }
        await updateUserPlan(userId, plan, obj.customer, obj.subscription);
        console.log(`User ${userId} upgraded to ${plan}`);
      }
    } else if (type === "customer.subscription.updated") {
      const userId = obj.metadata?.user_id;
      const status = obj.status;
      const priceId = obj.items?.data?.[0]?.price?.id;
      const periodEnd = obj.current_period_end
        ? new Date(obj.current_period_end * 1000).toISOString()
        : null;
      if (userId) {
        const plan = (status === "active" || status === "trialing") 
          ? (priceId ? priceIdToPlan(priceId) : "premium") 
          : "free";
        await updateUserPlan(userId, plan, obj.customer, obj.id, periodEnd || undefined);
        console.log(`User ${userId} subscription ${status} -> ${plan}`);
      }
    } else if (type === "customer.subscription.deleted") {
      const userId = obj.metadata?.user_id;
      if (userId) {
        await updateUserPlan(userId, "free");
        console.log(`User ${userId} downgraded to free`);
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Webhook error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
});
