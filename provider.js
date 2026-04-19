// Provider mode module — navigation, invoices list, auto-billing
// Depends on: sb, API, esc, showMsg, showToast, customConfirm,
//   showCreateInvoiceModal, initProviderFullChat, renderAnnuaireTab,
//   renderAutoBillingHistory, previewProviderAutoBill, SUPABASE_URL
// Exposes: switchProviderNav, loadProviderInvoices, renderProvInvoicesView,
//   _renderProvInvoiceCard, renderProvInvoiceSummary, renderProvInvoicePeriodChips,
//   renderProvInvoiceStatusChips, setProvInvoicePeriod, setProvInvoiceStatus,
//   switchProvFinTab, setProvDocType, openProvInvoice, switchProvFinMode,
//   renderProviderAutoBillingPanel, saveProviderAutoBillSettings, triggerProviderAutoBillNow

/* ── Provider Nav Switching ── */
function switchProviderNav(tab) {
  const overview = document.getElementById('provContentOverview');
  const prestations = document.getElementById('provContentPrestations');
  const billing = document.getElementById('provContentBilling');
  const chatPage = document.getElementById('provContentChat');
  const annuairePage = document.getElementById('provContentAnnuaire');
  if (overview) overview.style.display = tab === 'overview' ? '' : 'none';
  if (billing) billing.style.display = tab === 'billing' ? '' : 'none';
  if (prestations) prestations.style.display = tab === 'prestations' ? '' : 'none';
  if (chatPage) chatPage.style.display = tab === 'chat' ? '' : 'none';
  if (annuairePage) annuairePage.style.display = tab === 'annuaire' ? '' : 'none';
  if (tab === 'chat') initProviderFullChat();
  if (tab === 'annuaire') renderAnnuaireTab();
  if (tab === 'billing') loadProviderInvoices();
  document.querySelectorAll('#bottomNav .bottomNav-item').forEach(n => n.classList.remove('active'));
  const navEl = document.getElementById('nav_' + tab);
  if (navEl) navEl.classList.add('active');
  window.scrollTo(0, 0);
}

let _provInvoicesCache = [];
let _provInvoicePeriod = 'all';
let _provInvoiceStatus = 'all';

async function loadProviderInvoices() {
  try {
    const org = API.getOrg();
    if (!org) return;
    const member = API.getMember();
    const { data: { user } } = await sb.auth.getUser();
    const provName = member?.display_name || user?.email?.split('@')[0] || '';
    const { data: allInvoices } = await sb.from('invoices').select('*')
      .eq('org_id', org.id).in('type', ['provider_to_concierge','provider_to_owner'])
      .order('created_at', { ascending: false }).limit(200);
    _provInvoicesCache = (allInvoices || []).filter(inv => {
      if (inv.issuer_name && provName && inv.issuer_name.toLowerCase().includes(provName.toLowerCase())) return true;
      if (inv.provider_name && provName && inv.provider_name.toLowerCase().includes(provName.toLowerCase())) return true;
      return false;
    });
    renderProvInvoicesView();
  } catch(e) { console.error('loadProviderInvoices error:', e); }
}

function renderProvInvoicesView() {
  const container = document.getElementById('provInvoicesList');
  if (!container) return;
  const today = new Date().toISOString().split('T')[0];
  const search = (document.getElementById('provInvoiceSearch')?.value || '').trim().toLowerCase();
  const now = new Date();
  const thisMonthStart = now.getFullYear() + '-' + String(now.getMonth()+1).padStart(2,'0') + '-01';
  const lastMonth = new Date(now.getFullYear(), now.getMonth()-1, 1);
  const lastMonthStart = lastMonth.getFullYear() + '-' + String(lastMonth.getMonth()+1).padStart(2,'0') + '-01';
  const lastMonthEnd = now.getFullYear() + '-' + String(now.getMonth()+1).padStart(2,'0') + '-01';
  const thisYearStart = now.getFullYear() + '-01-01';
  const inPeriod = (inv) => {
    const d = (inv.created_at || '').substring(0, 10);
    if (_provInvoicePeriod === 'all') return true;
    if (_provInvoicePeriod === 'thisMonth') return d >= thisMonthStart;
    if (_provInvoicePeriod === 'lastMonth') return d >= lastMonthStart && d < lastMonthEnd;
    if (_provInvoicePeriod === 'thisYear') return d >= thisYearStart;
    return true;
  };
  const isOv = (inv) => inv.status === 'sent' && inv.due_date && inv.due_date < today;
  const statusOf = (inv) => isOv(inv) ? 'overdue' : inv.status;
  const matchSearch = (inv) => {
    if (!search) return true;
    const hay = [inv.invoice_number, inv.property_name, inv.client_name].filter(Boolean).join(' ').toLowerCase();
    return hay.includes(search);
  };
  const periodFiltered = _provInvoicesCache.filter(inPeriod);
  const filtered = periodFiltered.filter(inv => {
    if (_provInvoiceStatus !== 'all' && statusOf(inv) !== _provInvoiceStatus) return false;
    return matchSearch(inv);
  });
  renderProvInvoiceSummary(periodFiltered);
  renderProvInvoicePeriodChips();
  renderProvInvoiceStatusChips(periodFiltered);
  if (!filtered.length) {
    container.innerHTML = '<div style="text-align:center;color:var(--text3);font-size:13px;padding:30px 20px;"><div style="font-size:32px;opacity:0.4;margin-bottom:8px;">&#128196;</div>Aucune facture pour ces filtres</div>';
    return;
  }
  const MONTHS_FULL = ['Janvier','Fevrier','Mars','Avril','Mai','Juin','Juillet','Aout','Septembre','Octobre','Novembre','Decembre'];
  const groups = {};
  filtered.forEach(inv => {
    const key = (inv.created_at || '').substring(0, 7);
    if (!groups[key]) groups[key] = [];
    groups[key].push(inv);
  });
  const keys = Object.keys(groups).sort().reverse();
  let html = '';
  keys.forEach(mk => {
    const list = groups[mk];
    const [yy, mm] = mk.split('-');
    const label = MONTHS_FULL[parseInt(mm)-1] + ' ' + yy;
    const monthTotal = list.reduce((s,i) => s + (i.total_ttc||0), 0);
    const monthPaid = list.filter(i => i.status === 'paid').reduce((s,i) => s + (i.total_ttc||0), 0);
    html += '<details open style="margin-bottom:10px;">';
    html += '<summary style="list-style:none;cursor:pointer;display:flex;align-items:center;justify-content:space-between;padding:8px 4px;border-bottom:1px solid var(--border);font-size:12px;font-weight:700;color:var(--text2);">';
    html += '<span style="display:flex;align-items:center;gap:6px;"><span class="collapseArrow">&#9662;</span>' + label + ' <span style="color:var(--text3);font-weight:400;font-size:11px;">(' + list.length + ')</span></span>';
    html += '<span style="font-size:11px;color:var(--text3);font-weight:400;">Total <b style="color:var(--text);">' + monthTotal.toFixed(0) + '€</b> — Encaisse <b style="color:#34d399;">' + monthPaid.toFixed(0) + '€</b></span>';
    html += '</summary><div style="padding-top:6px;">';
    list.forEach(inv => { html += _renderProvInvoiceCard(inv, today); });
    html += '</div></details>';
  });
  container.innerHTML = html;
}

function _renderProvInvoiceCard(inv, today) {
  const isPaid = inv.status === 'paid';
  const isOverdue = inv.status === 'sent' && inv.due_date && inv.due_date < today;
  const color = isPaid ? '#34d399' : (isOverdue ? '#e94560' : '#6c63ff');
  const label = isPaid ? 'Encaisse' : (isOverdue ? 'En retard' : 'En attente');
  const dateStr = new Date(inv.created_at).toLocaleDateString('fr-FR');
  const firstItem = (inv.items && inv.items.length) ? inv.items[0] : null;
  const prestLabel = firstItem && firstItem.description ? firstItem.description : (inv.property_name || 'Facture');
  let dueHint = '';
  if (inv.due_date && !isPaid) {
    const d = new Date(inv.due_date + 'T12:00:00');
    const daysDiff = Math.floor((d - new Date()) / 86400000);
    if (daysDiff < 0) dueHint = '<span style="font-size:10px;color:#e94560;font-weight:600;">&#9888; En retard de ' + Math.abs(daysDiff) + 'j</span>';
    else if (daysDiff <= 7) dueHint = '<span style="font-size:10px;color:#f59e0b;">&#9201; Paiement dans ' + daysDiff + 'j</span>';
    else dueHint = '<span style="font-size:10px;color:var(--text3);">Echeance: ' + fmtDate(inv.due_date) + '</span>';
  }
  let html = '';
  html += '<div onclick="showInvoiceDetail(\'' + inv.id + '\')" style="background:var(--surface2);border:1px solid var(--border2);border-left:3px solid ' + color + ';border-radius:10px;padding:12px;margin-bottom:8px;cursor:pointer;transition:border-color 0.15s;" onmouseover="this.style.borderColor=\'' + color + '\'" onmouseout="this.style.borderColor=\'var(--border2)\'">';
  html += '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;">';
  html += '<div style="flex:1;min-width:0;">';
  html += '<div style="font-size:14px;font-weight:700;color:var(--text);margin-bottom:2px;">' + esc(prestLabel) + '</div>';
  if (inv.property_name) html += '<div style="font-size:11px;color:var(--text3);margin-bottom:3px;">&#127968; ' + esc(inv.property_name) + '</div>';
  html += '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;"><span style="font-size:10px;color:var(--text3);">' + esc(inv.invoice_number || 'Facture') + ' · ' + dateStr + '</span>';
  if (dueHint) html += dueHint;
  html += '</div></div>';
  html += '<div style="text-align:right;flex-shrink:0;">';
  html += '<div style="font-size:17px;font-weight:800;color:' + (isPaid ? '#34d399' : 'var(--text)') + ';">' + (inv.total_ttc || 0).toFixed(2) + ' \u20ac</div>';
  html += '<span style="display:inline-block;margin-top:4px;font-size:11px;padding:2px 8px;background:' + color + '20;color:' + color + ';border-radius:4px;font-weight:600;">' + label + '</span>';
  html += '</div></div>';
  html += '<div style="display:flex;gap:6px;margin-top:10px;flex-wrap:wrap;" onclick="event.stopPropagation()">';
  html += '<button class="btn btnSmall btnOutline" style="padding:4px 8px;font-size:11px;" onclick="showInvoiceDetail(\'' + inv.id + '\')">&#128065; Voir</button>';
  html += '<button class="btn btnSmall btnOutline" style="padding:4px 8px;font-size:11px;" onclick="downloadInvoicePDF(\'' + inv.id + '\')">&#128196; PDF</button>';
  html += '</div></div>';
  return html;
}

function renderProvInvoiceSummary(invoices) {
  const div = document.getElementById('provInvoiceSummary');
  if (!div) return;
  const today = new Date().toISOString().split('T')[0];
  const totalPending = invoices.filter(i => i.status === 'sent' && !(i.due_date && i.due_date < today)).reduce((s, i) => s + (i.total_ttc || 0), 0);
  const totalEarned = invoices.filter(i => i.status === 'paid').reduce((s, i) => s + (i.total_ttc || 0), 0);
  const overdue = invoices.filter(i => i.status === 'sent' && i.due_date && i.due_date < today);
  const overdueTotal = overdue.reduce((s, i) => s + (i.total_ttc || 0), 0);
  const tileStyle = 'flex:1;min-width:110px;border-radius:12px;padding:12px;text-align:center;cursor:pointer;transition:transform 0.15s;';
  let html = '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:10px;">';
  html += '<div onclick="setProvInvoiceStatus(\'sent\')" onmouseover="this.style.transform=\'translateY(-2px)\'" onmouseout="this.style.transform=\'\'" style="' + tileStyle + 'background:rgba(108,99,255,0.15);border:1px solid rgba(108,99,255,0.3);"><div style="font-size:18px;font-weight:800;color:#a78bfa;">' + totalPending.toFixed(0) + ' \u20ac</div><div style="font-size:10px;color:var(--text3);">En attente</div></div>';
  html += '<div onclick="setProvInvoiceStatus(\'paid\')" onmouseover="this.style.transform=\'translateY(-2px)\'" onmouseout="this.style.transform=\'\'" style="' + tileStyle + 'background:rgba(52,211,153,0.15);border:1px solid rgba(52,211,153,0.3);"><div style="font-size:18px;font-weight:800;color:#34d399;">' + totalEarned.toFixed(0) + ' \u20ac</div><div style="font-size:10px;color:var(--text3);">Encaisse</div></div>';
  html += '<div onclick="setProvInvoiceStatus(\'overdue\')" onmouseover="this.style.transform=\'translateY(-2px)\'" onmouseout="this.style.transform=\'\'" style="' + tileStyle + 'background:rgba(233,69,96,' + (overdue.length > 0 ? '0.15' : '0.05') + ');border:1px solid rgba(233,69,96,0.3);"><div style="font-size:18px;font-weight:800;color:#e94560;">' + overdueTotal.toFixed(0) + ' \u20ac</div><div style="font-size:10px;color:var(--text3);">En retard</div></div>';
  html += '<div onclick="setProvInvoiceStatus(\'all\')" onmouseover="this.style.transform=\'translateY(-2px)\'" onmouseout="this.style.transform=\'\'" style="' + tileStyle + 'background:var(--surface2);border:1px solid var(--border2);"><div style="font-size:18px;font-weight:800;color:var(--text);">' + invoices.length + '</div><div style="font-size:10px;color:var(--text3);">Nb factures</div></div>';
  html += '</div>';
  div.innerHTML = html;
}

function renderProvInvoicePeriodChips() {
  const row = document.getElementById('provInvoicePeriodChips');
  if (!row) return;
  const chips = [ {id:'all',label:'Tout'}, {id:'thisMonth',label:'Ce mois'}, {id:'lastMonth',label:'Mois dernier'}, {id:'thisYear',label:'Cette annee'} ];
  row.innerHTML = chips.map(c => {
    const act = _provInvoicePeriod === c.id;
    return '<button onclick="setProvInvoicePeriod(\'' + c.id + '\')" style="padding:5px 10px;border-radius:20px;font-size:11px;border:1px solid ' + (act ? '#6c63ff' : 'var(--border2)') + ';background:' + (act ? 'rgba(108,99,255,0.2)' : 'var(--surface2)') + ';color:' + (act ? '#a78bfa' : 'var(--text3)') + ';cursor:pointer;white-space:nowrap;">' + c.label + '</button>';
  }).join('');
}

function renderProvInvoiceStatusChips(invoices) {
  const row = document.getElementById('provInvoiceStatusChips');
  if (!row) return;
  const today = new Date().toISOString().split('T')[0];
  const counts = { all: invoices.length, sent: 0, paid: 0, overdue: 0 };
  invoices.forEach(i => { if (i.status === 'sent' && i.due_date && i.due_date < today) counts.overdue++; else counts[i.status] = (counts[i.status] || 0) + 1; });
  const chips = [ {id:'all',label:'Toutes',color:'#888'}, {id:'sent',label:'En attente',color:'#6c63ff'}, {id:'paid',label:'Encaisse',color:'#34d399'}, {id:'overdue',label:'En retard',color:'#e94560'} ];
  row.innerHTML = chips.map(c => {
    const act = _provInvoiceStatus === c.id;
    const count = counts[c.id] || 0;
    if (c.id !== 'all' && count === 0) return '';
    return '<button onclick="setProvInvoiceStatus(\'' + c.id + '\')" style="padding:5px 10px;border-radius:20px;font-size:11px;border:1px solid ' + (act ? c.color : 'var(--border2)') + ';background:' + (act ? c.color + '20' : 'var(--surface2)') + ';color:' + (act ? c.color : 'var(--text3)') + ';cursor:pointer;white-space:nowrap;font-weight:' + (act ? '700' : '500') + ';">' + c.label + ' (' + count + ')</button>';
  }).join('');
}

function setProvInvoicePeriod(p) { _provInvoicePeriod = p; renderProvInvoicesView(); }
function setProvInvoiceStatus(s) { _provInvoiceStatus = s; renderProvInvoicesView(); }

function switchProvFinTab(tab) {
  const btns = {
    list: document.getElementById('provFinTab_list'),
    create: document.getElementById('provFinTab_create'),
  };
  const panels = {
    list: document.getElementById('provFinPanel_list'),
    create: document.getElementById('provFinPanel_create'),
  };
  if (!btns.list || !btns.create) return;
  Object.values(btns).forEach(b => b && b.classList.remove('annSubTabActive'));
  Object.values(panels).forEach(p => p && (p.style.display = 'none'));
  if (btns[tab]) btns[tab].classList.add('annSubTabActive');
  if (panels[tab]) panels[tab].style.display = '';
  if (tab === 'list') loadProviderInvoices();
}

let _provDocType = 'invoice';
function setProvDocType(t) {
  _provDocType = t;
  const invBtn = document.getElementById('provDocType_invoice_btn');
  const qBtn = document.getElementById('provDocType_quote_btn');
  const hint = document.getElementById('provDocTypeHint');
  if (invBtn) invBtn.classList.toggle('finFactModeActive', t === 'invoice');
  if (qBtn) qBtn.classList.toggle('finFactModeActive', t === 'quote');
  if (hint) hint.textContent = t === 'quote' ? 'Emettre un devis pour validation avant prestation' : 'A qui envoyer cette facture ?';
}
function openProvInvoice(type) { showCreateInvoiceModal(type, _provDocType === 'quote'); }

function switchProvFinMode(mode) {
  const manualBtn = document.getElementById('provFinMode_manual_btn');
  const autoBtn = document.getElementById('provFinMode_auto_btn');
  const manualPanel = document.getElementById('provFinMode_manual_panel');
  const autoPanel = document.getElementById('provFinMode_auto_panel');
  if (!manualBtn || !autoBtn) return;
  manualBtn.classList.toggle('finFactModeActive', mode === 'manual');
  autoBtn.classList.toggle('finFactModeActive', mode === 'auto');
  if (manualPanel) manualPanel.style.display = mode === 'manual' ? '' : 'none';
  if (autoPanel) autoPanel.style.display = mode === 'auto' ? '' : 'none';
  if (mode === 'auto') renderProviderAutoBillingPanel();
}

async function renderProviderAutoBillingPanel() {
  const div = document.getElementById('provAutoBillingPanel');
  if (!div) return;
  const user = (await sb.auth.getUser()).data.user;
  if (!user) { div.innerHTML = '<div style="color:var(--text3);">Non connecte.</div>'; return; }

  let { data: s } = await sb.from('billing_settings').select('*').eq('user_id', user.id).eq('role', 'provider').maybeSingle();
  if (!s) {
    const org = API.getOrg();
    const orgId = org?.id || user.id;
    const { data: created } = await sb.from('billing_settings').insert({
      org_id: orgId, user_id: user.id, role: 'provider', auto_enabled: false,
      frequency: 'monthly', billing_day: 1, default_status: 'draft', period: 'previous_month',
      due_days: 30, types_enabled: { provider_to_concierge: true, provider_to_owner: true }
    }).select().single();
    s = created || { user_id: user.id, role: 'provider', auto_enabled: false, frequency: 'monthly', billing_day: 1, default_status: 'draft', period: 'previous_month', due_days: 30, types_enabled: { provider_to_concierge: true, provider_to_owner: true } };
  }
  const enabled = !!s.auto_enabled;
  const te = s.types_enabled || {};

  let h = '';
  h += '<div style="background:var(--surface2);border-radius:12px;padding:14px;margin-bottom:12px;">';
  h += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">';
  h += '<div><div style="font-size:15px;font-weight:700;color:var(--text);">&#9889; Facturation automatique</div>';
  h += '<div style="font-size:12px;color:var(--text3);margin-top:2px;">Genere vos factures aux conciergeries et proprietaires chaque mois.</div></div>';
  h += '<label class="switch" style="position:relative;display:inline-block;width:48px;height:26px;">';
  h += '<input type="checkbox" id="provAb_enabled"' + (enabled ? ' checked' : '') + ' style="opacity:0;width:0;height:0;">';
  h += '<span style="position:absolute;cursor:pointer;top:0;left:0;right:0;bottom:0;background:' + (enabled ? '#22c55e' : '#555') + ';border-radius:26px;transition:0.3s;"></span>';
  h += '<span style="position:absolute;top:3px;left:' + (enabled ? '25px' : '3px') + ';width:20px;height:20px;background:white;border-radius:50%;transition:0.3s;"></span>';
  h += '</label></div>';

  // Collapsible config (hidden when disabled)
  h += '<div id="provAb_collapsible" style="display:' + (enabled ? 'block' : 'none') + ';">';
  h += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px;">';
  h += '<div><label style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:0.5px;display:block;margin-bottom:4px;">Frequence</label>';
  h += '<select id="provAb_frequency" style="width:100%;padding:9px;background:var(--surface2);color:var(--text);border:1px solid var(--border2);border-radius:8px;font-size:13px;box-sizing:border-box;">';
  h += '<option value="monthly" selected>Mensuelle</option></select></div>';
  h += '<div><label style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:0.5px;display:block;margin-bottom:4px;">Jour de generation</label>';
  h += '<select id="provAb_billing_day" style="width:100%;padding:9px;background:var(--surface2);color:var(--text);border:1px solid var(--border2);border-radius:8px;font-size:13px;box-sizing:border-box;">';
  for (let d = 1; d <= 28; d++) h += '<option value="' + d + '"' + (s.billing_day === d ? ' selected' : '') + '>' + d + '</option>';
  h += '</select></div>';
  h += '<div><label style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:0.5px;display:block;margin-bottom:4px;">Periode couverte</label>';
  h += '<select id="provAb_period" style="width:100%;padding:9px;background:var(--surface2);color:var(--text);border:1px solid var(--border2);border-radius:8px;font-size:13px;box-sizing:border-box;">';
  h += '<option value="previous_month"' + (s.period === 'previous_month' ? ' selected' : '') + '>Mois precedent</option>';
  h += '<option value="current_month"' + (s.period === 'current_month' ? ' selected' : '') + '>Mois courant</option>';
  h += '</select></div>';
  h += '<div><label style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:0.5px;display:block;margin-bottom:4px;">Statut par defaut</label>';
  h += '<select id="provAb_default_status" style="width:100%;padding:9px;background:var(--surface2);color:var(--text);border:1px solid var(--border2);border-radius:8px;font-size:13px;box-sizing:border-box;">';
  h += '<option value="draft"' + (s.default_status === 'draft' ? ' selected' : '') + '>Brouillon</option>';
  h += '<option value="sent"' + (s.default_status === 'sent' ? ' selected' : '') + '>Envoye</option>';
  h += '</select></div>';
  h += '<div style="grid-column:1/-1;"><label style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:0.5px;display:block;margin-bottom:4px;">Echeance (jours)</label>';
  h += '<input type="number" id="provAb_due_days" value="' + (s.due_days || 30) + '" min="0" max="120" style="width:100%;padding:9px;background:var(--surface2);color:var(--text);border:1px solid var(--border2);border-radius:8px;font-size:13px;box-sizing:border-box;"></div>';
  h += '</div>';

  h += '<div style="margin-bottom:12px;"><div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;">Types de factures generees</div>';
  h += '<label style="display:flex;align-items:center;gap:8px;padding:8px;background:var(--surface2);border-radius:8px;margin-bottom:4px;cursor:pointer;">';
  h += '<input type="checkbox" id="provAb_type_concierge"' + (te.provider_to_concierge !== false ? ' checked' : '') + ' style="accent-color:#ef4444;">';
  h += '<span style="font-size:13px;color:var(--text);">&#129529; Aux conciergeries</span></label>';
  h += '<label style="display:flex;align-items:center;gap:8px;padding:8px;background:var(--surface2);border-radius:8px;cursor:pointer;">';
  h += '<input type="checkbox" id="provAb_type_owner"' + (te.provider_to_owner !== false ? ' checked' : '') + ' style="accent-color:#f59e0b;">';
  h += '<span style="font-size:13px;color:var(--text);">&#127968; Aux proprietaires (en direct)</span></label></div>';

  h += '<div style="font-size:11px;color:var(--text3);margin-bottom:8px;">Derniere execution: <strong style="color:var(--text2);">' + (s.last_run_at ? new Date(s.last_run_at).toLocaleString('fr-FR') : 'Jamais') + '</strong></div>';

  h += '<div style="display:flex;gap:8px;flex-wrap:wrap;">';
  h += '<button onclick="saveProviderAutoBillSettings()" style="flex:1;min-width:120px;padding:10px;background:linear-gradient(135deg,#ef4444,#dc2626);color:#fff;border:none;border-radius:8px;font-weight:600;cursor:pointer;">&#128190; Enregistrer</button>';
  h += '<button onclick="previewProviderAutoBill()" style="min-width:100px;padding:10px;background:var(--surface2);color:var(--text);border:1px solid var(--border2);border-radius:8px;font-weight:600;cursor:pointer;" title="Simule sans rien creer">&#128065; Simuler</button>';
  h += '<button onclick="triggerProviderAutoBillNow()" style="min-width:100px;padding:10px;background:var(--surface2);color:var(--text);border:1px solid var(--border2);border-radius:8px;font-weight:600;cursor:pointer;">&#9889; Tester</button>';
  h += '</div>';
  h += '<div id="provAutoBillingHistory" style="margin-top:14px;"></div>';
  h += '</div>'; // close provAb_collapsible
  h += '</div>';

  div.innerHTML = h;
  renderAutoBillingHistory('provider');
  // Collapse reactivity on toggle
  const provToggle = document.getElementById('provAb_enabled');
  const provColl = document.getElementById('provAb_collapsible');
  if (provToggle && provColl) provToggle.addEventListener('change', () => {
    provColl.style.display = provToggle.checked ? 'block' : 'none';
    saveProviderAutoBillSettings();
  });
}

async function saveProviderAutoBillSettings() {
  const user = (await sb.auth.getUser()).data.user;
  if (!user) return;
  const payload = {
    auto_enabled: document.getElementById('provAb_enabled').checked,
    frequency: document.getElementById('provAb_frequency').value,
    billing_day: parseInt(document.getElementById('provAb_billing_day').value) || 1,
    period: document.getElementById('provAb_period').value,
    default_status: document.getElementById('provAb_default_status').value,
    due_days: parseInt(document.getElementById('provAb_due_days').value) || 30,
    types_enabled: {
      provider_to_concierge: document.getElementById('provAb_type_concierge').checked,
      provider_to_owner: document.getElementById('provAb_type_owner').checked,
    },
    updated_at: new Date().toISOString(),
  };
  const { error } = await sb.from('billing_settings').update(payload).eq('user_id', user.id).eq('role', 'provider');
  if (error) { showToast('Erreur: ' + error.message); return; }
  showToast('Parametres enregistres');
  renderProviderAutoBillingPanel();
}

async function triggerProviderAutoBillNow() {
  const user = (await sb.auth.getUser()).data.user;
  if (!user) return;
  const ok = await customConfirm('Declencher la facturation automatique maintenant ? Les factures en double seront evitees.', 'Lancer');
  if (!ok) return;
  try {
    const session = (await sb.auth.getSession()).data.session;
    const resp = await fetch(SUPABASE_URL + '/functions/v1/auto-bill?force=1&role=provider&user_id=' + user.id, {
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
    renderProviderAutoBillingPanel();
  } catch(e) { console.error(e); showToast('Erreur: ' + e.message); }
}

window.switchProviderNav = switchProviderNav;
window.loadProviderInvoices = loadProviderInvoices;
window.renderProvInvoicesView = renderProvInvoicesView;
window.renderProvInvoiceSummary = renderProvInvoiceSummary;
window.renderProvInvoicePeriodChips = renderProvInvoicePeriodChips;
window.renderProvInvoiceStatusChips = renderProvInvoiceStatusChips;
window.setProvInvoicePeriod = setProvInvoicePeriod;
window.setProvInvoiceStatus = setProvInvoiceStatus;
window.switchProvFinTab = switchProvFinTab;
window.setProvDocType = setProvDocType;
window.openProvInvoice = openProvInvoice;
window.switchProvFinMode = switchProvFinMode;
window.renderProviderAutoBillingPanel = renderProviderAutoBillingPanel;
window.saveProviderAutoBillSettings = saveProviderAutoBillSettings;
window.triggerProviderAutoBillNow = triggerProviderAutoBillNow;
