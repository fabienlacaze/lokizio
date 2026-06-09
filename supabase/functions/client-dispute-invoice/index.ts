// Edge Function: client-dispute-invoice
//
// Lets the CLIENT (not authenticated in Lokizio) dispute an invoice during
// the 7-day review window. The dispute_token was generated when the payment
// succeeded and is embedded in the "Contester" button in the invoice email.
// On valid dispute, we immediately initiate a refund via Stripe.
//
// Body: { dispute_token, reason? }
// Auth: NONE (the token is the auth)
// Returns: { refunded: true, invoice_id }

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { audit } from '../_shared/security.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
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
  if (!r.ok) throw new Error(`Stripe ${r.status}: ${json.error?.message || JSON.stringify(json)}`);
  return json;
}

Deno.serve(async (req) => {
  const cors = corsHeaders(req);
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  try {
    if (!STRIPE_SECRET_KEY) {
      return Response.json({ error: 'STRIPE_SECRET_KEY not configured' }, { status: 500, headers: cors });
    }
    const { dispute_token, reason } = await req.json();
    if (!dispute_token || !/^[a-f0-9]{32}$/i.test(dispute_token)) {
      return Response.json({ error: 'Invalid dispute_token' }, { status: 400, headers: cors });
    }

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const { data: invoice, error } = await admin
      .from('invoices')
      .select('id, org_id, status, review_window_until, stripe_payment_intent_id, disputed_by_client_at, total_ttc')
      .eq('client_dispute_token', dispute_token)
      .maybeSingle();
    if (error) throw error;
    if (!invoice) {
      return Response.json({ error: 'Invalid or expired dispute link' }, { status: 404, headers: cors });
    }
    if (invoice.disputed_by_client_at) {
      return Response.json({ error: 'Already disputed' }, { status: 400, headers: cors });
    }
    if (invoice.status !== 'paid_pending_review') {
      return Response.json({ error: 'Review window already closed or invoice not in review state (status=' + invoice.status + ')' }, { status: 400, headers: cors });
    }
    const now = Date.now();
    const until = invoice.review_window_until ? new Date(invoice.review_window_until).getTime() : 0;
    if (now > until) {
      return Response.json({ error: 'Review window expired' }, { status: 400, headers: cors });
    }
    if (!invoice.stripe_payment_intent_id) {
      return Response.json({ error: 'No payment intent attached — cannot refund' }, { status: 400, headers: cors });
    }

    // Initiate the refund (full + reverse application_fee + reverse_transfer)
    const refund = await stripeApi('/refunds', {
      payment_intent: invoice.stripe_payment_intent_id,
      refund_application_fee: 'true',
      reverse_transfer: 'true',
      'metadata[lokizio_invoice_id]': invoice.id,
      'metadata[lokizio_org_id]': invoice.org_id,
      'metadata[disputed_by]': 'client',
    });

    await admin.from('invoices').update({
      disputed_by_client_at: new Date().toISOString(),
      client_dispute_reason: (reason || '').slice(0, 1000) || null,
      status: 'draft', // back to draft since money returned
      stripe_payment_status: 'refunded',
      client_dispute_token: null, // single-use
    }).eq('id', invoice.id);

    audit({
      user_id: null,
      org_id: invoice.org_id,
      action: 'invoice.client_disputed',
      resource_type: 'invoice',
      resource_id: invoice.id,
      metadata: {
        refund_id: refund.id,
        amount_cents: refund.amount,
        reason: (reason || '').slice(0, 200),
      },
      severity: 'warning',
    }).catch(() => {});

    // Sprint 4A: notify the provider of the dispute (best-effort)
    // We need to fetch created_by since the initial query doesn't include it
    try {
      const { data: invFull } = await admin
        .from('invoices').select('created_by, invoice_number').eq('id', invoice.id).maybeSingle();
      if (invFull?.created_by) {
        fetch(`${SUPABASE_URL}/functions/v1/notify-provider`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_id: invFull.created_by,
            event_type: 'dispute_opened',
            context: {
              invoice_id: invoice.id,
              invoice_number: invFull.invoice_number,
              amount_cents: refund.amount,
              reason: (reason || '').slice(0, 500),
            },
          }),
        }).catch(() => {});
      }
    } catch (_) { /* best-effort */ }

    return Response.json({
      refunded: true,
      invoice_id: invoice.id,
      refund_id: refund.id,
      amount_cents: refund.amount,
    }, { headers: cors });
  } catch (e: any) {
    console.error('client-dispute-invoice error:', e);
    return Response.json({ error: String(e?.message || e) }, { status: 500, headers: cors });
  }
});
