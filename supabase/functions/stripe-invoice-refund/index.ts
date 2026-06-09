// Edge Function: stripe-invoice-refund
//
// Issues a full refund on a paid Stripe invoice. The Lokizio application fee
// is also reversed (refund_application_fee=true on the Refund object).
//
// Body: { invoice_id }
// Auth: Bearer JWT (caller must be admin/concierge in the invoice org OR
//       the invoice.created_by themselves)
// Returns: { refund_id, amount, status }

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, requireAuth } from '../_shared/cors.ts';
import { audit, enforceRateLimit } from '../_shared/security.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY')!;

async function stripeApi(path: string, body: Record<string, string>, idempotencyKey?: string): Promise<any> {
  const form = new URLSearchParams();
  for (const [k, v] of Object.entries(body)) {
    if (v !== undefined && v !== null) form.append(k, String(v));
  }
  const headers: Record<string, string> = {
    Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
    'Content-Type': 'application/x-www-form-urlencoded',
  };
  // Sprint 4 fix BLOCKER #1: Idempotency-Key prevents duplicate refunds on retry.
  if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;
  const r = await fetch(`https://api.stripe.com/v1${path}`, {
    method: 'POST',
    headers,
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
    // Rate limit refunds to prevent replay/spam (3/min/user)
    const rl = await enforceRateLimit({
      user_id: userId,
      bucket: 'stripe_refund_min',
      max_per_window: 3,
      window_seconds: 60,
    }, cors);
    if (rl) return rl;

    const { invoice_id } = await req.json();
    if (!invoice_id) {
      return Response.json({ error: 'Missing invoice_id' }, { status: 400, headers: cors });
    }

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const { data: invoice } = await admin
      .from('invoices')
      .select('*')
      .eq('id', invoice_id)
      .maybeSingle();
    if (!invoice) {
      return Response.json({ error: 'Invoice not found' }, { status: 404, headers: cors });
    }
    if (!invoice.stripe_payment_intent_id) {
      return Response.json({ error: 'This invoice was not paid via Stripe' }, { status: 400, headers: cors });
    }
    if (invoice.stripe_payment_status !== 'succeeded') {
      return Response.json({ error: 'Invoice is not in succeeded state (current: ' + invoice.stripe_payment_status + ')' }, { status: 400, headers: cors });
    }

    // Authorize: caller must be admin/concierge in the org OR be the original beneficiary
    const { data: callerMember } = await admin
      .from('members')
      .select('role')
      .eq('user_id', userId)
      .eq('org_id', invoice.org_id)
      .eq('accepted', true)
      .maybeSingle();
    if (!callerMember) {
      return Response.json({ error: 'Forbidden: not a member of the invoice org' }, { status: 403, headers: cors });
    }
    const isPrivileged = callerMember.role === 'admin' || callerMember.role === 'concierge';
    const isOriginalBeneficiary = userId === invoice.created_by;
    if (!isPrivileged && !isOriginalBeneficiary) {
      return Response.json({ error: 'Forbidden: only admin/concierge or original beneficiary can refund' }, { status: 403, headers: cors });
    }

    // Issue the refund. refund_application_fee=true reverses Lokizio's 3% too.
    // reverse_transfer=true is implicit for Direct Charges with destination.
    // Idempotency-Key derived from invoice + user + day prevents double refund.
    const idempotencyKey = `refund-${invoice.id}-${userId}-${new Date().toISOString().slice(0, 10)}`;
    const refund = await stripeApi('/refunds', {
      payment_intent: invoice.stripe_payment_intent_id,
      refund_application_fee: 'true',
      reverse_transfer: 'true',
      'metadata[lokizio_invoice_id]': invoice.id,
      'metadata[lokizio_org_id]': invoice.org_id,
      'metadata[refunded_by]': userId,
    }, idempotencyKey);

    // Persist (webhook charge.refunded will also fire but we update immediately for UX)
    await admin.from('invoices').update({
      stripe_payment_status: 'refunded',
      status: 'draft', // back to draft since money returned; user can decide
    }).eq('id', invoice.id);

    // Audit: critical financial action — keep severity=warning for forensics
    audit({
      user_id: userId, org_id: invoice.org_id,
      action: 'stripe.refund_issued',
      resource_type: 'invoice', resource_id: invoice.id,
      metadata: {
        refund_id: refund.id,
        amount_cents: refund.amount,
        payment_intent_id: invoice.stripe_payment_intent_id,
        caller_role: callerMember.role,
        was_original_beneficiary: userId === invoice.created_by,
      },
      severity: 'warning',
    }).catch(() => {});

    return Response.json({
      refund_id: refund.id,
      amount: refund.amount,
      status: refund.status,
    }, { headers: cors });
  } catch (e) {
    console.error('stripe-invoice-refund error:', e);
    return Response.json({ error: String(e?.message || e) }, { status: 500, headers: cors });
  }
});
