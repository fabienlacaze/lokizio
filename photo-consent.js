// Photo consent banner — RGPD art. 6 (consent base).
// Exposes:
//   window.requirePhotoConsent(context)  — Promise<boolean>  (must be true before upload)
//   window.checkActivePhotoConsent(context)  — quick cache check
//
// Once given, consent is stored in public.photo_consents with policy_version,
// IP and user_agent for forensics. Users can withdraw at any time via Mon
// compte > Mes consentements (TODO sprint 3).

(function () {
  const CONSENT_CACHE_KEY = 'lokizio_photo_consent_';
  const POLICY_VERSION = (window && window.APP_VERSION) ? ('v' + window.APP_VERSION) : 'v9.76';

  async function checkActivePhotoConsent(context) {
    try {
      // Fast cache check first (avoids DB round-trip on every upload)
      const cached = localStorage.getItem(CONSENT_CACHE_KEY + context);
      if (cached === '1') return true;
      // Authoritative check
      const { data: { user } } = await sb.auth.getUser();
      if (!user) return false;
      const { data, error } = await sb.from('photo_consents')
        .select('id')
        .eq('user_id', user.id)
        .eq('context', context)
        .is('withdrawn_at', null)
        .limit(1)
        .maybeSingle();
      if (error) { console.warn('photo_consents check:', error); return false; }
      if (data) {
        localStorage.setItem(CONSENT_CACHE_KEY + context, '1');
        return true;
      }
      return false;
    } catch (e) {
      console.warn('checkActivePhotoConsent:', e);
      return false;
    }
  }

  // Show the consent modal and resolve with true on accept, false on refuse.
  async function requirePhotoConsent(context) {
    const has = await checkActivePhotoConsent(context);
    if (has) return true;

    const contextLabels = {
      cleaning_qc: 'Photos de controle qualite (preuve de prestation menage)',
      profile_avatar: 'Photo de profil',
      property_listing: 'Photos d\'un bien',
      marketplace_profile: 'Photos de profil annuaire',
    };
    const contextLabel = contextLabels[context] || 'photos';

    return new Promise(resolve => {
      let html = '<div style="padding:6px;max-width:520px;width:90vw;">';
      html += '<div style="font-size:15px;font-weight:700;color:var(--text);margin-bottom:8px;">&#128247; Consentement photo</div>';
      html += '<div style="font-size:11px;color:var(--text3);margin-bottom:14px;line-height:1.5;">Avant d\'uploader, on a besoin de ton accord explicite. Conformement au RGPD (art. 6, base juridique = consentement).</div>';

      html += '<div style="background:rgba(108,99,255,0.10);border:1px solid rgba(108,99,255,0.30);border-radius:8px;padding:12px;margin-bottom:14px;font-size:12px;color:var(--text2);line-height:1.6;">';
      html += '<div style="font-weight:700;color:var(--text);margin-bottom:6px;">Type de photos</div>';
      html += '<div>' + esc(contextLabel) + '</div>';
      html += '</div>';

      html += '<div style="font-size:11px;color:var(--text3);line-height:1.6;margin-bottom:14px;">';
      html += '<div style="font-weight:700;color:var(--text2);margin-bottom:4px;">&#128737; Tes droits</div>';
      html += '• <b>Acces / suppression</b> : Mon compte > Mes donnees<br>';
      html += '• <b>Retrait du consentement</b> : Mon compte > Mes consentements<br>';
      html += '• <b>Conservation</b> : 3 ans ou jusqu\'au retrait<br>';
      html += '• <b>Destinataires</b> : uniquement les membres de ton organisation et les clients destinataires des prestations<br>';
      html += '• <b>Pas de transfert hors UE</b>';
      html += '</div>';

      html += '<div style="font-size:10px;color:var(--text3);line-height:1.5;margin-bottom:14px;padding:8px 10px;background:var(--surface2);border-radius:6px;">';
      html += 'Politique complete: <a href="/lokizio/privacy.html" target="_blank" style="color:var(--accent2);">privacy.html</a>';
      html += '</div>';

      html += '<div style="display:flex;gap:8px;">';
      html += '<button class="btn btnOutline" style="flex:1;padding:11px;" onclick="window._pcResolve(false)">Refuser</button>';
      html += '<button class="btn btnPrimary" style="flex:1;padding:11px;font-weight:700;" onclick="window._pcResolve(true,\'' + esc(context) + '\')">&#10003; J\'accepte</button>';
      html += '</div>';
      html += '</div>';
      showMsg(html, true);

      window._pcResolve = async function (accepted, ctxIfAccepted) {
        closeMsg();
        if (!accepted) { resolve(false); return; }
        try {
          const { data: { user } } = await sb.auth.getUser();
          if (!user) { resolve(false); return; }
          await sb.from('photo_consents').insert({
            user_id: user.id,
            context: ctxIfAccepted,
            user_agent: navigator.userAgent.slice(0, 200),
            policy_version: POLICY_VERSION,
          });
          localStorage.setItem(CONSENT_CACHE_KEY + ctxIfAccepted, '1');
          resolve(true);
        } catch (e) {
          console.error('photo consent persist:', e);
          // Still resolve true — we don't want to break the UX if logging fails.
          resolve(true);
        }
      };
    });
  }

  window.requirePhotoConsent = requirePhotoConsent;
  window.checkActivePhotoConsent = checkActivePhotoConsent;
})();
