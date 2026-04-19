// Invoice/quote creation module
// Depends on: sb, API, esc, showMsg, closeMsg, showToast, customConfirm,
//   fullConfig, safeErr, loadInvoices
// Exposes: showCreateInvoiceModal, validateInvoiceForm, addInvoiceItem,
//   renderInvoiceItems, updateInvoiceTotals, autoFillInvoiceItems, saveInvoice

async function showCreateInvoiceModal(type, isQuote) {
  const member = API.getMember();
  const org = API.getOrg();
  const prop = API.getActiveProperty(fullConfig);
  window._invoiceType = type;
  window._invoiceItems = [];
  window._invoiceIsQuote = !!isQuote;

  // Build client list based on type
  const clients = [];
  try {
    if (type === 'concierge_to_owner') {
      // Owners: from properties (owner_name / owner_email) + members with role owner
      const { data: props } = await sb.from('properties').select('id,name,owner_name,owner_email,owner_member_id').eq('org_id', org?.id || '');
      (props || []).forEach(p => {
        if (p.owner_name || p.owner_email) {
          clients.push({ id: p.id, label: (p.owner_name || p.owner_email) + (p.name ? ' (' + p.name + ')' : ''), name: p.owner_name || p.owner_email, email: p.owner_email, propertyId: p.id, propertyName: p.name });
        }
      });
      const { data: owners } = await sb.from('members').select('id,user_id,display_name,invited_email').eq('org_id', org?.id || '').eq('role', 'owner');
      (owners || []).forEach(o => {
        const label = (o.display_name || o.invited_email);
        if (label && !clients.some(c => c.name === label)) clients.push({ id: o.user_id, label, name: label, email: o.invited_email });
      });
    } else if (type === 'provider_to_concierge' || type === 'owner_to_concierge') {
      // Client = the concierge (org owner)
      const { data: admins } = await sb.from('members').select('id,user_id,display_name,invited_email,company_name').eq('org_id', org?.id || '').eq('role', 'concierge');
      (admins || []).forEach(a => {
        const label = (a.company_name || a.display_name || a.invited_email);
        if (label) clients.push({ id: a.user_id, label, name: label, email: a.invited_email });
      });
    } else if (type === 'provider_to_owner') {
      // Clients = owners (from properties the provider has worked on or from members with role owner)
      const { data: props } = await sb.from('properties').select('id,name,owner_name,owner_email').eq('org_id', org?.id || '');
      (props || []).forEach(p => {
        if (p.owner_name || p.owner_email) {
          clients.push({ id: p.id, label: (p.owner_name || p.owner_email) + (p.name ? ' (' + p.name + ')' : ''), name: p.owner_name || p.owner_email, email: p.owner_email, propertyId: p.id, propertyName: p.name });
        }
      });
      const { data: owners } = await sb.from('members').select('id,user_id,display_name,invited_email').eq('org_id', org?.id || '').eq('role', 'owner');
      (owners || []).forEach(o => {
        const label = (o.display_name || o.invited_email);
        if (label && !clients.some(c => c.name === label)) clients.push({ id: o.user_id, label, name: label, email: o.invited_email });
      });
    }
  } catch(e) { console.error('load clients:', e); }

  const typeLabel = type === 'concierge_to_owner' ? 'Pour le proprietaire' : (type === 'owner_to_concierge' ? 'Pour la conciergerie' : (type === 'provider_to_owner' ? 'Pour le proprietaire' : 'Pour la conciergerie'));
  const typeColor = type === 'concierge_to_owner' ? '#e94560' : (type === 'owner_to_concierge' ? '#f59e0b' : (type === 'provider_to_owner' ? '#f59e0b' : '#34d399'));
  const typeIcon = type === 'concierge_to_owner' ? '&#127968;' : (type === 'owner_to_concierge' ? '&#127968;' : (type === 'provider_to_owner' ? '&#127968;' : '&#129529;'));

  let html = '<div style="padding:4px;max-height:78vh;overflow-y:auto;">';
  // Header banner
  html += '<div style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:linear-gradient(135deg,' + typeColor + '22,' + typeColor + '11);border:1px solid ' + typeColor + '40;border-radius:10px;margin-bottom:14px;">';
  html += '<span style="font-size:24px;">' + typeIcon + '</span>';
  html += '<div style="flex:1;"><div style="font-size:14px;font-weight:700;color:' + typeColor + ';">' + (isQuote ? 'Creer un devis' : 'Creer une facture') + '</div>';
  html += '<div style="font-size:11px;color:var(--text3);">' + typeLabel + ' · Numero genere automatiquement</div></div>';
  html += '</div>';

  // Client selector (always show dropdown + custom option)
  html += '<div style="margin-bottom:12px;"><label style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:0.5px;display:block;margin-bottom:4px;">Client</label>';
  html += '<select id="invClientSelect" onchange="onInvoiceClientChange()" style="width:100%;padding:10px;background:var(--surface2);color:var(--text);border:1px solid var(--border2);border-radius:8px;font-size:13px;box-sizing:border-box;">';
  html += '<option value="">-- Choisir un client --</option>';
  if (clients.length > 0) {
    clients.forEach((c, i) => {
      html += '<option value="' + i + '">' + esc(c.label) + '</option>';
    });
  }
  html += '<option value="__custom__">&#9999; Saisir un autre nom...</option>';
  html += '</select>';
  // Custom text field (hidden by default, shown when user picks "Autre" or if no clients)
  const showCustom = clients.length === 0;
  html += '<div id="invClientCustomWrap" style="' + (showCustom ? '' : 'display:none;') + 'margin-top:6px;">';
  html += '<input id="invClient" type="text" placeholder="Nom du client (saisie libre)" oninput="validateInvoiceForm()" style="width:100%;padding:10px;background:var(--surface2);color:var(--text);border:1px solid var(--border2);border-radius:8px;font-size:13px;box-sizing:border-box;">';
  if (clients.length === 0) html += '<div style="font-size:10px;color:var(--text3);margin-top:3px;">Aucun contact trouve dans votre organisation. Saisissez le nom manuellement.</div>';
  html += '</div>';
  window._invoiceClients = clients;
  html += '</div>';

  // Period + due date
  html += '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:12px;">';
  html += '<div><label style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:0.5px;display:block;margin-bottom:4px;">Periode du</label>';
  html += '<input id="invPeriodStart" type="date" style="width:100%;padding:8px;background:var(--surface2);color:var(--text);border:1px solid var(--border2);border-radius:8px;font-size:12px;box-sizing:border-box;"></div>';
  html += '<div><label style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:0.5px;display:block;margin-bottom:4px;">Au</label>';
  html += '<input id="invPeriodEnd" type="date" style="width:100%;padding:8px;background:var(--surface2);color:var(--text);border:1px solid var(--border2);border-radius:8px;font-size:12px;box-sizing:border-box;"></div>';
  html += '<div><label style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:0.5px;display:block;margin-bottom:4px;">' + (isQuote ? 'Valide jusqu\'au' : 'Echeance') + '</label>';
  html += '<input id="invDueDate" type="date" style="width:100%;padding:8px;background:var(--surface2);color:var(--text);border:1px solid var(--border2);border-radius:8px;font-size:12px;box-sizing:border-box;"></div>';
  html += '</div>';

  // Auto-fill
  html += '<button class="btn btnSmall btnOutline" style="width:100%;padding:9px;font-size:12px;margin-bottom:12px;" onclick="autoFillInvoiceItems(\'' + type + '\')">&#9889; Auto-remplir depuis les prestations de la periode</button>';

  // Items table
  html += '<div style="margin-bottom:10px;"><label style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:0.5px;display:block;margin-bottom:4px;">' + (isQuote ? 'Lignes du devis' : 'Lignes de facture') + '</label>';
  html += '<div style="background:var(--surface2);border-radius:10px;padding:10px;border:1px solid var(--border);">';
  html += '<div style="display:grid;grid-template-columns:1fr 60px 80px 70px 26px;gap:6px;padding:0 2px 6px;border-bottom:1px solid var(--border);font-size:9px;color:var(--text3);text-transform:uppercase;letter-spacing:0.5px;">';
  html += '<div>Description</div><div style="text-align:center;">Qte</div><div style="text-align:right;">PU HT</div><div style="text-align:right;">Total</div><div></div>';
  html += '</div>';
  html += '<div id="invItems" style="padding-top:6px;"></div>';
  html += '<button class="btn btnSmall btnOutline" style="font-size:11px;padding:5px 10px;margin-top:6px;" onclick="addInvoiceItem()">+ Ajouter une ligne</button>';
  html += '</div></div>';

  // Notes
  html += '<div style="margin-bottom:12px;"><label style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:0.5px;display:block;margin-bottom:4px;">Notes (optionnel)</label>';
  html += '<textarea id="invNotes" rows="2" placeholder="Conditions particulieres, modalites de paiement..." style="width:100%;padding:8px;background:var(--surface2);color:var(--text);border:1px solid var(--border2);border-radius:8px;font-size:12px;resize:vertical;box-sizing:border-box;font-family:inherit;"></textarea></div>';

  // Totals (sticky bottom-ish)
  html += '<div id="invTotals" style="background:linear-gradient(135deg,rgba(108,99,255,0.1),rgba(108,99,255,0.05));border:1px solid rgba(108,99,255,0.3);border-radius:10px;padding:12px;margin-bottom:14px;"></div>';

  // Actions
  html += '<div id="invValidationHint" style="font-size:11px;color:var(--text3);text-align:center;margin-bottom:8px;min-height:14px;"></div>';
  html += '<div style="display:flex;gap:8px;">';
  html += '<button class="btn btnOutline" style="flex:1;padding:12px;" onclick="closeMsg()">Annuler</button>';
  html += '<button id="invBtnDraft" class="btn btnSmall" disabled style="flex:1;padding:12px;background:var(--surface2);color:var(--text3);border:1px solid var(--border2);opacity:0.5;cursor:not-allowed;" onclick="saveInvoice(\'draft\',\'' + type + '\',' + (isQuote ? 'true' : 'false') + ')">Brouillon</button>';
  html += '<button id="invBtnSend" class="btn" disabled style="flex:1;padding:12px;background:var(--surface2);color:var(--text3);border:1px solid var(--border2);font-weight:700;opacity:0.5;cursor:not-allowed;" onclick="saveInvoice(\'sent\',\'' + type + '\',' + (isQuote ? 'true' : 'false') + ')">&#128228; ' + (isQuote ? 'Envoyer devis' : 'Envoyer') + '</button>';
  html += '</div></div>';
  window._invoiceTypeColor = typeColor;

  showMsg(html, true);
  const titleEl = document.getElementById('msgTitle');
  if (titleEl) titleEl.textContent = isQuote ? 'Nouveau devis' : 'Nouvelle facture';

  // Defaults
  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  document.getElementById('invPeriodStart').value = firstDay.toISOString().split('T')[0];
  document.getElementById('invPeriodEnd').value = lastDay.toISOString().split('T')[0];
  document.getElementById('invDueDate').value = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];

  // Pre-select first client + auto-fill
  if (clients.length === 1) {
    const sel = document.getElementById('invClientSelect');
    if (sel) { sel.value = '0'; onInvoiceClientChange(); }
  }
  autoFillInvoiceItems(type);
  updateInvoiceTotals();
}

function onInvoiceClientChange() {
  const sel = document.getElementById('invClientSelect');
  if (!sel) return;
  const custom = document.getElementById('invClientCustomWrap');
  if (sel.value === '__custom__') {
    if (custom) custom.style.display = '';
  } else if (custom && (window._invoiceClients || []).length > 0) {
    custom.style.display = 'none';
  }
  validateInvoiceForm();
}

function validateInvoiceForm() {
  const sel = document.getElementById('invClientSelect');
  const customInput = document.getElementById('invClient');
  const hint = document.getElementById('invValidationHint');
  const btnDraft = document.getElementById('invBtnDraft');
  const btnSend = document.getElementById('invBtnSend');
  if (!btnDraft || !btnSend) return;

  const clients = window._invoiceClients || [];
  let clientName = '';
  if (sel && sel.value && sel.value !== '__custom__' && clients[parseInt(sel.value)]) {
    clientName = clients[parseInt(sel.value)].name || clients[parseInt(sel.value)].label || '';
  } else if (customInput) {
    clientName = (customInput.value || '').trim();
  }

  const items = window._invoiceItems || [];
  const validItems = items.filter(i => (i.description || '').trim() && (parseFloat(i.unit_price) || 0) > 0 && (parseFloat(i.quantity) || 0) > 0);

  const errors = [];
  if (!clientName) errors.push('Client manquant');
  if (!validItems.length) errors.push('Au moins 1 ligne valide (description + qte + prix)');

  const ok = errors.length === 0;
  const tc = window._invoiceTypeColor || '#6c63ff';

  [btnDraft, btnSend].forEach(b => {
    b.disabled = !ok;
    b.style.opacity = ok ? '1' : '0.5';
    b.style.cursor = ok ? 'pointer' : 'not-allowed';
  });
  if (ok) {
    btnDraft.style.color = 'var(--text)';
    btnSend.style.background = 'linear-gradient(135deg,' + tc + ',' + tc + 'cc)';
    btnSend.style.color = '#fff';
    btnSend.style.border = 'none';
  } else {
    btnDraft.style.color = 'var(--text3)';
    btnSend.style.background = 'var(--surface2)';
    btnSend.style.color = 'var(--text3)';
    btnSend.style.border = '1px solid var(--border2)';
  }
  if (hint) hint.textContent = ok ? '' : '&#9888; ' + errors.join(' · ');
  if (hint && !ok) hint.innerHTML = '&#9888; ' + errors.join(' · ');
  if (hint && ok) hint.innerHTML = '';
}

function addInvoiceItem() {
  const items = window._invoiceItems || [];
  items.push({ description: '', quantity: 1, unit_price: 0 });
  window._invoiceItems = items;
  renderInvoiceItems();
}

function renderInvoiceItems() {
  const div = document.getElementById('invItems');
  if (!div) return;
  const items = window._invoiceItems || [];
  if (!items.length) {
    div.innerHTML = '<div style="text-align:center;color:var(--text3);font-size:11px;padding:14px 0;">Aucune ligne. Ajoutez-en une ou auto-remplissez.</div>';
    return;
  }
  let html = '';
  items.forEach((item, i) => {
    const lineTotal = (parseFloat(item.quantity) || 0) * (parseFloat(item.unit_price) || 0);
    html += '<div style="display:grid;grid-template-columns:1fr 60px 80px 70px 26px;gap:6px;margin-bottom:5px;align-items:center;">';
    html += '<input type="text" value="' + esc(item.description || '') + '" placeholder="Description" oninput="window._invoiceItems[' + i + '].description=this.value;validateInvoiceForm()" style="padding:7px 9px;background:var(--surface);color:var(--text);border:1px solid var(--border2);border-radius:6px;font-size:12px;min-width:0;">';
    html += '<input type="number" value="' + (item.quantity || 1) + '" min="0.5" step="0.5" onchange="window._invoiceItems[' + i + '].quantity=parseFloat(this.value)||1;updateInvoiceTotals();renderInvoiceItems()" style="padding:7px 6px;background:var(--surface);color:var(--text);border:1px solid var(--border2);border-radius:6px;font-size:12px;text-align:center;min-width:0;">';
    html += '<input type="number" value="' + (item.unit_price || 0) + '" min="0" step="0.01" onchange="window._invoiceItems[' + i + '].unit_price=parseFloat(this.value)||0;updateInvoiceTotals();renderInvoiceItems()" style="padding:7px 6px;background:var(--surface);color:var(--text);border:1px solid var(--border2);border-radius:6px;font-size:12px;text-align:right;min-width:0;">';
    html += '<div style="font-size:12px;font-weight:700;color:var(--text);text-align:right;">' + lineTotal.toFixed(2) + '€</div>';
    html += '<button onclick="window._invoiceItems.splice(' + i + ',1);renderInvoiceItems();updateInvoiceTotals()" title="Supprimer" style="background:none;border:none;color:#ef4444;cursor:pointer;font-size:14px;padding:2px;">&#128465;</button>';
    html += '</div>';
  });
  div.innerHTML = html;
}

function updateInvoiceTotals() {
  const div = document.getElementById('invTotals');
  if (!div) return;
  const items = window._invoiceItems || [];
  const subtotal = items.reduce((s, i) => s + (i.quantity || 1) * (i.unit_price || 0), 0);
  const member = API.getMember();
  const regime = member?.vat_regime || 'micro';
  const vatRate = regime === 'normal' ? 20 : regime === 'reduced' ? 10 : 0;
  const vatAmount = subtotal * vatRate / 100;
  const total = subtotal + vatAmount;
  let html = '<div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:4px;"><span>Sous-total HT</span><span>' + subtotal.toFixed(2) + ' \u20ac</span></div>';
  if (vatRate > 0) {
    html += '<div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:4px;color:var(--text3);"><span>TVA ' + vatRate + '%</span><span>' + vatAmount.toFixed(2) + ' \u20ac</span></div>';
  } else {
    html += '<div style="font-size:11px;color:var(--text3);margin-bottom:4px;">TVA non applicable, art. 293B du CGI</div>';
  }
  html += '<div style="display:flex;justify-content:space-between;font-size:14px;font-weight:700;border-top:1px solid var(--border2);padding-top:6px;"><span>Total TTC</span><span>' + total.toFixed(2) + ' \u20ac</span></div>';
  div.innerHTML = html;
  validateInvoiceForm();
}

async function autoFillInvoiceItems(type) {
  const start = document.getElementById('invPeriodStart').value;
  const end = document.getElementById('invPeriodEnd').value;
  if (!start || !end) return showToast('Definissez la periode');
  const prop = API.getActiveProperty(fullConfig);
  const org = API.getOrg();

  // 1. Cleanings from planning (iCal ménages)
  const excludedStatuses = ['disputed', 'refused', 'cancelled', 'pending', 'assigned', 'pending_validation'];
  const filteredCleanings = (cleanings || []).filter(c => {
    const d = c.date || c.cleaningDate;
    if (d < start || d > end) return false;
    if (c._status && excludedStatuses.includes(c._status)) return false;
    return true;
  });

  // 2. Service requests (prestations à la demande) - only 'done'
  let filteredServices = [];
  if (org && prop) {
    try {
      const { data: svcReqs } = await sb.from('service_requests').select('*')
        .eq('org_id', org.id).eq('property_id', prop.id).eq('status', 'done')
        .gte('requested_date', start).lte('requested_date', end);
      filteredServices = svcReqs || [];
    } catch(e) { console.error('Load service requests for invoice:', e); }
  }

  if (!filteredCleanings.length && !filteredServices.length) return showToast('Aucune prestation facturable sur cette periode');

  if (type === 'concierge_to_owner') {
    window._invoiceItems = [];
    // Ménages réguliers
    if (filteredCleanings.length) {
      const price = getServicePrice(prop?.id || '', 'cleaning_standard', 'price_owner');
      window._invoiceItems.push({
        description: 'Menages reguliers - ' + (prop?.name || 'Propriete') + ' (' + filteredCleanings.length + ')',
        quantity: filteredCleanings.length,
        unit_price: price
      });
    }
    // Prestations à la demande
    filteredServices.forEach(sr => {
      const svcLabel = getServiceLabel(sr.service_type);
      const svcPrice = getServicePrice(prop?.id || '', sr.service_type, 'price_owner');
      window._invoiceItems.push({
        description: svcLabel + (sr.requested_date ? ' (' + sr.requested_date + ')' : ''),
        quantity: 1,
        unit_price: svcPrice
      });
    });
  } else {
    const byProvider = {};
    filteredCleanings.forEach(c => {
      const p = c.provider || 'Non assigne';
      if (!byProvider[p]) byProvider[p] = { count: 0, price: 0 };
      byProvider[p].count++;
      const provObj = (prop?.providers || []).find(pr => pr.name === p);
      byProvider[p].price = provObj?.price || 0;
    });
    filteredServices.forEach(sr => {
      const p = sr.assigned_provider || 'Non assigne';
      if (!byProvider[p]) byProvider[p] = { count: 0, price: 0 };
      byProvider[p].count++;
      byProvider[p].price = byProvider[p].price || getServicePrice(prop?.id || '', sr.service_type, 'cost_provider');
    });
    window._invoiceItems = Object.entries(byProvider).map(([name, data]) => ({
      description: 'Prestations de ' + name + ' - ' + (prop?.name || ''),
      quantity: data.count,
      unit_price: data.price
    }));
  }
  renderInvoiceItems();
  updateInvoiceTotals();
}

async function saveInvoice(status, type, isQuote) {
  const member = API.getMember();
  const org = API.getOrg();
  const prop = API.getActiveProperty(fullConfig);
  if (!org) return;
  isQuote = !!isQuote;

  const items = window._invoiceItems || [];
  const validItems = items.filter(i => i.description && (parseFloat(i.unit_price) || 0) > 0);
  if (!validItems.length) return showToast('Ajoutez au moins une ligne avec description et prix');

  // Resolve client from select or custom input
  const sel = document.getElementById('invClientSelect');
  const clients = window._invoiceClients || [];
  let clientName = '', clientEmail = '', propertyName = prop?.name || '';
  if (sel && sel.value && sel.value !== '__custom__' && clients[parseInt(sel.value)]) {
    const c = clients[parseInt(sel.value)];
    clientName = c.name || c.label || '';
    clientEmail = c.email || '';
    if (c.propertyName) propertyName = c.propertyName;
  } else {
    clientName = document.getElementById('invClient')?.value?.trim() || '';
  }
  if (!clientName) return showToast('Selectionnez un client');

  const subtotal = validItems.reduce((s, i) => s + (parseFloat(i.quantity) || 1) * (parseFloat(i.unit_price) || 0), 0);
  const regime = member?.vat_regime || 'micro';
  const vatRate = regime === 'normal' ? 20 : regime === 'reduced' ? 10 : 0;
  const vatAmount = subtotal * vatRate / 100;
  const total = subtotal + vatAmount;

  const year = new Date().getFullYear();
  const prefix = isQuote ? 'DEV' : 'FAC';
  const { count } = await sb.from('invoices').select('*', { count: 'exact', head: true })
    .eq('org_id', org.id).eq('is_quote', isQuote);
  const num = String((count || 0) + 1).padStart(4, '0');
  const invoiceNumber = prefix + '-' + year + '-' + num;

  const invoice = {
    org_id: org.id,
    invoice_number: invoiceNumber,
    type: type,
    status: status,
    is_quote: isQuote,
    issuer_name: member?.company_name || member?.display_name || '',
    issuer_siret: member?.siret || '',
    issuer_address: member?.billing_address || member?.address || '',
    issuer_vat_number: member?.vat_number || '',
    issuer_email: member?.invited_email || '',
    client_name: clientName,
    client_email: clientEmail,
    client_address: '',
    property_name: propertyName,
    items: validItems,
    subtotal_ht: subtotal,
    total_ht: subtotal,
    vat_rate: vatRate,
    vat_amount: vatAmount,
    total_tva: vatAmount,
    total_ttc: total,
    payment_terms: 'A reception',
    period_start: document.getElementById('invPeriodStart')?.value || null,
    period_end: document.getElementById('invPeriodEnd')?.value || null,
    notes: document.getElementById('invNotes')?.value?.trim() || '',
    due_date: isQuote ? null : (document.getElementById('invDueDate')?.value || new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0]),
    quote_valid_until: isQuote ? (document.getElementById('invDueDate')?.value || new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0]) : null,
  };

  // Try insert — retry by dropping unknown columns if schema doesn't have them
  const OPTIONAL_COLS = ['client_email','client_address','total_ht','total_tva','subtotal_ht','vat_rate','vat_amount','issuer_vat_number','issuer_email','issuer_siret','issuer_address','property_name','payment_terms','period_start','period_end','notes','due_date','is_quote','quote_valid_until'];
  let payload = { ...invoice };
  let error = null;
  for (let attempt = 0; attempt < 8; attempt++) {
    const res = await sb.from('invoices').insert(payload);
    error = res.error;
    if (!error) break;
    // Schema mismatch: "Could not find the 'X' column of 'invoices'"
    const m = (error.message || '').match(/find the '([^']+)' column/i);
    if (m && OPTIONAL_COLS.includes(m[1]) && (m[1] in payload)) {
      delete payload[m[1]];
      continue;
    }
    break;
  }
  if (error) { console.error('Invoice error:', error); return showToast('Erreur: ' + safeErr(error, 'Creation impossible')); }

  closeMsg();
  const label = isQuote ? 'Devis' : 'Facture';
  showToast(status === 'draft' ? 'Brouillon sauvegarde' : label + ' ' + invoiceNumber + ' cree !');
  loadInvoices();
}

window.showCreateInvoiceModal = showCreateInvoiceModal;
window.validateInvoiceForm = validateInvoiceForm;
window.addInvoiceItem = addInvoiceItem;
window.renderInvoiceItems = renderInvoiceItems;
window.updateInvoiceTotals = updateInvoiceTotals;
window.autoFillInvoiceItems = autoFillInvoiceItems;
window.saveInvoice = saveInvoice;
