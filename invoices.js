// Invoices module (list, render, actions, PDF)
// Depends on: sb, API, esc, fmtDate, safePhotoUrl, safeErr, customConfirm,
//   showMsg, closeMsg, showToast, loadPDF (lazy), showCreateInvoiceModal,
//   sendPushToUser (from push.js)
// Exposes: loadInvoices, renderInvoicesView, _renderInvoiceCard,
//   sendInvoiceReminder, showInvoiceDetail, showInvoiceFullView,
//   showInvoicePrestationDetail, updateInvoiceStatus, notifyInvoiceStatus,
//   deleteInvoice, sendInvoiceByEmail, _buildInvoiceEmailHtml,
//   confirmSendInvoiceEmail, duplicateInvoice, toggleInvoiceSelect,
//   bulkMarkPaid, clearInvoiceSelection, toggleInvoiceCompact,
//   setInvoiceClientFilter, setInvoiceSort, ensureInvoiceNumber,
//   downloadInvoicePDF

// INVOICES_MODULE_START
let _invoicePeriod = 'all';
let _invoiceStatus = 'all';
let _invoicesCache = [];

async function loadInvoices() {
  const org = API.getOrg();
  if (!org) return;
  // Fetch all invoices (client-side filtering)
  const { data } = await sb.from('invoices').select('*').eq('org_id', org.id).order('created_at', { ascending: false }).limit(200);
  // Exclude quotes from invoice list (they have their own tab)
  _invoicesCache = (data || []).filter(i => !i.is_quote);
  // Backfill missing invoice_number sequentially (chronological order)
  const missing = _invoicesCache.filter(i => !i.invoice_number).sort((a,b) => (a.created_at||'').localeCompare(b.created_at||''));
  if (missing.length) {
    const withNum = _invoicesCache.filter(i => i.invoice_number).length;
    for (let k = 0; k < missing.length; k++) {
      const inv = missing[k];
      const yr = new Date(inv.created_at || Date.now()).getFullYear();
      const num = String(withNum + k + 1).padStart(3, '0');
      const generated = 'FAC-' + yr + '-' + num;
      await sb.from('invoices').update({ invoice_number: generated }).eq('id', inv.id);
      inv.invoice_number = generated;
    }
  }
  renderInvoicesView();
}

function renderInvoicesView() {
  const container = document.getElementById('invoicesList');
  if (!container) return;
  const today = new Date().toISOString().split('T')[0];
  const search = (document.getElementById('invoiceSearch')?.value || '').trim().toLowerCase();

  // Period filter
  const now = new Date();
  const thisMonthStart = now.getFullYear() + '-' + String(now.getMonth()+1).padStart(2,'0') + '-01';
  const lastMonth = new Date(now.getFullYear(), now.getMonth()-1, 1);
  const lastMonthStart = lastMonth.getFullYear() + '-' + String(lastMonth.getMonth()+1).padStart(2,'0') + '-01';
  const lastMonthEnd = now.getFullYear() + '-' + String(now.getMonth()+1).padStart(2,'0') + '-01';
  const thisYearStart = now.getFullYear() + '-01-01';

  const inPeriod = (inv) => {
    const d = (inv.created_at || '').substring(0, 10);
    if (_invoicePeriod === 'all') return true;
    if (_invoicePeriod === 'thisMonth') return d >= thisMonthStart;
    if (_invoicePeriod === 'lastMonth') return d >= lastMonthStart && d < lastMonthEnd;
    if (_invoicePeriod === 'thisYear') return d >= thisYearStart;
    return true;
  };
  const isOv = (inv) => inv.status === 'sent' && inv.due_date && inv.due_date < today;
  const statusOf = (inv) => isOv(inv) ? 'overdue' : inv.status;
  const matchSearch = (inv) => {
    if (!search) return true;
    const hay = [inv.invoice_number, inv.client_name, inv.property_name, inv.issuer_name].filter(Boolean).join(' ').toLowerCase();
    return hay.includes(search);
  };

  const periodFiltered = _invoicesCache.filter(inPeriod);
  let filtered = periodFiltered.filter(inv => {
    if (_invoiceStatus !== 'all' && statusOf(inv) !== _invoiceStatus) return false;
    if (_invoiceClientFilter && (inv.client_name || '').toLowerCase() !== _invoiceClientFilter.toLowerCase()) return false;
    return matchSearch(inv);
  });
  // Sorting
  filtered.sort((a, b) => {
    const dA = a.created_at || '', dB = b.created_at || '';
    const amA = a.total_ttc || 0, amB = b.total_ttc || 0;
    const cA = (a.client_name || '').toLowerCase(), cB = (b.client_name || '').toLowerCase();
    if (_invoiceSort === 'date_asc') return dA.localeCompare(dB);
    if (_invoiceSort === 'amount_desc') return amB - amA;
    if (_invoiceSort === 'amount_asc') return amA - amB;
    if (_invoiceSort === 'client_asc') return cA.localeCompare(cB);
    return dB.localeCompare(dA); // date_desc (default)
  });

  // Build unique client list for filter
  const uniqueClients = [...new Set(periodFiltered.map(i => i.client_name).filter(Boolean))].sort();

  // KPI summary (based on period-filtered, ignoring status/search)
  renderInvoiceSummary(periodFiltered);
  // Chips
  renderInvoicePeriodChips();
  renderInvoiceStatusChips(periodFiltered);
  // Overdue badge on tab
  const overdueCount = _invoicesCache.filter(isOv).length;
  const badge = document.getElementById('invoiceOverdueBadge');
  if (badge) {
    if (overdueCount > 0) { badge.textContent = overdueCount; badge.style.display = ''; }
    else badge.style.display = 'none';
  }

  // Toolbar: client filter + sort + compact + bulk actions
  let toolbar = '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:10px;padding:8px;background:var(--surface2);border-radius:8px;">';
  toolbar += '<select onchange="setInvoiceClientFilter(this.value)" style="padding:6px 8px;background:var(--surface);color:var(--text);border:1px solid var(--border2);border-radius:6px;font-size:11px;">';
  toolbar += '<option value="">Tous les clients</option>';
  uniqueClients.forEach(c => { toolbar += '<option value="' + esc(c) + '"' + (_invoiceClientFilter === c ? ' selected' : '') + '>' + esc(c) + '</option>'; });
  toolbar += '</select>';
  toolbar += '<select onchange="setInvoiceSort(this.value)" style="padding:6px 8px;background:var(--surface);color:var(--text);border:1px solid var(--border2);border-radius:6px;font-size:11px;">';
  [['date_desc','Plus recent'],['date_asc','Plus ancien'],['amount_desc','Montant ↓'],['amount_asc','Montant ↑'],['client_asc','Client A-Z']].forEach(o => {
    toolbar += '<option value="' + o[0] + '"' + (_invoiceSort === o[0] ? ' selected' : '') + '>' + o[1] + '</option>';
  });
  toolbar += '</select>';
  toolbar += '<button onclick="toggleInvoiceCompact()" style="padding:6px 10px;background:' + (_invoiceCompactMode ? 'var(--accent)' : 'var(--surface)') + ';color:' + (_invoiceCompactMode ? '#fff' : 'var(--text)') + ';border:1px solid var(--border2);border-radius:6px;font-size:11px;cursor:pointer;" title="Mode compact">' + (_invoiceCompactMode ? '📋 Compact' : '📖 Detaille') + '</button>';
  if (_invoiceSelection.size > 0) {
    toolbar += '<div style="flex:1;"></div>';
    toolbar += '<span style="font-size:11px;color:var(--accent2);font-weight:600;">' + _invoiceSelection.size + ' selectionnee(s)</span>';
    toolbar += '<button onclick="bulkMarkPaid()" style="padding:6px 10px;background:#34d399;color:#fff;border:none;border-radius:6px;font-size:11px;cursor:pointer;">&#9989; Marquer payees</button>';
    toolbar += '<button onclick="clearInvoiceSelection()" style="padding:6px 10px;background:var(--surface);color:var(--text);border:1px solid var(--border2);border-radius:6px;font-size:11px;cursor:pointer;">Annuler</button>';
  }
  toolbar += '</div>';

  if (!filtered.length) {
    container.innerHTML = toolbar + '<div style="text-align:center;color:var(--text3);font-size:13px;padding:30px 20px;"><div style="font-size:32px;opacity:0.4;margin-bottom:8px;">&#128196;</div>Aucune facture pour ces filtres</div>';
    return;
  }

  // Group by month (YYYY-MM from created_at)
  const MONTHS_FULL = ['Janvier','Fevrier','Mars','Avril','Mai','Juin','Juillet','Aout','Septembre','Octobre','Novembre','Decembre'];
  const groups = {};
  filtered.forEach(inv => {
    const key = (inv.created_at || '').substring(0, 7);
    if (!groups[key]) groups[key] = [];
    groups[key].push(inv);
  });
  const sortedKeys = Object.keys(groups).sort().reverse();

  let html = toolbar;
  sortedKeys.forEach(mk => {
    const list = groups[mk];
    const [yy, mm] = mk.split('-');
    const label = MONTHS_FULL[parseInt(mm)-1] + ' ' + yy;
    const monthTotal = list.reduce((s,i) => s + (i.total_ttc||0), 0);
    const monthPaid = list.filter(i => i.status === 'paid').reduce((s,i) => s + (i.total_ttc||0), 0);
    html += '<details open style="margin-bottom:10px;">';
    html += '<summary style="list-style:none;cursor:pointer;display:flex;align-items:center;justify-content:space-between;padding:8px 4px;border-bottom:1px solid var(--border);font-size:12px;font-weight:700;color:var(--text2);">';
    html += '<span style="display:flex;align-items:center;gap:6px;"><span class="collapseArrow">&#9662;</span>' + label + ' <span style="color:var(--text3);font-weight:400;font-size:11px;">(' + list.length + ')</span></span>';
    html += '<span style="font-size:11px;color:var(--text3);font-weight:400;">Total <b style="color:var(--text);">' + monthTotal.toFixed(0) + '€</b> — Encaisse <b style="color:#34d399;">' + monthPaid.toFixed(0) + '€</b></span>';
    html += '</summary>';
    html += '<div style="padding-top:6px;">';
    list.forEach(inv => { html += _renderInvoiceCard(inv, today); });
    html += '</div></details>';
  });
  container.innerHTML = html;
}

function _renderInvoiceCard(inv, today) {
  const statusColors = { draft: '#888', sent: '#6c63ff', paid: '#34d399', overdue: '#e94560', accepted: '#34d399', refused: '#ef4444' };
  const statusLabels = { draft: 'Brouillon', sent: 'Envoyee', paid: 'Payee', accepted: 'Accepte', refused: 'Refuse' };
  const isOverdue = inv.status === 'sent' && inv.due_date && inv.due_date < today;
  const displayStatus = isOverdue ? 'overdue' : inv.status;
  const color = statusColors[displayStatus] || '#888';
  const label = isOverdue ? 'En retard' : (statusLabels[inv.status] || inv.status);
  const dateStr = new Date(inv.created_at).toLocaleDateString('fr-FR');
  const typeIcon = inv.type === 'concierge_to_owner' ? '\ud83c\udfe0' : '\ud83e\uddf9';
  const typeLabel = inv.type === 'concierge_to_owner' ? 'Proprietaire' : 'Concierge';
  // Due date hint
  let dueHint = '';
  if (inv.due_date) {
    const d = new Date(inv.due_date + 'T12:00:00');
    const daysDiff = Math.floor((d - new Date()) / 86400000);
    if (inv.status === 'sent') {
      if (daysDiff < 0) dueHint = '<span style="font-size:10px;color:#e94560;font-weight:600;">&#9888; Echeance depassee de ' + Math.abs(daysDiff) + 'j</span>';
      else if (daysDiff <= 7) dueHint = '<span style="font-size:10px;color:#f59e0b;">&#9201; Echeance dans ' + daysDiff + 'j</span>';
      else dueHint = '<span style="font-size:10px;color:var(--text3);">Echeance: ' + fmtDate(inv.due_date) + '</span>';
    }
  }
  // Prestation title
  const firstItem = (inv.items && inv.items.length) ? inv.items[0] : null;
  const prestLabel = firstItem && firstItem.description ? firstItem.description : (inv.property_name || 'Facture');

  const isSelected = _invoiceSelection.has(inv.id);
  const canSelect = inv.status === 'sent' || inv.status === 'draft';
  let html = '';
  // Compact mode: single-line row
  if (_invoiceCompactMode) {
    html += '<div style="display:flex;align-items:center;gap:8px;background:var(--surface2);border:1px solid var(--border2);border-left:3px solid ' + color + ';border-radius:8px;padding:8px 10px;margin-bottom:4px;font-size:12px;">';
    if (canSelect) html += '<input type="checkbox" ' + (isSelected ? 'checked' : '') + ' onclick="event.stopPropagation();toggleInvoiceSelect(\'' + inv.id + '\')" style="margin:0;">';
    html += '<div onclick="showInvoiceDetail(\'' + inv.id + '\')" style="flex:1;min-width:0;cursor:pointer;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">';
    html += '<strong>' + esc(inv.invoice_number || '—') + '</strong> · ' + esc(inv.client_name || '—') + ' · ' + dateStr;
    html += '</div>';
    html += '<span style="font-weight:700;color:var(--text);">' + (inv.total_ttc || 0).toFixed(2) + '€</span>';
    html += '<span style="font-size:10px;padding:2px 6px;background:' + color + '20;color:' + color + ';border-radius:4px;font-weight:600;flex-shrink:0;">' + label + '</span>';
    html += '<button class="btn btnSmall btnOutline" style="padding:3px 6px;font-size:10px;" onclick="event.stopPropagation();showInvoiceFullView(\'' + inv.id + '\')" title="Voir">&#128065;</button>';
    html += '<button class="btn btnSmall btnOutline" style="padding:3px 6px;font-size:10px;" onclick="event.stopPropagation();downloadInvoicePDF(\'' + inv.id + '\')" title="PDF">&#128196;</button>';
    html += '</div>';
    return html;
  }
  html += '<div style="background:var(--surface2);border:1px solid ' + (isSelected ? 'var(--accent)' : 'var(--border2)') + ';border-left:3px solid ' + color + ';border-radius:10px;padding:12px;margin-bottom:8px;transition:border-color 0.15s;">';
  html += '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;">';
  // Left: checkbox + content
  html += '<div style="flex:1;min-width:0;display:flex;gap:8px;align-items:flex-start;">';
  if (canSelect) html += '<input type="checkbox" ' + (isSelected ? 'checked' : '') + ' onclick="event.stopPropagation();toggleInvoiceSelect(\'' + inv.id + '\')" style="margin-top:4px;flex-shrink:0;">';
  html += '<div onclick="showInvoiceDetail(\'' + inv.id + '\')" style="flex:1;min-width:0;cursor:pointer;">';
  html += '<div style="font-size:14px;font-weight:700;color:var(--text);margin-bottom:2px;">' + esc(prestLabel) + '</div>';
  let meta = '';
  if (inv.property_name) meta += '&#127968; ' + esc(inv.property_name);
  if (inv.client_name) meta += (meta ? ' · ' : '') + '&#128100; ' + esc(inv.client_name);
  if (meta) html += '<div style="font-size:11px;color:var(--text3);margin-bottom:3px;">' + meta + '</div>';
  html += '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">';
  html += '<span style="font-size:10px;color:var(--text3);">' + esc(inv.invoice_number || 'Facture') + ' · ' + typeIcon + ' ' + typeLabel + ' · ' + dateStr + '</span>';
  if (inv.is_quote) html += '<span style="font-size:9px;padding:1px 6px;background:#8b5cf6;color:#fff;border-radius:4px;font-weight:600;">DEVIS</span>';
  if (dueHint) html += dueHint;
  html += '</div></div></div>';
  // Right: amount + status
  html += '<div style="text-align:right;flex-shrink:0;">';
  html += '<div style="font-size:17px;font-weight:800;color:var(--text);">' + (inv.total_ttc || 0).toFixed(2) + ' \u20ac</div>';
  html += '<span style="display:inline-block;margin-top:4px;font-size:11px;padding:2px 8px;background:' + color + '20;color:' + color + ';border-radius:4px;font-weight:600;">' + label + '</span>';
  html += '</div>';
  html += '</div>';
  // Actions
  html += '<div style="display:flex;gap:6px;margin-top:10px;flex-wrap:wrap;" onclick="event.stopPropagation()">';
  html += '<button class="btn btnSmall btnOutline" style="padding:4px 8px;font-size:11px;" onclick="showInvoiceDetail(\'' + inv.id + '\')">&#128065; Voir</button>';
  html += '<button class="btn btnSmall btnOutline" style="padding:4px 8px;font-size:11px;" onclick="downloadInvoicePDF(\'' + inv.id + '\')">&#128196; PDF</button>';
  html += '<button class="btn btnSmall btnOutline" style="padding:4px 8px;font-size:11px;" onclick="sendInvoiceByEmail(\'' + inv.id + '\')" title="Envoyer par email">&#128231; Email</button>';
  html += '<button class="btn btnSmall btnOutline" style="padding:4px 8px;font-size:11px;" onclick="duplicateInvoice(\'' + inv.id + '\')" title="Dupliquer">&#128203; Dupliquer</button>';
  if (inv.is_quote) {
    if (inv.status !== 'accepted' && inv.status !== 'refused') {
      html += '<button class="btn btnSmall" style="padding:4px 8px;font-size:11px;background:#34d399;color:#fff;" onclick="acceptQuote(\'' + inv.id + '\')" title="Marquer comme accepte">&#10003; Accepter</button>';
      html += '<button class="btn btnSmall" style="padding:4px 8px;font-size:11px;background:#ef4444;color:#fff;" onclick="refuseQuote(\'' + inv.id + '\')" title="Marquer comme refuse">&#10007; Refuser</button>';
    }
    if (inv.status !== 'refused') {
      html += '<button class="btn btnSmall" style="padding:4px 8px;font-size:11px;background:#6c63ff;color:#fff;" onclick="convertQuoteToInvoice(\'' + inv.id + '\')" title="' + t('invoice.convert_quote') + '">&#10132; Convertir en facture</button>';
    }
  }
  if (inv.status === 'draft') html += '<button class="btn btnSmall" style="padding:4px 8px;font-size:11px;background:#6c63ff;color:#fff;" onclick="updateInvoiceStatus(\'' + inv.id + '\',\'sent\')">Envoyer</button>';
  if (inv.status === 'sent') html += '<button class="btn btnSmall btnSuccess" style="padding:4px 8px;font-size:11px;" onclick="updateInvoiceStatus(\'' + inv.id + '\',\'paid\')">&#9989; Marquer payee</button>';
  if (isOverdue) html += '<button class="btn btnSmall" style="padding:4px 8px;font-size:11px;background:#f59e0b;color:#fff;" onclick="sendInvoiceReminder(\'' + inv.id + '\')">&#128276; Relancer</button>';
  if (inv.status === 'draft') html += '<button class="btn btnSmall btnDanger" style="padding:4px 8px;font-size:11px;" onclick="deleteInvoice(\'' + inv.id + '\')">Supprimer</button>';
  html += '</div></div>';
  return html;
}

function renderInvoiceSummary(invoices) {
  const div = document.getElementById('invoiceSummary');
  if (!div) return;
  const today = new Date().toISOString().split('T')[0];
  const totalSent = invoices.filter(i => i.status === 'sent' && !(i.due_date && i.due_date < today)).reduce((s, i) => s + (i.total_ttc || 0), 0);
  const totalPaid = invoices.filter(i => i.status === 'paid').reduce((s, i) => s + (i.total_ttc || 0), 0);
  const overdue = invoices.filter(i => i.status === 'sent' && i.due_date && i.due_date < today);
  const overdueTotal = overdue.reduce((s, i) => s + (i.total_ttc || 0), 0);
  const tileStyle = 'flex:1;min-width:110px;border-radius:12px;padding:12px;text-align:center;cursor:pointer;transition:transform 0.15s;';
  let html = '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:10px;">';
  html += '<div onclick="setInvoiceStatus(\'sent\')" onmouseover="this.style.transform=\'translateY(-2px)\'" onmouseout="this.style.transform=\'\'" style="' + tileStyle + 'background:rgba(108,99,255,0.15);border:1px solid rgba(108,99,255,0.3);"><div style="font-size:18px;font-weight:800;color:#a78bfa;">' + totalSent.toFixed(0) + ' \u20ac</div><div style="font-size:10px;color:var(--text3);">En attente</div><div style="font-size:9px;color:var(--text3);margin-top:2px;">' + invoices.filter(i=>i.status==='sent'&&!(i.due_date&&i.due_date<today)).length + ' facture(s)</div></div>';
  html += '<div onclick="setInvoiceStatus(\'paid\')" onmouseover="this.style.transform=\'translateY(-2px)\'" onmouseout="this.style.transform=\'\'" style="' + tileStyle + 'background:rgba(52,211,153,0.15);border:1px solid rgba(52,211,153,0.3);"><div style="font-size:18px;font-weight:800;color:#34d399;">' + totalPaid.toFixed(0) + ' \u20ac</div><div style="font-size:10px;color:var(--text3);">Encaisse</div><div style="font-size:9px;color:var(--text3);margin-top:2px;">' + invoices.filter(i=>i.status==='paid').length + ' facture(s)</div></div>';
  html += '<div onclick="setInvoiceStatus(\'overdue\')" onmouseover="this.style.transform=\'translateY(-2px)\'" onmouseout="this.style.transform=\'\'" style="' + tileStyle + 'background:rgba(233,69,96,' + (overdue.length > 0 ? '0.15' : '0.05') + ');border:1px solid rgba(233,69,96,0.3);"><div style="font-size:18px;font-weight:800;color:#e94560;">' + overdueTotal.toFixed(0) + ' \u20ac</div><div style="font-size:10px;color:var(--text3);">En retard</div><div style="font-size:9px;color:var(--text3);margin-top:2px;">' + overdue.length + ' facture(s)</div></div>';
  html += '<div onclick="setInvoiceStatus(\'all\')" onmouseover="this.style.transform=\'translateY(-2px)\'" onmouseout="this.style.transform=\'\'" style="' + tileStyle + 'background:var(--surface2);border:1px solid var(--border2);"><div style="font-size:18px;font-weight:800;color:var(--text);">' + invoices.length + '</div><div style="font-size:10px;color:var(--text3);">Nb factures</div></div>';
  html += '</div>';
  div.innerHTML = html;
}

function renderInvoicePeriodChips() {
  const row = document.getElementById('invoicePeriodChips');
  if (!row) return;
  const chips = [
    { id: 'all', label: 'Tout' },
    { id: 'thisMonth', label: 'Ce mois' },
    { id: 'lastMonth', label: 'Mois dernier' },
    { id: 'thisYear', label: t('invoice.period.this_year') },
  ];
  row.innerHTML = chips.map(c => {
    const act = _invoicePeriod === c.id;
    return '<button onclick="setInvoicePeriod(\'' + c.id + '\')" style="padding:5px 10px;border-radius:20px;font-size:11px;border:1px solid ' + (act ? '#6c63ff' : 'var(--border2)') + ';background:' + (act ? 'rgba(108,99,255,0.2)' : 'var(--surface2)') + ';color:' + (act ? '#a78bfa' : 'var(--text3)') + ';cursor:pointer;white-space:nowrap;">' + c.label + '</button>';
  }).join('');
}

function renderInvoiceStatusChips(invoices) {
  const row = document.getElementById('invoiceStatusChips');
  if (!row) return;
  const today = new Date().toISOString().split('T')[0];
  const counts = { all: invoices.length, draft: 0, sent: 0, paid: 0, overdue: 0 };
  invoices.forEach(i => {
    if (i.status === 'sent' && i.due_date && i.due_date < today) counts.overdue++;
    else counts[i.status] = (counts[i.status] || 0) + 1;
  });
  const chips = [
    { id: 'all', label: 'Toutes', color: '#888' },
    { id: 'draft', label: 'Brouillon', color: '#888' },
    { id: 'sent', label: 'En attente', color: '#6c63ff' },
    { id: 'paid', label: 'Payee', color: '#34d399' },
    { id: 'overdue', label: 'En retard', color: '#e94560' },
  ];
  row.innerHTML = chips.map(c => {
    const act = _invoiceStatus === c.id;
    const count = counts[c.id] || 0;
    if (c.id !== 'all' && count === 0) return '';
    return '<button onclick="setInvoiceStatus(\'' + c.id + '\')" style="padding:5px 10px;border-radius:20px;font-size:11px;border:1px solid ' + (act ? c.color : 'var(--border2)') + ';background:' + (act ? c.color + '20' : 'var(--surface2)') + ';color:' + (act ? c.color : 'var(--text3)') + ';cursor:pointer;white-space:nowrap;font-weight:' + (act ? '700' : '500') + ';">' + c.label + ' (' + count + ')</button>';
  }).join('');
}

function setInvoicePeriod(p) { _invoicePeriod = p; renderInvoicesView(); }
function setInvoiceStatus(s) { _invoiceStatus = s; renderInvoicesView(); }

async function sendInvoiceReminder(id) {
  const ok = await customConfirm(t('invoice.send_reminder'), 'Envoyer');
  if (!ok) return;
  try {
    const { data: inv } = await sb.from('invoices').select('*').eq('id', id).maybeSingle();
    if (!inv) return;
    showToast('Relance envoyee a ' + (inv.client_name || 'client'));
    // Could trigger an email via edge function later
  } catch(e) { showToast('Erreur'); }
}

async function showInvoicePrestationDetail(invoiceId) {
  try {
    const { data: inv } = await sb.from('invoices').select('*').eq('id', invoiceId).maybeSingle();
    if (!inv) return;
    let html = '<div style="padding:6px;max-height:70vh;overflow-y:auto;">';
    // Prestation header
    const firstItem = (inv.items && inv.items.length) ? inv.items[0] : null;
    const prestLabel = firstItem ? firstItem.description : '(Sans titre)';
    html += '<div style="font-size:18px;font-weight:800;color:var(--text);margin-bottom:4px;">' + esc(prestLabel) + '</div>';
    if (inv.property_name) html += '<div style="font-size:12px;color:var(--text3);margin-bottom:14px;">&#127968; ' + esc(inv.property_name) + '</div>';
    // Info grid
    html += '<div style="display:grid;gap:8px;margin-bottom:14px;">';
    const row = (icon, lbl, val) => {
      if (!val) return '';
      return '<div style="display:flex;gap:10px;padding:10px;background:var(--surface2);border-radius:8px;"><span style="font-size:16px;">' + icon + '</span><div style="flex:1;min-width:0;"><div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:0.5px;">' + lbl + '</div><div style="font-size:13px;color:var(--text);font-weight:600;word-break:break-word;">' + esc(val) + '</div></div></div>';
    };
    html += row('&#128197;', 'Periode', (inv.period_start ? fmtDate(inv.period_start) : '') + (inv.period_end ? ' → ' + fmtDate(inv.period_end) : ''));
    html += row('&#128100;', inv.type === 'concierge_to_owner' ? 'Client (proprietaire)' : 'Client', inv.client_name);
    html += row('&#127970;', 'Emetteur', inv.issuer_name);
    html += row('&#128205;', 'Adresse emetteur', inv.issuer_address);
    html += row('&#128221;', 'SIRET', inv.issuer_siret);
    html += row('&#9993;', 'Email emetteur', inv.issuer_email);
    if (inv.due_date) html += row('&#9201;', 'Echeance', fmtDate(inv.due_date));
    html += '</div>';
    // Items list (all)
    if (inv.items && inv.items.length) {
      html += '<div style="font-size:12px;font-weight:700;color:var(--text);margin-bottom:6px;">Lignes de la facture</div>';
      html += '<table style="width:100%;border-collapse:collapse;font-size:11px;margin-bottom:14px;">';
      html += '<tr><th style="text-align:left;padding:6px;color:var(--text3);border-bottom:1px solid var(--border);">Description</th><th style="text-align:center;padding:6px;color:var(--text3);border-bottom:1px solid var(--border);">Qte</th><th style="text-align:right;padding:6px;color:var(--text3);border-bottom:1px solid var(--border);">PU</th><th style="text-align:right;padding:6px;color:var(--text3);border-bottom:1px solid var(--border);">Total</th></tr>';
      inv.items.forEach(it => {
        html += '<tr style="border-bottom:1px solid var(--border);">';
        html += '<td style="padding:6px;">' + esc(it.description || '') + '</td>';
        html += '<td style="text-align:center;padding:6px;">' + (it.quantity || 1) + '</td>';
        html += '<td style="text-align:right;padding:6px;">' + (parseFloat(it.unit_price) || 0).toFixed(2) + '€</td>';
        html += '<td style="text-align:right;padding:6px;font-weight:600;">' + (parseFloat(it.amount) || 0).toFixed(2) + '€</td>';
        html += '</tr>';
      });
      html += '</table>';
    }
    // Totals
    html += '<div style="padding:10px 12px;background:var(--surface2);border-radius:10px;">';
    if (inv.total_ht) html += '<div style="display:flex;justify-content:space-between;padding:2px 0;"><span style="color:var(--text3);">HT</span><span>' + inv.total_ht.toFixed(2) + '€</span></div>';
    if (inv.total_tva) html += '<div style="display:flex;justify-content:space-between;padding:2px 0;"><span style="color:var(--text3);">TVA</span><span>' + inv.total_tva.toFixed(2) + '€</span></div>';
    html += '<div style="display:flex;justify-content:space-between;padding:4px 0;font-weight:800;font-size:15px;border-top:1px solid var(--border);margin-top:4px;"><span>TTC</span><span>' + (inv.total_ttc || 0).toFixed(2) + '€</span></div>';
    html += '</div>';
    html += '<div style="display:flex;gap:8px;margin-top:14px;">';
    html += '<button class="btn btnOutline" style="flex:1;padding:10px;" onclick="closeMsg();setTimeout(()=>showInvoiceDetail(\'' + inv.id + '\'),150)">&larr; Retour a la facture</button>';
    html += '</div>';
    html += '</div>';
    closeMsg();
    setTimeout(() => showMsg(html, true), 150);
  } catch(e) { console.error('showInvoicePrestationDetail error:', e); showToast('Erreur'); }
}

async function showInvoiceFullView(id) {
  try {
    const { data: inv } = await sb.from('invoices').select('*').eq('id', id).single();
    if (!inv) { showToast('Facture introuvable'); return; }
    const statusColors = { draft: '#888', sent: '#6c63ff', paid: '#34d399', overdue: '#e94560', accepted: '#34d399', refused: '#ef4444' };
    const statusLabels = { draft: 'Brouillon', sent: 'Envoyee', paid: 'Payee', accepted: 'Accepte', refused: 'Refuse' };
    const isOverdue = inv.status === 'sent' && inv.due_date && inv.due_date < new Date().toISOString().split('T')[0];
    const color = statusColors[isOverdue ? 'overdue' : inv.status] || '#888';
    const label = isOverdue ? 'En retard' : (statusLabels[inv.status] || inv.status);
    const fmtD = (d) => d ? new Date(d).toLocaleDateString('fr-FR') : '—';

    let h = '<div style="background:#fff;color:#222;padding:20px;border-radius:8px;font-family:Arial,sans-serif;max-width:100%;box-sizing:border-box;">';
    // Top banner: invoice number + status + dates
    h += '<div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #222;padding-bottom:10px;margin-bottom:14px;">';
    h += '<div><div style="font-size:24px;font-weight:800;color:#222;">FACTURE</div>';
    h += '<div style="font-size:13px;color:#555;margin-top:4px;">N° ' + esc(inv.invoice_number || '—') + '</div>';
    h += '<div style="font-size:11px;color:#777;">Emise le ' + fmtD(inv.created_at) + '</div></div>';
    h += '<span style="padding:4px 12px;background:' + color + '20;color:' + color + ';border-radius:6px;font-weight:700;font-size:12px;">' + label + '</span>';
    h += '</div>';

    // Issuer / Client side by side
    h += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px;">';
    h += '<div><div style="font-size:10px;color:#888;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">Emetteur</div>';
    h += '<div style="font-size:13px;font-weight:700;">' + esc(inv.issuer_name || '—') + '</div>';
    if (inv.issuer_address) h += '<div style="font-size:12px;color:#555;">' + esc(inv.issuer_address) + '</div>';
    if (inv.issuer_email) h += '<div style="font-size:11px;color:#555;">' + esc(inv.issuer_email) + '</div>';
    if (inv.issuer_siret) h += '<div style="font-size:11px;color:#555;">SIRET: ' + esc(inv.issuer_siret) + '</div>';
    if (inv.issuer_vat_number) h += '<div style="font-size:11px;color:#555;">TVA: ' + esc(inv.issuer_vat_number) + '</div>';
    h += '</div>';
    h += '<div><div style="font-size:10px;color:#888;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">Client</div>';
    h += '<div style="font-size:13px;font-weight:700;">' + esc(inv.client_name || '—') + '</div>';
    if (inv.client_address) h += '<div style="font-size:12px;color:#555;">' + esc(inv.client_address) + '</div>';
    if (inv.client_email) h += '<div style="font-size:11px;color:#555;">' + esc(inv.client_email) + '</div>';
    if (inv.property_name) h += '<div style="font-size:11px;color:#555;">Bien: ' + esc(inv.property_name) + '</div>';
    h += '</div></div>';

    // Period
    if (inv.period_start || inv.period_end || inv.due_date) {
      h += '<div style="display:flex;gap:14px;font-size:11px;color:#555;background:#f5f5f5;padding:8px 10px;border-radius:6px;margin-bottom:14px;flex-wrap:wrap;">';
      if (inv.period_start || inv.period_end) h += '<span><strong>Periode:</strong> ' + fmtD(inv.period_start) + ' → ' + fmtD(inv.period_end) + '</span>';
      if (inv.due_date) h += '<span><strong>Echeance:</strong> ' + fmtD(inv.due_date) + '</span>';
      if (inv.payment_terms) h += '<span><strong>Paiement:</strong> ' + esc(inv.payment_terms) + '</span>';
      h += '</div>';
    }

    // Items table
    h += '<table style="width:100%;border-collapse:collapse;font-size:12px;margin-bottom:14px;">';
    h += '<thead><tr style="background:#222;color:#fff;"><th style="text-align:left;padding:8px;">Description</th><th style="text-align:center;padding:8px;width:60px;">Qte</th><th style="text-align:right;padding:8px;width:80px;">PU HT</th><th style="text-align:right;padding:8px;width:90px;">Total HT</th></tr></thead><tbody>';
    (inv.items || []).forEach((item, idx) => {
      h += '<tr style="background:' + (idx % 2 ? '#f9f9f9' : '#fff') + ';">';
      h += '<td style="padding:8px;border-bottom:1px solid #eee;">' + esc(item.description || '') + '</td>';
      h += '<td style="text-align:center;padding:8px;border-bottom:1px solid #eee;">' + (item.quantity || 1) + '</td>';
      h += '<td style="text-align:right;padding:8px;border-bottom:1px solid #eee;">' + (item.unit_price || 0).toFixed(2) + '€</td>';
      h += '<td style="text-align:right;padding:8px;border-bottom:1px solid #eee;font-weight:600;">' + (item.amount || 0).toFixed(2) + '€</td></tr>';
    });
    if (!inv.items || !inv.items.length) {
      h += '<tr><td colspan="4" style="text-align:center;padding:12px;color:#888;font-style:italic;">Aucune ligne</td></tr>';
    }
    h += '</tbody></table>';

    // Totals
    h += '<div style="display:flex;justify-content:flex-end;margin-bottom:14px;">';
    h += '<table style="font-size:12px;min-width:220px;">';
    if (inv.subtotal_ht !== undefined && inv.subtotal_ht !== null) h += '<tr><td style="padding:4px 10px;color:#555;">Sous-total HT</td><td style="text-align:right;padding:4px 10px;">' + (inv.subtotal_ht || 0).toFixed(2) + '€</td></tr>';
    if (inv.vat_rate) h += '<tr><td style="padding:4px 10px;color:#555;">TVA ' + inv.vat_rate + '%</td><td style="text-align:right;padding:4px 10px;">' + (inv.vat_amount || inv.total_tva || 0).toFixed(2) + '€</td></tr>';
    h += '<tr style="background:#222;color:#fff;"><td style="padding:8px 10px;font-weight:700;">TOTAL TTC</td><td style="text-align:right;padding:8px 10px;font-weight:800;font-size:14px;">' + (inv.total_ttc || 0).toFixed(2) + '€</td></tr>';
    h += '</table></div>';

    // Mentions légales (si pas de TVA)
    if (!inv.vat_rate || inv.vat_rate === 0) {
      h += '<div style="font-size:10px;color:#888;border-top:1px solid #ddd;padding-top:8px;font-style:italic;">TVA non applicable, art. 293 B du CGI</div>';
    }
    h += '</div>';

    // Action buttons
    h += '<div style="display:flex;gap:8px;margin-top:12px;">';
    h += '<button class="btn btnOutline" style="flex:1;padding:10px;" onclick="closeMsg();setTimeout(()=>showInvoiceDetail(\'' + inv.id + '\'),150)">&larr; Historique</button>';
    h += '<button class="btn" style="padding:10px;background:#6c63ff;color:#fff;border:none;font-weight:600;" onclick="downloadInvoicePDF(\'' + inv.id + '\')">&#128196; PDF</button>';
    h += '</div>';

    showMsg(h);
  } catch(e) { console.error('showInvoiceFullView:', e); showToast('Erreur'); }
}

async function showInvoiceDetail(id) {
  try {
    const { data: inv } = await sb.from('invoices').select('*').eq('id', id).single();
    if (!inv) { showToast('Facture introuvable'); return; }

    const statusColors = { draft: '#888', sent: '#6c63ff', paid: '#34d399', overdue: '#e94560', accepted: '#34d399', refused: '#ef4444' };
    const statusLabels = { draft: 'Brouillon', sent: 'Envoyee', paid: 'Payee', accepted: 'Accepte', refused: 'Refuse' };
    const isOverdue = inv.status === 'sent' && inv.due_date && inv.due_date < new Date().toISOString().split('T')[0];
    const color = statusColors[isOverdue ? 'overdue' : inv.status] || '#888';
    const label = isOverdue ? 'En retard' : (statusLabels[inv.status] || inv.status);

    // Pick first item as main prestation summary
    const firstItem = (inv.items && inv.items.length) ? inv.items[0] : null;
    const prestLabel = (firstItem && firstItem.description) ? firstItem.description : (inv.property_name ? 'Prestation — ' + inv.property_name : 'Prestation sans description');

    let html = '<div style="padding:6px;">';
    // Header
    html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">';
    html += '<div>';
    html += '<div style="font-size:18px;font-weight:800;color:var(--text);">' + esc(inv.invoice_number || 'Facture') + '</div>';
    html += '<div style="font-size:12px;color:var(--text3);">' + (inv.type === 'concierge_to_owner' ? '&#127968; Facture proprietaire' : '&#129529; Facture concierge') + '</div>';
    html += '</div>';
    html += '<span style="padding:4px 12px;background:' + color + '20;color:' + color + ';border-radius:6px;font-weight:700;font-size:13px;">' + label + '</span>';
    html += '</div>';
    // Prestation summary card (always shown)
    html += '<div onclick="showInvoicePrestationDetail(\'' + inv.id + '\')" style="background:rgba(108,99,255,0.1);border:1px solid rgba(108,99,255,0.3);border-radius:10px;padding:10px 12px;margin-bottom:16px;cursor:pointer;transition:background 0.2s;" onmouseover="this.style.background=\'rgba(108,99,255,0.18)\'" onmouseout="this.style.background=\'rgba(108,99,255,0.1)\'" title="' + t('invoice.view_detail') + '">';
    html += '<div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:3px;">&#128203; Prestation</div>';
    html += '<div style="font-size:14px;font-weight:700;color:var(--text);">' + esc(prestLabel) + '</div>';
    if (inv.property_name) html += '<div style="font-size:11px;color:var(--text3);margin-top:2px;">&#127968; ' + esc(inv.property_name) + '</div>';
    html += '<div style="font-size:10px;color:#a78bfa;margin-top:4px;">&#128279; Cliquer pour plus d\'infos</div>';
    html += '</div>';

    // Timeline
    html += '<div style="font-size:12px;font-weight:700;color:var(--text);margin-bottom:10px;">&#128340; Historique</div>';
    html += '<div style="border-left:2px solid var(--border2);margin-left:8px;padding-left:16px;">';

    // Creation
    html += '<div style="position:relative;margin-bottom:14px;">';
    html += '<div style="position:absolute;left:-22px;top:2px;width:12px;height:12px;border-radius:50%;background:#6c63ff;border:2px solid var(--bg);"></div>';
    html += '<div style="font-size:11px;color:var(--text3);">' + new Date(inv.created_at).toLocaleString('fr-FR', {day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}) + '</div>';
    html += '<div style="font-size:13px;color:var(--text);font-weight:600;">Facture creee</div>';
    html += '</div>';

    // Sent
    if (inv.status === 'sent' || inv.status === 'paid') {
      const sentDate = inv.sent_at || inv.updated_at || inv.created_at;
      html += '<div style="position:relative;margin-bottom:14px;">';
      html += '<div style="position:absolute;left:-22px;top:2px;width:12px;height:12px;border-radius:50%;background:#6c63ff;border:2px solid var(--bg);"></div>';
      html += '<div style="font-size:11px;color:var(--text3);">' + new Date(sentDate).toLocaleString('fr-FR', {day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}) + '</div>';
      html += '<div style="font-size:13px;color:var(--text);font-weight:600;">Facture envoyee</div>';
      if (inv.client_name) html += '<div style="font-size:11px;color:var(--text3);">A : ' + esc(inv.client_name) + '</div>';
      html += '</div>';
    }

    // Overdue
    if (isOverdue) {
      html += '<div style="position:relative;margin-bottom:14px;">';
      html += '<div style="position:absolute;left:-22px;top:2px;width:12px;height:12px;border-radius:50%;background:#e94560;border:2px solid var(--bg);"></div>';
      html += '<div style="font-size:11px;color:#e94560;">' + fmtDate(inv.due_date) + '</div>';
      html += '<div style="font-size:13px;color:#e94560;font-weight:600;">&#9888; Echeance depassee</div>';
      html += '</div>';
    }

    // Paid
    if (inv.status === 'paid') {
      const paidDate = inv.paid_at || inv.updated_at || inv.created_at;
      const d = new Date(paidDate);
      const paidLabel = (paidDate && !isNaN(d.getTime())) ? d.toLocaleString('fr-FR', {day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}) : 'Date inconnue';
      html += '<div style="position:relative;margin-bottom:14px;">';
      html += '<div style="position:absolute;left:-22px;top:2px;width:12px;height:12px;border-radius:50%;background:#34d399;border:2px solid var(--bg);"></div>';
      html += '<div style="font-size:11px;color:var(--text3);">' + paidLabel + '</div>';
      html += '<div style="font-size:13px;color:#34d399;font-weight:600;">&#9989; Paiement recu</div>';
      html += '</div>';
    }

    // Pending
    if (inv.status === 'draft') {
      html += '<div style="position:relative;margin-bottom:14px;">';
      html += '<div style="position:absolute;left:-22px;top:2px;width:12px;height:12px;border-radius:50%;background:var(--border2);border:2px solid var(--bg);"></div>';
      html += '<div style="font-size:13px;color:var(--text3);">En attente d\'envoi...</div>';
      html += '</div>';
    } else if (inv.status === 'sent' && !isOverdue) {
      html += '<div style="position:relative;margin-bottom:14px;">';
      html += '<div style="position:absolute;left:-22px;top:2px;width:12px;height:12px;border-radius:50%;background:var(--border2);border:2px solid var(--bg);"></div>';
      html += '<div style="font-size:13px;color:var(--text3);">En attente de paiement...</div>';
      html += '</div>';
    }
    html += '</div>'; // close timeline

    // Items
    if (inv.items && inv.items.length) {
      html += '<div style="font-size:12px;font-weight:700;color:var(--text);margin:16px 0 8px;">&#128203; Prestations</div>';
      html += '<table style="width:100%;border-collapse:collapse;font-size:11px;">';
      html += '<tr><th style="text-align:left;padding:6px;color:var(--text3);border-bottom:1px solid var(--border);">Description</th><th style="text-align:center;padding:6px;color:var(--text3);border-bottom:1px solid var(--border);">Qte</th><th style="text-align:right;padding:6px;color:var(--text3);border-bottom:1px solid var(--border);">PU</th><th style="text-align:right;padding:6px;color:var(--text3);border-bottom:1px solid var(--border);">Total</th></tr>';
      inv.items.forEach(item => {
        html += '<tr style="border-bottom:1px solid var(--border);"><td style="padding:6px;">' + esc(item.description || '') + '</td><td style="text-align:center;padding:6px;">' + (item.quantity || 1) + '</td><td style="text-align:right;padding:6px;">' + (item.unit_price || 0).toFixed(2) + '€</td><td style="text-align:right;padding:6px;font-weight:600;">' + (item.amount || 0).toFixed(2) + '€</td></tr>';
      });
      html += '</table>';
    }

    // Totals
    html += '<div style="display:flex;justify-content:space-between;padding:12px 0;margin-top:8px;border-top:1px solid var(--border);">';
    if (inv.total_ht) html += '<div style="font-size:12px;color:var(--text3);">HT: ' + inv.total_ht.toFixed(2) + '€</div>';
    if (inv.total_tva) html += '<div style="font-size:12px;color:var(--text3);">TVA: ' + inv.total_tva.toFixed(2) + '€</div>';
    html += '<div style="font-size:16px;font-weight:800;color:var(--text);">TTC: ' + (inv.total_ttc || 0).toFixed(2) + '€</div>';
    html += '</div>';

    // Actions
    html += '<div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap;">';
    html += '<button class="btn btnOutline" style="flex:1;padding:10px;" onclick="closeMsg()">Fermer</button>';
    html += '<button class="btn" style="padding:10px;background:#6c63ff;color:#fff;border:none;font-weight:600;" onclick="closeMsg();setTimeout(()=>showInvoiceFullView(\'' + inv.id + '\'),150)">&#128196; Voir la facture</button>';
    html += '<button class="btn btnSmall btnOutline" style="padding:10px;" onclick="closeMsg();downloadInvoicePDF(\'' + inv.id + '\')">PDF</button>';
    if (inv.status === 'draft') html += '<button class="btn" style="padding:10px;background:#34d399;color:#fff;border:none;font-weight:600;" onclick="closeMsg();updateInvoiceStatus(\'' + inv.id + '\',\'sent\')">Envoyer</button>';
    if (inv.status === 'sent') html += '<button class="btn btnSuccess" style="padding:10px;font-weight:600;" onclick="closeMsg();updateInvoiceStatus(\'' + inv.id + '\',\'paid\')">&#9989; Marquer payee</button>';
    html += '</div>';

    html += '</div>';
    showMsg(html, true);
  } catch(e) { console.error('showInvoiceDetail error:', e); showToast('Erreur'); }
}

async function exportComptableCSV() {
  try {
    const org = API.getOrg();
    if (!org) return;
    const { data: invoices } = await sb.from('invoices').select('*').eq('org_id', org.id).order('created_at', { ascending: false });
    if (!invoices || !invoices.length) { showToast('Aucune facture a exporter'); return; }
    // French accounting CSV format (semicolon separated, UTF-8 BOM)
    const sep = ';';
    let csv = '\uFEFF'; // BOM for Excel
    csv += ['Date', 'Numero', 'Type', 'Client', 'Statut', 'HT', 'TVA', 'TTC', 'Paye le', 'Echeance'].join(sep) + '\n';
    invoices.forEach(inv => {
      const date = new Date(inv.created_at).toLocaleDateString('fr-FR');
      const type = inv.type === 'concierge_to_owner' ? 'Proprietaire' : 'Prestataire';
      const status = inv.status === 'paid' ? 'Payee' : inv.status === 'sent' ? 'Envoyee' : 'Brouillon';
      const paidDate = inv.paid_at ? new Date(inv.paid_at).toLocaleDateString('fr-FR') : '';
      const dueDate = inv.due_date ? new Date(inv.due_date).toLocaleDateString('fr-FR') : '';
      csv += [date, inv.invoice_number || '', type, inv.client_name || '', status,
        (inv.total_ht || 0).toFixed(2).replace('.', ','),
        (inv.total_tva || 0).toFixed(2).replace('.', ','),
        (inv.total_ttc || 0).toFixed(2).replace('.', ','),
        paidDate, dueDate].join(sep) + '\n';
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'lokizio-factures-' + new Date().toISOString().split('T')[0] + '.csv';
    a.click();
    URL.revokeObjectURL(url);
    showToast('Export CSV telecharge');
  } catch(e) { console.error('Export error:', e); showToast('Erreur export'); }
}

async function updateInvoiceStatus(id, status) {
  try {
    const update = { status };
    if (status === 'paid') update.paid_at = new Date().toISOString();
    if (status === 'sent') update.sent_at = new Date().toISOString();
    const { data: inv } = await sb.from('invoices').select('*').eq('id', id).single();
    const { error } = await sb.from('invoices').update(update).eq('id', id);
    if (error) { console.error('updateInvoiceStatus error:', error); showToast('Erreur: ' + safeErr(error, 'Mise a jour impossible')); return; }
    showToast('Facture mise a jour');
    // Push to recipient/issuer depending on transition
    try { await notifyInvoiceStatus(inv, status); } catch(e) { console.warn('notifyInvoiceStatus:', e); }
    loadInvoices();
  } catch(e) { console.error('updateInvoiceStatus:', e); showToast('Erreur: ' + e.message); }
}

// Send push to relevant party on invoice status change
async function notifyInvoiceStatus(inv, newStatus) {
  if (!inv) return;
  const org = API.getOrg();
  if (!org) return;
  // Find client user (recipient) and issuer user (emitter)
  const { data: members } = await sb.from('members').select('user_id,display_name,invited_email,company_name').eq('org_id', org.id);
  const matchByName = (name) => (members || []).find(m => name && (m.display_name === name || m.invited_email === name || m.company_name === name));
  const clientUser = matchByName(inv.client_name) || matchByName(inv.client_email);
  const issuerUser = matchByName(inv.issuer_name) || matchByName(inv.issuer_email);
  const num = inv.invoice_number || '';
  const amt = (inv.total_ttc || 0).toFixed(2) + '€';

  if (newStatus === 'sent' && clientUser?.user_id) {
    await sendPushToUser(clientUser.user_id, 'Nouvelle facture', 'Facture ' + num + ' a payer (' + amt + ')', { tag: 'inv-' + inv.id });
  } else if (newStatus === 'paid' && issuerUser?.user_id) {
    await sendPushToUser(issuerUser.user_id, 'Paiement recu', 'Facture ' + num + ' reglee (' + amt + ')', { tag: 'inv-' + inv.id });
  }
}

async function deleteInvoice(id) {
  const ok = await customConfirm(t('invoice.delete_confirm'), 'Supprimer');
  if (!ok) return;
  await sb.from('invoices').delete().eq('id', id);
  showToast('Facture supprimee');
  loadInvoices();
}

async function sendInvoiceByEmail(id) {
  try {
    const { data: inv } = await sb.from('invoices').select('*').eq('id', id).single();
    if (!inv) { showToast('Facture introuvable'); return; }
    const defaultEmail = inv.client_email || '';
    let h = '<div style="font-size:15px;font-weight:700;margin-bottom:10px;">&#128231; Envoyer par email</div>';
    h += '<div style="font-size:12px;color:var(--text3);margin-bottom:12px;">Facture <strong>' + esc(inv.invoice_number || '') + '</strong> — ' + esc(inv.client_name || '') + ' — ' + (inv.total_ttc || 0).toFixed(2) + '€</div>';
    h += '<label style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:0.5px;display:block;margin-bottom:4px;">Destinataire</label>';
    h += '<input id="emailTo" type="email" value="' + esc(defaultEmail) + '" placeholder="client@exemple.fr" style="width:100%;padding:9px;background:var(--surface2);color:var(--text);border:1px solid var(--border2);border-radius:8px;font-size:13px;box-sizing:border-box;margin-bottom:10px;">';
    h += '<label style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:0.5px;display:block;margin-bottom:4px;">Message (optionnel)</label>';
    h += '<textarea id="emailMsg" rows="3" placeholder="' + t('invoice.email_body') + '" style="width:100%;padding:9px;background:var(--surface2);color:var(--text);border:1px solid var(--border2);border-radius:8px;font-size:13px;box-sizing:border-box;margin-bottom:12px;resize:vertical;"></textarea>';
    h += '<div style="display:flex;gap:8px;">';
    h += '<button class="btn btnOutline" style="flex:1;padding:10px;" onclick="closeMsg()">Annuler</button>';
    h += '<button class="btn btnPrimary" style="flex:1;padding:10px;" onclick="confirmSendInvoiceEmail(\'' + id + '\')">&#128231; Envoyer</button>';
    h += '</div>';
    showMsg(h, true);
  } catch(e) { console.error('sendInvoiceByEmail:', e); showToast('Erreur'); }
}

function _buildInvoiceEmailHtml(inv, customMessage) {
  const fmtD = (d) => d ? new Date(d).toLocaleDateString('fr-FR') : '—';
  const items = (inv.items || []).map(it => (
    '<tr>' +
    '<td style="padding:8px;border-bottom:1px solid #eee;">' + esc(it.description || '') + '</td>' +
    '<td style="text-align:center;padding:8px;border-bottom:1px solid #eee;">' + (it.quantity || 1) + '</td>' +
    '<td style="text-align:right;padding:8px;border-bottom:1px solid #eee;">' + (it.unit_price || 0).toFixed(2) + '€</td>' +
    '<td style="text-align:right;padding:8px;border-bottom:1px solid #eee;font-weight:600;">' + (it.amount || 0).toFixed(2) + '€</td>' +
    '</tr>'
  )).join('');
  let h = '<div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;color:#222;padding:20px;">';
  if (customMessage) h += '<div style="background:#f5f7ff;border-left:3px solid #6c63ff;padding:12px 14px;margin-bottom:20px;font-size:14px;line-height:1.5;">' + esc(customMessage).replace(/\n/g, '<br>') + '</div>';
  h += '<div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #222;padding-bottom:10px;margin-bottom:14px;">';
  h += '<div><div style="font-size:24px;font-weight:800;">FACTURE</div>';
  h += '<div style="font-size:13px;color:#555;">N&deg; ' + esc(inv.invoice_number || '—') + '</div>';
  h += '<div style="font-size:11px;color:#777;">Emise le ' + fmtD(inv.created_at) + '</div></div></div>';
  h += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px;">';
  h += '<div><div style="font-size:10px;color:#888;text-transform:uppercase;margin-bottom:4px;">Emetteur</div>';
  h += '<div style="font-size:13px;font-weight:700;">' + esc(inv.issuer_name || '') + '</div>';
  if (inv.issuer_address) h += '<div style="font-size:12px;color:#555;">' + esc(inv.issuer_address) + '</div>';
  if (inv.issuer_siret) h += '<div style="font-size:11px;color:#555;">SIRET: ' + esc(inv.issuer_siret) + '</div>';
  if (inv.issuer_vat_number) h += '<div style="font-size:11px;color:#555;">TVA: ' + esc(inv.issuer_vat_number) + '</div>';
  h += '</div>';
  h += '<div><div style="font-size:10px;color:#888;text-transform:uppercase;margin-bottom:4px;">Client</div>';
  h += '<div style="font-size:13px;font-weight:700;">' + esc(inv.client_name || '') + '</div>';
  if (inv.property_name) h += '<div style="font-size:11px;color:#555;">Bien: ' + esc(inv.property_name) + '</div>';
  h += '</div></div>';
  if (inv.period_start || inv.due_date) {
    h += '<div style="font-size:11px;color:#555;background:#f5f5f5;padding:8px 10px;border-radius:6px;margin-bottom:14px;">';
    if (inv.period_start) h += '<strong>Periode:</strong> ' + fmtD(inv.period_start) + ' → ' + fmtD(inv.period_end) + ' &nbsp; ';
    if (inv.due_date) h += '<strong>Echeance:</strong> ' + fmtD(inv.due_date);
    h += '</div>';
  }
  h += '<table style="width:100%;border-collapse:collapse;font-size:12px;margin-bottom:14px;">';
  h += '<thead><tr style="background:#222;color:#fff;"><th style="text-align:left;padding:8px;">Description</th><th style="padding:8px;">Qte</th><th style="text-align:right;padding:8px;">PU HT</th><th style="text-align:right;padding:8px;">Total HT</th></tr></thead>';
  h += '<tbody>' + (items || '<tr><td colspan="4" style="padding:12px;text-align:center;color:#888;">Aucune ligne</td></tr>') + '</tbody></table>';
  h += '<div style="display:flex;justify-content:flex-end;margin-bottom:14px;"><table style="font-size:12px;min-width:220px;">';
  if (inv.subtotal_ht !== undefined) h += '<tr><td style="padding:4px 10px;color:#555;">Sous-total HT</td><td style="text-align:right;padding:4px 10px;">' + (inv.subtotal_ht || 0).toFixed(2) + '€</td></tr>';
  if (inv.vat_rate) h += '<tr><td style="padding:4px 10px;color:#555;">TVA ' + inv.vat_rate + '%</td><td style="text-align:right;padding:4px 10px;">' + ((inv.vat_amount || inv.total_tva || 0)).toFixed(2) + '€</td></tr>';
  h += '<tr style="background:#222;color:#fff;"><td style="padding:8px 10px;font-weight:700;">TOTAL TTC</td><td style="text-align:right;padding:8px 10px;font-weight:800;font-size:14px;">' + (inv.total_ttc || 0).toFixed(2) + '€</td></tr>';
  h += '</table></div>';
  if (!inv.vat_rate) h += '<div style="font-size:10px;color:#888;border-top:1px solid #ddd;padding-top:8px;font-style:italic;">TVA non applicable, art. 293 B du CGI</div>';
  h += '<div style="margin-top:24px;padding-top:12px;border-top:1px solid #eee;font-size:11px;color:#888;text-align:center;">Envoye via Lokizio</div>';
  h += '</div>';
  return h;
}

async function confirmSendInvoiceEmail(id) {
  const to = document.getElementById('emailTo')?.value?.trim();
  const msg = document.getElementById('emailMsg')?.value?.trim();
  if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) { showToast('Email invalide'); return; }
  closeMsg();
  showToast('Envoi en cours...');
  try {
    const { data: inv } = await sb.from('invoices').select('*').eq('id', id).single();
    if (!inv) { showToast('Facture introuvable'); return; }
    const html = _buildInvoiceEmailHtml(inv, msg);
    const subject = 'Facture ' + (inv.invoice_number || '') + ' - ' + (inv.issuer_name || 'Lokizio');
    const session = (await sb.auth.getSession()).data.session;
    const resp = await fetch(SUPABASE_URL + '/functions/v1/send-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + (session?.access_token || '') },
      body: JSON.stringify({ to, subject, html, type: 'invoice' }),
    });
    const json = await resp.json();
    if (json.ok) {
      if (inv.status === 'draft') await sb.from('invoices').update({ status: 'sent', sent_at: new Date().toISOString() }).eq('id', id);
      showToast('Email envoye a ' + to);
      loadInvoices();
    } else {
      showToast('Erreur: ' + (json.error || 'envoi impossible'));
    }
  } catch(e) { console.error(e); showToast('Erreur: ' + e.message); }
}

async function duplicateInvoice(id) {
  try {
    const { data: orig } = await sb.from('invoices').select('*').eq('id', id).single();
    if (!orig) { showToast('Facture introuvable'); return; }
    const copy = { ...orig };
    delete copy.id;
    delete copy.created_at;
    delete copy.updated_at;
    delete copy.sent_at;
    delete copy.paid_at;
    copy.status = 'draft';
    copy.invoice_number = null;
    const { data: newInv, error } = await sb.from('invoices').insert(copy).select('id').single();
    if (error) { showToast('Erreur: ' + error.message); return; }
    showToast('Facture dupliquee (brouillon)');
    loadInvoices();
  } catch(e) { console.error('duplicateInvoice:', e); showToast('Erreur: ' + e.message); }
}

// Bulk selection state
let _invoiceSelection = new Set();
let _invoiceCompactMode = localStorage.getItem('mm_invoice_compact') === '1';
let _invoiceClientFilter = '';
let _invoiceSort = 'date_desc';

function toggleInvoiceSelect(id) {
  if (_invoiceSelection.has(id)) _invoiceSelection.delete(id);
  else _invoiceSelection.add(id);
  renderInvoicesView();
}

async function bulkMarkPaid() {
  if (!_invoiceSelection.size) return;
  const ok = await customConfirm('Marquer ' + _invoiceSelection.size + ' facture(s) comme payees ?', 'Confirmer');
  if (!ok) return;
  const now = new Date().toISOString();
  const ids = Array.from(_invoiceSelection);
  await sb.from('invoices').update({ status: 'paid', paid_at: now }).in('id', ids);
  _invoiceSelection.clear();
  showToast(ids.length + ' facture(s) marquees payees');
  loadInvoices();
}

function clearInvoiceSelection() { _invoiceSelection.clear(); renderInvoicesView(); }

function toggleInvoiceCompact() {
  _invoiceCompactMode = !_invoiceCompactMode;
  localStorage.setItem('mm_invoice_compact', _invoiceCompactMode ? '1' : '0');
  renderInvoicesView();
}

function setInvoiceClientFilter(v) { _invoiceClientFilter = v || ''; renderInvoicesView(); }
function setInvoiceSort(v) { _invoiceSort = v || 'date_desc'; renderInvoicesView(); }

async function ensureInvoiceNumber(inv) {
  if (inv.invoice_number) return inv;
  // Generate: FAC-YYYY-NNN (sequential within org)
  const org = API.getOrg();
  if (!org) return inv;
  const yr = new Date(inv.created_at || Date.now()).getFullYear();
  const { count } = await sb.from('invoices').select('*', { count: 'exact', head: true }).eq('org_id', org.id).not('invoice_number','is',null);
  const num = String((count || 0) + 1).padStart(3, '0');
  const generated = 'FAC-' + yr + '-' + num;
  await sb.from('invoices').update({ invoice_number: generated }).eq('id', inv.id);
  inv.invoice_number = generated;
  return inv;
}

async function downloadInvoicePDF(invoiceId) {
  try {
  const org = API.getOrg();
  let { data: inv, error: invErr } = await sb.from('invoices').select('*').eq('id', invoiceId).single();
  if (!inv) return showToast('Facture introuvable');
  inv = await ensureInvoiceNumber(inv);

  await loadPDF();
  if (!window.jspdf) return showToast('Erreur chargement librairie PDF');
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  const pageW = doc.internal.pageSize.getWidth();
  let y = 20;

  // Header - Issuer
  doc.setFontSize(18);
  doc.setFont(undefined, 'bold');
  doc.text(inv.issuer_name || 'Lokizio', 14, y);
  doc.setFontSize(9);
  doc.setFont(undefined, 'normal');
  y += 6;
  if (inv.issuer_address) { doc.text(inv.issuer_address, 14, y); y += 4; }
  if (inv.issuer_siret) { doc.text('SIRET: ' + inv.issuer_siret, 14, y); y += 4; }
  if (inv.issuer_vat_number) { doc.text('TVA: ' + inv.issuer_vat_number, 14, y); y += 4; }
  if (inv.issuer_email) { doc.text('Email: ' + inv.issuer_email, 14, y); y += 4; }

  // Invoice title + number (right aligned)
  doc.setFontSize(22);
  doc.setFont(undefined, 'bold');
  doc.setTextColor(108, 99, 255);
  doc.text('FACTURE', pageW - 14, 20, { align: 'right' });
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(11);
  doc.text(inv.invoice_number || 'Facture', pageW - 14, 28, { align: 'right' });
  doc.setFontSize(9);
  doc.setFont(undefined, 'normal');
  doc.text('Date: ' + new Date(inv.created_at).toLocaleDateString('fr-FR'), pageW - 14, 34, { align: 'right' });
  if (inv.due_date) doc.text('Echeance: ' + new Date(inv.due_date).toLocaleDateString('fr-FR'), pageW - 14, 39, { align: 'right' });
  if (inv.period_start && inv.period_end) {
    doc.text('Periode: ' + new Date(inv.period_start).toLocaleDateString('fr-FR') + ' - ' + new Date(inv.period_end).toLocaleDateString('fr-FR'), pageW - 14, 44, { align: 'right' });
  }

  // Client box
  y = Math.max(y + 8, 55);
  doc.setFillColor(245, 245, 250);
  doc.rect(pageW / 2 + 10, y - 4, pageW / 2 - 24, 24, 'F');
  doc.setFontSize(9);
  doc.setFont(undefined, 'bold');
  doc.text('FACTURER A:', pageW / 2 + 14, y);
  doc.setFont(undefined, 'normal');
  y += 5;
  doc.text(inv.client_name || '', pageW / 2 + 14, y);
  if (inv.client_address) { y += 4; doc.text(inv.client_address, pageW / 2 + 14, y); }
  if (inv.client_siret) { y += 4; doc.text('SIRET: ' + inv.client_siret, pageW / 2 + 14, y); }

  // Property
  y += 14;
  if (inv.property_name) {
    doc.setFontSize(10);
    doc.text('Propriete: ' + inv.property_name, 14, y);
    y += 8;
  }

  // Items table header
  y += 4;
  doc.setFillColor(108, 99, 255);
  doc.rect(14, y - 4, pageW - 28, 8, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(9);
  doc.setFont(undefined, 'bold');
  doc.text('Description', 16, y);
  doc.text('Qte', pageW - 80, y, { align: 'right' });
  doc.text('P.U. HT', pageW - 55, y, { align: 'right' });
  doc.text('Total HT', pageW - 16, y, { align: 'right' });
  doc.setTextColor(0, 0, 0);
  doc.setFont(undefined, 'normal');
  y += 8;

  // Items
  const items = inv.items || [];
  items.forEach((item, i) => {
    if (i % 2 === 0) { doc.setFillColor(248, 248, 252); doc.rect(14, y - 4, pageW - 28, 7, 'F'); }
    doc.text(String(item.description || ''), 16, y);
    doc.text(String(item.quantity || 1), pageW - 80, y, { align: 'right' });
    doc.text((item.unit_price || 0).toFixed(2) + ' EUR', pageW - 55, y, { align: 'right' });
    doc.text(((item.quantity || 1) * (item.unit_price || 0)).toFixed(2) + ' EUR', pageW - 16, y, { align: 'right' });
    y += 7;
  });

  // Totals
  y += 6;
  doc.setDrawColor(200, 200, 210);
  doc.line(pageW - 90, y, pageW - 14, y);
  y += 6;
  doc.setFontSize(10);
  doc.text('Sous-total HT:', pageW - 90, y);
  doc.text((inv.subtotal_ht || 0).toFixed(2) + ' EUR', pageW - 16, y, { align: 'right' });
  y += 6;
  if (inv.vat_rate > 0) {
    doc.text('TVA ' + inv.vat_rate + '%:', pageW - 90, y);
    doc.text((inv.vat_amount || 0).toFixed(2) + ' EUR', pageW - 16, y, { align: 'right' });
  } else {
    doc.setFontSize(8);
    doc.text(t('invoice.vat.exempt_notice'), pageW - 90, y);
    doc.setFontSize(10);
  }
  y += 8;
  doc.setFillColor(108, 99, 255);
  doc.rect(pageW - 92, y - 5, 78, 10, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont(undefined, 'bold');
  doc.setFontSize(11);
  doc.text('TOTAL TTC:', pageW - 88, y);
  doc.text((inv.total_ttc || 0).toFixed(2) + ' EUR', pageW - 16, y, { align: 'right' });
  doc.setTextColor(0, 0, 0);

  // Payment terms + legal
  y += 16;
  doc.setFontSize(8);
  doc.setFont(undefined, 'normal');
  doc.text('Conditions de paiement: ' + (inv.payment_terms || 'A reception'), 14, y);
  y += 4;
  doc.text('En cas de retard de paiement, une penalite de 3x le taux d\'interet legal sera appliquee.', 14, y);
  y += 4;
  doc.text('Indemnite forfaitaire pour frais de recouvrement: 40,00 EUR.', 14, y);
  if (inv.notes) { y += 6; doc.text('Notes: ' + inv.notes, 14, y); }

  // Footer
  const pageH = doc.internal.pageSize.getHeight();
  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  doc.text('Facture generee par Lokizio - fabienlacaze.github.io/lokizio', 14, pageH - 8);
  doc.text((inv.invoice_number || 'Facture') + ' - Page 1/1', pageW - 14, pageH - 8, { align: 'right' });

  doc.save((inv.invoice_number || 'Facture') + '.pdf');
  } catch(e) { console.error('downloadInvoicePDF error:', e); showToast('Erreur generation PDF: ' + (e.message || 'Verifiez votre connexion')); }
}

// ── Exports ──
window.loadInvoices = loadInvoices;
window.renderInvoicesView = renderInvoicesView;
window._renderInvoiceCard = _renderInvoiceCard;
window.sendInvoiceReminder = sendInvoiceReminder;
window.showInvoiceDetail = showInvoiceDetail;
window.showInvoiceFullView = showInvoiceFullView;
window.showInvoicePrestationDetail = showInvoicePrestationDetail;
window.updateInvoiceStatus = updateInvoiceStatus;
window.notifyInvoiceStatus = notifyInvoiceStatus;
window.deleteInvoice = deleteInvoice;
window.sendInvoiceByEmail = sendInvoiceByEmail;
window._buildInvoiceEmailHtml = _buildInvoiceEmailHtml;
window.confirmSendInvoiceEmail = confirmSendInvoiceEmail;
window.duplicateInvoice = duplicateInvoice;
window.toggleInvoiceSelect = toggleInvoiceSelect;
window.bulkMarkPaid = bulkMarkPaid;
window.clearInvoiceSelection = clearInvoiceSelection;
window.toggleInvoiceCompact = toggleInvoiceCompact;
window.setInvoiceClientFilter = setInvoiceClientFilter;
window.setInvoiceSort = setInvoiceSort;
window.ensureInvoiceNumber = ensureInvoiceNumber;
window.downloadInvoicePDF = downloadInvoicePDF;
