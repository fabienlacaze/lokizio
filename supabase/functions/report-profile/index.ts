// Edge Function: report-profile
//
// Inserts a row in profile_reports for the DSA article 16 "notice and action"
// mechanism. Quick Win #6.
//
// Body: { reported_profile_id, reported_user_id?, category, description? }
// Auth: Bearer JWT (any authenticated user)
// Returns: { report_id }

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, requireAuth } from '../_shared/cors.ts';
import { audit, enforceRateLimit } from '../_shared/security.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const VALID_CATEGORIES = ['fake_profile', 'scam', 'inappropriate', 'illegal', 'spam', 'other'];

Deno.serve(async (req) => {
  const cors = corsHeaders(req);
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  try {
    const { userId } = await requireAuth(req, SUPABASE_URL, SUPABASE_ANON_KEY);
    // Rate limit: max 5 reports per user per hour (anti-spam reports)
    const rl = await enforceRateLimit({
      user_id: userId,
      bucket: 'report_profile_h',
      max_per_window: 5,
      window_seconds: 3600,
    }, cors);
    if (rl) return rl;

    const body = await req.json();
    const { reported_profile_id, reported_user_id, category, description } = body || {};
    if (!reported_profile_id) {
      return Response.json({ error: 'Missing reported_profile_id' }, { status: 400, headers: cors });
    }
    if (!category || !VALID_CATEGORIES.includes(category)) {
      return Response.json({ error: 'Invalid category. Allowed: ' + VALID_CATEGORIES.join(', ') }, { status: 400, headers: cors });
    }
    if (description && description.length > 2000) {
      return Response.json({ error: 'Description too long (max 2000 chars)' }, { status: 400, headers: cors });
    }
    // Reject self-reports
    if (reported_user_id === userId) {
      return Response.json({ error: 'Cannot report yourself' }, { status: 400, headers: cors });
    }

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const { data: report, error } = await admin.from('profile_reports').insert({
      reported_profile_id,
      reported_user_id: reported_user_id || null,
      reporter_user_id: userId,
      category,
      description: description || null,
      status: 'pending',
    }).select('id').maybeSingle();
    if (error) throw error;

    audit({
      user_id: userId,
      action: 'profile.reported',
      resource_type: 'marketplace_profile',
      resource_id: reported_profile_id,
      metadata: { category, has_description: !!description, reported_user_id: reported_user_id || null },
      severity: 'info',
    }).catch(() => {});

    return Response.json({ report_id: report?.id }, { headers: cors });
  } catch (e: any) {
    console.error('report-profile error:', e);
    return Response.json({ error: String(e?.message || e) }, { status: 500, headers: cors });
  }
});
