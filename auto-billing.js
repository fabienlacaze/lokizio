// Auto-billing module (concierge panel)
// Depends on: sb, API, SUPABASE_URL, showToast, customConfirm, showMsg,
//   showCreateInvoiceModal
// Exposes: setConciergeDocType, openConciergeInvoice, renderAutoBillingPanel,
//   saveBillingSettings, previewAutoBill, previewProviderAutoBill,
//   showAutoBillPreviewModal, triggerAutoBillNow, renderAutoBillingHistory

let _conciergeDocType = 'invoice';

function setConciergeDocType(t) {
  _conciergeDocType = t;
  const invBtn = document.getElementById('concDocType_invoice_btn');
  const qBtn = document.getElementById('concDocType_quote_btn');
  const hint = document.getElementById('concDocTypeHint');
  const provLbl = document.getElementById('concBtnProviderLabel');
  if (invBtn) invBtn.classList.toggle('finFactModeActive', t === 'invoice');
  if (qBtn) qBtn.classList.toggle('finFactModeActive', t === 'quote');
  if (hint) hint.textContent = t === 'quote' ? 'Emettre un devis pour validation avant prestation' : 'A qui envoyer cette facture ?';
  if (provLbl) provLbl.textContent = t === 'quote' ? 'Devis recu (prestataire)' : 'Facture recue (prestataire)';
}
function openConciergeInvoice(type) {
  showCreateInvoiceModal(type, _conciergeDocType === 'quote');
}

async function renderAutoBillingPanel() {
  const div = document.getElementById('autoBillingPanel');
  if (!div) return;
  const org = API.getOrg();
  if (!org) { div.innerHTML = '<div style="color:var(--text3);">Organisation introuvable.</div>'; return; }
  div.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text3);">Chargement...</div>';
  let { data: s } = await sb.from('billing_settings').select('*').eq('org_id', org.id).maybeSingle();
  if (!s) {
    const { data: created } = await sb.from('billing_settings').insert({ org_id: org.id }).select().single();
    s = created || { org_id: org.id, auto_enabled: false, frequency: 'monthly', billing_day: 1, default_status: 'draft', period: 'previous_month', due_days: 30, types_enabled: { concierge_to_owner: true, provider_to_concierge: true } };
  }
  const enabled = !!s.auto_enabled;
  const typesEnabled = s.types_enabled || { concierge_to_owner: true, provider_to_concierge: true };
  const lastRun = s.last_run_at ? new Date(s.last_run_at).toLocaleString('fr-FR') : 'Jamais';

  let h = '';
  h += '<div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:16px;">';
  h += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">';
  h += '<div><div style="font-size:15px;font-weight:700;color:var(--text);">&#9889; Facturation automatique</div>';
  h += '<div style="font-size:11px;color:var(--text3);margin-top:2px;">Genere les factures automatiquement a une date fixe chaque mois.</div></div>';
  h += '<label style="display:inline-flex;align-items:center;gap:8px;cursor:pointer;">';
  h += '<input type="checkbox" id="ab_enabled"' + (enabled ? ' checked' : '') + ' style="width:42px;height:22px;cursor:pointer;">';
  h += '<span style="font-size:12px;font-weight:600;color:' + (enabled ? '#34d399' : 'var(--text3)') + ';" id="ab_enabled_label">' + (enabled ? 'Active' : 'Desactive') + '</span>';
  h += '</label></div>';
  h += '<div id="ab_collapsible" style="display:' + (enabled ? 'block' : 'none') + ';">';
  h += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px;">';
  h += '<div><label style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:0.5px;display:block;margin-bottom:4px;">Frequence</label>';
  h += '<select id="ab_frequency" style="width:100%;padding:9px;background:var(--surface2);color:var(--text);border:1px solid var(--border2);border-radius:8px;font-size:13px;box-sizing:border-box;">';
  h += '<option value="monthly" selected>Mensuelle</option>';
  h += '</select></div>';
  h += '<div><label style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:0.5px;display:block;margin-bottom:4px;">Jour de generation</label>';
  h += '<select id="ab_billing_day" style="width:100%;padding:9px;background:var(--surface2);color:var(--text);border:1px solid var(--border2);border-radius:8px;font-size:13px;box-sizing:border-box;">';
  for (let d = 1; d <= 28; d++) h += '<option value="' + d + '"' + (s.billing_day === d ? ' selected' : '') + '>' + d + '</option>';
  h += '</select></div>';
  h += '<div><label style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:0.5px;display:block;margin-bottom:4px;">Periode couverte</label>';
  h += '<select id="ab_period" style="width:100%;padding:9px;background:var(--surface2);color:var(--text);border:1px solid var(--border2);border-radius:8px;font-size:13px;box-sizing:border-box;">';
  h += '<option value="previous_month"' + (s.period === 'previous_month' ? ' selected' : '') + '>Mois precedent</option>';
  h += '<option value="current_month"' + (s.period === 'current_month' ? ' selected' : '') + '>Mois courant</option>';
  h += '</select></div>';
  h += '<div><label style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:0.5px;display:block;margin-bottom:4px;">Statut par defaut</label>';
  h += '<select id="ab_default_status" style="width:100%;padding:9px;background:var(--surface2);color:var(--text);border:1px solid var(--border2);border-radius:8px;font-size:13px;box-sizing:border-box;">';
  h += '<option value="draft"' + (s.default_status === 'draft' ? ' selected' : '') + '>Brouillon (a valider)</option>';
  h += '<option value="sent"' + (s.default_status === 'sent' ? ' selected' : '') + '>Envoyee (auto)</option>';
  h += '</select></div>';
  h += '<div><label style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:0.5px;display:block;margin-bottom:4px;">Echeance (jours)</label>';
  h += '<input type="number" id="ab_due_days" value="' + (s.due_days || 30) + '" min="0" max="120" style="width:100%;padding:9px;background:var(--surface2);color:var(--text);border:1px solid var(--border2);border-radius:8px;font-size:13px;box-sizing:border-box;"></div>';
  h += '</div>';
  h += '<div style="margin-bottom:14px;"><label style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:0.5px;display:block;margin-bottom:6px;">Types de factures generees</label>';
  h += '<div style="display:flex;flex-direction:column;gap:8px;">';
  h += '<label style="display:flex;align-items:center;gap:8px;cursor:pointer;padding:8px 10px;background:var(--surface2);border-radius:8px;" title="Factures que vous envoyez a vos proprietaires pour les prestations realisees"><input type="checkbox" id="ab_type_c2o"' + (typesEnabled.concierge_to_owner ? ' checked' : '') + '> <span style="font-size:13px;">&#127968; A envoyer aux proprietaires</span></label>';
  h += '<label style="display:flex;align-items:center;gap:8px;cursor:pointer;padding:8px 10px;background:var(--surface2);border-radius:8px;" title="Factures recues de vos prestataires pour leurs interventions"><input type="checkbox" id="ab_type_p2c"' + (typesEnabled.provider_to_concierge ? ' checked' : '') + '> <span style="font-size:13px;">&#129529; Recues des prestataires</span></label>';
  h += '</div></div>';
  h += '<div style="font-size:11px;color:var(--text3);margin-bottom:12px;">Derniere execution: <b style="color:var(--text2);">' + lastRun + '</b></div>';
  h += '<div style="display:flex;gap:8px;flex-wrap:wrap;">';
  h += '<button class="btn btnPrimary" style="flex:1;min-width:120px;padding:11px;" onclick="saveBillingSettings()">&#128190; Enregistrer</button>';
  h += '<button class="btn btnOutline" style="padding:11px 14px;" onclick="previewAutoBill()" title="Simule sans rien creer">&#128065; Simuler</button>';
  h += '<button class="btn btnOutline" style="padding:11px 14px;" onclick="triggerAutoBillNow()" title="Declencher la generation maintenant">&#9889; Tester maintenant</button>';
  h += '</div>';
  h += '<div id="autoBillingHistory" style="margin-top:14px;"></div>';
  h += '</div>';
  h += '</div>';

  div.innerHTML = h;
  renderAutoBillingHistory('concierge');
  const toggle = document.getElementById('ab_enabled');
  const lbl = document.getElementById('ab_enabled_label');
  const coll = document.getElementById('ab_collapsible');
  if (toggle && lbl) toggle.addEventListener('change', () => {
    lbl.textContent = toggle.checked ? 'Active' : 'Desactive';
    lbl.style.color = toggle.checked ? '#34d399' : 'var(--text3)';
    if (coll) coll.style.display = toggle.checked ? 'block' : 'none';
    saveBillingSettings();
  });
}

async function saveBillingSettings() {
  const org = API.getOrg();
  if (!org) return;
  const payload = {
    auto_enabled: document.getElementById('ab_enabled').checked,
    frequency: document.getElementById('ab_frequency').value,
    billing_day: parseInt(document.getElementById('ab_billing_day').value) || 1,
    period: document.getElementById('ab_period').value,
    default_status: document.getElementById('ab_default_status').value,
    due_days: parseInt(document.getElementById('ab_due_days').value) || 30,
    types_enabled: {
      concierge_to_owner: document.getElementById('ab_type_c2o').checked,
      provider_to_concierge: document.getElementById('ab_type_p2c').checked,
    },
    updated_at: new Date().toISOString(),
  };
  const { error } = await sb.from('billing_settings').update(payload).eq('org_id', org.id);
  if (error) { console.error(error); showToast('Erreur: ' + (error.message || 'sauvegarde impossible')); return; }
  showToast('Parametres enregistres');
}

async function previewAutoBill() {
  const org = API.getOrg();
  if (!org) return;
  try {
    const session = (await sb.auth.getSession()).data.session;
    const resp = await fetch(SUPABASE_URL + '/functions/v1/auto-bill?force=1&preview=1&org_id=' + org.id, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + (session?.access_token || '') },
      body: '{}'
    });
    const json = await resp.json();
    if (!json.ok) { showToast('Erreur: ' + (json.error || 'echec')); return; }
    showAutoBillPreviewModal(json.preview_invoices || []);
  } catch(e) { console.error(e); showToast('Erreur: ' + e.message); }
}

async function previewProviderAutoBill() {
  const user = (await sb.auth.getUser()).data.user;
  if (!user) return;
  try {
    const session = (await sb.auth.getSession()).data.session;
    const resp = await fetch(SUPABASE_URL + '/functions/v1/auto-bill?force=1&preview=1&role=provider&user_id=' + user.id, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + (session?.access_token || '') },
      body: '{}'
    });
    const json = await resp.json();
    if (!json.ok) { showToast('Erreur: ' + (json.error || 'echec')); return; }
    showAutoBillPreviewModal(json.preview_invoices || []);
  } catch(e) { console.error(e); showToast('Erreur: ' + e.message); }
}

function showAutoBillPreviewModal(invoices) {
  const typeLabels = { concierge_to_owner: 'Au proprietaire', provider_to_concierge: 'A la conciergerie', provider_to_owner: 'Au proprietaire (direct)' };
  let h = '<div style="font-size:13px;color:var(--text2);margin-bottom:12px;">' + invoices.length + ' facture(s) seraient creees. Aucune ecriture en base pour cette simulation.</div>';
  if (!invoices.length) {
    h += '<div style="padding:20px;text-align:center;color:var(--text3);font-size:13px;background:var(--surface2);border-radius:8px;">Aucune facture a creer pour cette periode (rien a facturer ou deja facture).</div>';
  } else {
    h += '<div style="display:flex;flex-direction:column;gap:8px;max-height:400px;overflow-y:auto;">';
    invoices.forEach(inv => {
      h += '<div style="background:var(--surface2);border-radius:8px;padding:10px 12px;font-size:12px;">';
      h += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">';
      h += '<strong style="color:var(--text);">' + (typeLabels[inv.type] || inv.type) + '</strong>';
      h += '<span style="color:#34d399;font-weight:700;">' + (inv.total_ttc || 0).toFixed(2) + ' €</span>';
      h += '</div>';
      h += '<div style="color:var(--text3);margin-bottom:4px;">' + (inv.client_name || '—') + (inv.property_name ? ' · ' + inv.property_name : '') + '</div>';
      h += '<div style="color:var(--text3);font-size:11px;">Periode: ' + inv.period_start + ' → ' + inv.period_end + ' · ' + (inv.items?.length || 0) + ' ligne(s)</div>';
      h += '</div>';
    });
    h += '</div>';
  }
  showMsg('<div style="font-size:15px;font-weight:700;margin-bottom:10px;">&#128065; Simulation (aucune ecriture)</div>' + h);
}

async function triggerAutoBillNow() {
  const org = API.getOrg();
  if (!org) return;
  const ok = await customConfirm('Declencher la facturation automatique maintenant pour votre organisation ? Les factures en double seront evitees.', 'Lancer');
  if (!ok) return;
  try {
    const session = (await sb.auth.getSession()).data.session;
    const resp = await fetch(SUPABASE_URL + '/functions/v1/auto-bill?force=1&org_id=' + org.id, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + (session?.access_token || '') },
      body: '{}'
    });
    const json = await resp.json();
    if (json.ok) {
      const n = json.invoices_created || 0;
      if (n === 0) showToast('Aucune nouvelle facture (rien a facturer ou deja fait)');
      else showToast(n + ' facture(s) creee(s) - voir l\'historique ci-dessous');
    } else showToast('Erreur: ' + (json.error || 'echec'));
    renderAutoBillingPanel();
  } catch(e) { console.error(e); showToast('Erreur: ' + e.message); }
}

async function renderAutoBillingHistory(role) {
  const divId = role === 'provider' ? 'provAutoBillingHistory' : 'autoBillingHistory';
  const div = document.getElementById(divId);
  if (!div) return;
  let query = sb.from('billing_runs').select('*, invoices(invoice_number, client_name, total_ttc, status)').order('created_at', { ascending: false }).limit(10);
  if (role === 'provider') {
    const user = (await sb.auth.getUser()).data.user;
    if (!user) return;
    query = query.like('client_key', '%' + user.id + '%').or('client_key.like.concierge:%,client_key.like.owner:%');
  } else {
    const org = API.getOrg();
    if (!org) return;
    query = query.eq('org_id', org.id);
  }
  const { data: runs } = await query;
  if (!runs || !runs.length) {
    div.innerHTML = '<div style="font-size:11px;color:var(--text3);font-style:italic;">Aucune execution encore.</div>';
    return;
  }
  let h = '<details style="margin-top:8px;"><summary style="cursor:pointer;font-size:12px;font-weight:600;color:var(--text2);padding:6px 0;list-style:none;display:flex;align-items:center;gap:6px;"><span class="collapseArrow">&#9662;</span> Historique des generations (' + runs.length + ')</summary>';
  h += '<div style="padding:8px 0;display:flex;flex-direction:column;gap:6px;max-height:300px;overflow-y:auto;">';
  runs.forEach(r => {
    const inv = r.invoices;
    const date = new Date(r.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
    const typeIcon = r.invoice_type.includes('concierge_to_owner') ? '🏠' : (r.invoice_type.includes('provider_to_concierge') ? '🧹' : '🔧');
    h += '<div style="background:var(--surface2);border-radius:6px;padding:8px 10px;font-size:12px;">';
    h += '<div style="display:flex;justify-content:space-between;align-items:center;">';
    h += '<div><span style="font-size:14px;">' + typeIcon + '</span> <strong>' + (inv?.invoice_number || 'Facture') + '</strong> - ' + (inv?.client_name || '—') + '</div>';
    h += '<div style="color:var(--text3);font-size:11px;">' + date + '</div></div>';
    h += '<div style="margin-top:4px;color:var(--text3);font-size:11px;">Periode: ' + r.period_start + ' → ' + r.period_end + (inv?.total_ttc ? ' · <strong style="color:var(--text2);">' + inv.total_ttc + '€</strong>' : '') + '</div>';
    h += '</div>';
  });
  h += '</div></details>';
  div.innerHTML = h;
}

window.setConciergeDocType = setConciergeDocType;
window.openConciergeInvoice = openConciergeInvoice;
window.renderAutoBillingPanel = renderAutoBillingPanel;
window.saveBillingSettings = saveBillingSettings;
window.previewAutoBill = previewAutoBill;
window.previewProviderAutoBill = previewProviderAutoBill;
window.showAutoBillPreviewModal = showAutoBillPreviewModal;
window.triggerAutoBillNow = triggerAutoBillNow;
window.renderAutoBillingHistory = renderAutoBillingHistory;
