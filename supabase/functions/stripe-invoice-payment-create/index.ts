// Edge Function: stripe-invoice-payment-create
//
// Creates a hosted Stripe Checkout Session for an invoice payment.
// Uses Direct Charges: the destination connected account (the invoice
// creator with stripe_account_id) gets the money, Lokizio takes a 3%
// application_fee_amount.
//
// Body: { invoice_id }
// Auth: Bearer JWT (caller must be a member of the invoice's org)
// Returns: { payment_link, payment_intent_id, expires_at }

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, requireAuth } from '../_shared/cors.ts';
import { audit, enforceRateLimit } from '../_shared/security.ts';

const MAX_INVOICE_AMOUNT_EUR = 50000; // Quick Win #3 — sanity ceiling, blocks fraud / typo
const MIN_INVOICE_AMOUNT_EUR = 0.5;

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
    // Quick Win #2: rate limit (5 payment-create calls/min/user)
    const rl = await enforceRateLimit({
      user_id: userId,
      bucket: 'stripe_payment_create_min',
      max_per_window: 5,
      window_seconds: 60,
    }, cors);
    if (rl) return rl;

    const { invoice_id } = await req.json();
    if (!invoice_id) {
      return Response.json({ error: 'Missing invoice_id' }, { status: 400, headers: cors });
    }

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Load invoice + verify caller is in the same org
    const { data: invoice } = await admin
      .from('invoices')
      .select('*')
      .eq('id', invoice_id)
      .maybeSingle();
    if (!invoice) return Response.json({ error: 'Invoice not found' }, { status: 404, headers: cors });

    const { data: callerMember } = await admin
      .from('members')
      .select('id, role')
      .eq('user_id', userId)
      .eq('org_id', invoice.org_id)
      .eq('accepted', true)
      .maybeSingle();
    if (!callerMember) {
      return Response.json({ error: 'Forbidden: caller is not a member of the invoice org' }, { status: 403, headers: cors });
    }

    // Find the BENEFICIARY (the user who created the invoice). For now we use
    // invoice.created_by → the user whose Stripe Connect account receives the
    // money.
    if (!invoice.created_by) {
      return Response.json({ error: 'Invoice has no created_by — cannot determine beneficiary' }, { status: 400, headers: cors });
    }
    // SECURITY: lookup beneficiary BY org_id + user_id to prevent cross-org
    // payment routing. Otherwise an invoice created by a user who's a member
    // of multiple orgs could route payment to a Stripe account from a
    // different org than the invoice's own (audit finding wz3hcekr9).
    const { data: beneficiaryMember } = await admin
      .from('members')
      .select('stripe_account_id, stripe_charges_enabled, accepted')
      .eq('user_id', invoice.created_by)
      .eq('org_id', invoice.org_id)
      .eq('accepted', true)
      .not('stripe_account_id', 'is', null)
      .maybeSingle();
    if (!beneficiaryMember?.stripe_account_id) {
      return Response.json({ error: 'Beneficiary has not enabled Stripe Connect' }, { status: 400, headers: cors });
    }
    if (!beneficiaryMember.stripe_charges_enabled) {
      return Response.json({ error: 'Beneficiary Stripe account is not yet enabled for charges (KYC incomplete)' }, { status: 400, headers: cors });
    }

    // Load platform fee config
    const { data: config } = await admin
      .from('platform_config')
      .select('value')
      .eq('key', 'stripe_connect')
      .maybeSingle();
    const feePercent = Number(config?.value?.fee_percent ?? 3.0);
    const feeFixedCents = Number(config?.value?.fee_fixed_cents ?? 0);

    const amountCents = Math.round((invoice.total_ttc || 0) * 100);
    // Quick Win #3: enforce sane amount bounds (anti-fraud + anti-typo)
    if (amountCents < Math.round(MIN_INVOICE_AMOUNT_EUR * 100)) {
      return Response.json({ error: `Invoice amount below minimum (${MIN_INVOICE_AMOUNT_EUR} EUR)` }, { status: 400, headers: cors });
    }
    if (amountCents > Math.round(MAX_INVOICE_AMOUNT_EUR * 100)) {
      await audit({
        user_id: userId, org_id: invoice.org_id,
        action: 'invoice.amount_over_limit', resource_type: 'invoice', resource_id: invoice.id,
        metadata: { amount_cents: amountCents, limit_cents: MAX_INVOICE_AMOUNT_EUR * 100 },
        severity: 'warning',
      });
      return Response.json({ error: `Invoice amount exceeds maximum (${MAX_INVOICE_AMOUNT_EUR} EUR). Contact support to raise the limit.` }, { status: 400, headers: cors });
    }
    const applicationFee = Math.round(amountCents * (feePercent / 100)) + feeFixedCents;

    // Create a Checkout Session (hosted Stripe payment page).
    // Direct charges model: use Stripe-Account header → charge happens ON the
    // connected account; we take application_fee_amount.
    const session = await stripeApi('/checkout/sessions', {
      mode: 'payment',
      'payment_method_types[]': 'card',
      'line_items[0][price_data][currency]': 'eur',
      'line_items[0][price_data][unit_amount]': String(amountCents),
      'line_items[0][price_data][product_data][name]': `Facture ${invoice.invoice_number || invoice.id}`,
      'line_items[0][price_data][product_data][description]': (invoice.client_name || 'Lokizio') + (invoice.property_name ? ` — ${invoice.property_name}` : ''),
      'line_items[0][quantity]': '1',
      'payment_intent_data[application_fee_amount]': String(applicationFee),
      'payment_intent_data[transfer_data][destination]': beneficiaryMember.stripe_account_id,
      'payment_intent_data[metadata][lokizio_invoice_id]': invoice.id,
      'payment_intent_data[metadata][lokizio_org_id]': invoice.org_id,
      success_url: `${APP_URL}#payment-success?invoice=${invoice.id}`,
      cancel_url: `${APP_URL}#payment-cancel?invoice=${invoice.id}`,
      customer_email: invoice.client_email || '',
    });

    // Persist
    await admin.from('invoices')
      .update({
        stripe_payment_intent_id: session.payment_intent || null,
        stripe_payment_status: 'requires_payment_method',
        stripe_application_fee_amount: applicationFee,
        stripe_destination_account_id: beneficiaryMember.stripe_account_id,
        payment_link: session.url,
      })
      .eq('id', invoice.id);

    // Quick Win #4: audit log
    audit({
      user_id: userId, org_id: invoice.org_id,
      action: 'invoice.payment_link_created',
      resource_type: 'invoice', resource_id: invoice.id,
      metadata: {
        amount_cents: amountCents,
        application_fee_cents: applicationFee,
        destination_account: beneficiaryMember.stripe_account_id,
        session_id: session.id,
      },
    }).catch(() => {});

    return Response.json({
      payment_link: session.url,
      payment_intent_id: session.payment_intent,
      session_id: session.id,
      amount_total: amountCents,
      application_fee_amount: applicationFee,
      destination_account: beneficiaryMember.stripe_account_id,
    }, { headers: cors });
  } catch (e) {
    console.error('stripe-invoice-payment-create error:', e);
    return Response.json({ error: String(e?.message || e) }, { status: 500, headers: cors });
  }
});
