// Edge Function: submit-kyc-document
//
// Records that a KYC document has been uploaded by the authenticated user
// to Supabase Storage. The actual upload happens directly from the browser
// to storage (with RLS gating); this EF just persists metadata.
//
// Body: { document_type, storage_path, original_filename, file_size_bytes, mime_type, expires_at? }
// Auth: Bearer JWT
// Returns: { document_id, kyc_status_now }

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, requireAuth } from '../_shared/cors.ts';
import { audit, enforceRateLimit } from '../_shared/security.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const VALID_TYPES = ['siret', 'rc_pro', 'identity', 'kbis', 'tax_residence'];
const MAX_BYTES = 10 * 1024 * 1024;

Deno.serve(async (req) => {
  const cors = corsHeaders(req);
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  try {
    const { userId } = await requireAuth(req, SUPABASE_URL, SUPABASE_ANON_KEY);
    const rl = await enforceRateLimit({
      user_id: userId, bucket: 'kyc_doc_h', max_per_window: 20, window_seconds: 3600,
    }, cors);
    if (rl) return rl;

    const body = await req.json();
    const { document_type, storage_path, original_filename, file_size_bytes, mime_type, expires_at } = body || {};

    if (!VALID_TYPES.includes(document_type)) {
      return Response.json({ error: 'Invalid document_type. Allowed: ' + VALID_TYPES.join(', ') }, { status: 400, headers: cors });
    }
    if (!storage_path || typeof storage_path !== 'string' || storage_path.length > 500) {
      return Response.json({ error: 'Invalid storage_path' }, { status: 400, headers: cors });
    }
    // Enforce that the path starts with the user's id folder (matches Storage RLS)
    if (!storage_path.startsWith(userId + '/')) {
      return Response.json({ error: 'storage_path must be under the user folder' }, { status: 403, headers: cors });
    }
    if (typeof file_size_bytes !== 'number' || file_size_bytes <= 0 || file_size_bytes > MAX_BYTES) {
      return Response.json({ error: 'Invalid file_size_bytes (max 10MB)' }, { status: 400, headers: cors });
    }

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    // Upsert (1 active doc per type per user)
    const { data: row, error } = await admin.from('provider_kyc_documents').upsert({
      user_id: userId,
      document_type,
      storage_path,
      original_filename: (original_filename || '').slice(0, 200),
      file_size_bytes,
      mime_type: (mime_type || '').slice(0, 100),
      validation_status: 'pending',
      uploaded_at: new Date().toISOString(),
      expires_at: expires_at || null,
      validated_at: null,
      validated_by: null,
      refusal_reason: null,
    }, { onConflict: 'user_id,document_type' }).select('id').maybeSingle();
    if (error) throw error;

    // Bump member status: if user had not_started -> incomplete (at least 1 doc).
    // If they had all 3 main docs (siret, rc_pro, identity) -> pending_review.
    const { data: allDocs } = await admin
      .from('provider_kyc_documents')
      .select('document_type, validation_status')
      .eq('user_id', userId);
    const types = new Set((allDocs || []).map(d => d.document_type));
    const requiredOk = ['siret', 'rc_pro', 'identity'].every(t => types.has(t));
    let newKycStatus = 'incomplete';
    if (requiredOk) {
      // Check signature too — pending_review only if charter signed
      const { data: sig } = await admin
        .from('provider_charter_signatures')
        .select('id').eq('user_id', userId).is('revoked_at', null).limit(1).maybeSingle();
      newKycStatus = sig ? 'pending_review' : 'incomplete';
    }
    await admin.from('members')
      .update({ lokizio_kyc_status: newKycStatus })
      .eq('user_id', userId);

    audit({
      user_id: userId,
      action: 'kyc.document_uploaded',
      resource_type: 'kyc_document',
      resource_id: row?.id || '',
      metadata: { document_type, size: file_size_bytes, new_kyc_status: newKycStatus },
      severity: 'info',
    }).catch(() => {});

    return Response.json({ document_id: row?.id, kyc_status_now: newKycStatus }, { headers: cors });
  } catch (e: any) {
    console.error('submit-kyc-document error:', e);
    return Response.json({ error: String(e?.message || e) }, { status: 500, headers: cors });
  }
});
