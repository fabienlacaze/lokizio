// Edge Function: submit-review
//
// Lets the CLIENT (not authenticated in Lokizio) submit a verified review
// for a paid invoice. The review_token was generated when payment succeeded
// and is embedded in the "Noter ce prestataire" button in the invoice email.
// Valid for 90 days after payment.
//
// Body: { review_token, rating: 1..5, comment? }
// Auth: NONE (token is the auth)
// Returns: { review_id, ok: true }

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { audit, enforceRateLimit } from '../_shared/security.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

Deno.serve(async (req) => {
  const cors = corsHeaders(req);
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  try {
    const { review_token, rating, comment } = await req.json();
    if (!review_token || !/^[a-f0-9]{32}$/i.test(review_token)) {
      return Response.json({ error: 'Invalid review_token' }, { status: 400, headers: cors });
    }
    if (typeof rating !== 'number' || rating < 1 || rating > 5) {
      return Response.json({ error: 'Rating must be 1-5' }, { status: 400, headers: cors });
    }
    if (comment && (typeof comment !== 'string' || comment.length > 2000)) {
      return Response.json({ error: 'Comment too long (max 2000 chars)' }, { status: 400, headers: cors });
    }

    // Rate limit by token (max 3 attempts per token per hour)
    const rl = await enforceRateLimit({
      user_id: review_token,
      bucket: 'submit_review_h',
      max_per_window: 3,
      window_seconds: 3600,
    }, cors);
    if (rl) return rl;

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const { data: invoice, error } = await admin
      .from('invoices')
      .select('id, org_id, created_by, client_email, review_token_expires_at, status')
      .eq('client_review_token', review_token)
      .maybeSingle();
    if (error) throw error;
    if (!invoice) {
      return Response.json({ error: 'Invalid or expired review link' }, { status: 404, headers: cors });
    }
    if (!['paid', 'paid_pending_review'].includes(invoice.status || '')) {
      return Response.json({ error: 'Invoice is not in a reviewable state (status=' + invoice.status + ')' }, { status: 400, headers: cors });
    }
    // Check token expiry
    if (invoice.review_token_expires_at) {
      const expiresAt = new Date(invoice.review_token_expires_at).getTime();
      if (Date.now() > expiresAt) {
        return Response.json({ error: 'Review link expired' }, { status: 400, headers: cors });
      }
    }

    // Check that no review exists yet for this invoice (1 review max)
    const { data: existing } = await admin
      .from('reviews').select('id').eq('invoice_id', invoice.id).maybeSingle();
    if (existing) {
      return Response.json({ error: 'A review already exists for this invoice' }, { status: 409, headers: cors });
    }

    const { data: inserted, error: insErr } = await admin.from('reviews').insert({
      invoice_id: invoice.id,
      org_id: invoice.org_id,
      provider_user_id: invoice.created_by || null,
      client_email: invoice.client_email || null,
      rating: Math.round(rating),
      comment: (comment || '').trim() || null,
      status: 'published',
    }).select('id').maybeSingle();
    if (insErr) throw insErr;

    audit({
      user_id: null,
      org_id: invoice.org_id,
      action: 'review.submitted',
      resource_type: 'review',
      resource_id: inserted?.id || '',
      metadata: { invoice_id: invoice.id, rating: Math.round(rating), has_comment: !!comment },
      severity: 'info',
    }).catch(() => {});

    // Sprint 4A: notify the provider (email + push, best-effort)
    if (invoice.created_by) {
      fetch(`${SUPABASE_URL}/functions/v1/notify-provider`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: invoice.created_by,
          event_type: 'review_received',
          context: { rating: Math.round(rating), comment: (comment || '').slice(0, 500), invoice_id: invoice.id },
        }),
      }).catch(() => {});
    }

    return Response.json({ review_id: inserted?.id, ok: true }, { headers: cors });
  } catch (e: any) {
    console.error('submit-review error:', e);
    return Response.json({ error: String(e?.message || e) }, { status: 500, headers: cors });
  }
});
