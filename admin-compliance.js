// Compliance dashboard for super_admins.
// Exposes:
//   window.showAppSettingsEditor()        — fill the [À COMPLÉTER] placeholders
//   window.showProcessingRegister()       — RGPD art. 30 register viewer/editor
//   window.showSecurityIncidentsLog()     — RGPD art. 33 breach log
//   window.showModerationDashboard()      — review profile_reports (DSA art. 16+)

(function () {
  // ═══════════════════════════════════════════════════════════════
  // 1. App settings editor (mentions legales placeholders)
  // ═══════════════════════════════════════════════════════════════
  async function showAppSettingsEditor() {
    showToast('Chargement parametres...');
    try {
      const { data, error } = await sb.from('app_settings').select('*').limit(1).maybeSingle();
      if (error) throw error;
      const s = data || {};
      const f = (k, label, type, placeholder) => {
        const v = (s[k] != null && s[k] !== '') ? s[k] : '';
        if (type === 'textarea') {
          return '<label style="display:block;font-size:11px;color:var(--text3);text-transform:uppercase;margin:10px 0 5px;">' + label + '</label>' +
                 '<textarea id="aset_' + k + '" rows="3" placeholder="' + esc(placeholder || '') + '" style="width:100%;padding:9px;background:var(--surface2);color:var(--text);border:1px solid var(--border2);border-radius:7px;font-size:12px;font-family:Inter,sans-serif;resize:vertical;box-sizing:border-box;">' + esc(v) + '</textarea>';
        }
        return '<label style="display:block;font-size:11px;color:var(--text3);text-transform:uppercase;margin:10px 0 5px;">' + label + '</label>' +
               '<input type="' + (type || 'text') + '" id="aset_' + k + '" value="' + esc(v) + '" placeholder="' + esc(placeholder || '') + '" style="width:100%;padding:9px;background:var(--surface2);color:var(--text);border:1px solid var(--border2);border-radius:7px;font-size:12px;box-sizing:border-box;">';
      };
      let html = '<div style="padding:6px;max-width:680px;width:90vw;max-height:84vh;overflow:auto;">';
      html += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;">';
      html += '<div style="font-size:16px;font-weight:700;color:var(--accent);">&#9881; Parametres legaux Lokizio</div>';
      html += '<button class="btn btnSmall btnOutline" style="padding:6px 12px;font-size:11px;" onclick="closeMsg()">Fermer</button>';
      html += '</div>';
      html += '<div style="font-size:11px;color:var(--text3);line-height:1.5;margin-bottom:14px;padding:10px;background:rgba(108,99,255,0.08);border-radius:8px;">Ces valeurs alimentent automatiquement les mentions legales, CGU, CGV, politique RGPD. Rempli les des qu\'ils sont connus (SIRET = des reception URSSAF). Modifiable a tout moment.</div>';

      html += '<div style="font-size:12px;font-weight:700;color:var(--text2);margin-bottom:6px;text-transform:uppercase;letter-spacing:0.5px;">Entite</div>';
      html += f('company_name', 'Raison sociale', 'text', 'Ex: Fabien Lacaze (auto-entrepreneur) ou Lokizio SAS');
      html += f('legal_form_short', 'Forme juridique courte', 'text', 'EI, Micro-entreprise, SAS, SARL...');
      html += f('legal_status', 'Statut detaille', 'textarea', 'Entrepreneur individuel sous regime micro-entreprise');
      html += f('siret', 'SIRET', 'text', '14 chiffres');
      html += f('rcs_registration', 'RCS / Immatriculation', 'text', 'RCS Paris B 123 456 789 (si SAS/SARL)');
      html += f('share_capital_eur', 'Capital social (€)', 'number', 'Si applicable');
      html += f('tva_number', 'Numero TVA intracommunautaire', 'text', 'FR12345678901 (vide si franchise TVA)');
      html += f('address', 'Adresse postale', 'textarea', '12 rue Exemple, 75001 Paris, France');

      html += '<div style="font-size:12px;font-weight:700;color:var(--text2);margin:14px 0 6px;text-transform:uppercase;letter-spacing:0.5px;">Contact</div>';
      html += f('director_name', 'Directeur de la publication', 'text', 'Fabien Lacaze');
      html += f('contact_email', 'Email contact general', 'email', 'contact@lokizio.com');
      html += f('dpo_email', 'Email DPO (RGPD)', 'email', 'dpo@lokizio.com');
      html += f('dsa_contact_email', 'Email contact DSA (modération)', 'email', 'dsa@lokizio.com');

      html += '<div style="font-size:12px;font-weight:700;color:var(--text2);margin:14px 0 6px;text-transform:uppercase;letter-spacing:0.5px;">Mediation & Conformite</div>';
      html += f('mediator', 'Mediateur de la consommation', 'textarea', 'CMAP - Centre de mediation et d\'arbitrage de Paris\\n39 av. F.D. Roosevelt 75008 Paris\\nhttps://www.cmap.fr');
      html += f('hosting_provider', 'Hebergeur', 'textarea', 'GitHub Pages (Microsoft Corp.) + Supabase Inc.');
      html += f('breach_process_url', 'URL politique securite (breach)', 'text', 'https://fabienlacaze.github.io/lokizio/security-policy.html');
      html += f('ranking_criteria', 'Criteres de classement annuaire (DSA art.27 + P2B)', 'textarea', 'Texte explicatif des criteres d\'ordre dans l\'annuaire');

      html += '<div style="display:flex;gap:8px;margin-top:20px;">';
      html += '<button class="btn btnOutline" style="flex:1;padding:11px;" onclick="closeMsg()">Annuler</button>';
      html += '<button class="btn btnPrimary" style="flex:1;padding:11px;font-weight:700;" onclick="window._saveAppSettings()">&#128190; Enregistrer</button>';
      html += '</div>';
      html += '</div>';
      showMsg(html, true);
      // Override modal width
      setTimeout(() => { const m = document.getElementById('msgModal'); if (m) { m.style.maxWidth = 'min(720px, 95vw)'; m.style.width = 'min(720px, 95vw)'; } }, 0);
    } catch (e) {
      console.error('showAppSettingsEditor:', e);
      showToast('Erreur chargement: ' + (e.message || e));
    }
  }

  window._saveAppSettings = async function () {
    const fields = ['company_name','legal_form_short','legal_status','siret','rcs_registration','share_capital_eur','tva_number','address','director_name','contact_email','dpo_email','dsa_contact_email','mediator','hosting_provider','breach_process_url','ranking_criteria'];
    const patch = { updated_at: new Date().toISOString() };
    fields.forEach(k => {
      const el = document.getElementById('aset_' + k);
      if (!el) return;
      let v = (el.value || '').trim();
      if (k === 'share_capital_eur') {
        patch[k] = v ? parseFloat(v) : null;
      } else {
        patch[k] = v || null;
      }
    });
    try {
      const { data: existing } = await sb.from('app_settings').select('id').limit(1).maybeSingle();
      if (existing?.id) {
        const { error } = await sb.from('app_settings').update(patch).eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await sb.from('app_settings').insert(patch);
        if (error) throw error;
      }
      closeMsg();
      showToast('Parametres enregistres &#9989;');
    } catch (e) {
      console.error('_saveAppSettings:', e);
      showToast('Erreur enregistrement: ' + (e.message || e));
    }
  };

  // ═══════════════════════════════════════════════════════════════
  // 2. Data processing register (RGPD art. 30)
  // ═══════════════════════════════════════════════════════════════
  async function showProcessingRegister() {
    showToast('Chargement registre...');
    try {
      const { data: rows, error } = await sb.from('data_processing_register').select('*').order('treatment_name');
      if (error) throw error;
      let html = '<div style="padding:6px;max-width:780px;width:92vw;max-height:86vh;overflow:auto;">';
      html += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">';
      html += '<div style="font-size:16px;font-weight:700;color:var(--accent);">&#128218; Registre des traitements (RGPD art. 30)</div>';
      html += '<button class="btn btnSmall btnOutline" style="padding:6px 12px;font-size:11px;" onclick="closeMsg()">Fermer</button>';
      html += '</div>';
      html += '<div style="font-size:11px;color:var(--text3);line-height:1.5;margin-bottom:14px;padding:10px;background:rgba(108,99,255,0.08);border-radius:8px;">Document obligatoire. La CNIL le demande en premier en cas de controle. Public read (transparence recommandee).</div>';

      if (!rows || !rows.length) {
        html += '<div style="text-align:center;padding:30px;color:var(--text3);">Aucun traitement enregistre</div>';
      } else {
        rows.forEach(r => {
          html += '<details style="margin-bottom:8px;background:var(--surface2);border:1px solid var(--border2);border-radius:8px;padding:10px 12px;">';
          html += '<summary style="cursor:pointer;font-weight:700;font-size:13px;color:var(--text);">' + esc(r.treatment_name) + ' <span style="font-size:10px;color:var(--text3);font-weight:400;">[' + esc(r.legal_basis) + ']</span></summary>';
          html += '<div style="font-size:11px;color:var(--text2);line-height:1.6;margin-top:8px;">';
          html += '<div><b>Finalite:</b> ' + esc(r.purpose) + '</div>';
          html += '<div><b>Donnees collectees:</b> ' + (r.data_categories || []).map(esc).join(', ') + '</div>';
          html += '<div><b>Personnes concernees:</b> ' + (r.data_subjects || []).map(esc).join(', ') + '</div>';
          html += '<div><b>Destinataires:</b> ' + (r.recipients || []).map(esc).join(', ') + '</div>';
          html += '<div><b>Conservation:</b> ' + esc(r.retention_period) + '</div>';
          if (r.international_transfers) html += '<div><b>Transferts hors UE:</b> ' + esc(r.international_transfers) + '</div>';
          if (r.security_measures) html += '<div><b>Securite:</b> ' + esc(r.security_measures) + '</div>';
          html += '</div></details>';
        });
      }
      html += '</div>';
      showMsg(html, true);
      setTimeout(() => { const m = document.getElementById('msgModal'); if (m) { m.style.maxWidth = 'min(820px, 96vw)'; m.style.width = 'min(820px, 96vw)'; } }, 0);
    } catch (e) {
      console.error('showProcessingRegister:', e);
      showToast('Erreur: ' + (e.message || e));
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // 3. Security incidents log (RGPD art. 33 — breach CNIL 72h)
  // ═══════════════════════════════════════════════════════════════
  async function showSecurityIncidentsLog() {
    try {
      const { data: rows, error } = await sb.from('security_incidents').select('*').order('reported_at', { ascending: false }).limit(50);
      if (error) throw error;
      let html = '<div style="padding:6px;max-width:680px;width:90vw;max-height:84vh;overflow:auto;">';
      html += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">';
      html += '<div style="font-size:16px;font-weight:700;color:var(--accent);">&#9888; Incidents de securite (RGPD art. 33)</div>';
      html += '<button class="btn btnSmall btnOutline" style="padding:6px 12px;font-size:11px;" onclick="closeMsg()">Fermer</button>';
      html += '</div>';
      html += '<div style="font-size:11px;color:var(--text3);line-height:1.5;margin-bottom:12px;padding:10px;background:rgba(245,158,11,0.10);border:1px solid rgba(245,158,11,0.3);border-radius:8px;">Notification CNIL obligatoire sous 72h si risque pour les droits/libertes. Process: <a href="/lokizio/security-policy.html" target="_blank" style="color:var(--accent2);">security-policy.html</a></div>';

      html += '<button class="btn btnPrimary" style="width:100%;padding:10px;margin-bottom:12px;font-size:12px;" onclick="window._dtNewIncident()">+ Declarer un nouvel incident</button>';

      if (!rows || !rows.length) {
        html += '<div style="text-align:center;padding:30px;color:var(--text3);font-size:12px;">Aucun incident declare. (C\'est bien.)</div>';
      } else {
        rows.forEach(r => {
          const sevColor = r.severity === 'critical' ? '#dc2626' : (r.severity === 'high' ? '#f59e0b' : (r.severity === 'medium' ? '#6c63ff' : '#34d399'));
          html += '<div style="padding:10px;margin-bottom:8px;background:var(--surface2);border-left:3px solid ' + sevColor + ';border-radius:6px;">';
          html += '<div style="display:flex;gap:8px;align-items:center;font-size:12px;font-weight:700;color:var(--text);">';
          html += '<span style="font-size:9px;padding:2px 7px;border-radius:10px;background:' + sevColor + ';color:#fff;text-transform:uppercase;">' + r.severity + '</span>';
          html += esc(r.category);
          html += '<span style="margin-left:auto;font-size:10px;color:var(--text3);font-weight:400;">' + new Date(r.reported_at).toLocaleString('fr-FR') + '</span>';
          html += '</div>';
          html += '<div style="font-size:11px;color:var(--text2);margin-top:6px;line-height:1.4;">' + esc(r.description) + '</div>';
          if (r.cnil_notification_required) {
            html += '<div style="font-size:10px;margin-top:6px;color:' + (r.cnil_notification_sent_at ? '#34d399' : '#ef4444') + ';">';
            html += r.cnil_notification_sent_at ? ('&#10003; CNIL notifiee le ' + new Date(r.cnil_notification_sent_at).toLocaleString('fr-FR')) : '&#9888; CNIL non notifiee (delai 72h)';
            html += '</div>';
          }
          html += '</div>';
        });
      }
      html += '</div>';
      showMsg(html, true);
    } catch (e) {
      showToast('Erreur: ' + (e.message || e));
    }
  }

  window._dtNewIncident = function () {
    // Simple form to declare a new incident
    let html = '<div style="padding:6px;max-width:560px;width:90vw;">';
    html += '<div style="font-size:14px;font-weight:700;color:var(--text);margin-bottom:10px;">Declarer un incident de securite</div>';
    html += '<label style="display:block;font-size:11px;color:var(--text3);text-transform:uppercase;margin-bottom:5px;">Categorie</label>';
    html += '<select id="incCat" style="width:100%;padding:9px;background:var(--surface2);color:var(--text);border:1px solid var(--border2);border-radius:7px;margin-bottom:10px;"><option value="data_breach">Fuite de donnees</option><option value="auth_bypass">Bypass authentification</option><option value="xss">XSS</option><option value="sql_injection">SQL injection</option><option value="iban_change_fraud">Fraude changement IBAN</option><option value="phishing_via_platform">Phishing via Lokizio</option><option value="other">Autre</option></select>';
    html += '<label style="display:block;font-size:11px;color:var(--text3);text-transform:uppercase;margin-bottom:5px;">Severite</label>';
    html += '<select id="incSev" style="width:100%;padding:9px;background:var(--surface2);color:var(--text);border:1px solid var(--border2);border-radius:7px;margin-bottom:10px;"><option value="low">Faible</option><option value="medium" selected>Moyenne</option><option value="high">Elevee</option><option value="critical">Critique</option></select>';
    html += '<label style="display:block;font-size:11px;color:var(--text3);text-transform:uppercase;margin-bottom:5px;">Description</label>';
    html += '<textarea id="incDesc" rows="4" placeholder="Ce qui s\'est passe, quand, quels donnees affectees..." style="width:100%;padding:9px;background:var(--surface2);color:var(--text);border:1px solid var(--border2);border-radius:7px;font-family:Inter,sans-serif;resize:vertical;box-sizing:border-box;margin-bottom:10px;"></textarea>';
    html += '<label style="display:flex;align-items:center;gap:8px;font-size:12px;color:var(--text2);margin-bottom:14px;cursor:pointer;"><input type="checkbox" id="incCnil"> Notification CNIL requise (risque pour droits/libertes)</label>';
    html += '<div style="display:flex;gap:8px;">';
    html += '<button class="btn btnOutline" style="flex:1;padding:10px;" onclick="closeMsg()">Annuler</button>';
    html += '<button class="btn btnPrimary" style="flex:1;padding:10px;font-weight:700;" onclick="window._saveIncident()">Declarer</button>';
    html += '</div></div>';
    showMsg(html, true);
  };

  window._saveIncident = async function () {
    const category = document.getElementById('incCat')?.value;
    const severity = document.getElementById('incSev')?.value;
    const description = (document.getElementById('incDesc')?.value || '').trim();
    const cnil = document.getElementById('incCnil')?.checked;
    if (!description || description.length < 10) { showToast('Description trop courte (10 chars min)'); return; }
    try {
      const { data: { user } } = await sb.auth.getUser();
      const { error } = await sb.from('security_incidents').insert({
        category, severity, description,
        cnil_notification_required: !!cnil,
        reported_by: user?.id || null,
      });
      if (error) throw error;
      closeMsg();
      showToast('Incident declare. ' + (cnil ? 'NOTIFIE CNIL SOUS 72H.' : ''));
      setTimeout(showSecurityIncidentsLog, 600);
    } catch (e) {
      showToast('Erreur: ' + (e.message || e));
    }
  };

  // ═══════════════════════════════════════════════════════════════
  // 4. Moderation dashboard (DSA — profile_reports queue)
  // ═══════════════════════════════════════════════════════════════
  async function showModerationDashboard() {
    try {
      const { data: rows, error } = await sb.from('profile_reports').select('*').order('ts', { ascending: false }).limit(50);
      if (error) throw error;
      let html = '<div style="padding:6px;max-width:680px;width:90vw;max-height:84vh;overflow:auto;">';
      html += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">';
      html += '<div style="font-size:16px;font-weight:700;color:var(--accent);">&#9872; Moderation (DSA art. 16)</div>';
      html += '<button class="btn btnSmall btnOutline" style="padding:6px 12px;font-size:11px;" onclick="closeMsg()">Fermer</button>';
      html += '</div>';
      if (!rows || !rows.length) {
        html += '<div style="text-align:center;padding:30px;color:var(--text3);font-size:12px;">Aucun signalement.</div>';
      } else {
        rows.forEach(r => {
          const sCol = r.status === 'pending' ? '#f59e0b' : (r.status === 'actioned' ? '#dc2626' : '#34d399');
          html += '<div style="padding:10px;margin-bottom:8px;background:var(--surface2);border-left:3px solid ' + sCol + ';border-radius:6px;">';
          html += '<div style="display:flex;align-items:center;gap:8px;font-size:12px;color:var(--text);">';
          html += '<span style="font-size:9px;padding:2px 7px;border-radius:10px;background:' + sCol + ';color:#fff;text-transform:uppercase;">' + r.status + '</span>';
          html += '<span style="font-weight:600;">' + esc(r.category) + '</span>';
          html += '<span style="margin-left:auto;font-size:10px;color:var(--text3);">' + new Date(r.ts).toLocaleString('fr-FR') + '</span>';
          html += '</div>';
          if (r.description) html += '<div style="font-size:11px;color:var(--text2);margin-top:6px;line-height:1.4;">' + esc(r.description) + '</div>';
          html += '<div style="font-size:10px;color:var(--text3);margin-top:6px;font-family:monospace;">profile=' + (r.reported_profile_id || '').slice(0, 8) + '... user=' + (r.reported_user_id || '').slice(0, 8) + '...</div>';
          if (r.status === 'pending') {
            html += '<div style="display:flex;gap:6px;margin-top:8px;">';
            html += '<button class="btn btnSmall btnSuccess" style="padding:5px 10px;font-size:10px;" onclick="window._modReport(\'' + r.id + '\',\'reviewed\')">&#10003; Validee</button>';
            html += '<button class="btn btnSmall" style="padding:5px 10px;font-size:10px;background:#dc2626;color:#fff;border:none;" onclick="window._modReport(\'' + r.id + '\',\'actioned\')">&#9888; Action prise</button>';
            html += '<button class="btn btnSmall btnOutline" style="padding:5px 10px;font-size:10px;" onclick="window._modReport(\'' + r.id + '\',\'dismissed\')">Rejetee</button>';
            html += '</div>';
          }
          html += '</div>';
        });
      }
      html += '</div>';
      showMsg(html, true);
    } catch (e) {
      showToast('Erreur: ' + (e.message || e));
    }
  }

  window._modReport = async function (id, newStatus) {
    try {
      const { data: { user } } = await sb.auth.getUser();
      const { error } = await sb.from('profile_reports').update({
        status: newStatus,
        reviewed_by: user?.id || null,
        reviewed_at: new Date().toISOString(),
      }).eq('id', id);
      if (error) throw error;
      showToast('Mis a jour: ' + newStatus);
      setTimeout(showModerationDashboard, 400);
    } catch (e) {
      showToast('Erreur: ' + (e.message || e));
    }
  };

  window.showAppSettingsEditor = showAppSettingsEditor;
  window.showProcessingRegister = showProcessingRegister;
  window.showSecurityIncidentsLog = showSecurityIncidentsLog;
  window.showModerationDashboard = showModerationDashboard;
})();
