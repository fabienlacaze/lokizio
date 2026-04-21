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
function _appendProviderExtraTabs(content) {
  // Append hidden tab containers so nav switching works even in "waiting" mode
  let extra = '';
  extra += '<div id="provContentPrestations" style="display:none;"><div style="text-align:center;padding:30px;color:var(--text3);font-size:13px;">Aucune prestation pour le moment</div></div>';
  extra += '<div id="provContentBilling" style="display:none;"><div style="text-align:center;padding:30px;color:var(--text3);font-size:13px;">Aucun revenu pour le moment</div></div>';
  extra += '<div id="provContentAnnuaire" style="display:none;"><div id="provAnnuaireContent"></div></div>';
  extra += '<div id="provContentChat" style="display:none;"><div style="text-align:center;padding:30px;color:var(--text3);font-size:13px;">Aucun message</div></div>';
  content.insertAdjacentHTML('beforeend', extra);
}

async function showProviderMode() {
  try {
  setupBottomNav('provider');
  updateConnectionBadge();
  const content = document.querySelector('.content');
  if (!content) return;

  // Hide all normal panels
  content.innerHTML = '';

  // Get user's provider data
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return;

  // Find which properties this provider has cleanings in
  const org = API.getOrg();
  if (!org) {
    const { data: { user: u2 } } = await sb.auth.getUser();
    content.innerHTML = `<div id="provContentOverview"><div style="text-align:center;padding:60px 20px;">
      <div style="font-size:48px;margin-bottom:16px;animation:spin 2s ease-in-out infinite;">&#9203;</div>
      <div style="font-size:18px;font-weight:700;color:#6c63ff;margin-bottom:8px;">En attente d'invitation</div>
      <div style="font-size:13px;color:var(--text3);line-height:1.6;">
        Votre compte prestataire est pret !<br><br>
        Pour recevoir des missions, votre gestionnaire doit vous inviter.<br><br>
        <div style="background:var(--surface2);border-radius:8px;padding:12px;margin:16px 0;">
          Votre email : <b style="color:var(--text);font-size:15px;">${esc(u2 ? u2.email : '')}</b>
        </div>
      </div>
    </div></div>`;
    _appendProviderExtraTabs(content);
    return;
  }

  // Load all properties
  const { data: properties } = await sb.from('properties').select('*').eq('org_id', org.id);
  if (!properties || !properties.length) {
    content.innerHTML = '<div id="provContentOverview"><div style="text-align:center;padding:40px;color:var(--text3);">Aucune propriete trouvee.</div></div>';
    _appendProviderExtraTabs(content);
    return;
  }

  // Find provider name by email
  const providerEmail = user.email;
  let providerName = '';
  for (const prop of properties) {
    const match = (prop.providers || []).find(p => p.email === providerEmail);
    if (match) { providerName = match.name; break; }
  }
  if (!providerName) {
    content.innerHTML = `<div id="provContentOverview"><div style="text-align:center;padding:60px 20px;">
      <div style="font-size:48px;margin-bottom:16px;animation:spin 2s ease-in-out infinite;">&#9203;</div>
      <div style="font-size:18px;font-weight:700;color:var(--accent);margin-bottom:8px;">En attente</div>
      <div style="font-size:13px;color:var(--text3);line-height:1.6;">
        Votre compte prestataire est pret.<br>
        Votre gestionnaire doit vous ajouter comme prestataire dans ses proprietes.<br><br>
        <b>Votre email :</b> ${esc(providerEmail)}<br>
        Communiquez-le a votre gestionnaire pour qu'il vous ajoute.
      </div>
      <div style="display:flex;flex-direction:column;align-items:center;gap:10px;margin-top:24px;width:100%;max-width:320px;margin-left:auto;margin-right:auto;">
        <button onclick="shareProviderProfile()" style="padding:16px 32px;background:linear-gradient(135deg,#6c63ff,#5a54e0);color:#fff;border:none;border-radius:12px;font-size:15px;font-weight:700;cursor:pointer;width:100%;box-shadow:0 4px 16px rgba(108,99,255,0.4);">&#128228; Partager mon profil</button>
        <button id="mkPublishBtn" onclick="publishToMarketplace()" style="padding:14px 32px;background:linear-gradient(135deg,#34d399,#059669);color:#fff;border:none;border-radius:12px;font-size:14px;font-weight:700;cursor:pointer;width:100%;box-shadow:0 4px 16px rgba(52,211,153,0.3);">&#127970; M'inscrire sur l'annuaire</button>
      </div>
      <div style="font-size:11px;color:var(--text3);margin-top:8px;">Les conciergeries pourront vous trouver et vous inviter</div>
    </div></div>`;
    // Check if already on marketplace and update button
    try {
      const { data: { user: _u } } = await sb.auth.getUser();
      if (_u) {
        const { data: _mk } = await sb.from('marketplace_profiles').select('id').eq('user_id', _u.id).maybeSingle();
        if (_mk) {
          const btn = document.getElementById('mkPublishBtn');
          if (btn) { btn.innerHTML = '&#128221; Modifier mon profil annuaire'; btn.style.background = 'linear-gradient(135deg,#6c63ff,#5a54e0)'; }
        }
      }
    } catch(e) { console.error('Provider marketplace check error:', e); }
    // Still create other tab containers so nav works
    _appendProviderExtraTabs(content);
    return;
  }

  // Load all plannings and filter for this provider
  const today = new Date().toISOString().split('T')[0];
  let allCleanings = [];
  const propMap = {};

  for (const prop of properties) {
    propMap[prop.id] = prop;
    const { data: planning, error: planErr } = await sb.from('plannings').select('cleanings').eq('property_id', prop.id).single();
    if (planErr) continue;
    if (planning && planning.cleanings) {
      planning.cleanings
        .filter(c => c.provider === providerName && (c.cleaningDate || c.date) >= today)
        .forEach(c => allCleanings.push({ ...c, propertyId: prop.id, propertyName: prop.name, propertyAddress: prop.address || '', checkinTime: prop.checkinTime || '15:00', checkoutTime: prop.checkoutTime || '11:00', checklist: prop.checklist || [] }));
    }
  }

  allCleanings.sort((a, b) => (a.cleaningDate || a.date || '').localeCompare(b.cleaningDate || b.date || ''));

  // Load validations
  const validations = {};
  for (const prop of properties) {
    const { data: vals } = await sb.from('cleaning_validations').select('*').eq('property_id', prop.id).eq('provider_name', providerName);
    if (vals) vals.forEach(v => { validations[v.cleaning_date + '_' + v.provider_name] = v; });
  }

  // Render provider view
  const headerEl = document.querySelector('.header');
  if (headerEl) {
    const h1 = headerEl.querySelector('h1');
    if (h1) {
      h1.innerHTML = 'Lokizio';
      appendRoleBadge(h1);
    }
    const sub = headerEl.querySelector('.sub-title');
    if (sub) sub.textContent = 'Mode prestataire';
    // Hide unnecessary header buttons for provider — keep logout, theme, account, marketplace, invite
    document.querySelectorAll('.header-actions .btnHelp').forEach(btn => {
      const oc = btn.getAttribute('onclick') || '';
      if (!oc.includes('authLogout') && !oc.includes('toggleTheme') && !oc.includes('showAccountModal') && !oc.includes('showMarketplace') && !oc.includes('showConnectionRequests')) {
        btn.style.display = 'none';
      }
    });
    // Hide premium button for provider
    const premBtn = headerEl.querySelector('.btnPremium');
    if (premBtn) premBtn.style.display = 'none';
  }
  const footerPrem = document.getElementById('footerPremiumLink');
  if (footerPrem) footerPrem.style.display = 'none';

  // Calculate provider price and earnings (per-property using pricing table)
  let providerPrice = 0; // average display price
  let totalEarned = 0, totalUpcoming = 0;
  for (const prop of properties) {
    const basePrice = getServicePrice(prop.id, 'cleaning_standard', 'cost_provider');
    if (!providerPrice && basePrice) providerPrice = basePrice;
    const propCleanings = allCleanings.filter(c => c.propertyId === prop.id);
    propCleanings.forEach(c => {
      const d = c.cleaningDate || c.date || '';
      const price = getServicePriceForDate(prop.id, 'cleaning_standard', 'cost_provider', d);
      const v = validations[d + '_' + providerName];
      if (v && v.status === 'done') totalEarned += price;
      else totalUpcoming += price;
    });
  }
  const doneCount = allCleanings.filter(c => { const v = validations[(c.cleaningDate||c.date) + '_' + providerName]; return v && v.status === 'done'; }).length;
  const earnedThisMonth = totalEarned;
  const upcomingEarnings = totalUpcoming;

  // Load service requests assigned to this provider
  const { data: svcRequests } = await sb.from('service_requests').select('*').eq('org_id', org.id).in('status', ['pending','assigned','accepted','in_progress']);
  const myServiceRequests = (svcRequests || []).filter(r => r.assigned_provider === providerName || r.assigned_provider_email === providerEmail);

  // Get provider's services list
  let providerServices = [];
  for (const prop of properties) {
    const prov = (prop.providers || []).find(p => p.name === providerName);
    if (prov && prov.services) { providerServices = prov.services; break; }
  }

  // Group service requests by category
  const svcByCategory = {};
  myServiceRequests.forEach(r => {
    const catObj = SERVICE_CATALOG.find(c => c.services.some(s => s.id === r.service_type));
    const catKey = catObj ? catObj.cat : 'autre';
    if (!svcByCategory[catKey]) svcByCategory[catKey] = [];
    svcByCategory[catKey].push(r);
  });

  let html = '';

  // Build unified prestations array
  const unified = [];
  allCleanings.forEach(c => {
    const dateStr = c.cleaningDate || c.date;
    if (dateStr < today) return; // Hide past cleanings
    const isToday = dateStr === today;
    const key = dateStr + '_' + providerName;
    const v = validations[key];
    const validationStatus = v ? v.status : 'pending';
    unified.push({
      _source: 'cleaning',
      type: 'cleaning_standard',
      date: dateStr,
      propertyName: c.propertyName,
      propertyAddress: c.propertyAddress,
      provider: c.provider,
      status: validationStatus,
      propertyId: c.propertyId,
      checkinTime: c.checkinTime,
      checkoutTime: c.checkoutTime,
      checklist: c.checklist,
      dayName: c.dayName,
      isToday: isToday,
      _original: c,
      _validation: v
    });
  });
  myServiceRequests.forEach(r => {
    const rDate = r.preferred_date || r.requested_date || '';
    if (rDate && rDate < today) return; // Hide past service requests
    unified.push({
      _source: 'service_request',
      _id: r.id,
      type: r.service_type,
      date: rDate,
      propertyName: r.property_name || '',
      status: r.status,
      notes: r.notes,
    });
  });
  unified.sort((a, b) => (a.date || '').localeCompare(b.date || ''));

  // Count by category for filters
  const catCounts = { all: unified.length };
  unified.forEach(u => {
    const catObj = SERVICE_CATALOG.find(c => c.services.some(s => s.id === u.type));
    const catKey = catObj ? catObj.cat : 'autre';
    catCounts[catKey] = (catCounts[catKey] || 0) + 1;
  });

  // ═══ TAB 1: Apercu (Overview) ═══
  html += '<div id="provContentOverview">';

  // ── Provider profile completeness bar ──
  try {
    const { data: { user: _pu } } = await sb.auth.getUser();
    if (_pu) {
      const { data: _mk } = await sb.from('marketplace_profiles').select('*').eq('user_id', _pu.id).maybeSingle();
      let score = 0; let total = 5;
      const missing = [];
      if (_mk && _mk.display_name) score++; else missing.push({ label: 'Nom affiche', icon: '&#128221;' });
      if (_mk && _mk.city) score++; else missing.push({ label: 'Ville', icon: '&#127961;' });
      if (_mk && _mk.phone) score++; else missing.push({ label: 'Telephone', icon: '&#128222;' });
      if (_mk && _mk.services && _mk.services.length) score++; else missing.push({ label: 'Services', icon: '&#128736;' });
      if (_mk && _mk.description) score++; else missing.push({ label: 'Description', icon: '&#128172;' });
      const pct = Math.round((score / total) * 100);
      if (pct < 100) {
        const barColor = pct >= 80 ? '#34d399' : pct >= 50 ? '#f59e0b' : '#e94560';
        html += '<div style="background:var(--surface);border:1px solid var(--border2);border-radius:12px;padding:14px;margin-bottom:12px;border-left:3px solid ' + barColor + ';">';
        html += '<div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">';
        html += '<div style="flex:1;font-size:13px;font-weight:600;color:var(--text);">Completez votre profil annuaire</div>';
        html += '<span style="font-size:12px;font-weight:700;color:' + barColor + ';">' + pct + '%</span>';
        html += '</div>';
        html += '<div style="height:6px;background:var(--surface2);border-radius:3px;overflow:hidden;margin-bottom:12px;">';
        html += '<div style="height:100%;width:' + pct + '%;background:linear-gradient(90deg,#6c63ff,#34d399);border-radius:3px;transition:width 0.3s;"></div>';
        html += '</div>';
        html += '<div style="font-size:11px;color:var(--text3);margin-bottom:8px;">A completer :</div>';
        html += '<div style="display:flex;flex-wrap:wrap;gap:8px;">';
        missing.forEach(m => {
          html += '<button onclick="showProfileModal()" style="display:inline-flex;align-items:center;gap:6px;padding:7px 12px;background:rgba(108,99,255,0.12);color:var(--accent2);border:1px solid rgba(108,99,255,0.35);border-radius:20px;font-size:12px;font-weight:600;cursor:pointer;transition:all 0.15s;" onmouseover="this.style.background=\'rgba(108,99,255,0.22)\'" onmouseout="this.style.background=\'rgba(108,99,255,0.12)\'">' + m.icon + ' ' + esc(m.label) + '</button>';
        });
        html += '</div>';
        html += '</div>';
      }
    }
  } catch(e) { /* best-effort, ignore */ }

  // Org switcher (if provider belongs to multiple orgs)
  const provMemberships = API.getAllMemberships();
  if (provMemberships.length > 1) {
    html += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;flex-wrap:wrap;">';
    html += '<span style="font-size:12px;color:var(--text3);">Conciergerie :</span>';
    html += '<select onchange="switchProviderOrg(this.value)" style="flex:1;padding:8px 12px;background:var(--surface2);color:var(--text);border:1px solid var(--border2);border-radius:8px;font-size:13px;font-weight:600;">';
    provMemberships.forEach(m => {
      const orgName = m.organizations?.name || 'Organisation';
      const selected = m.org_id === org.id ? ' selected' : '';
      html += '<option value="' + m.org_id + '"' + selected + '>' + esc(orgName) + '</option>';
    });
    html += '</select>';
    html += '<span style="font-size:10px;padding:3px 8px;background:rgba(52,211,153,0.15);color:#34d399;border-radius:6px;font-weight:600;">' + provMemberships.length + ' equipes</span>';
    html += '</div>';
  }

  // Stats bar - with press effect
  const totalPrestations = unified.length;
  const donePrestations = unified.filter(u => u.status === 'done' || u.status === 'departed').length;
  html += `<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:10px;">
    <div onclick="switchProviderNav('prestations')" style="background:linear-gradient(135deg,#6c63ff,#5a54e0);border-radius:12px;padding:16px;text-align:center;cursor:pointer;transition:transform 0.1s,opacity 0.1s;" onpointerdown="this.style.transform='scale(0.95)';this.style.opacity='0.85'" onpointerup="this.style.transform='';this.style.opacity=''" onpointerleave="this.style.transform='';this.style.opacity=''">
      <div style="font-size:24px;font-weight:800;color:#fff;">${totalPrestations}</div>
      <div style="font-size:11px;color:rgba(255,255,255,0.8);">${t('kpi.upcoming_provider')}</div>
    </div>
    <div style="background:linear-gradient(135deg,#34d399,#059669);border-radius:12px;padding:16px;text-align:center;cursor:pointer;transition:transform 0.1s,opacity 0.1s;" onpointerdown="this.style.transform='scale(0.95)';this.style.opacity='0.85'" onpointerup="this.style.transform='';this.style.opacity=''" onpointerleave="this.style.transform='';this.style.opacity=''">
      <div style="font-size:24px;font-weight:800;color:#fff;">${doneCount}</div>
      <div style="font-size:11px;color:rgba(255,255,255,0.8);">${t('kpi.done')}</div>
    </div>
    <div style="background:linear-gradient(135deg,#f59e0b,#d97706);border-radius:12px;padding:16px;text-align:center;cursor:pointer;transition:transform 0.1s,opacity 0.1s;" onpointerdown="this.style.transform='scale(0.95)';this.style.opacity='0.85'" onpointerup="this.style.transform='';this.style.opacity=''" onpointerleave="this.style.transform='';this.style.opacity=''">
      <div style="font-size:24px;font-weight:800;color:#fff;">${totalPrestations - donePrestations}</div>
      <div style="font-size:11px;color:rgba(255,255,255,0.8);">${t('kpi.remaining')}</div>
    </div>
  </div>`;

  // Financial summary
  if (providerPrice > 0) {
    html += `<div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:14px 16px;margin-bottom:16px;display:flex;justify-content:space-around;text-align:center;">
      <div>
        <div style="font-size:11px;color:var(--text3);text-transform:uppercase;margin-bottom:4px;">Tarif/prestation</div>
        <div style="font-size:16px;font-weight:700;color:var(--text);">${providerPrice}&#8364;</div>
      </div>
      <div style="border-left:1px solid var(--border);"></div>
      <div>
        <div style="font-size:11px;color:var(--text3);text-transform:uppercase;margin-bottom:4px;">Gagne</div>
        <div style="font-size:16px;font-weight:700;color:#34d399;">${earnedThisMonth}&#8364;</div>
      </div>
      <div style="border-left:1px solid var(--border);"></div>
      <div>
        <div style="font-size:11px;color:var(--text3);text-transform:uppercase;margin-bottom:4px;">A venir</div>
        <div style="font-size:16px;font-weight:700;color:#6c63ff;">${upcomingEarnings}&#8364;</div>
      </div>
    </div>`;
  }

  // Provider services/competences
  if (providerServices.length > 0) {
    html += '<div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:14px 16px;margin-bottom:12px;">';
    html += '<div style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;margin-bottom:8px;">Vos competences</div>';
    html += '<div style="display:flex;flex-wrap:wrap;gap:6px;">';
    providerServices.forEach(sId => {
      const label = getServiceLabel(sId);
      html += '<span style="padding:4px 10px;background:var(--surface2);border:1px solid var(--border2);border-radius:8px;font-size:12px;color:var(--text);">' + label + '</span>';
    });
    html += '</div></div>';
  }

  // Today's prestations summary
  const _sc = { done:'#34d399', departed:'#34d399', in_progress:'#3b82f6', arrived:'#6c63ff', assigned:'#8b5cf6', accepted:'#34d399', pending:'#f59e0b', pending_validation:'#f59e0b', refused:'#ef4444', cancelled:'#ef4444' };
  const _sl = { done:'Termine', departed:'Parti', in_progress:'En cours', arrived:'Sur place', assigned:'En attente de reponse', accepted:'Accepte', pending:'Attente', pending_validation:'Validation', refused:'Refuse', cancelled:'Annulee' };
  const todayItems = unified.filter(u => u.date === today && !['done','cancelled','departed'].includes(u.status));
  html += '<details style="background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:16px;margin-bottom:12px;">';
  html += '<summary style="list-style:none;cursor:pointer;display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;"><div style="font-weight:700;font-size:14px;">&#128197; Aujourd\'hui — ' + todayItems.length + ' prestation(s)</div><span class="collapseArrow">&#9662;</span></summary>';
  if (todayItems.length === 0) {
    html += '<div style="color:var(--text3);font-size:13px;">Aucune prestation aujourd\'hui</div>';
  } else {
    todayItems.forEach(u => {
      html += '<div onclick="goToPrestation(\'' + (u.date||'') + '\',\'' + (u.type||'') + '\',\'\')" style="display:flex;align-items:center;gap:8px;padding:8px 0;border-top:1px solid var(--border);cursor:pointer;" onmouseover="this.style.background=\'rgba(255,255,255,0.03)\'" onmouseout="this.style.background=\'\'">';
      html += '<div style="flex:1;font-size:12px;font-weight:600;">' + getServiceLabel(u.type) + '</div>';
      if (u.propertyName) html += '<div style="font-size:11px;color:var(--text3);">' + esc(u.propertyName) + '</div>';
      if (u.priority === 'high') html += '<span style="font-size:9px;padding:1px 5px;border-radius:3px;background:#ef444420;color:#ef4444;font-weight:700;animation:pulse 1.5s ease-in-out infinite;">URGENT</span>';
      html += '<span style="font-size:10px;padding:2px 6px;border-radius:4px;background:' + (_sc[u.status]||'#666') + '22;color:' + (_sc[u.status]||'#666') + ';font-weight:600;">' + (_sl[u.status]||u.status) + '</span>';
      html += '</div>';
    });
  }
  html += '</details>';

  // Upcoming prestations (excluding today, excluding terminal)
  const upcomingItems = unified.filter(u => {
    const d = u.date || '';
    return d > today && !['done','cancelled','departed'].includes(u.status);
  }).slice(0, 8);
  if (upcomingItems.length > 0) {
    html += '<details style="background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:16px;margin-bottom:12px;">';
    html += '<summary style="list-style:none;cursor:pointer;display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;"><div style="font-weight:700;font-size:14px;">&#128203; Prochaines prestations</div><span class="collapseArrow">&#9662;</span></summary>';
    upcomingItems.forEach(u => {
      html += '<div onclick="goToPrestation(\'' + (u.date||'') + '\',\'' + (u.type||'') + '\',\'\')" style="display:flex;align-items:center;gap:8px;padding:8px 0;border-top:1px solid var(--border);cursor:pointer;" onmouseover="this.style.background=\'rgba(255,255,255,0.03)\'" onmouseout="this.style.background=\'\'">';
      html += '<div style="min-width:40px;font-size:11px;color:var(--text3);">' + fmtDate(u.date).substring(0,5) + '</div>';
      html += '<div style="flex:1;font-size:12px;font-weight:600;">' + getServiceLabel(u.type) + '</div>';
      if (u.propertyName) html += '<div style="font-size:11px;color:var(--text3);">' + esc(u.propertyName) + '</div>';
      if (u.priority === 'high') html += '<span style="font-size:9px;padding:1px 5px;border-radius:3px;background:#ef444420;color:#ef4444;font-weight:700;animation:pulse 1.5s ease-in-out infinite;">URGENT</span>';
      html += '<span style="font-size:10px;padding:2px 6px;border-radius:4px;background:' + (_sc[u.status]||'#666') + '22;color:' + (_sc[u.status]||'#666') + ';font-weight:600;">' + (_sl[u.status]||'') + '</span>';
      html += '</div>';
    });
    if (unified.filter(u => (u.date||'') >= today && !['done','cancelled','departed'].includes(u.status)).length > 5) {
      html += '<div onclick="switchProviderNav(\'prestations\')" style="text-align:center;padding:8px;font-size:11px;color:var(--accent2);cursor:pointer;font-weight:600;">Voir tout &#8250;</div>';
    }
    html += '</details>';
  }

  // Recent activity (messages)
  try {
    const { data: recentMsgs } = await sb.from('messages').select('*').eq('org_id', org.id).order('created_at', { ascending: false }).limit(10);
    if (recentMsgs && recentMsgs.length) {
      html += '<details style="background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:16px;margin-bottom:12px;">';
      html += '<summary style="list-style:none;cursor:pointer;display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;"><div style="font-weight:700;font-size:14px;">&#128276; Activite recente</div><span class="collapseArrow">&#9662;</span></summary>';
      recentMsgs.forEach(m => {
        const d = new Date(m.created_at);
        const dateStr2 = d.toLocaleDateString('fr-FR', {day:'2-digit',month:'2-digit'}) + ' ' + d.toLocaleTimeString('fr-FR', {hour:'2-digit',minute:'2-digit'});
        html += '<div onclick="switchProviderNav(\'messages\')" style="padding:6px 0;border-top:1px solid var(--border);font-size:12px;color:var(--text2);cursor:pointer;line-height:1.5;" onmouseover="this.style.background=\'rgba(255,255,255,0.03)\'" onmouseout="this.style.background=\'\'">';
        html += '<span style="color:var(--text3);font-size:10px;">' + dateStr2 + '</span> — ' + esc(m.content || '');
        html += '</div>';
      });
      html += '</details>';
    }
  } catch(e) { /* best-effort, ignore */ }

  if (unified.length === 0) {
    html += '<div style="text-align:center;padding:40px 20px;">';
    html += '<div style="font-size:48px;margin-bottom:16px;">&#127881;</div>';
    html += '<div style="font-size:18px;font-weight:700;color:var(--success);margin-bottom:8px;">Aucune prestation a venir</div>';
    html += '<div style="font-size:13px;color:var(--text3);line-height:1.6;">Votre conciergerie vous enverra une notification quand une prestation vous sera assignee.</div>';
    html += '</div>';
  }

  html += '</div>'; // close provContentOverview

  // ═══ TAB 2: Prestations (unified) ═══
  html += '<div id="provContentPrestations" style="display:none;">';

  // Header
  html += '<div style="font-size:16px;font-weight:700;color:var(--text);margin-bottom:12px;">📋 Mes prestations</div>';

  // Cache unified for cascading filters
  window._provUnified = unified;
  if (window._provHidePast === undefined) window._provHidePast = true;
  if (!window._provFilter) window._provFilter = { cat: 'all', status: 'all', actor: { type: 'all', value: '' } };

  // Filter rows: Categories | Actors | Status | Hide past
  html += '<div id="provPrestCatRow" style="display:flex;gap:6px;overflow-x:auto;padding-bottom:6px;margin-bottom:4px;-webkit-overflow-scrolling:touch;align-items:center;"></div>';
  html += '<div id="provPrestActorRow" style="display:flex;gap:6px;overflow-x:auto;padding-bottom:6px;margin-bottom:4px;-webkit-overflow-scrolling:touch;align-items:center;"></div>';
  html += '<div id="provPrestStatusRow" style="display:flex;gap:6px;overflow-x:auto;padding-bottom:6px;margin-bottom:4px;-webkit-overflow-scrolling:touch;align-items:center;"></div>';
  const hidePastActive = !!window._provHidePast;
  html += '<div style="display:flex;padding-bottom:8px;margin-bottom:12px;">';
  html += '<button id="provTogglePastBtn" class="prestFilter' + (hidePastActive ? ' active' : '') + '" onclick="toggleProvHidePast(this)" style="white-space:nowrap;">' + (hidePastActive ? '&#128065; Afficher passees' : '&#128065;&#65039; Masquer passees') + '</button>';
  html += '</div>';

  if (unified.length === 0) {
    html += `<div style="text-align:center;padding:40px 20px;">
      <div style="font-size:40px;margin-bottom:12px;">&#128203;</div>
      <div style="font-size:16px;font-weight:700;color:var(--text);margin-bottom:8px;">Aucune prestation</div>
      <div style="font-size:13px;color:var(--text3);line-height:1.6;">Vous n'avez pas de prestation en cours.</div>
    </div>`;
  } else {
    let _lastProvDate = '';
    for (const u of unified) {
      const catObj = SERVICE_CATALOG.find(c => c.services.some(s => s.id === u.type));
      const catKey = catObj ? catObj.cat : 'autre';
      // Date separator
      const _ud = u.date || '';
      if (_ud && _ud !== _lastProvDate) {
        _lastProvDate = _ud;
        const _gd = new Date(_ud + 'T12:00:00');
        const _isGd = _ud === today;
        const _gdL = _isGd ? 'Aujourd\'hui' : _gd.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
        html += '<div style="font-size:12px;font-weight:700;color:' + (_isGd ? 'var(--accent)' : 'var(--text3)') + ';margin:12px 0 4px 4px;text-transform:capitalize;">' + _gdL + '</div>';
      }

      if (u._source === 'cleaning') {
        // Cleaning card (same as before)
        const c = u._original;
        const dateStr = u.date;
        const isToday = u.isToday;
        const v = u._validation;
        const status = u.status;
        const statusIcons = { done: '&#9989;', departed: '&#128682;', in_progress: '&#129529;', arrived: '&#127968;', assigned: '&#128228;', accepted: '&#9989;', seen: '&#128065;', sent: '&#9993;', refused: '&#10060;', pending: '&#9898;' };
        const statusIcon = statusIcons[status] || '&#9898;';
        const statusLabel = getStatusLabel(status) || 'A faire';
        const statusColor = getStatusColor(status);

        html += `<div class="prestCard" data-category="${catKey}" data-date="${dateStr}" data-type="${u.type||''}" data-provider="${esc(u.provider||'')}" data-status="${status || ''}" data-owner="${esc(u.propertyName||'')}" style="background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:16px;margin-bottom:10px;${isToday ? 'border-left:3px solid #e94560;' : ''}">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
            <div>
              <div style="font-size:11px;color:var(--accent2);font-weight:600;margin-bottom:2px;">${getServiceLabel('cleaning_standard')}</div>
              <div style="font-weight:700;font-size:15px;color:var(--accent);">${c.dayName || ''} ${fmtDate(dateStr)}${isToday ? ' <span style="background:#e94560;color:#fff;font-size:10px;padding:2px 6px;border-radius:4px;">AUJOURD\'HUI</span>' : ''}</div>
              <div style="font-size:12px;color:var(--text3);margin-top:2px;">${esc(u.propertyName)}${u.propertyAddress ? ' — <a href="https://www.google.com/maps/dir/?api=1&destination=' + encodeURIComponent(u.propertyAddress) + '" target="_blank" style="color:var(--accent2);text-decoration:none;">' + esc(u.propertyAddress) + ' &#128506;</a>' : ''}</div>
              <div style="font-size:11px;color:var(--text2);margin-top:3px;">&#128336; Menage entre <b>${u.checkoutTime}</b> et <b>${u.checkinTime}</b></div>
            </div>
            <div style="text-align:right;">
              <div style="font-size:12px;color:${statusColor};">${statusIcon} ${statusLabel}</div>
            </div>
          </div>`;

        // Checklist
        if (u.checklist && u.checklist.length > 0) {
          html += '<div style="border-top:1px solid var(--border);padding-top:10px;margin-top:8px;">';
          html += '<div style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;margin-bottom:6px;">Checklist</div>';
          u.checklist.forEach((item, ci) => {
            const checkKey = 'prov_check_' + dateStr + '_' + ci;
            const checked = localStorage.getItem(checkKey) === '1';
            const itemText = typeof item === 'string' ? item : (item.text || item.name || '');
            html += `<label style="display:flex;align-items:center;gap:8px;padding:5px 0;cursor:pointer;font-size:13px;color:${checked ? 'var(--success)' : 'var(--text)'};">
              <input type="checkbox" ${checked ? 'checked' : ''} onchange="localStorage.setItem('${checkKey}',this.checked?'1':'0');this.parentElement.style.color=this.checked?'var(--success)':'var(--text)';" style="width:18px;height:18px;accent-color:var(--success);">
              <span style="${checked ? 'text-decoration:line-through;opacity:0.6;' : ''}">${esc(itemText)}</span>
            </label>`;
          });
          html += '</div>';
        }

        // Mark as seen automatically
        if (status === 'sent' || status === 'pending') {
          markCleaningAsSeen(u.propertyId, dateStr, providerName);
        }

        // Action buttons based on status
        if (status === 'sent' || status === 'seen' || status === 'pending') {
          html += `<div style="display:flex;gap:8px;margin-top:12px;padding-top:10px;border-top:1px solid var(--border);">
            <button onclick="acceptCleaning('${u.propertyId}','${dateStr}','${esc(providerName)}')" style="flex:1;padding:10px;background:#34d399;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;">&#10003; Accepter</button>
            <button onclick="refuseCleaning('${u.propertyId}','${dateStr}','${esc(providerName)}')" style="flex:1;padding:10px;background:#ef4444;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;">&#10007; Refuser</button>
          </div>`;
        } else if (status === 'accepted') {
          if (isToday) {
            html += `<div style="display:flex;gap:8px;margin-top:12px;padding-top:10px;border-top:1px solid var(--border);">
              <button onclick="providerValidate('${u.propertyId}','${dateStr}','${esc(providerName)}','arrived',this)" style="flex:1;padding:12px;background:linear-gradient(135deg,#6c63ff,#5a54e0);color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;">&#128692; En route / Je suis arrive</button>
            </div>`;
          } else {
            html += `<div style="margin-top:10px;padding-top:10px;border-top:1px solid var(--border);font-size:11px;color:var(--text3);text-align:center;">Le jour du menage, vous pourrez signaler votre arrivee ici</div>`;
          }
          html += `<div style="text-align:center;margin-top:6px;"><button onclick="showModifyResponsePopup('${u.propertyId}','${dateStr}','${esc(providerName)}','accepted')" style="background:none;border:none;color:var(--text3);font-size:11px;cursor:pointer;text-decoration:underline;">&#9998; Modifier ma reponse</button></div>`;
        } else if (status === 'arrived') {
          html += `<div style="display:flex;gap:8px;margin-top:12px;padding-top:10px;border-top:1px solid var(--border);">
            <button onclick="providerValidate('${u.propertyId}','${dateStr}','${esc(providerName)}','in_progress',this)" style="flex:1;padding:12px;background:#f59e0b;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;">&#129529; Commencer le menage</button>
          </div>
          <div style="margin-top:8px;">
            <input type="file" accept="image/*" multiple onchange="providerUploadPhotos(this,'${u.propertyId}','${dateStr}','${esc(providerName)}')" style="font-size:11px;color:var(--text3);">
            <span style="font-size:10px;color:var(--text3);margin-left:4px;">&#128247; Photos avant menage</span>
          </div>`;
        } else if (status === 'in_progress') {
          html += `<div style="display:flex;gap:8px;margin-top:12px;padding-top:10px;border-top:1px solid var(--border);">
            <button onclick="providerValidate('${u.propertyId}','${dateStr}','${esc(providerName)}','departed',this)" style="flex:1;padding:12px;background:#34d399;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;">&#128682; Menage termine — Je pars</button>
          </div>
          <div style="margin-top:8px;">
            <input type="file" accept="image/*" multiple onchange="providerUploadPhotos(this,'${u.propertyId}','${dateStr}','${esc(providerName)}')" style="font-size:11px;color:var(--text3);">
            <span style="font-size:10px;color:var(--text3);margin-left:4px;">&#128247; Photos apres menage</span>
          </div>`;
        } else if (status === 'refused') {
          html += `<div style="display:flex;gap:8px;margin-top:12px;padding-top:10px;border-top:1px solid var(--border);">
            <button onclick="showModifyResponsePopup('${u.propertyId}','${dateStr}','${esc(providerName)}','refused')" style="flex:1;padding:10px;background:var(--surface2);color:var(--text);border:1px solid var(--border2);border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;">&#9998; Modifier ma reponse</button>
          </div>`;
        } else if (status === 'departed') {
          html += `<div style="display:flex;gap:8px;margin-top:12px;padding-top:10px;border-top:1px solid var(--border);">
            <button onclick="providerValidate('${u.propertyId}','${dateStr}','${esc(providerName)}','done',this)" style="flex:1;padding:12px;background:#059669;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;">&#9989; Confirmer — Tout est OK</button>
          </div>`;
        }

        // Photos
        if (v && v.photos && v.photos.length) {
          html += '<div style="display:flex;gap:6px;margin-top:8px;flex-wrap:wrap;">';
          v.photos.forEach(p => { html += `<img src="${esc(p)}" style="width:60px;height:60px;object-fit:cover;border-radius:6px;border:1px solid var(--border);">`; });
          html += '</div>';
        }

        html += '</div>';

      } else {
        // Service request card
        const r = u;
        const svcLabel = getServiceLabel(r.type);
        html += '<div class="prestCard" data-category="' + catKey + '" data-status="' + (r.status || '') + '" data-date="' + (r.date || '') + '" data-owner="' + esc(r.propertyName || '') + '" data-type="' + (r.type || '') + '" style="background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:14px 16px;margin-bottom:8px;">';
        html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">';
        html += '<div style="font-weight:700;font-size:14px;color:var(--text);">' + svcLabel + '</div>';
        html += '<span style="font-size:11px;padding:3px 8px;border-radius:6px;background:' + getStatusColor(r.status) + '22;color:' + getStatusColor(r.status) + ';font-weight:600;">' + getStatusLabel(r.status) + '</span>';
        html += '</div>';
        if (r.propertyName) html += '<div style="font-size:12px;color:var(--text3);margin-bottom:4px;">&#127968; ' + esc(r.propertyName) + '</div>';
        if (r.date) html += '<div style="font-size:12px;color:var(--text3);margin-bottom:4px;">&#128197; ' + fmtDate(r.date) + '</div>';
        if (r.notes) html += '<div style="font-size:12px;color:var(--text2);margin-top:6px;padding:8px;background:var(--surface2);border-radius:8px;">' + esc(r.notes) + '</div>';
        // Action buttons
        if (r.status === 'assigned' || r.status === 'pending') {
          html += '<div style="display:flex;gap:8px;margin-top:10px;">';
          html += '<button onclick="acceptServiceRequest(\'' + r._id + '\')" style="flex:1;padding:10px;background:#34d399;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;">&#10003; Accepter</button>';
          html += '<button onclick="refuseServiceRequest(\'' + r._id + '\')" style="flex:1;padding:10px;background:#ef4444;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;">&#10007; Refuser</button>';
          html += '</div>';
        } else if (r.status === 'accepted') {
          html += '<div style="display:flex;gap:8px;margin-top:10px;">';
          html += '<button onclick="startServiceRequest(\'' + r._id + '\')" style="flex:1;padding:10px;background:#f59e0b;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;">&#128260; Commencer</button>';
          html += '<button onclick="providerWithdraw(\'' + r._id + '\',\'' + (r.date || '') + '\')" style="padding:10px 14px;background:rgba(239,68,68,0.15);color:#ef4444;border:none;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;">Se desister</button>';
          html += '</div>';
        } else if (r.status === 'in_progress') {
          html += '<div style="margin-top:10px;"><button onclick="completeServiceRequest(\'' + r._id + '\')" style="width:100%;padding:10px;background:#059669;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;">&#9989; Termine</button></div>';
        } else if (r.status === 'pending_validation') {
          html += '<div style="margin-top:8px;font-size:12px;color:#f59e0b;padding:8px;background:rgba(245,158,11,0.1);border-radius:8px;text-align:center;">&#9203; En attente de validation par le gestionnaire</div>';
        } else if (r.status === 'cancelled') {
          html += '<div style="margin-top:8px;font-size:12px;color:#ef4444;padding:8px;background:rgba(239,68,68,0.1);border-radius:8px;">';
          html += '&#10006; Prestation annulee';
          if (r.cancel_penalty_amount > 0) html += ' — <b>Indemnite: ' + r.cancel_penalty_amount.toFixed(2) + '€</b>';
          html += '</div>';
        } else if (r.status === 'done') {
          html += '<div style="margin-top:8px;font-size:12px;color:#34d399;text-align:center;">&#9989; Valide par le gestionnaire</div>';
        }
        html += '</div>';
      }
    }
  }

  html += '</div>'; // close provContentPrestations

  // Add floating chat button
  // Billing page (redesigned)
  html += '<div id="provContentBilling" style="display:none;">';
  html += '<div style="font-size:16px;font-weight:700;color:var(--text);margin-bottom:12px;">💰 Mes revenus</div>';
  // Tabs
  html += '<div style="display:flex;gap:4px;background:var(--surface2);padding:4px;border-radius:10px;margin-bottom:14px;">';
  html += '<button id="provFinTab_create" class="annSubTab" onclick="switchProvFinTab(\'create\')" style="flex:1;padding:10px 14px;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;">&#10133; Creer</button>';
  html += '<button id="provFinTab_list" class="annSubTab annSubTabActive" onclick="switchProvFinTab(\'list\')" style="flex:1;padding:10px 14px;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;">&#128196; Consulter</button>';
  html += '</div>';
  html += '<div id="provFinPanel_create" style="display:none;">';
  html += '<div style="display:inline-flex;gap:2px;margin-bottom:14px;padding:3px;background:var(--surface2);border-radius:8px;">';
  html += '<div id="provFinMode_manual_btn" onclick="switchProvFinMode(\'manual\')" class="finFactModeBtn finFactModeActive" style="cursor:pointer;padding:5px 14px;border-radius:6px;font-size:11px;font-weight:500;">&#9997;&#65039; Manuel</div>';
  html += '<div id="provFinMode_auto_btn" onclick="switchProvFinMode(\'auto\')" class="finFactModeBtn" style="cursor:pointer;padding:5px 14px;border-radius:6px;font-size:11px;font-weight:500;">&#9889; Auto</div>';
  html += '</div>';
  html += '<div id="provFinMode_manual_panel">';
  html += '<div style="display:inline-flex;gap:2px;margin-bottom:12px;padding:3px;background:var(--surface2);border-radius:8px;">';
  html += '<div id="provDocType_invoice_btn" onclick="setProvDocType(\'invoice\')" class="finFactModeBtn finFactModeActive" style="cursor:pointer;padding:5px 14px;border-radius:6px;font-size:11px;font-weight:500;">&#128196; Facture</div>';
  html += '<div id="provDocType_quote_btn" onclick="setProvDocType(\'quote\')" class="finFactModeBtn" style="cursor:pointer;padding:5px 14px;border-radius:6px;font-size:11px;font-weight:500;">&#128203; Devis</div>';
  html += '</div>';
  html += '<div id="provDocTypeHint" style="font-size:13px;color:var(--text2);margin-bottom:10px;">A qui envoyer cette facture ?</div>';
  html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">';
  html += '<button onclick="openProvInvoice(\'provider_to_concierge\')" style="padding:18px 14px;background:linear-gradient(135deg,#34d399,#059669);color:#fff;border:none;border-radius:12px;font-weight:700;cursor:pointer;transition:transform 0.15s;" onmouseover="this.style.transform=\'translateY(-2px)\'" onmouseout="this.style.transform=\'\'">';
  html += '<div style="font-size:28px;margin-bottom:6px;">&#129529;</div><div style="font-size:14px;">A la conciergerie</div>';
  html += '<div style="font-size:10px;opacity:0.85;margin-top:4px;font-weight:400;">Prestation via un concierge</div>';
  html += '</button>';
  html += '<button onclick="openProvInvoice(\'provider_to_owner\')" style="padding:18px 14px;background:linear-gradient(135deg,#f59e0b,#d97706);color:#fff;border:none;border-radius:12px;font-weight:700;cursor:pointer;transition:transform 0.15s;" onmouseover="this.style.transform=\'translateY(-2px)\'" onmouseout="this.style.transform=\'\'">';
  html += '<div style="font-size:28px;margin-bottom:6px;">&#127968;</div><div style="font-size:14px;">Au proprietaire</div>';
  html += '<div style="font-size:10px;opacity:0.85;margin-top:4px;font-weight:400;">Directement au proprietaire</div>';
  html += '</button>';
  html += '</div></div>';
  html += '<div id="provFinMode_auto_panel" style="display:none;"><div id="provAutoBillingPanel"></div></div>';
  html += '</div>';
  html += '<div id="provFinPanel_list">';
  html += '<div id="provInvoiceSummary" style="margin-bottom:12px;"></div>';
  html += '<div style="display:flex;gap:8px;margin-bottom:8px;flex-wrap:wrap;align-items:center;">';
  html += '<div style="flex:1;min-width:200px;position:relative;"><span style="position:absolute;left:10px;top:50%;transform:translateY(-50%);color:var(--text3);font-size:13px;">&#128269;</span><input type="text" id="provInvoiceSearch" placeholder="Numero, propriete..." oninput="renderProvInvoicesView()" style="width:100%;padding:7px 10px 7px 30px;background:var(--surface2);color:var(--text);border:1px solid var(--border2);border-radius:8px;font-size:12px;box-sizing:border-box;"></div>';
  html += '<div id="provInvoicePeriodChips" style="display:flex;gap:4px;flex-wrap:wrap;"></div>';
  html += '<button onclick="exportProviderPDF()" style="padding:7px 12px;background:var(--surface2);color:var(--text);border:1px solid var(--border2);border-radius:8px;font-size:11px;cursor:pointer;">&#128196; Export PDF</button>';
  html += '</div>';
  html += '<div id="provInvoiceStatusChips" style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:10px;"></div>';
  html += '<div id="provInvoicesList"></div>';
  html += '</div>'; // close provFinPanel_list
  // Upcoming / in-progress prestations — admin-style cards grouped by month
  const upcomingList = unified.filter(u => u.status === 'accepted' || u.status === 'assigned' || u.status === 'in_progress' || u.status === 'arrived');
  html += '<details style="margin-top:16px;"><summary style="cursor:pointer;font-size:13px;font-weight:700;color:var(--text);padding:8px 0;list-style:none;display:flex;align-items:center;gap:6px;"><span class="collapseArrow">&#9662;</span> Prestations a venir (' + upcomingList.length + ' · ' + upcomingEarnings + '€)</summary>';
  html += '<div style="padding-top:8px;">';
  if (!upcomingList.length) {
    html += '<div style="text-align:center;padding:16px;color:var(--text3);font-size:12px;">Aucune prestation en cours</div>';
  } else {
    const _monthsFull = ['Janvier','Fevrier','Mars','Avril','Mai','Juin','Juillet','Aout','Septembre','Octobre','Novembre','Decembre'];
    const _days = ['Dim','Lun','Mar','Mer','Jeu','Ven','Sam'];
    const _monthsShort = ['Jan','Fev','Mar','Avr','Mai','Jun','Jul','Aou','Sep','Oct','Nov','Dec'];
    const statusColors = { accepted: '#34d399', assigned: '#8b5cf6', in_progress: '#3b82f6', arrived: '#3b82f6' };
    const statusLabels = { accepted: 'Accepte', assigned: 'En attente reponse', in_progress: 'En cours', arrived: 'Sur place' };
    const groups = {};
    upcomingList.forEach(u => {
      const key = (u.date || '').substring(0, 7);
      if (!groups[key]) groups[key] = [];
      groups[key].push(u);
    });
    const keys = Object.keys(groups).sort();
    keys.forEach(mk => {
      const list = groups[mk];
      const [yy, mm] = mk.split('-');
      const monthLabel = _monthsFull[parseInt(mm)-1] + ' ' + yy;
      const monthTotal = list.length * (parseFloat(providerPrice) || 0);
      html += '<details open style="margin-bottom:8px;">';
      html += '<summary style="list-style:none;cursor:pointer;display:flex;align-items:center;justify-content:space-between;padding:8px 4px;font-size:12px;font-weight:700;color:var(--text2);border-bottom:1px solid var(--border);">';
      html += '<span style="display:flex;align-items:center;gap:6px;"><span class="collapseArrow">&#9662;</span>' + monthLabel + ' <span style="color:var(--text3);font-weight:400;font-size:11px;">(' + list.length + ')</span></span>';
      html += '<span style="font-size:11px;color:var(--text3);font-weight:400;">A venir <b style="color:#6c63ff;">' + monthTotal.toFixed(0) + '€</b></span>';
      html += '</summary><div style="padding-top:6px;">';
      list.forEach(u => {
        const dt = u.date ? new Date(u.date + 'T12:00:00') : null;
        const dayNum = dt ? dt.getDate() : '';
        const dowStr = dt ? _days[dt.getDay()] : '';
        const monthStr = dt ? _monthsShort[dt.getMonth()] : '';
        const svcIcon = (typeof getServiceIcon === 'function') ? getServiceIcon(u.type) : '🧹';
        const svcLabel = getServiceLabel(u.type);
        const color = statusColors[u.status] || '#6c63ff';
        const sLabel = statusLabels[u.status] || u.status;
        html += '<div class="adminPrestCard" style="border-left:4px solid ' + color + ';cursor:default;">';
        html += '<div style="display:flex;align-items:stretch;gap:0;padding:0;">';
        html += '<div class="card-date-block"><div class="card-dow">' + dowStr + '</div><div class="card-day">' + dayNum + '</div><div class="card-month">' + monthStr + '</div></div>';
        html += '<div style="display:flex;align-items:center;padding:0 8px;font-size:26px;flex-shrink:0;">' + svcIcon + '</div>';
        html += '<div style="flex:1;min-width:0;padding:8px 4px;">';
        html += '<div style="font-size:14px;font-weight:700;color:var(--text);">' + esc(svcLabel) + '</div>';
        html += '<div style="font-size:11px;color:var(--text3);margin-top:2px;">&#127968; ' + esc(u.propertyName || '') + '</div>';
        html += '</div>';
        html += '<div style="display:flex;flex-direction:column;justify-content:center;align-items:flex-end;padding:8px 12px;flex-shrink:0;">';
        html += '<div style="font-weight:800;font-size:16px;color:#6c63ff;">' + providerPrice + '€</div>';
        html += '<span style="font-size:10px;padding:2px 8px;background:' + color + '20;color:' + color + ';border-radius:4px;font-weight:600;margin-top:4px;">' + sLabel + '</span>';
        html += '</div></div></div>';
      });
      html += '</div></details>';
    });
  }
  html += '</div></details>';
  html += '</div>';

  // Team page (hidden, shown by nav Equipe tab)
  html += '<div id="provContentAnnuaire" style="display:none;"><div id="provAnnuaireContent"></div></div>';

  // Chat page (hidden, shown by nav Messages tab)
  html += '<div id="provContentChat" style="display:none;">';
  html += '<div style="display:flex;flex-direction:column;height:calc(100vh - 210px);">';
  html += '<div style="font-size:16px;font-weight:700;color:var(--text);margin-bottom:12px;">💬 Messages</div>';
  html += '<div id="provFullChatMessages" style="flex:1;overflow-y:auto;padding:16px;background:var(--surface);border:1px solid var(--border);border-radius:12px;margin-bottom:10px;min-height:200px;"></div>';
  html += '<div style="display:flex;gap:8px;">';
  html += '<input type="text" id="provFullChatInput" placeholder="Ecrire un message..." onkeydown="if(event.key===\'Enter\')sendProvFullChatMessage()" style="flex:1;padding:12px 16px;background:var(--surface2);color:var(--text);border:1px solid var(--border2);border-radius:12px;font-size:14px;font-family:\'Inter\',sans-serif;">';
  html += '<button onclick="sendProvFullChatMessage()" style="background:linear-gradient(135deg,#6c63ff,#5a54e0);color:#fff;border:none;padding:12px 20px;border-radius:12px;font-size:16px;cursor:pointer;">➤</button>';
  html += '</div></div></div>';

  // Floating chat button (opens mini widget)
  html += `<button onclick="openProviderChat()" style="position:fixed;bottom:110px;right:20px;width:56px;height:56px;border-radius:50%;background:linear-gradient(135deg,#6c63ff,#5a54e0);color:#fff;border:none;font-size:24px;cursor:pointer;box-shadow:0 4px 12px rgba(108,99,255,0.4);z-index:50;">&#128172;</button>`;

  content.innerHTML = html;

  // Request push notifications
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }
  } catch(err) { console.error('showProviderMode error:', err); showToast('Erreur chargement mode prestataire: ' + (err.message || 'Probleme de connexion')); }
}

// Additional exports
window.showProviderMode = showProviderMode;
window._appendProviderExtraTabs = _appendProviderExtraTabs;
