// Edge Function: cron-close-review-windows
//
// Scheduled job (via Supabase cron / pg_cron / external scheduler) that
// flips invoices from 'paid_pending_review' to 'paid' once the review window
// has expired without a client dispute. To run, schedule it every 15 min:
//   supabase functions secret set CRON_TOKEN=<random>
//   then via pg_cron or external (cron-job.org free tier) POST hourly with
//   Authorization: Bearer <CRON_TOKEN>
//
// Body: {}
// Auth: CRON_TOKEN bearer (not user JWT)
// Returns: { closed_count }

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { audit } from '../_shared/security.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const CRON_TOKEN = Deno.env.get('CRON_TOKEN') || '';

Deno.serve(async (req) => {
  const cors = corsHeaders(req);
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  try {
    // Auth: cron token bearer (not user JWT)
    const auth = req.headers.get('Authorization') || '';
    const provided = auth.replace(/^Bearer\s+/i, '').trim();
    if (!CRON_TOKEN || provided !== CRON_TOKEN) {
      return Response.json({ error: 'Forbidden' }, { status: 403, headers: cors });
    }

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const nowIso = new Date().toISOString();

    // Find invoices whose review window has expired
    const { data: pending, error } = await admin
      .from('invoices')
      .select('id, org_id, total_ttc, review_window_until')
      .eq('status', 'paid_pending_review')
      .lt('review_window_until', nowIso);
    if (error) throw error;

    let closed = 0;
    for (const inv of (pending || [])) {
      const { error: updErr } = await admin.from('invoices').update({
        status: 'paid',
        review_auto_closed_at: nowIso,
        client_dispute_token: null, // expire the magic link
      }).eq('id', inv.id);
      if (!updErr) {
        closed++;
        audit({
          user_id: null,
          org_id: inv.org_id,
          action: 'invoice.review_window_closed',
          resource_type: 'invoice',
          resource_id: inv.id,
          metadata: { closed_at: nowIso, amount_eur: inv.total_ttc || 0 },
          severity: 'info',
        }).catch(() => {});
      }
    }

    return Response.json({
      closed_count: closed,
      total_pending_checked: pending?.length || 0,
      now: nowIso,
    }, { headers: cors });
  } catch (e: any) {
    console.error('cron-close-review-windows error:', e);
    return Response.json({ error: String(e?.message || e) }, { status: 500, headers: cors });
  }
});
