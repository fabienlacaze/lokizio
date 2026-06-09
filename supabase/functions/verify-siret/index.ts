// Edge Function: verify-siret
//
// Validates a SIRET against the official French government Sirene database
// via api.recherche-entreprises.data.gouv.fr (free, no API key required,
// rate-limited at 7 req/sec — far more than we'll ever hit).
//
// On success, populates members.siret_validated_at + autoadvances KYC docs
// status for the 'siret' document type to 'validated' (if user has uploaded one).
//
// Body: { siret }
// Auth: Bearer JWT (any authenticated user, validates their own SIRET)
// Returns: { valid: bool, denomination, naf, etat_administratif, ... }

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, requireAuth } from '../_shared/cors.ts';
import { audit, enforceRateLimit } from '../_shared/security.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const SIRET_REGEX = /^\d{14}$/;

Deno.serve(async (req) => {
  const cors = corsHeaders(req);
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  try {
    const { userId } = await requireAuth(req, SUPABASE_URL, SUPABASE_ANON_KEY);
    const rl = await enforceRateLimit({
      user_id: userId,
      bucket: 'verify_siret_h',
      max_per_window: 20,
      window_seconds: 3600,
    }, cors);
    if (rl) return rl;

    const { siret } = await req.json();
    if (!siret || !SIRET_REGEX.test(String(siret).replace(/\s/g, ''))) {
      return Response.json({ valid: false, error: 'Format SIRET invalide (14 chiffres requis)' }, { status: 400, headers: cors });
    }
    const cleanSiret = String(siret).replace(/\s/g, '');

    // Call the public Sirene API (no auth required)
    const r = await fetch(`https://recherche-entreprises.api.gouv.fr/search?q=${cleanSiret}&page=1&per_page=1`, {
      headers: { Accept: 'application/json' },
    });
    if (!r.ok) {
      console.warn('Sirene API error:', r.status, await r.text().catch(() => ''));
      return Response.json({ valid: false, error: 'API gouv.fr indisponible (HTTP ' + r.status + '). Reessaie plus tard.' }, { status: 502, headers: cors });
    }
    const data = await r.json();
    const result = data?.results?.[0];
    if (!result) {
      return Response.json({ valid: false, error: 'SIRET introuvable dans le registre INSEE' }, { headers: cors });
    }

    // The recherche-entreprises API returns the unite_legale (SIREN-level) with
    // matching_etablissements containing the specific etablissement.
    const etab = (result.matching_etablissements || []).find((e: any) => e.siret === cleanSiret) || result.matching_etablissements?.[0] || {};
    const summary = {
      siret: etab.siret || cleanSiret,
      siren: result.siren,
      denomination: result.nom_complet || result.nom_raison_sociale || result.nom_url,
      naf_code: etab.activite_principale || result.activite_principale,
      naf_label: etab.libelle_activite_principale || result.libelle_activite_principale,
      etat_administratif: result.etat_administratif,                    // 'A' = active, 'C' = cessee
      date_creation: result.date_creation,
      categorie_juridique: result.nature_juridique,
      adresse: etab.adresse,
      commune: etab.commune,
      code_postal: etab.code_postal,
    };
    const isActive = summary.etat_administratif === 'A';

    if (!isActive) {
      return Response.json({
        valid: false,
        error: 'Cette entreprise est cessée (' + summary.etat_administratif + ')',
        details: summary,
      }, { headers: cors });
    }

    // Update members: store the verified siret + timestamp (best-effort)
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    await admin.from('members').update({
      siret: cleanSiret,
      tax_id_validated_at: new Date().toISOString(),
      company_name: summary.denomination,
    }).eq('user_id', userId);

    // If the user has a 'siret' document pending, mark it validated (gov check trumps human review)
    const { data: doc } = await admin.from('provider_kyc_documents')
      .select('id, validation_status').eq('user_id', userId).eq('document_type', 'siret').maybeSingle();
    if (doc && doc.validation_status === 'pending') {
      await admin.from('provider_kyc_documents').update({
        validation_status: 'validated',
        validated_at: new Date().toISOString(),
        // validated_by stays null — auto by Sirene API
      }).eq('id', doc.id);
    }

    audit({
      user_id: userId,
      action: 'siret.verified',
      resource_type: 'member',
      metadata: { siret: cleanSiret, denomination: summary.denomination, naf: summary.naf_code },
      severity: 'info',
    }).catch(() => {});

    return Response.json({ valid: true, ...summary }, { headers: cors });
  } catch (e: any) {
    console.error('verify-siret error:', e);
    return Response.json({ valid: false, error: String(e?.message || e) }, { status: 500, headers: cors });
  }
});
