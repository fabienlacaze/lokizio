// Admin prestations module — load + filter the prestations list (concierge)
// Depends on: sb, API, esc, fmtDate, showToast, customConfirm,
//   getServiceLabel, getServiceIcon, getStatusHint, getStatusLabel,
//   getStatusColor, showMsg, closeMsg
// Exposes: loadAdminPrestations, filterAdminPrestActor, goToProviderPrestations,
//   filterAdminPrest, filterAdminPrestStatus, applyAdminPrestFilters, toggleAdminHidePast

async function loadAdminPrestations(forceReload) {
  try {
  const org = API.getOrg();
  if (!org) return;
  const filtersEl = document.getElementById('adminPrestFilters');
  const listEl = document.getElementById('adminPrestList');
  if (!listEl) return;

  let props, plannings, svcRequests, validations, propMap;
  const now = Date.now();

  // Use cache if available and less than 30s old
  if (!forceReload && _adminPrestCache && (now - _adminPrestCacheTime) < 30000) {
    props = _adminPrestCache.props;
    plannings = _adminPrestCache.plannings;
    svcRequests = _adminPrestCache.svcRequests;
    validations = _adminPrestCache.validations;
    propMap = _adminPrestCache.propMap;
  } else {
    // Load all properties
    const { data: properties } = await sb.from('properties').select('*').eq('org_id', org.id);
    props = properties || [];
    propMap = {};
    props.forEach(p => { propMap[p.id] = p; });

    // Load all plannings (cleanings)
    const propIds = props.map(p => p.id);
    const { data: planData } = propIds.length ? await sb.from('plannings').select('cleanings,property_id').in('property_id', propIds) : { data: [] };
    plannings = planData;
    const today = new Date().toISOString().split('T')[0];

    // Load service requests
    const { data: svcData } = await sb.from('service_requests').select('*').eq('org_id', org.id).order('created_at', { ascending: false }).limit(100);
    svcRequests = svcData || [];

    // Load all validations in a single query instead of N+1
    validations = {};
    if (propIds.length) {
      const { data: vals } = await sb.from('cleaning_validations').select('*').in('property_id', propIds);
      if (vals) vals.forEach(v => { validations[v.property_id + '_' + v.cleaning_date + '_' + v.provider_name] = v; });
    }

    _adminPrestCache = { props, plannings, svcRequests, validations, propMap };
    _adminPrestCacheTime = now;
  }

  const today = new Date().toISOString().split('T')[0];

  // Build unified array (filtered by property if selected)
  const filterProp = _filterPropertyId;
  const unified = [];
  (plannings || []).forEach(plan => {
    const prop = propMap[plan.property_id];
    if (!plan.cleanings || !prop) return;
    if (filterProp && prop.id !== filterProp) return;
    plan.cleanings.forEach(c => {
      const dateStr = c.cleaningDate || c.date;
      const vKey = prop.id + '_' + dateStr + '_' + (c.provider || '');
      const v = validations[vKey];
      unified.push({
        _source: 'cleaning',
        type: 'cleaning_standard',
        date: dateStr,
        propertyName: prop.name,
        propertyId: prop.id,
        provider: c.provider || '',
        status: v ? v.status : (c._status || 'pending'),
        source: c.source || '',
        dayName: c.dayName || '',
      });
    });
  });
  svcRequests.forEach(r => {
    if (filterProp && r.property_id !== filterProp) return;
    const prop = propMap[r.property_id];
    unified.push({
      _source: 'service_request',
      _id: r.id,
      type: r.service_type || 'cleaning_standard',
      date: r.requested_date || r.preferred_date || '',
      propertyName: prop ? prop.name : (r.property_name || ''),
      propertyId: r.property_id,
      provider: r.assigned_provider || '',
      status: r.status,
      priority: r.priority,
      description: r.description || r.notes || '',
      cancel_reason: r.cancel_reason || '',
      cancel_penalty_amount: r.cancel_penalty_amount || 0,
    });
  });
  unified.sort((a, b) => (a.date || '').localeCompare(b.date || ''));

  // Count by category
  const counts = { all: unified.length };
  unified.forEach(u => {
    const catObj = SERVICE_CATALOG.find(c => c.services.some(s => s.id === u.type));
    const cat = catObj ? catObj.cat : 'autre';
    counts[cat] = (counts[cat] || 0) + 1;
  });

  // Cache unified for status recount when category changes
  window._adminUnified = unified;

  // Collect unique providers and owners (property names as proxy for owner)
  const provSet = new Set();
  const ownerSet = new Set(); // property names (each property represents an owner context)
  unified.forEach(u => {
    if (u.provider) provSet.add(u.provider);
    if (u.propertyName) ownerSet.add(u.propertyName);
  });
  const providersList = Array.from(provSet).sort();
  const ownersList = Array.from(ownerSet).sort();

  // Render filters (order: Categories → Actors → Status → Hide past)
  if (filtersEl) {
    let fHtml = '';
    fHtml += '<div id="adminPrestCatRow" style="display:flex;gap:6px;overflow-x:auto;padding-bottom:6px;margin-bottom:4px;-webkit-overflow-scrolling:touch;align-items:center;"></div>';
    fHtml += '<div id="adminPrestActorRow" style="display:flex;gap:6px;overflow-x:auto;padding-bottom:6px;margin-bottom:4px;-webkit-overflow-scrolling:touch;align-items:center;"></div>';
    fHtml += '<div id="adminPrestStatusRow" style="display:flex;gap:6px;overflow-x:auto;padding-bottom:6px;margin-bottom:4px;-webkit-overflow-scrolling:touch;align-items:center;"></div>';
    if (window._adminHidePast === undefined) window._adminHidePast = true;
    const hidePastActive = !!window._adminHidePast;
    fHtml += '<div style="display:flex;padding-bottom:8px;margin-bottom:8px;">';
    fHtml += '<button id="togglePastBtn" class="prestFilter' + (hidePastActive ? ' active' : '') + '" onclick="toggleAdminHidePast(this)" title="Masquer/afficher les prestations passees" style="white-space:nowrap;">' + (hidePastActive ? '&#128065; Afficher passees' : '&#128065;&#65039; Masquer passees') + '</button>';
    fHtml += '</div>';
    filtersEl.innerHTML = fHtml;
    renderCatFilterRow();
    renderActorFilterRow();
    renderStatusFilterRow();
  }

  // Update nav badge
  const pendingCount = unified.filter(u => u.status === 'pending').length;
  const navBadge = document.querySelector('#nav_prestations .nav-badge');
  if (navBadge) {
    if (pendingCount > 0) { navBadge.textContent = pendingCount; navBadge.style.display = 'flex'; }
    else { navBadge.style.display = 'none'; }
  }

  // Render list
  if (unified.length === 0) {
    listEl.innerHTML = '<div style="text-align:center;padding:30px;color:var(--text3);font-size:13px;">Aucune prestation</div>';
    return;
  }

  const providers = props.length ? (props[0].providers || []) : [];
  let html = '';
  const months = ['Jan','Fev','Mar','Avr','Mai','Jun','Jul','Aou','Sep','Oct','Nov','Dec'];
  const monthsFull = ['Janvier','Fevrier','Mars','Avril','Mai','Juin','Juillet','Aout','Septembre','Octobre','Novembre','Decembre'];
  const days = ['Dim','Lun','Mar','Mer','Jeu','Ven','Sam'];
  let lastMonthGroup = '';
  unified.forEach(u => {
    // Month group separator (collapsible)
    if (u.date) {
      const monthKey = u.date.substring(0, 7); // YYYY-MM
      if (monthKey !== lastMonthGroup) {
        if (lastMonthGroup !== '') html += '</details>';
        lastMonthGroup = monthKey;
        const gd = new Date(u.date + 'T12:00:00');
        const monthLabel = monthsFull[gd.getMonth()] + ' ' + gd.getFullYear();
        html += '<details open style="margin-bottom:8px;"><summary style="list-style:none;cursor:pointer;display:flex;align-items:center;gap:8px;padding:10px 4px;font-size:13px;font-weight:700;color:var(--text2);text-transform:capitalize;border-bottom:1px solid var(--border);"><span class="collapseArrow">&#9662;</span>' + monthLabel + '</summary>';
      }
    }
    const catObj = SERVICE_CATALOG.find(c => c.services.some(s => s.id === u.type));
    const cat = catObj ? catObj.cat : 'autre';
    const color = getStatusColor(u.status);
    const label = getStatusLabel(u.status) || u.status;
    const svcObj = (catObj ? catObj.services : []).find(s => s.id === u.type);
    const svcName = svcObj ? svcObj.label : u.type;
    const svcIcon = svcObj ? svcObj.icon : '📋';
    const isToday = u.date === today;

    // Parse date for calendar block
    let dayNum = '', monthStr = '', dowStr = '';
    if (u.date) {
      const d = new Date(u.date + 'T12:00:00');
      dayNum = d.getDate();
      monthStr = months[d.getMonth()];
      dowStr = days[d.getDay()];
    }

    // Pre-compute actions for pending status (inline in card).
    // Now also covers iCal-derived cleanings without a provider.
    let pendingProviders = null;
    const _isPendingNoProv = (!u.provider || u.provider.trim() === '')
      && ['pending', 'assigned'].includes(u.status);
    if (_isPendingNoProv) {
      pendingProviders = [];
      props.forEach(p => { (p.providers || []).forEach(pv => { if (!pendingProviders.find(x => x.name === pv.name)) pendingProviders.push(pv); }); });
    }
    const cancellable = u._source === 'service_request' && !['done', 'departed', 'in_progress', 'cancelled'].includes(u.status);
    const cancelPrice = getServicePriceForDate(u.propertyId || '', u.type || 'cleaning_standard', 'price_owner', u.date || '');

    const prestPayload = encodeURIComponent(JSON.stringify({
      _source: u._source, _id: u._id || '', type: u.type, date: u.date, propertyName: u.propertyName,
      propertyId: u.propertyId, provider: u.provider, status: u.status, source: u.source,
      priority: u.priority, description: u.description, cancel_reason: u.cancel_reason,
      cancel_penalty_amount: u.cancel_penalty_amount
    }));
    const isPast = u.date && u.date < today;
    const pastStyle = isPast ? 'opacity:0.5;filter:grayscale(0.6);position:relative;' : '';
    // CRITICAL: prestation upcoming/today without any assigned provider.
    // Applies to BOTH iCal-derived cleanings (_source='cleaning') and
    // service requests (_source='service_request') in pending state.
    const _provStr = (u.provider || '').trim();
    const noProvider = !isPast
      && _provStr === ''
      && ['pending', 'pending_validation', 'assigned'].includes(u.status);
    const cardClass = 'adminPrestCard' + (noProvider ? ' prestNoProvider' : '');
    const cardTitle = noProvider ? 'PRESTATAIRE NON ASSIGNE - Action requise' : (isPast ? 'Date passee' : '');
    html += '<div class="' + cardClass + '" data-category="' + cat + '" data-status="' + u.status + '" data-date="' + (u.date||'') + '" data-type="' + (u.type||'') + '" data-provider="' + esc(u.provider||'') + '" data-owner="' + esc(u.propertyName||'') + '" onclick="showPrestationDetail(\'' + prestPayload + '\', event)" style="border-left:4px solid ' + (noProvider ? '#ef4444' : color) + ';cursor:pointer;' + pastStyle + (isToday ? 'box-shadow:0 0 0 1px rgba(233,69,96,0.3);' : '') + '" title="' + cardTitle + '">';
    if (isPast) html += '<div style="position:absolute;top:4px;right:8px;font-size:9px;color:var(--text3);font-style:italic;letter-spacing:0.3px;pointer-events:none;">&#128197; Date passee</div>';
    html += '<div style="display:flex;align-items:stretch;gap:0;padding:0;">';
    // Date block
    if (dayNum) {
      html += '<div class="card-date-block">';
      html += '<div class="card-dow">' + dowStr + '</div>';
      html += '<div class="card-day">' + dayNum + '</div>';
      html += '<div class="card-month">' + monthStr + '</div>';
      html += '</div>';
    }
    // Service icon
    html += '<div style="display:flex;align-items:center;padding:0 8px;font-size:26px;flex-shrink:0;">' + svcIcon + '</div>';
    // Info
    html += '<div style="flex:1;min-width:0;padding:10px 8px 10px 0;">';
    html += '<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">';
    html += '<span style="font-size:14px;font-weight:700;color:var(--text);">' + esc(svcName) + '</span>';
    if (u.source) html += '<span style="font-size:9px;padding:1px 5px;border-radius:3px;background:' + (u.source.toLowerCase().includes('airbnb') ? '#e9456030' : '#2563eb30') + ';color:' + (u.source.toLowerCase().includes('airbnb') ? '#e94560' : '#2563eb') + ';font-weight:700;">' + esc(u.source).toUpperCase() + '</span>';
    if (u.priority === 'high') html += '<span style="font-size:9px;padding:1px 5px;border-radius:3px;background:#ef444420;color:#ef4444;font-weight:700;animation:pulse 1.5s ease-in-out infinite;">URGENT</span>';
    html += '</div>';
    html += '<div style="font-size:11px;color:var(--text3);margin-top:3px;display:flex;align-items:center;gap:6px;flex-wrap:wrap;">';
    const metaParts = [];
    if (u.propertyName) metaParts.push('&#127968; ' + esc(u.propertyName));
    if (u.provider) metaParts.push('&#128100; ' + esc(u.provider));
    html += metaParts.join(' &middot; ');
    if (noProvider) {
      html += '<span class="prestNoProvider-badge">&#9888;&#65039; Aucun prestataire</span>';
    }
    html += '</div>';
    if (u.description) html += '<div style="font-size:10px;color:var(--text3);margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + esc(u.description) + '</div>';
    html += '</div>';
    // Right side: assign button (single popup) + status + actions
    html += '<div style="display:flex;align-items:center;gap:6px;flex-shrink:0;">';
    if (pendingProviders) {
      const _id = u._id || '';
      const _date = (u.date || '').replace(/'/g, '');
      const _svc = (u.type || '').replace(/'/g, '');
      const _prop = esc(u.propertyName || '').replace(/'/g, "\\'");
      html += '<button class="prestSendBtn" onclick="event.stopPropagation();showAssignProviderPopup(\'' + _id + '\',\'' + _date + '\',\'' + _svc + '\',\'' + _prop + '\')" style="padding:5px 11px;font-size:11px;border:none;border-radius:5px;cursor:pointer;">&#128100; Selectionner prestataire</button>';
      // More actions menu
      html += '<div style="position:relative;display:inline-block;">';
      html += '<button onclick="this.nextElementSibling.style.display=this.nextElementSibling.style.display===\'block\'?\'none\':\'block\'" style="padding:3px 6px;font-size:12px;border:none;border-radius:4px;cursor:pointer;background:transparent;color:var(--text3);" title="Plus d\'actions">&#8942;</button>';
      html += '<div style="display:none;position:absolute;right:0;top:100%;background:var(--surface);border:1px solid var(--border2);border-radius:8px;box-shadow:0 8px 24px rgba(0,0,0,0.4);z-index:100;min-width:140px;overflow:hidden;">';
      html += '<div onclick="updateServiceRequest(\'' + u._id + '\',\'refused\');setTimeout(()=>loadAdminPrestations(true),500)" style="padding:8px 14px;font-size:11px;color:#ef4444;cursor:pointer;border-bottom:1px solid var(--border);" onmouseover="this.style.background=\'rgba(255,255,255,0.05)\'" onmouseout="this.style.background=\'\'">&#10007; Refuser</div>';
      html += '<div onclick="showCancelModal(\'' + u._id + '\',\'' + (u.date || '') + '\',\'' + esc(svcName).replace(/'/g,"\\'") + '\',' + cancelPrice + ')" style="padding:8px 14px;font-size:11px;color:var(--text3);cursor:pointer;" onmouseover="this.style.background=\'rgba(255,255,255,0.05)\'" onmouseout="this.style.background=\'\'">&#128465; Annuler</div>';
      html += '</div></div>';
    } else if (u.status === 'pending_validation' && u._source === 'service_request') {
      html += '<button style="padding:4px 12px;font-size:10px;font-weight:700;border:none;border-radius:5px;cursor:pointer;background:rgba(52,211,153,0.2);color:#34d399;" onclick="adminValidateService(\'' + u._id + '\',\'done\')">&#10003; Valider</button>';
    } else if (u.status === 'disputed' && u._source === 'service_request') {
      html += '<span class="card-status" style="background:#dc262618;color:#dc2626;cursor:help;" title="' + t('admin.prestation.disputed') + '">&#9888; Contestee</span>';
      html += '<button style="padding:4px 8px;font-size:10px;border:none;border-radius:5px;cursor:pointer;background:rgba(108,99,255,0.2);color:#6c63ff;" onclick="adminValidateService(\'' + u._id + '\',\'in_progress\')">&#128260; Reprendre</button>';
      html += '<button style="padding:4px 8px;font-size:10px;border:none;border-radius:5px;cursor:pointer;background:rgba(220,38,38,0.2);color:#dc2626;" onclick="adminValidateService(\'' + u._id + '\',\'cancelled\')">&#128683; Annuler</button>';
    } else {
      html += '<span class="card-status" title="' + (getStatusHint(u.status)||'') + '" style="background:' + color + '18;color:' + color + ';cursor:help;">' + label + '</span>';
      if (u.status === 'done' && u._source === 'service_request' && u.provider) {
        html += '<a href="#" onclick="showRatingModal(\'' + u._id + '\',\'' + esc(u.provider).replace(/'/g,"\\'") + '\');return false;" style="font-size:10px;color:#f59e0b;text-decoration:none;padding:2px;" title="Noter">&#11088;</a>';
      }
      if (cancellable && u.status !== 'pending') {
        html += '<a href="#" onclick="showCancelModal(\'' + u._id + '\',\'' + (u.date || '') + '\',\'' + esc(svcName).replace(/'/g,"\\'") + '\',' + cancelPrice + ');return false;" style="font-size:10px;color:var(--text3);text-decoration:none;padding:2px;" title="Annuler">&#128465;</a>';
      }
    }
    html += '</div>';
    html += '</div>';

    // Action footer for refused (reassign) or cancelled info
    if (u._source === 'service_request') {
      if (u.status === 'refused') {
        let allProviders = [];
        props.forEach(p => { (p.providers || []).forEach(pv => { if (!allProviders.find(x => x.name === pv.name)) allProviders.push(pv); }); });
        html += '<div class="card-actions">';
        html += '<select id="svcReassign_' + u._id + '" style="flex:1;padding:6px 8px;background:var(--surface2);color:var(--text);border:1px solid var(--border2);border-radius:6px;font-size:11px;min-width:0;">';
        html += '<option value="">Reassigner a...</option>';
        allProviders.forEach(p => { html += '<option value="' + esc(p.name) + '">' + esc(p.name) + '</option>'; });
        html += '</select>';
        html += '<button class="btn btnSmall" style="padding:5px 12px;font-size:11px;background:#8b5cf6;color:#fff;" onclick="updateServiceRequest(\'' + u._id + '\',\'assigned\',document.getElementById(\'svcReassign_' + u._id + '\').value);setTimeout(()=>loadAdminPrestations(true),500)">Reassigner</button>';
        html += '</div>';
      } else if (u.status === 'cancelled') {
        html += '<div style="padding:6px 14px 8px;font-size:11px;color:#ef4444;">';
        html += '&#10006; Annulee' + (u.cancel_reason ? ' — ' + esc(u.cancel_reason) : '');
        if (u.cancel_penalty_amount > 0) html += ' (frais: ' + u.cancel_penalty_amount.toFixed(2) + '€)';
        html += '</div>';
      }
    }
    html += '</div>'; // adminPrestCard
  });
  if (lastMonthGroup !== '') html += '</details>'; // close last month group
  listEl.innerHTML = html;
  // Apply filters (hide past by default) after initial render
  applyAdminPrestFilters();
  } catch(err) { console.error('loadAdminPrestations error:', err); showToast('Erreur chargement prestations: ' + (err.message || 'Probleme de connexion')); }
}

let _adminPrestFilterCat = 'all';
let _adminPrestFilterStatus = 'all';
let _adminPrestFilterActor = { type: 'all', value: '' };

function filterAdminPrestActor(type, value) {
  _adminPrestFilterActor = { type, value: value || '' };
  renderActorFilterRow();
  applyAdminPrestFilters();
}

function goToProviderPrestations(providerName) {
  _adminPrestFilterActor = { type: 'provider', value: providerName };
  // Make sure past prestations are visible so user sees full history
  window._adminHidePast = false;
  if (typeof switchMainTab === 'function') switchMainTab('prestations');
  if (typeof switchPrestSubTab === 'function') switchPrestSubTab('list');
  setTimeout(() => loadAdminPrestations(true), 150);
}

function filterAdminPrest(cat, btn) {
  _adminPrestFilterCat = cat;
  // Don't reset others — recompute will hide incompatible ones
  renderCatFilterRow();
  renderActorFilterRow();
  renderStatusFilterRow();
  applyAdminPrestFilters();
}

function _catOf(u) { const co = SERVICE_CATALOG.find(c => c.services.some(s => s.id === u.type)); return co ? co.cat : 'autre'; }

function _matchActor(u, actor) {
  if (!actor || actor.type === 'all') return true;
  if (actor.type === 'provider') return (u.provider || '') === actor.value;
  if (actor.type === 'owner') return (u.propertyName || '') === actor.value;
  return true;
}

function renderCatFilterRow() {
  const row = document.getElementById('adminPrestCatRow');
  if (!row) return;
  const unified = window._adminUnified || [];
  // Scope: apply active actor + status (upstream filters not relevant for category = top)
  const scope = unified.filter(u => {
    if (!_matchActor(u, _adminPrestFilterActor)) return false;
    if (_adminPrestFilterStatus !== 'all' && u.status !== _adminPrestFilterStatus) return false;
    return true;
  });
  const counts = { all: scope.length };
  scope.forEach(u => { const c = _catOf(u); counts[c] = (counts[c] || 0) + 1; });
  let h = '';
  h += '<button class="prestFilter' + (_adminPrestFilterCat === 'all' ? ' active' : '') + '" onclick="filterAdminPrest(\'all\')">Tout ' + counts.all + '</button>';
  SERVICE_CATALOG.forEach(cat => {
    const n = counts[cat.cat] || 0;
    if (n === 0 && _adminPrestFilterCat !== cat.cat) return;
    const act = (_adminPrestFilterCat === cat.cat) ? ' active' : '';
    h += '<button class="prestFilter' + act + '" onclick="filterAdminPrest(\'' + cat.cat + '\')">' + cat.services[0].icon + ' ' + n + '</button>';
  });
  row.innerHTML = h;
}

function renderActorFilterRow() {
  const row = document.getElementById('adminPrestActorRow');
  if (!row) return;
  const unified = window._adminUnified || [];
  // Scope: apply active category + status (not the actor itself, so user can switch)
  const scope = unified.filter(u => {
    if (_adminPrestFilterCat !== 'all' && _catOf(u) !== _adminPrestFilterCat) return false;
    if (_adminPrestFilterStatus !== 'all' && u.status !== _adminPrestFilterStatus) return false;
    return true;
  });
  const provCounts = {};
  const ownerCounts = {};
  scope.forEach(u => {
    if (u.provider) provCounts[u.provider] = (provCounts[u.provider] || 0) + 1;
    if (u.propertyName) ownerCounts[u.propertyName] = (ownerCounts[u.propertyName] || 0) + 1;
  });
  const provs = Object.keys(provCounts).sort();
  const owners = Object.keys(ownerCounts).sort();
  const actor = _adminPrestFilterActor || { type: 'all', value: '' };
  let h = '';
  const actAll = (actor.type === 'all') ? ' active' : '';
  h += '<button class="prestFilter' + actAll + '" onclick="filterAdminPrestActor(\'all\',\'\')">&#128101; Tous</button>';
  provs.forEach(name => {
    const a = (actor.type === 'provider' && actor.value === name) ? ' active' : '';
    const safeName = JSON.stringify(name);
    h += '<button class="prestFilter' + a + '" onclick=\'filterAdminPrestActor("provider",' + safeName + ')\' title="Prestataire" style="border-color:#34d39960;color:#34d399;">&#129529; ' + esc(name) + ' (' + provCounts[name] + ')</button>';
  });
  owners.forEach(name => {
    const a = (actor.type === 'owner' && actor.value === name) ? ' active' : '';
    const safeName = JSON.stringify(name);
    h += '<button class="prestFilter' + a + '" onclick=\'filterAdminPrestActor("owner",' + safeName + ')\' title="Bien / proprietaire" style="border-color:#f59e0b60;color:#f59e0b;">&#127968; ' + esc(name) + ' (' + ownerCounts[name] + ')</button>';
  });
  row.innerHTML = h;
}

function renderStatusFilterRow() {
  const row = document.getElementById('adminPrestStatusRow');
  if (!row) return;
  const unified = window._adminUnified || [];
  const cat = _adminPrestFilterCat;
  // Filter unified by active category
  const scope = unified.filter(u => {
    if (cat === 'all') return true;
    const catObj = SERVICE_CATALOG.find(c => c.services.some(s => s.id === u.type));
    const cc = catObj ? catObj.cat : 'autre';
    return cc === cat;
  });
  const statusCounts = {};
  scope.forEach(u => { statusCounts[u.status] = (statusCounts[u.status] || 0) + 1; });
  const statusDefs = [
    { id: 'pending', label: 'Attente', color: '#f59e0b' },
    { id: 'assigned', label: 'Attente reponse', color: '#8b5cf6' },
    { id: 'accepted', label: 'Accepte', color: '#34d399' },
    { id: 'in_progress', label: 'En cours', color: '#3b82f6' },
    { id: 'done', label: 'Termine', color: '#059669' },
    { id: 'refused', label: 'Refuse', color: '#ef4444' },
    { id: 'pending_validation', label: 'A valider', color: '#f59e0b' },
    { id: 'cancelled', label: 'Annulee', color: '#ef4444' },
  ];
  let h = '';
  const statusAllActive = (_adminPrestFilterStatus === 'all');
  h += '<button class="prestFilter' + (statusAllActive ? ' active' : '') + '" data-filter-type="status" onclick="filterAdminPrestStatus(\'all\',this)">Tout (' + scope.length + ')</button>';
  statusDefs.forEach(s => {
    if (statusCounts[s.id]) {
      const act = (_adminPrestFilterStatus === s.id) ? ' active' : '';
      h += '<button class="prestFilter' + act + '" data-filter-type="status" onclick="filterAdminPrestStatus(\'' + s.id + '\',this)" style="border-color:' + s.color + '40;color:' + s.color + ';">' + s.label + ' (' + statusCounts[s.id] + ')</button>';
    }
  });
  row.innerHTML = h;
}

function filterAdminPrestStatus(status, btn) {
  _adminPrestFilterStatus = status;
  _adminPrestFilterActor = { type: 'all', value: '' };
  document.querySelectorAll('#adminPrestFilters .prestFilter[data-filter-type="status"]').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  renderActorFilterRow();
  applyAdminPrestFilters();
}

function applyAdminPrestFilters() {
  const todayStr = new Date().toISOString().split('T')[0];
  const hidePast = !!window._adminHidePast;
  const actor = _adminPrestFilterActor || { type: 'all', value: '' };
  document.querySelectorAll('.adminPrestCard').forEach(card => {
    const catMatch = _adminPrestFilterCat === 'all' || card.dataset.category === _adminPrestFilterCat;
    const statusMatch = _adminPrestFilterStatus === 'all' || card.dataset.status === _adminPrestFilterStatus;
    const cardDate = card.dataset.date || '';
    const pastMatch = !hidePast || !cardDate || cardDate >= todayStr;
    let actorMatch = true;
    if (actor.type === 'provider') actorMatch = (card.dataset.provider || '') === actor.value;
    else if (actor.type === 'owner') actorMatch = (card.dataset.owner || '') === actor.value;
    card.style.display = (catMatch && statusMatch && pastMatch && actorMatch) ? '' : 'none';
  });
  // Also hide month-group <details> that have no visible cards
  document.querySelectorAll('#adminPrestList details').forEach(det => {
    const anyVisible = Array.from(det.querySelectorAll('.adminPrestCard')).some(c => c.style.display !== 'none');
    det.style.display = anyVisible ? '' : 'none';
  });
}

function toggleAdminHidePast(btn) {
  window._adminHidePast = !window._adminHidePast;
  if (btn) {
    btn.classList.toggle('active', window._adminHidePast);
    btn.innerHTML = window._adminHidePast ? '&#128065; Afficher passees' : '&#128065;&#65039; Masquer passees';
  }
  applyAdminPrestFilters();
}

window.loadAdminPrestations = loadAdminPrestations;
window.filterAdminPrestActor = filterAdminPrestActor;
window.goToProviderPrestations = goToProviderPrestations;
window.filterAdminPrest = filterAdminPrest;
window.filterAdminPrestStatus = filterAdminPrestStatus;
window.applyAdminPrestFilters = applyAdminPrestFilters;
window.toggleAdminHidePast = toggleAdminHidePast;

// Open a unified popup to either pick an existing provider OR broadcast
// the request to the public marketplace. Replaces the old inline
// 'Assigner...' select + separate broadcast button.
async function showAssignProviderPopup(reqId, dateStr, svcType, propertyName) {
  const org = (typeof API !== 'undefined' && API.getOrg) ? API.getOrg() : null;
  if (!org) { showToast('Organisation introuvable'); return; }

  // Fetch providers of the org (members table)
  const { data: members } = await sb.from('members')
    .select('user_id, display_name, invited_email, role')
    .eq('org_id', org.id)
    .eq('role', 'provider')
    .eq('accepted', true);
  const orgProviders = members || [];

  // Build the popup
  const overlay = document.createElement('div');
  overlay.id = 'assignProviderOverlay';
  overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.7);z-index:99999;display:flex;align-items:center;justify-content:center;padding:20px;';
  overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };

  const svcLabel = (typeof getServiceLabel === 'function') ? getServiceLabel(svcType) : svcType;
  const dateLabel = dateStr ? new Date(dateStr + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }) : '';

  let html = '<div style="max-width:480px;width:100%;background:var(--surface);border-radius:16px;border:1px solid var(--border);max-height:92vh;display:flex;flex-direction:column;box-shadow:0 20px 40px rgba(0,0,0,0.5);">';

  // ── Header ──
  html += '<div style="display:flex;justify-content:space-between;align-items:center;padding:18px 20px 14px;">';
  html += '<div style="display:flex;align-items:center;gap:10px;">';
  html += '<span style="width:34px;height:34px;border-radius:50%;background:linear-gradient(135deg,#6c63ff,#5a54e0);display:inline-flex;align-items:center;justify-content:center;font-size:18px;">&#128100;</span>';
  html += '<div style="font-size:16px;font-weight:700;color:var(--text);">Selectionner un prestataire</div>';
  html += '</div>';
  html += '<button aria-label="Fermer" onclick="document.getElementById(\'assignProviderOverlay\').remove()" style="background:var(--surface2);border:1px solid var(--border2);color:var(--text2);width:30px;height:30px;border-radius:8px;cursor:pointer;font-size:16px;">&times;</button>';
  html += '</div>';

  // ── Mission context card ──
  html += '<div style="margin:0 20px 18px;padding:14px 16px;background:linear-gradient(135deg,rgba(108,99,255,0.10),rgba(108,99,255,0.04));border:1px solid rgba(108,99,255,0.25);border-radius:12px;">';
  html += '<div style="font-size:10px;font-weight:700;color:#a5a0ff;text-transform:uppercase;letter-spacing:0.6px;margin-bottom:6px;">Mission a assigner</div>';
  html += '<div style="font-size:15px;font-weight:700;color:var(--text);margin-bottom:2px;">' + esc(svcLabel) + '</div>';
  html += '<div style="font-size:12px;color:var(--text2);">&#127968; ' + esc(propertyName) + '</div>';
  if (dateLabel) html += '<div style="font-size:12px;color:var(--text3);text-transform:capitalize;margin-top:4px;">&#128197; ' + esc(dateLabel) + '</div>';
  html += '</div>';

  html += '<div style="padding:0 20px 20px;overflow-y:auto;flex:1;">';

  // ─── SECTION 1: Mon equipe ───
  html += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">';
  html += '<div style="font-size:12px;font-weight:700;color:var(--text);text-transform:uppercase;letter-spacing:0.5px;">&#129529; Mon equipe</div>';
  html += '<span style="font-size:11px;color:var(--text3);background:var(--surface2);padding:2px 8px;border-radius:10px;">' + orgProviders.length + (orgProviders.length > 1 ? ' prestataires' : ' prestataire') + '</span>';
  html += '</div>';

  if (orgProviders.length === 0) {
    html += '<div style="padding:18px 14px;text-align:center;background:var(--surface2);border-radius:12px;border:1px dashed var(--border2);margin-bottom:22px;">';
    html += '<div style="font-size:24px;opacity:0.5;margin-bottom:6px;">&#129529;</div>';
    html += '<div style="font-size:12px;color:var(--text3);line-height:1.5;margin-bottom:12px;">Aucun prestataire dans votre equipe pour le moment.</div>';
    html += '<div style="display:flex;flex-direction:column;gap:8px;">';
    html += '<button onclick="pickProviderFromAnnuaire()" style="padding:10px 16px;background:linear-gradient(135deg,#6c63ff,#5a54e0);color:#fff;border:none;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;">&#127760; Choisir dans l\'annuaire</button>';
    html += '<button onclick="document.getElementById(\'assignProviderOverlay\').remove();showAddManualContact()" style="padding:8px 16px;background:rgba(108,99,255,0.15);color:#a5a0ff;border:1px solid rgba(108,99,255,0.35);border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;">+ Ajouter manuellement</button>';
    html += '</div>';
    html += '</div>';
  } else {
    html += '<div style="display:flex;flex-direction:column;gap:6px;margin-bottom:22px;">';
    orgProviders.forEach(p => {
      const name = esc(p.display_name || p.invited_email || 'Prestataire');
      const nameJsEsc = name.replace(/'/g, "\\'");
      html += '<button onclick="assignToOrgProvider(\'' + reqId + '\',\'' + nameJsEsc + '\',\'' + (p.user_id || '') + '\',\'' + svcType + '\',\'' + dateStr + '\',\'' + propertyName + '\')" style="display:flex;align-items:center;gap:12px;padding:12px 14px;background:var(--surface2);border:1px solid var(--border2);border-radius:10px;font-size:13px;color:var(--text);cursor:pointer;text-align:left;transition:all 0.15s;" onmouseover="this.style.borderColor=\'#6c63ff\';this.style.background=\'rgba(108,99,255,0.05)\'" onmouseout="this.style.borderColor=\'var(--border2)\';this.style.background=\'var(--surface2)\'">';
      html += '<span style="width:36px;height:36px;border-radius:50%;background:linear-gradient(135deg,#6c63ff,#5a54e0);display:inline-flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:14px;flex-shrink:0;">' + name.charAt(0).toUpperCase() + '</span>';
      html += '<div style="flex:1;min-width:0;"><div style="font-weight:600;font-size:13px;color:var(--text);">' + name + '</div>';
      if (p.invited_email) html += '<div style="font-size:11px;color:var(--text3);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + esc(p.invited_email) + '</div>';
      html += '</div>';
      html += '<span style="color:#6c63ff;font-size:20px;flex-shrink:0;">&rsaquo;</span>';
      html += '</button>';
    });
    html += '<button onclick="pickProviderFromAnnuaire()" style="margin-top:4px;padding:10px 12px;background:transparent;color:#a5a0ff;border:1px dashed rgba(108,99,255,0.45);border-radius:10px;font-size:12px;font-weight:600;cursor:pointer;text-align:center;">&#127760; Choisir un autre prestataire dans l\'annuaire</button>';
    html += '</div>';
  }

  // ─── SECTION 2: Diffuser ───
  html += '<div style="font-size:12px;font-weight:700;color:var(--text);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:10px;">&#128228; Diffuser plus largement</div>';

  // Primary: notify the org's team (more direct than annuaire)
  if (orgProviders.length > 0) {
    html += '<button onclick="broadcastToProvidersFromPopup(\'' + reqId + '\',\'' + dateStr + '\',\'' + svcType + '\',\'' + propertyName + '\')" style="width:100%;display:flex;align-items:center;gap:12px;padding:14px;background:var(--surface2);color:var(--text);border:1px solid var(--border2);border-radius:10px;font-size:13px;cursor:pointer;text-align:left;margin-bottom:8px;transition:all 0.15s;" onmouseover="this.style.borderColor=\'#ef4444\'" onmouseout="this.style.borderColor=\'var(--border2)\'">';
    html += '<span style="width:36px;height:36px;border-radius:8px;background:rgba(239,68,68,0.15);color:#ef4444;display:inline-flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0;">&#128276;</span>';
    html += '<div style="flex:1;min-width:0;"><div style="font-weight:600;color:var(--text);">Notifier tout mon equipe</div><div style="font-size:11px;color:var(--text3);margin-top:2px;">Envoie un push a vos ' + orgProviders.length + ' prestataire' + (orgProviders.length > 1 ? 's' : '') + ' simultanement</div></div>';
    html += '<span style="color:var(--text3);font-size:18px;flex-shrink:0;">&rsaquo;</span>';
    html += '</button>';
  }

  // Public marketplace
  html += '<button onclick="postToAnnuaire(\'' + reqId + '\',\'' + dateStr + '\',\'' + svcType + '\',\'' + propertyName + '\')" style="width:100%;display:flex;align-items:center;gap:12px;padding:14px;background:var(--surface2);color:var(--text);border:1px solid var(--border2);border-radius:10px;font-size:13px;cursor:pointer;text-align:left;transition:all 0.15s;" onmouseover="this.style.borderColor=\'#34d399\'" onmouseout="this.style.borderColor=\'var(--border2)\'">';
  html += '<span style="width:36px;height:36px;border-radius:8px;background:rgba(52,211,153,0.15);color:#34d399;display:inline-flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0;">&#127758;</span>';
  html += '<div style="flex:1;min-width:0;"><div style="font-weight:600;color:var(--text);">Publier sur l\'annuaire</div><div style="font-size:11px;color:var(--text3);margin-top:2px;">Tous les prestataires de la marketplace peuvent postuler</div></div>';
  html += '<span style="color:var(--text3);font-size:18px;flex-shrink:0;">&rsaquo;</span>';
  html += '</button>';

  html += '</div>'; // end body
  html += '</div>'; // end card

  overlay.innerHTML = html;
  document.body.appendChild(overlay);
}
window.showAssignProviderPopup = showAssignProviderPopup;

// Action: pick a specific provider from the org's team
async function assignToOrgProvider(reqId, providerName, providerUserId, svcType, dateStr, propertyName) {
  document.getElementById('assignProviderOverlay')?.remove();
  if (reqId && reqId !== '') {
    // service_request: update DB row
    if (typeof updateServiceRequest === 'function') {
      await updateServiceRequest(reqId, 'assigned', providerName);
    }
  }
  // Push notif to the assigned provider
  if (providerUserId && typeof sendPushToUser === 'function') {
    const svcLabel = (typeof getServiceLabel === 'function') ? getServiceLabel(svcType) : svcType;
    try {
      await sendPushToUser(providerUserId, '🧹 Nouvelle mission', svcLabel + ' - ' + propertyName + ' (' + dateStr + ')', { tag: 'assign-' + (reqId || dateStr) });
    } catch (e) { /* notification optional */ }
  }
  showToast('Mission assignee a ' + providerName);
  setTimeout(() => loadAdminPrestations(true), 500);
}
window.assignToOrgProvider = assignToOrgProvider;

// Action: broadcast push to all org providers (from inside the popup)
async function broadcastToProvidersFromPopup(reqId, dateStr, svcType, propertyName) {
  document.getElementById('assignProviderOverlay')?.remove();
  await broadcastToProviders(dateStr, svcType, propertyName);
}
window.broadcastToProvidersFromPopup = broadcastToProvidersFromPopup;

// Action: post the request to the public marketplace
async function postToAnnuaire(reqId, dateStr, svcType, propertyName) {
  // Get the property to enrich the job posting
  const org = (typeof API !== 'undefined' && API.getOrg) ? API.getOrg() : null;
  if (!org) { showToast('Organisation introuvable'); return; }
  const { data: { user } } = await sb.auth.getUser();

  // Try to find the matching property for richer details (city, address)
  let propAddress = '', propCity = '';
  try {
    const { data: props } = await sb.from('properties')
      .select('address, city')
      .eq('org_id', org.id)
      .eq('name', propertyName)
      .maybeSingle();
    if (props) {
      propAddress = props.address || '';
      propCity = props.city || (props.address ? (props.address.match(/\d{5}\s+([^,]+)/) || [])[1] || '' : '');
    }
  } catch (e) { /* best-effort */ }

  // Expire after 7 days by default
  const expiresAt = new Date(Date.now() + 7 * 86400000).toISOString();
  const svcLabel = (typeof getServiceLabel === 'function') ? getServiceLabel(svcType) : svcType;

  const jobPayload = {
    org_id: org.id,
    posted_by: user?.id || null,
    service_request_id: (reqId && reqId !== '') ? reqId : null,
    service_type: svcType,
    requested_date: dateStr || null,
    property_name: propertyName,
    property_address: propAddress,
    property_city: propCity,
    description: svcLabel + ' - ' + propertyName + (dateStr ? ' (' + dateStr + ')' : ''),
    status: 'open',
    expires_at: expiresAt,
  };

  try {
    const { data, error } = await sb.from('marketplace_jobs').insert(jobPayload).select().single();
    if (error) throw error;

    // Tag the service_request as broadcast (if applicable)
    if (reqId && reqId !== '') {
      await sb.from('service_requests').update({
        notes: 'Annonce publique posted_id=' + data.id,
      }).eq('id', reqId);
    }

    // Close the assign popup and show a confirmation overlay
    document.getElementById('assignProviderOverlay')?.remove();
    _showAnnuaireConfirmation(data.id, svcLabel, propertyName, dateStr, expiresAt);
  } catch (e) {
    if (typeof notifyError === 'function') notifyError('Publication annuaire', e);
    else showToast('Erreur publication: ' + (e?.message || e));
  }
}
window.postToAnnuaire = postToAnnuaire;

// Close the assign popup and open the marketplace annuaire pre-filtered on
// providers, so the user can browse and connect with a new prestataire.
function pickProviderFromAnnuaire() {
  document.getElementById('assignProviderOverlay')?.remove();
  if (typeof showMarketplace !== 'function') {
    showToast('Annuaire indisponible');
    return;
  }
  showMarketplace();
  // After marketplace is opened, switch to annuaire > search tab and filter on providers
  setTimeout(() => {
    try {
      // Some builds expose a tab switcher for the marketplace top-level tabs;
      // the annuaire tab is rendered inline so we just scroll to it and tweak filters.
      if (typeof switchAnnuaireSubTab === 'function') switchAnnuaireSubTab('search');
      const roleEl = document.getElementById('annRoleFilter');
      if (roleEl) {
        roleEl.value = 'provider';
        roleEl.dispatchEvent(new Event('change'));
      }
      if (typeof filterAnnuaire === 'function') filterAnnuaire();
      const annPanel = document.getElementById('annuairePanel_search') || document.getElementById('annuaireResults');
      if (annPanel && annPanel.scrollIntoView) annPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (e) { /* best-effort UX, ignore */ }
  }, 250);
}
window.pickProviderFromAnnuaire = pickProviderFromAnnuaire;

// Visual confirmation overlay shown after a successful annuaire posting.
function _showAnnuaireConfirmation(jobId, svcLabel, propertyName, dateStr, expiresIso) {
  const overlay = document.createElement('div');
  overlay.id = 'annuaireConfirmOverlay';
  overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.7);z-index:99999;display:flex;align-items:center;justify-content:center;padding:20px;';
  overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
  const expDate = new Date(expiresIso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
  let html = '<div style="max-width:420px;width:100%;background:var(--surface);border-radius:16px;border:1px solid var(--border);overflow:hidden;animation:bounceIn 0.4s ease-out;">';
  html += '<div style="padding:24px 24px 16px;text-align:center;background:linear-gradient(135deg,rgba(52,211,153,0.15),rgba(52,211,153,0.05));border-bottom:1px solid rgba(52,211,153,0.2);">';
  html += '<div style="width:60px;height:60px;border-radius:50%;background:#34d399;display:inline-flex;align-items:center;justify-content:center;font-size:32px;margin-bottom:10px;">&#10003;</div>';
  html += '<div style="font-size:18px;font-weight:700;color:var(--text);">Annonce publiee !</div>';
  html += '<div style="font-size:12px;color:var(--text3);margin-top:4px;">Votre demande est visible sur l\'annuaire.</div>';
  html += '</div>';
  html += '<div style="padding:18px 24px;">';
  html += '<div style="background:var(--surface2);border-radius:10px;padding:12px;margin-bottom:14px;">';
  html += '<div style="font-size:11px;color:var(--text3);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;">Recapitulatif</div>';
  html += '<div style="font-size:13px;color:var(--text);font-weight:600;margin-bottom:2px;">&#129529; ' + esc(svcLabel) + '</div>';
  html += '<div style="font-size:12px;color:var(--text2);">&#127968; ' + esc(propertyName) + '</div>';
  if (dateStr) {
    const d = new Date(dateStr + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
    html += '<div style="font-size:12px;color:var(--text2);text-transform:capitalize;">&#128197; ' + esc(d) + '</div>';
  }
  html += '<div style="font-size:11px;color:#f59e0b;margin-top:6px;">&#9203; Expire le ' + esc(expDate) + '</div>';
  html += '</div>';
  html += '<div style="font-size:12px;color:var(--text3);line-height:1.5;margin-bottom:16px;">';
  html += '&#128161; <b>Et apres ?</b><br>';
  html += '&middot; Les prestataires de la marketplace verront cette annonce<br>';
  html += '&middot; Vous serez notifie quand l\'un d\'eux postule<br>';
  html += '&middot; Vous pourrez retirer l\'annonce a tout moment dans <i>Annuaire &gt; Mes annonces</i>';
  html += '</div>';
  html += '<button onclick="document.getElementById(\'annuaireConfirmOverlay\').remove();loadAdminPrestations(true)" style="width:100%;padding:12px;background:linear-gradient(135deg,#34d399,#059669);color:#fff;border:none;border-radius:10px;font-size:14px;font-weight:600;cursor:pointer;">Compris &#10003;</button>';
  html += '</div></div>';
  overlay.innerHTML = html;
  document.body.appendChild(overlay);
}

// Broadcast a service request to all providers of the org via push notification.
// Used when a prestation has no assigned provider yet — the concierge can
// send it to everyone available.
async function broadcastToProviders(dateStr, svcType, propertyName) {
  const ok = await customConfirm(
    'Envoyer une notification a tous vos prestataires pour le menage du ' + dateStr + ' a "' + propertyName + '" ?',
    'Envoyer'
  );
  if (!ok) return;
  try {
    const org = API.getOrg();
    if (!org) { showToast('Organisation introuvable'); return; }
    // Get all providers of the org (members table)
    const { data: members, error: memErr } = await sb.from('members')
      .select('user_id, display_name')
      .eq('org_id', org.id)
      .eq('role', 'provider')
      .eq('accepted', true);
    if (memErr || !members || members.length === 0) {
      showToast('Aucun prestataire dans votre equipe');
      return;
    }
    // Build push payload
    const svcLabel = (typeof getServiceLabel === 'function') ? getServiceLabel(svcType) : 'Menage';
    const dateLabel = dateStr ? new Date(dateStr + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }) : '';
    let sentCount = 0;
    for (const m of members) {
      if (!m.user_id) continue;
      try {
        await sendPushToUser(m.user_id, '🚨 Mission disponible', svcLabel + ' - ' + propertyName + ' - ' + dateLabel, { tag: 'broadcast-' + dateStr });
        sentCount++;
      } catch (e) { /* skip individual failures */ }
    }
    showToast(sentCount + ' prestataire' + (sentCount > 1 ? 's' : '') + ' notifie' + (sentCount > 1 ? 's' : ''));
  } catch (e) {
    if (typeof notifyError === 'function') notifyError('Envoi aux prestataires', e);
    else showToast('Erreur: ' + (e.message || e));
  }
}
window.broadcastToProviders = broadcastToProviders;
