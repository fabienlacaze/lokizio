// Edge Function: feedback-submit
//
// Captures in-app user feedback (rating + text + page URL + optional screenshot
// data URL) and:
//   1. Stores it in public.user_feedback for the admin dashboard
//   2. Sends an email to Fabien for instant notification (best-effort)
//
// Body: { rating?: 1..5, text, page_url, user_agent?, screenshot_data_url? }
// Auth: Bearer JWT (any authenticated user)
// Returns: { feedback_id }

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, requireAuth } from '../_shared/cors.ts';
import { audit, enforceRateLimit } from '../_shared/security.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ADMIN_EMAIL = Deno.env.get('LOKIZIO_ADMIN_EMAIL') || 'fabien65400@hotmail.fr';

const MAX_SCREENSHOT_BYTES = 2 * 1024 * 1024; // 2 MB

Deno.serve(async (req) => {
  const cors = corsHeaders(req);
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  try {
    const { userId } = await requireAuth(req, SUPABASE_URL, SUPABASE_ANON_KEY);
    // Anti-spam: max 10 feedback messages per hour per user
    const rl = await enforceRateLimit({
      user_id: userId,
      bucket: 'feedback_submit_h',
      max_per_window: 10,
      window_seconds: 3600,
    }, cors);
    if (rl) return rl;

    const body = await req.json();
    const { rating, text, page_url, user_agent, screenshot_data_url } = body || {};

    if (!text || typeof text !== 'string' || text.trim().length < 3) {
      return Response.json({ error: 'Feedback text required (min 3 chars)' }, { status: 400, headers: cors });
    }
    if (text.length > 5000) {
      return Response.json({ error: 'Feedback text too long (max 5000 chars)' }, { status: 400, headers: cors });
    }
    if (rating !== undefined && (typeof rating !== 'number' || rating < 1 || rating > 5)) {
      return Response.json({ error: 'Rating must be 1-5' }, { status: 400, headers: cors });
    }

    let screenshotKept: string | null = null;
    if (screenshot_data_url && typeof screenshot_data_url === 'string') {
      // Crude size guard — base64 inflates 4/3x, but this is just a sanity cap.
      if (screenshot_data_url.length > MAX_SCREENSHOT_BYTES * 2) {
        return Response.json({ error: 'Screenshot too large (max ~2MB)' }, { status: 400, headers: cors });
      }
      if (!screenshot_data_url.startsWith('data:image/')) {
        return Response.json({ error: 'Invalid screenshot format' }, { status: 400, headers: cors });
      }
      screenshotKept = screenshot_data_url;
    }

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Lookup user info for the email
    const { data: { user } } = await admin.auth.admin.getUserById(userId);
    const userEmail = user?.email || 'unknown';

    const { data: row, error } = await admin.from('user_feedback').insert({
      user_id: userId,
      rating: typeof rating === 'number' ? Math.round(rating) : null,
      text: text.trim(),
      page_url: page_url || null,
      user_agent: user_agent || null,
      screenshot_data_url: screenshotKept,
      app_version: body.app_version || null,
    }).select('id').maybeSingle();
    if (error) throw error;

    audit({
      user_id: userId,
      action: 'feedback.submitted',
      resource_type: 'user_feedback',
      resource_id: row?.id || '',
      metadata: { rating, page_url, has_screenshot: !!screenshotKept, text_length: text.length },
      severity: 'info',
    }).catch(() => {});

    // Best-effort email notif to Fabien (uses existing send-email EF)
    try {
      const ratingStars = typeof rating === 'number' ? '★'.repeat(rating) + '☆'.repeat(5 - rating) : '(pas de note)';
      const html = `
<div style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h2 style="color: #6c63ff;">📢 Nouveau feedback Lokizio</h2>
  <p><strong>Note :</strong> ${ratingStars}</p>
  <p><strong>De :</strong> ${userEmail} (${userId})</p>
  <p><strong>Page :</strong> <code>${(page_url || '?').toString().slice(0, 200)}</code></p>
  <p><strong>App version :</strong> ${body.app_version || '?'}</p>
  <p><strong>User agent :</strong> ${(user_agent || '?').toString().slice(0, 200)}</p>
  <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
  <div style="background: #f5f7ff; border-left: 4px solid #6c63ff; padding: 14px; margin-bottom: 16px; white-space: pre-wrap; font-size: 14px;">${text.replace(/[<>&]/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;'}[c]!))}</div>
  ${screenshotKept ? `<p style="font-size: 11px; color: #888;">Screenshot capture (voir dashboard admin).</p>` : ''}
  <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
  <p style="font-size: 11px; color: #888;">Feedback ID: ${row?.id || '?'} · Soumis le ${new Date().toLocaleString('fr-FR')}</p>
</div>`;
      await fetch(`${SUPABASE_URL}/functions/v1/send-email`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: ADMIN_EMAIL,
          subject: `[Lokizio feedback ${typeof rating === 'number' ? rating + '★' : ''}] ${text.slice(0, 60)}`,
          html,
          type: 'feedback_notification',
        }),
      });
    } catch (e) {
      console.warn('feedback email notif failed:', e);
    }

    return Response.json({ feedback_id: row?.id, ok: true }, { headers: cors });
  } catch (e: any) {
    console.error('feedback-submit error:', e);
    return Response.json({ error: String(e?.message || e) }, { status: 500, headers: cors });
  }
});
