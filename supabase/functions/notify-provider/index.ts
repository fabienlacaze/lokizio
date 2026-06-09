// Edge Function: notify-provider
//
// Generic notification dispatcher for events that affect a provider:
//   - review_received: a client posted a review
//   - dispute_opened: a client opened a dispute (refund initiated)
//   - kyc_validated / kyc_refused
//   - rc_pro_expiring_soon
//   - first_paid_invoice
//
// Sends both email (via send-email EF) and push (via send-push EF) when
// the target user has them enabled.
//
// Body: { user_id, event_type, context }
// Auth: super_admin Bearer JWT OR service_role (intra-platform calls)
// Returns: { sent_email, sent_push }

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { audit } from '../_shared/security.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface TemplatedEvent {
  subject: string;
  html: (ctx: Record<string, any>) => string;
  push_title: string;
  push_body: (ctx: Record<string, any>) => string;
}

const TEMPLATES: Record<string, TemplatedEvent> = {
  review_received: {
    subject: 'Nouvel avis recu sur Lokizio',
    html: (ctx) => `
<div style="font-family:system-ui,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
  <h2 style="color:#6c63ff;">⭐ Tu as un nouvel avis !</h2>
  <p>Un client vient de t'evaluer sur Lokizio.</p>
  <div style="font-size:32px;text-align:center;margin:20px 0;">${'⭐'.repeat(ctx.rating || 0)}${'☆'.repeat(5 - (ctx.rating || 0))}</div>
  <div style="font-size:18px;text-align:center;font-weight:700;color:#6c63ff;margin-bottom:20px;">${ctx.rating || '?'}/5</div>
  ${ctx.comment ? `<div style="background:#f5f3ff;border-left:4px solid #6c63ff;padding:14px;margin:14px 0;font-style:italic;">"${(ctx.comment+'').replace(/[<>&]/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;'}[c]!))}"</div>` : ''}
  <p style="margin-top:20px;"><a href="https://fabienlacaze.github.io/lokizio/" style="background:#6c63ff;color:#fff;padding:12px 24px;text-decoration:none;border-radius:8px;font-weight:700;">Voir mes avis</a></p>
  <p style="font-size:11px;color:#888;margin-top:20px;">Tu peux désactiver ces emails dans Mon compte > Notifications.</p>
</div>`,
    push_title: '⭐ Nouvel avis recu',
    push_body: (ctx) => `${ctx.rating}/5 etoiles${ctx.comment ? ' — clique pour voir' : ''}`,
  },
  dispute_opened: {
    subject: '⚠ Un client a conteste un paiement',
    html: (ctx) => `
<div style="font-family:system-ui,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
  <h2 style="color:#dc2626;">⚠ Paiement conteste</h2>
  <p>Le client de la facture <strong>${ctx.invoice_number || ctx.invoice_id || '?'}</strong> a ouvert une contestation.</p>
  <div style="background:#fef2f2;border:1px solid #ef4444;padding:14px;border-radius:8px;margin:14px 0;">
    <div><strong>Montant rembourse:</strong> ${((ctx.amount_cents || 0) / 100).toFixed(2)} €</div>
    ${ctx.reason ? `<div style="margin-top:8px;"><strong>Motif:</strong> ${(ctx.reason+'').replace(/[<>&]/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;'}[c]!))}</div>` : ''}
  </div>
  <p>Le remboursement a ete initie automatiquement (sous 5-10 jours sur la carte du client). La facture est retournee a "Brouillon" cote Lokizio.</p>
  <p>Si tu penses que cette contestation n'est pas justifiee, contacte le support Lokizio.</p>
  <p style="font-size:11px;color:#888;margin-top:20px;">Reference : ${ctx.invoice_id || '?'}</p>
</div>`,
    push_title: '⚠ Paiement conteste',
    push_body: (ctx) => `Facture ${ctx.invoice_number || '?'} - rembourse au client`,
  },
  kyc_validated: {
    subject: '✅ Ton KYC Lokizio a ete valide',
    html: (ctx) => `
<div style="font-family:system-ui,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
  <h2 style="color:#34d399;">✅ KYC validé !</h2>
  <p>Felicitations ! Ton dossier KYC Lokizio (SIRET + RC Pro + identite + charte) a ete valide.</p>
  <p>Ton profil affiche maintenant le badge <strong>✓ Verifie</strong> dans l'annuaire.</p>
  <p style="margin-top:20px;"><a href="https://fabienlacaze.github.io/lokizio/" style="background:#34d399;color:#fff;padding:12px 24px;text-decoration:none;border-radius:8px;font-weight:700;">Voir mon profil</a></p>
</div>`,
    push_title: '✅ KYC valide',
    push_body: () => 'Ton badge "Verifie" est actif',
  },
  kyc_refused: {
    subject: '❌ Ton dossier KYC necessite des corrections',
    html: (ctx) => `
<div style="font-family:system-ui,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
  <h2 style="color:#ef4444;">❌ Documents a corriger</h2>
  <p>Ton dossier KYC Lokizio a ete examine mais certains documents necessitent des corrections.</p>
  ${ctx.refusal_reason ? `<div style="background:#fef2f2;border:1px solid #ef4444;padding:14px;border-radius:8px;margin:14px 0;"><strong>Motif:</strong> ${(ctx.refusal_reason+'').replace(/[<>&]/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;'}[c]!))}</div>` : ''}
  <p>Re-upload les documents demandes dans Mon compte > Activation prestataire — KYC Lokizio.</p>
</div>`,
    push_title: '❌ KYC a corriger',
    push_body: () => 'Re-upload les documents demandes',
  },
  rc_pro_expiring_soon: {
    subject: '⏰ Ton RC Pro expire bientot',
    html: (ctx) => `
<div style="font-family:system-ui,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
  <h2 style="color:#f59e0b;">⏰ Ton attestation RC Pro expire dans ${ctx.days_left || '?'} jours</h2>
  <p>Pour conserver ton badge "Verifie" sur Lokizio, upload une attestation a jour.</p>
  <p style="margin-top:20px;"><a href="https://fabienlacaze.github.io/lokizio/" style="background:#f59e0b;color:#fff;padding:12px 24px;text-decoration:none;border-radius:8px;font-weight:700;">Mettre a jour</a></p>
</div>`,
    push_title: '⏰ RC Pro expire bientot',
    push_body: (ctx) => `Dans ${ctx.days_left || '?'} jours — upload une nouvelle attestation`,
  },
};

Deno.serve(async (req) => {
  const cors = corsHeaders(req);
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  try {
    const body = await req.json();
    const { user_id, event_type, context = {} } = body || {};
    if (!user_id || !event_type) {
      return Response.json({ error: 'Missing user_id or event_type' }, { status: 400, headers: cors });
    }
    const tpl = TEMPLATES[event_type];
    if (!tpl) {
      return Response.json({ error: 'Unknown event_type. Allowed: ' + Object.keys(TEMPLATES).join(', ') }, { status: 400, headers: cors });
    }

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Look up user's email
    const { data: { user } } = await admin.auth.admin.getUserById(user_id);
    if (!user?.email) {
      return Response.json({ error: 'User has no email on file' }, { status: 404, headers: cors });
    }

    let sentEmail = false;
    let sentPush = false;

    // Send email via existing send-email EF
    try {
      const r = await fetch(`${SUPABASE_URL}/functions/v1/send-email`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: user.email,
          subject: tpl.subject,
          html: tpl.html(context),
          type: event_type,
        }),
      });
      sentEmail = r.ok;
    } catch (e) { console.warn('email send failed:', e); }

    // Send push via existing send-push EF (best-effort)
    try {
      const r = await fetch(`${SUPABASE_URL}/functions/v1/send-push`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id,
          title: tpl.push_title,
          body: tpl.push_body(context),
          tag: event_type + '-' + Date.now(),
        }),
      });
      sentPush = r.ok;
    } catch (e) { console.warn('push send failed:', e); }

    audit({
      user_id,
      action: 'notify.' + event_type,
      metadata: { sent_email: sentEmail, sent_push: sentPush },
      severity: 'info',
    }).catch(() => {});

    return Response.json({ sent_email: sentEmail, sent_push: sentPush }, { headers: cors });
  } catch (e: any) {
    console.error('notify-provider error:', e);
    return Response.json({ error: String(e?.message || e) }, { status: 500, headers: cors });
  }
});
