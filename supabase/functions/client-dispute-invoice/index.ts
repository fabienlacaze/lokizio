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
import { audit, checkRateLimit } from '../_shared/security.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
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
  // Sprint 4 fix BLOCKER #1: Stripe Idempotency-Key prevents duplicate
  // refunds on network retry. Stripe accepts same key for 24h.
  if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;
  const r = await fetch(`https://api.stripe.com/v1${path}`, {
    method: 'POST',
    headers,
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

    // Sprint 4 fix BLOCKER #4: hardened rate limiting per IP for token guessing.
    // Strict: 5 attempts per hour per IP. Failed token lookups also count.
    const ip = (req.headers.get('x-forwarded-for') || req.headers.get('cf-connecting-ip') || '').split(',')[0].trim() || 'unknown';
    const rl = await checkRateLimit({
      user_id: 'dispute_ip_' + ip,
      bucket: 'dispute_attempts_h',
      max_per_window: 5,
      window_seconds: 3600,
    });
    if (!rl.allowed) {
      audit({
        user_id: null,
        action: 'dispute.brute_force_attempt',
        metadata: { ip, count: rl.count },
        severity: 'critical',
      }).catch(() => {});
      return Response.json({ error: 'Too many attempts. Try again later.' }, { status: 429, headers: { ...cors, 'Retry-After': '3600' } });
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

    // Sprint 4 fix BLOCKER #2: atomic transition. Mark invoice as "dispute
    // in flight" BEFORE calling Stripe. WHERE status='paid_pending_review'
    // ensures we lose the race against the cron-close-review-windows if it
    // already flipped the status to 'paid'. If 0 rows affected, abort.
    const claimedAt = new Date().toISOString();
    const { data: claimed, error: claimErr } = await admin.from('invoices').update({
      disputed_by_client_at: claimedAt,
      client_dispute_reason: (reason || '').slice(0, 1000) || null,
      stripe_payment_status: 'refund_pending',
      client_dispute_token: null, // single-use, neutralized now
    }).eq('id', invoice.id).eq('status', 'paid_pending_review').eq('disputed_by_client_at', null as unknown as string).select('id').maybeSingle();
    // PostgREST cannot do .eq(null), use .is() instead
    if (claimErr) {
      // Fallback: use .is for null check
      const { data: claimed2, error: e2 } = await admin.from('invoices').update({
        disputed_by_client_at: claimedAt,
        client_dispute_reason: (reason || '').slice(0, 1000) || null,
        stripe_payment_status: 'refund_pending',
        client_dispute_token: null,
      }).eq('id', invoice.id).eq('status', 'paid_pending_review').is('disputed_by_client_at', null).select('id').maybeSingle();
      if (e2 || !claimed2) {
        return Response.json({ error: 'Cannot claim invoice for dispute — review window closed or already disputed' }, { status: 409, headers: cors });
      }
    } else if (!claimed) {
      return Response.json({ error: 'Cannot claim invoice for dispute — review window closed or already disputed' }, { status: 409, headers: cors });
    }

    // Sprint 4 fix BLOCKER #3: write audit_log AFTER claim but BEFORE Stripe call.
    // This way we have a trace even if Stripe fails or the final UPDATE crashes.
    // Status='refund_pending' in DB marks the claim. We finalize on Stripe success.
    audit({
      user_id: null,
      org_id: invoice.org_id,
      action: 'invoice.client_dispute_initiated',
      resource_type: 'invoice',
      resource_id: invoice.id,
      metadata: {
        amount_cents_invoice: Math.round((invoice.total_ttc || 0) * 100),
        reason: (reason || '').slice(0, 200),
        payment_intent_id: invoice.stripe_payment_intent_id,
      },
      severity: 'warning',
    }).catch(() => {});

    // Sprint 4 fix BLOCKER #1: Idempotency-Key derived from invoice.id —
    // same dispute on same invoice = same key. Stripe deduplicates for 24h.
    const idempotencyKey = `dispute-${invoice.id}-${claimedAt.slice(0, 10)}`;
    const refund = await stripeApi('/refunds', {
      payment_intent: invoice.stripe_payment_intent_id,
      refund_application_fee: 'true',
      reverse_transfer: 'true',
      'metadata[lokizio_invoice_id]': invoice.id,
      'metadata[lokizio_org_id]': invoice.org_id,
      'metadata[disputed_by]': 'client',
    }, idempotencyKey);

    // Finalize state — only flip if we still are in 'refund_pending' (defensive)
    await admin.from('invoices').update({
      status: 'draft', // back to draft since money returned
      stripe_payment_status: 'refunded',
    }).eq('id', invoice.id).eq('stripe_payment_status', 'refund_pending');

    audit({
      user_id: null,
      org_id: invoice.org_id,
      action: 'invoice.client_disputed_finalized',
      resource_type: 'invoice',
      resource_id: invoice.id,
      metadata: {
        refund_id: refund.id,
        amount_cents: refund.amount,
        idempotency_key: idempotencyKey,
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
