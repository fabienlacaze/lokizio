// Edge Function: sign-provider-charter
//
// Records the electronic signature of the Lokizio provider charter for
// the authenticated user. Stores charter version + IP + UA + timestamp
// for non-repudiation. After signature, re-evaluates kyc_status.
//
// Body: { charter_version, accepted: true }
// Auth: Bearer JWT
// Returns: { signature_id, kyc_status_now }

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, requireAuth } from '../_shared/cors.ts';
import { audit } from '../_shared/security.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const CURRENT_CHARTER_VERSION = 'v1.0';

Deno.serve(async (req) => {
  const cors = corsHeaders(req);
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  try {
    const { userId } = await requireAuth(req, SUPABASE_URL, SUPABASE_ANON_KEY);
    const body = await req.json();
    const { charter_version, accepted } = body || {};

    if (charter_version !== CURRENT_CHARTER_VERSION) {
      return Response.json({ error: 'Charter version mismatch. Expected ' + CURRENT_CHARTER_VERSION }, { status: 400, headers: cors });
    }
    if (accepted !== true) {
      return Response.json({ error: 'Must accept the charter explicitly (accepted=true)' }, { status: 400, headers: cors });
    }

    const ip = req.headers.get('x-forwarded-for') || req.headers.get('cf-connecting-ip') || null;
    const ua = req.headers.get('user-agent') || null;

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const { data: sig, error } = await admin.from('provider_charter_signatures').insert({
      user_id: userId,
      charter_version,
      ip: ip ? ip.split(',')[0].trim().slice(0, 50) : null,
      user_agent: ua ? ua.slice(0, 200) : null,
    }).select('id').maybeSingle();
    if (error) throw error;

    // Re-evaluate kyc_status
    const { data: docs } = await admin
      .from('provider_kyc_documents')
      .select('document_type')
      .eq('user_id', userId);
    const types = new Set((docs || []).map(d => d.document_type));
    const requiredOk = ['siret', 'rc_pro', 'identity'].every(t => types.has(t));
    const newKycStatus = requiredOk ? 'pending_review' : 'incomplete';
    await admin.from('members')
      .update({ lokizio_kyc_status: newKycStatus })
      .eq('user_id', userId);

    audit({
      user_id: userId,
      action: 'kyc.charter_signed',
      resource_type: 'provider_charter_signature',
      resource_id: sig?.id || '',
      ip: ip ? ip.split(',')[0].trim() : undefined,
      user_agent: ua || undefined,
      metadata: { charter_version, new_kyc_status: newKycStatus },
      severity: 'info',
    }).catch(() => {});

    return Response.json({ signature_id: sig?.id, kyc_status_now: newKycStatus }, { headers: cors });
  } catch (e: any) {
    console.error('sign-provider-charter error:', e);
    return Response.json({ error: String(e?.message || e) }, { status: 500, headers: cors });
  }
});
