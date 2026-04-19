// Dashboard module — renderDashboardContent
// Depends on: _adminPrestCache, cleanings, getServiceLabel, fmtDate, esc
// Exposes: renderDashboardContent

function renderDashboardContent() {
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];

  // Use unified data from admin prestations cache (same source as Liste tab)
  const allUpcoming = [];
  if (_adminPrestCache && _adminPrestCache.svcRequests) {
    // Service requests (already have correct status)
    _adminPrestCache.svcRequests.forEach(r => {
      const d = r.requested_date || r.preferred_date || '';
      if (d >= todayStr && !['cancelled', 'refused'].includes(r.status)) {
        allUpcoming.push({ date: d, type: r.service_type, label: getServiceLabel(r.service_type), provider: r.assigned_provider || '?', source: '', status: r.status, propertyName: r.property_name || '', priority: r.priority });
      }
    });
  }
  // Cleanings with validation status applied
  if (_adminPrestCache && _adminPrestCache.plannings && _adminPrestCache.propMap) {
    const validations = _adminPrestCache.validations || {};
    (_adminPrestCache.plannings || []).forEach(plan => {
      const prop = _adminPrestCache.propMap[plan.property_id];
      if (!plan.cleanings || !prop) return;
      plan.cleanings.forEach(c => {
        const d = c.cleaningDate || c.date;
        if (!d || d < todayStr) return;
        const vKey = prop.id + '_' + d + '_' + (c.provider || '');
        const v = validations[vKey];
        const status = v ? v.status : (c._status || 'pending');
        if (['cancelled', 'refused', 'done', 'departed'].includes(status)) return;
        allUpcoming.push({ date: d, type: 'cleaning_standard', label: getServiceLabel('cleaning_standard'), provider: c.provider || '?', source: c.source || '', status: status, propertyName: prop.name || '' });
      });
    });
  } else {
    // Fallback: use raw cleanings if cache not ready
    (cleanings || []).forEach(c => {
      const d = c.cleaningDate || c.date || '';
      if (d >= todayStr && !['cancelled', 'refused', 'done'].includes(c._status)) {
        allUpcoming.push({ date: d, type: 'cleaning_standard', label: getServiceLabel('cleaning_standard'), provider: c.provider || '?', source: c.source || '', status: c._status || 'pending', propertyName: '' });
      }
    });
  }
  allUpcoming.sort((a, b) => a.date.localeCompare(b.date));

  const todayItems = allUpcoming.filter(u => u.date === todayStr);
  const upcomingItems = allUpcoming.filter(u => u.date > todayStr).slice(0, 5);

  // Today section
  const div1 = document.getElementById('dashTodayCleanings');
  if (div1) {
    let html = '<details style="background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:16px;margin-bottom:12px;">';
    html += '<summary style="list-style:none;cursor:pointer;display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;"><div style="font-size:14px;font-weight:700;color:var(--text);">&#128197; Aujourd\'hui — ' + todayItems.length + ' prestation(s)</div><span class="collapseArrow">&#9662;</span></summary>';
    if (todayItems.length === 0) {
      html += '<div style="color:var(--text3);font-size:13px;">Aucune prestation aujourd\'hui</div>';
    } else {
      todayItems.forEach(u => {
        html += '<div onclick="goToPrestation(\'' + u.date + '\',\'' + (u.type||'') + '\',\'' + esc(u.provider||'').replace(/'/g,"\\'") + '\')" style="display:flex;align-items:center;gap:8px;padding:8px 0;border-top:1px solid var(--border);cursor:pointer;" onmouseover="this.style.background=\'rgba(255,255,255,0.03)\'" onmouseout="this.style.background=\'\'">';
        html += '<div style="flex:1;font-size:13px;font-weight:600;">' + u.label + '</div>';
        html += '<div style="font-size:11px;color:var(--text3);">' + esc(u.provider) + '</div>';
        if (u.priority === 'high') html += '<span style="font-size:9px;padding:1px 5px;border-radius:3px;background:#ef444420;color:#ef4444;font-weight:700;animation:pulse 1.5s ease-in-out infinite;">URGENT</span>';
        html += '<span style="font-size:10px;padding:2px 6px;border-radius:4px;background:' + getStatusColor(u.status) + '22;color:' + getStatusColor(u.status) + ';font-weight:600;cursor:help;" title="' + getStatusHint(u.status) + '">' + getStatusLabel(u.status) + '</span>';
        html += '</div>';
      });
    }
    html += '</details>';
    div1.innerHTML = html;
  }

  // Upcoming section
  const div2 = document.getElementById('dashPendingRequests');
  if (div2 && upcomingItems.length > 0) {
    let html = '<details style="background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:16px;">';
    html += '<summary style="list-style:none;cursor:pointer;display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;"><div style="font-size:14px;font-weight:700;color:var(--text);">&#128203; Prochaines prestations</div><span class="collapseArrow">&#9662;</span></summary>';
    upcomingItems.forEach(u => {
      html += '<div onclick="goToPrestation(\'' + u.date + '\',\'' + (u.type||'') + '\',\'' + esc(u.provider||'').replace(/'/g,"\\'") + '\')" style="display:flex;align-items:center;gap:8px;padding:8px 0;border-top:1px solid var(--border);cursor:pointer;" onmouseover="this.style.background=\'rgba(255,255,255,0.03)\'" onmouseout="this.style.background=\'\'">';
      html += '<div style="min-width:45px;font-size:11px;color:var(--text3);">' + fmtDate(u.date).substring(0, 5) + '</div>';
      html += '<div style="flex:1;font-size:12px;font-weight:600;">' + u.label + '</div>';
      html += '<div style="font-size:11px;color:var(--text3);">' + esc(u.provider) + '</div>';
      if (u.priority === 'high') html += '<span style="font-size:9px;padding:1px 5px;border-radius:3px;background:#ef444420;color:#ef4444;font-weight:700;animation:pulse 1.5s ease-in-out infinite;">URGENT</span>';
      html += '<span style="font-size:10px;padding:2px 6px;border-radius:4px;background:' + getStatusColor(u.status) + '22;color:' + getStatusColor(u.status) + ';font-weight:600;cursor:help;" title="' + getStatusHint(u.status) + '">' + getStatusLabel(u.status) + '</span>';
      html += '</div>';
    });
    if (allUpcoming.filter(u => u.date > todayStr).length > 5) {
      html += '<div onclick="switchMainTab(\'prestations\')" style="text-align:center;padding:8px;font-size:11px;color:var(--accent2);cursor:pointer;font-weight:600;">Voir tout &#8250;</div>';
    }
    html += '</details>';
    div2.innerHTML = html;
  }

  // Analytics section
  const div3 = document.getElementById('dashAnalytics');
  if (div3 && _adminPrestCache) {
    const cache = _adminPrestCache;
    const thisMonth = todayStr.substring(0, 7);
    const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 15).toISOString().substring(0, 7);
    let thisMonthCount = 0, lastMonthCount = 0, thisMonthRevenue = 0, disputed = 0, pending = 0;

    // Count from service requests
    (cache.svcRequests || []).forEach(r => {
      const d = r.requested_date || '';
      const month = d.substring(0, 7);
      if (r.status === 'done') {
        if (month === thisMonth) { thisMonthCount++; thisMonthRevenue += getServicePrice(r.property_id || '', r.service_type, 'price_owner'); }
        if (month === lastMonth) lastMonthCount++;
      }
      if (r.status === 'disputed') disputed++;
      if (r.status === 'pending' || r.status === 'assigned') pending++;
    });

    // Count from cleanings
    (cache.plannings || []).forEach(plan => {
      if (!plan.cleanings) return;
      plan.cleanings.forEach(c => {
        const d = c.cleaningDate || c.date || '';
        const month = d.substring(0, 7);
        const vKey = plan.property_id + '_' + d + '_' + (c.provider || '');
        const v = (cache.validations || {})[vKey];
        if (v && v.status === 'done') {
          if (month === thisMonth) { thisMonthCount++; thisMonthRevenue += getServicePrice(plan.property_id, 'cleaning_standard', 'price_owner'); }
          if (month === lastMonth) lastMonthCount++;
        }
      });
    });

    const trend = lastMonthCount > 0 ? Math.round(((thisMonthCount - lastMonthCount) / lastMonthCount) * 100) : 0;
    const trendColor = trend >= 0 ? '#34d399' : '#ef4444';
    const trendIcon = trend >= 0 ? '&#9650;' : '&#9660;';

    let html = '<details style="background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:16px;margin-top:12px;">';
    html += '<summary style="list-style:none;cursor:pointer;display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;"><div style="font-size:14px;font-weight:700;color:var(--text);">&#128202; Analytique du mois</div><span class="collapseArrow">&#9662;</span></summary>';
    const tileStyle = 'background:var(--surface2);border-radius:10px;padding:12px;text-align:center;cursor:pointer;transition:transform 0.15s,background 0.15s;';
    const tileHover = 'onmouseover="this.style.background=\'rgba(108,99,255,0.1)\';this.style.transform=\'translateY(-2px)\'" onmouseout="this.style.background=\'var(--surface2)\';this.style.transform=\'\'"';
    html += '<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:10px;">';
    html += '<div ' + tileHover + ' onclick="goToAnalyticTile(\'done\')" style="' + tileStyle + '"><div style="font-size:22px;font-weight:800;color:var(--text);">' + thisMonthCount + '</div><div style="font-size:10px;color:var(--text3);">Prestations terminees</div>';
    if (trend !== 0) html += '<div style="font-size:10px;color:' + trendColor + ';margin-top:4px;">' + trendIcon + ' ' + Math.abs(trend) + '% vs mois dernier</div>';
    html += '</div>';
    html += '<div ' + tileHover + ' onclick="goToAnalyticTile(\'revenue\')" style="' + tileStyle + '"><div style="font-size:22px;font-weight:800;color:#f59e0b;">' + thisMonthRevenue + '&euro;</div><div style="font-size:10px;color:var(--text3);">CA du mois</div></div>';
    html += '<div ' + tileHover + ' onclick="goToAnalyticTile(\'pending\')" style="' + tileStyle + '"><div style="font-size:22px;font-weight:800;color:#f59e0b;">' + pending + '</div><div style="font-size:10px;color:var(--text3);">En attente</div></div>';
    html += '<div ' + tileHover + ' onclick="goToAnalyticTile(\'disputed\')" style="' + tileStyle + '"><div style="font-size:22px;font-weight:800;color:' + (disputed > 0 ? '#ef4444' : 'var(--text)') + ';">' + disputed + '</div><div style="font-size:10px;color:var(--text3);">Litiges</div></div>';
    html += '</div></details>';
    div3.innerHTML = html;
  }
}

/* ── Tabs (legacy - redirects to prestSubTab system) ── */

window.renderDashboardContent = renderDashboardContent;
