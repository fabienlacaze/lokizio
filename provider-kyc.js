// Sprint 3C — KYC métier Lokizio (RC Pro upload + charte signée)
// Exposes:
//   window.showProviderKycDashboard()   — entry point for the provider
// The dashboard shows the current status + upload buttons for each required
// document + the charter signing flow.

(function () {
  const CHARTER_VERSION = 'v1.0';
  const REQUIRED_DOCS = [
    { type: 'siret', label: 'SIRET / Extrait Kbis ou autoentrepreneur', icon: '🪪' },
    { type: 'rc_pro', label: 'Assurance RC Pro (validité en cours)', icon: '🛡️' },
    { type: 'identity', label: 'Pièce d\'identité (CNI ou passeport)', icon: '🆔' },
  ];

  async function showProviderKycDashboard() {
    showToast('Chargement de ton dossier...');
    try {
      const { data: { user } } = await sb.auth.getUser();
      if (!user) { showToast('Non connecte'); return; }

      const [docsRes, sigRes, memberRes] = await Promise.all([
        sb.from('provider_kyc_documents').select('*').eq('user_id', user.id),
        sb.from('provider_charter_signatures').select('id, charter_version, signed_at').eq('user_id', user.id).is('revoked_at', null).order('signed_at', { ascending: false }).limit(1).maybeSingle(),
        sb.from('members').select('lokizio_kyc_status, lokizio_kyc_validated_at, lokizio_kyc_refusal_reason').eq('user_id', user.id).limit(1).maybeSingle(),
      ]);
      const docs = (docsRes.data || []);
      const sig = sigRes.data || null;
      const member = memberRes.data || {};
      const docsByType = {};
      docs.forEach(d => { docsByType[d.document_type] = d; });

      let html = '<div style="padding:6px;max-width:640px;width:90vw;max-height:86vh;overflow:auto;">';
      html += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;">';
      html += '<div style="font-size:16px;font-weight:700;color:var(--accent);">&#127919; Activation prestataire — KYC Lokizio</div>';
      html += '<button class="btn btnSmall btnOutline" style="padding:6px 12px;font-size:11px;" onclick="closeMsg()">Fermer</button>';
      html += '</div>';

      // Status badge
      const statusInfo = _kycStatusInfo(member.lokizio_kyc_status || 'not_started');
      html += '<div style="padding:14px;background:' + statusInfo.bg + ';border:1px solid ' + statusInfo.border + ';border-radius:10px;margin-bottom:16px;">';
      html += '<div style="display:flex;align-items:center;gap:10px;">';
      html += '<span style="font-size:24px;">' + statusInfo.icon + '</span>';
      html += '<div style="flex:1;"><div style="font-size:13px;font-weight:700;color:' + statusInfo.color + ';">' + statusInfo.label + '</div>';
      html += '<div style="font-size:11px;color:var(--text3);margin-top:2px;">' + statusInfo.desc + '</div></div></div>';
      if (member.lokizio_kyc_refusal_reason) {
        html += '<div style="margin-top:8px;font-size:11px;color:#dc2626;background:rgba(239,68,68,0.10);padding:8px;border-radius:6px;">Motif refus: ' + esc(member.lokizio_kyc_refusal_reason) + '</div>';
      }
      html += '</div>';

      html += '<div style="font-size:11px;color:var(--text3);line-height:1.5;margin-bottom:14px;padding:10px;background:rgba(108,99,255,0.08);border-radius:8px;">Une fois ces 3 documents + la charte signes, ton profil obtient le badge <b>"Verifie"</b> dans l\'annuaire. Tes documents sont chiffres et seul un super_admin Lokizio peut les consulter pour validation.</div>';

      // Sprint 4B: Auto-verif SIRET via API gouv.fr
      html += '<div style="padding:12px;margin-bottom:8px;background:linear-gradient(135deg,rgba(52,211,153,0.10),rgba(52,211,153,0.04));border:1px solid rgba(52,211,153,0.30);border-radius:8px;">';
      html += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">';
      html += '<span style="font-size:18px;">&#127894;</span>';
      html += '<div style="font-size:12px;font-weight:700;color:var(--text);">Verification rapide SIRET <span style="font-size:9px;background:#34d399;color:#fff;padding:2px 6px;border-radius:8px;margin-left:4px;">API GOUV.FR</span></div>';
      html += '</div>';
      html += '<div style="font-size:10px;color:var(--text3);margin-bottom:8px;line-height:1.4;">Verifie ton SIRET aupres du registre INSEE en 2 secondes. Si valide, ton document SIRET est <b>auto-valide</b> et tu n\'as plus a attendre une revue manuelle.</div>';
      html += '<div style="display:flex;gap:6px;align-items:center;">';
      html += '<input type="text" id="kycSiretInput" placeholder="14 chiffres" maxlength="17" style="flex:1;padding:8px;background:var(--surface2);color:var(--text);border:1px solid var(--border2);border-radius:6px;font-size:13px;font-family:monospace;">';
      html += '<button class="btn btnSmall btnPrimary" style="padding:8px 14px;font-size:11px;font-weight:700;" onclick="window._kycVerifySiret()">Verifier</button>';
      html += '</div>';
      html += '<div id="kycSiretResult" style="margin-top:8px;font-size:11px;"></div>';
      html += '</div>';

      // Required documents
      REQUIRED_DOCS.forEach(d => {
        const doc = docsByType[d.type];
        html += '<div style="padding:12px;margin-bottom:8px;background:var(--surface2);border:1px solid ' + (doc ? (doc.validation_status === 'validated' ? '#34d399' : doc.validation_status === 'refused' ? '#ef4444' : '#f59e0b') : 'var(--border2)') + ';border-radius:8px;">';
        html += '<div style="display:flex;align-items:center;gap:10px;">';
        html += '<span style="font-size:20px;">' + d.icon + '</span>';
        html += '<div style="flex:1;">';
        html += '<div style="font-size:12px;font-weight:700;color:var(--text);">' + esc(d.label) + '</div>';
        if (doc) {
          const sCol = doc.validation_status === 'validated' ? '#34d399' : doc.validation_status === 'refused' ? '#ef4444' : '#f59e0b';
          const sLabel = doc.validation_status === 'validated' ? 'Valide' : doc.validation_status === 'refused' ? 'Refuse' : 'En attente de revue';
          html += '<div style="font-size:10px;color:' + sCol + ';margin-top:2px;">' + sLabel + ' &middot; uploade le ' + new Date(doc.uploaded_at).toLocaleDateString('fr-FR') + '</div>';
          if (doc.refusal_reason) html += '<div style="font-size:10px;color:#dc2626;margin-top:2px;">Motif: ' + esc(doc.refusal_reason) + '</div>';
        } else {
          html += '<div style="font-size:10px;color:var(--text3);margin-top:2px;">Pas encore uploade</div>';
        }
        html += '</div>';
        html += '<input type="file" id="kycFile_' + d.type + '" accept="application/pdf,image/*" style="display:none;" onchange="window._kycUpload(\'' + d.type + '\', this.files[0])">';
        html += '<button class="btn btnSmall btnPrimary" style="padding:6px 12px;font-size:11px;" onclick="document.getElementById(\'kycFile_' + d.type + '\').click()">' + (doc ? 'Remplacer' : 'Uploader') + '</button>';
        html += '</div>';
        html += '</div>';
      });

      // Charter signature
      html += '<div style="margin-top:16px;padding:14px;background:var(--surface2);border:1px solid ' + (sig ? '#34d399' : 'var(--border2)') + ';border-radius:8px;">';
      html += '<div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">';
      html += '<span style="font-size:20px;">&#9997;</span>';
      html += '<div style="flex:1;">';
      html += '<div style="font-size:12px;font-weight:700;color:var(--text);">Charte prestataire ' + CHARTER_VERSION + '</div>';
      if (sig) {
        html += '<div style="font-size:10px;color:#34d399;margin-top:2px;">&#10003; Signee le ' + new Date(sig.signed_at).toLocaleString('fr-FR') + '</div>';
      } else {
        html += '<div style="font-size:10px;color:var(--text3);margin-top:2px;">Pas encore signee</div>';
      }
      html += '</div></div>';
      if (!sig) {
        html += '<details style="font-size:11px;color:var(--text2);margin-top:8px;padding:8px;background:var(--surface);border-radius:6px;line-height:1.5;">';
        html += '<summary style="cursor:pointer;font-weight:700;">Lire la charte (obligatoire avant signature)</summary>';
        html += '<div style="margin-top:8px;padding-left:8px;border-left:2px solid var(--accent2);">';
        html += '<p><b>Engagements du prestataire envers Lokizio et ses clients :</b></p>';
        html += '<ol style="padding-left:18px;">';
        html += '<li>Je dispose d\'un SIRET valide et d\'une assurance Responsabilite Civile Professionnelle en cours de validite.</li>';
        html += '<li>Je m\'engage a effectuer les prestations conformement aux standards de qualite annonces (proprete, ponctualite, communication).</li>';
        html += '<li>Je respecte le calendrier convenu et previens des 48h en cas d\'empechement.</li>';
        html += '<li>Je n\'utilise jamais Lokizio pour proposer hors plateforme un service deja amorce sur Lokizio (anti-detournement de leads).</li>';
        html += '<li>J\'autorise Lokizio a verifier mes documents KYC et a suspendre mon compte en cas de manquement repete (preavis 30 jours sauf urgence : fraude / risque de securite).</li>';
        html += '<li>Je suis seul responsable de mes obligations fiscales et sociales decoulant de mon activite.</li>';
        html += '<li>J\'accepte le mecanisme de notation par mes clients et la moderation des avis par Lokizio.</li>';
        html += '<li>En cas de litige avec un client, je m\'engage a coopérer de bonne foi a la procedure de mediation interne.</li>';
        html += '</ol>';
        html += '<p style="font-size:10px;color:var(--text3);margin-top:8px;">Texte complet : <a href="/lokizio/provider-charter.html" target="_blank" style="color:var(--accent2);">/provider-charter.html</a></p>';
        html += '</div></details>';
        html += '<div style="margin-top:10px;">';
        html += '<label style="display:flex;align-items:center;gap:8px;font-size:12px;color:var(--text2);cursor:pointer;"><input type="checkbox" id="kycCharterAccept" style="cursor:pointer;"> J\'ai lu et j\'accepte les engagements ci-dessus</label>';
        html += '<button class="btn btnPrimary" style="width:100%;padding:10px;margin-top:8px;font-size:12px;font-weight:700;" onclick="window._kycSignCharter()">&#10003; Signer electroniquement</button>';
        html += '</div>';
      }
      html += '</div>';

      html += '</div>';
      showMsg(html, true);
    } catch (e) {
      console.error('showProviderKycDashboard:', e);
      showToast('Erreur: ' + (e.message || e));
    }
  }

  function _kycStatusInfo(status) {
    switch (status) {
      case 'validated':
        return { icon: '✅', label: 'KYC validé', color: '#065f46', bg: 'rgba(52,211,153,0.10)', border: '#34d399', desc: 'Ton profil affiche le badge "Verifie" dans l\'annuaire.' };
      case 'pending_review':
        return { icon: '⏳', label: 'En attente de validation', color: '#92400e', bg: 'rgba(245,158,11,0.10)', border: '#f59e0b', desc: 'Lokizio examine tes documents (24-72h).' };
      case 'refused':
        return { icon: '❌', label: 'Documents refusés', color: '#7f1d1d', bg: 'rgba(239,68,68,0.10)', border: '#ef4444', desc: 'Re-upload les documents demandes ci-dessous.' };
      case 'incomplete':
        return { icon: '📝', label: 'Documents incomplets', color: '#5b21b6', bg: 'rgba(108,99,255,0.10)', border: '#6c63ff', desc: 'Il manque encore des documents ou la signature.' };
      case 'expired':
        return { icon: '⚠', label: 'KYC expiré', color: '#7f1d1d', bg: 'rgba(239,68,68,0.10)', border: '#ef4444', desc: 'Un document (RC Pro ?) est arrive a expiration.' };
      default:
        return { icon: '🚀', label: 'Activation prestataire', color: '#1e3a8a', bg: 'rgba(108,99,255,0.06)', border: 'var(--border2)', desc: 'Upload tes 3 documents + signe la charte pour obtenir le badge "Verifie".' };
    }
  }

  window._kycUpload = async function (docType, file) {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { showToast('Fichier trop volumineux (max 10MB)'); return; }
    const allowed = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.type)) { showToast('Format non accepte (PDF, JPG, PNG, WEBP)'); return; }
    showToast('Upload en cours...');
    try {
      const { data: { user } } = await sb.auth.getUser();
      if (!user) { showToast('Non connecte'); return; }
      const ext = file.name.split('.').pop().toLowerCase().slice(0, 5);
      const path = user.id + '/' + docType + '-' + Date.now() + '.' + ext;
      const { error: upErr } = await sb.storage.from('kyc-documents').upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      // Persist metadata via EF
      const session = (await sb.auth.getSession()).data.session;
      const r = await fetch(SUPABASE_URL + '/functions/v1/submit-kyc-document', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + session.access_token, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          document_type: docType,
          storage_path: path,
          original_filename: file.name,
          file_size_bytes: file.size,
          mime_type: file.type,
        }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'HTTP ' + r.status);
      showToast('Document uploade ! Statut: ' + data.kyc_status_now);
      setTimeout(showProviderKycDashboard, 800);
    } catch (e) {
      console.error('_kycUpload:', e);
      showToast('Erreur upload: ' + (e.message || e));
    }
  };

  window._kycSignCharter = async function () {
    const accept = document.getElementById('kycCharterAccept')?.checked;
    if (!accept) { showToast('Tu dois cocher la case d\'acceptation'); return; }
    try {
      const session = (await sb.auth.getSession()).data.session;
      const r = await fetch(SUPABASE_URL + '/functions/v1/sign-provider-charter', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + session.access_token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ charter_version: CHARTER_VERSION, accepted: true }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'HTTP ' + r.status);
      showToast('Charte signee ! Statut: ' + data.kyc_status_now);
      setTimeout(showProviderKycDashboard, 800);
    } catch (e) {
      showToast('Erreur signature: ' + (e.message || e));
    }
  };

  window._kycVerifySiret = async function () {
    const inp = document.getElementById('kycSiretInput');
    const resultEl = document.getElementById('kycSiretResult');
    const raw = (inp?.value || '').replace(/\s/g, '');
    if (!/^\d{14}$/.test(raw)) {
      resultEl.innerHTML = '<div style="color:#ef4444;">SIRET invalide (14 chiffres requis)</div>';
      return;
    }
    resultEl.innerHTML = '<div style="color:var(--text3);">Verification en cours...</div>';
    try {
      const session = (await sb.auth.getSession()).data.session;
      const r = await fetch(SUPABASE_URL + '/functions/v1/verify-siret', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + session.access_token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ siret: raw }),
      });
      const data = await r.json();
      if (!data.valid) {
        resultEl.innerHTML = '<div style="color:#ef4444;">' + esc(data.error || 'SIRET non valide') + '</div>';
        return;
      }
      let h = '<div style="padding:8px;background:rgba(52,211,153,0.10);border-left:3px solid #34d399;border-radius:4px;">';
      h += '<div style="color:#065f46;font-weight:700;">&#10003; SIRET verifie</div>';
      h += '<div style="margin-top:4px;color:var(--text2);">' + esc(data.denomination || 'Sans nom') + '</div>';
      if (data.naf_label) h += '<div style="font-size:10px;color:var(--text3);">' + esc(data.naf_label) + ' (' + esc(data.naf_code || '') + ')</div>';
      if (data.adresse) h += '<div style="font-size:10px;color:var(--text3);margin-top:2px;">' + esc(data.adresse) + '</div>';
      h += '</div>';
      resultEl.innerHTML = h;
      setTimeout(showProviderKycDashboard, 1500); // refresh dashboard to show auto-validated doc
    } catch (e) {
      resultEl.innerHTML = '<div style="color:#ef4444;">Erreur: ' + esc(e.message || e) + '</div>';
    }
  };

  window.showProviderKycDashboard = showProviderKycDashboard;
})();
