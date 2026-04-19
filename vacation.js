// Vacation / holidays module
// Depends on globals: sb, API, esc, safeErr, showToast, openOverlayPopup
// Exposes: window._vacationPeriods, showVacationPlanner, vacationRemove, vacationChangeMonth,
//          vacationClickDay, saveProfileCountry, saveNotifPref, getHolidaysForCountry, _userCountry

// ══ Vacation planner (provider + concierge personal) ══
let _vacationPeriods = [];
let _vacationCurrentMonth = new Date();
let _vacationRangeStart = null;
let _userCountry = 'FR';

async function showVacationPlanner() {
  try {
    const { data: { user } } = await sb.auth.getUser();
    if (!user) { showToast('Non connecte'); return; }
    const { data: mk } = await sb.from('marketplace_profiles').select('vacation_periods').eq('user_id', user.id).maybeSingle();
    _vacationPeriods = (mk && Array.isArray(mk.vacation_periods)) ? mk.vacation_periods : [];
  } catch(e) { console.error('load vacations:', e); _vacationPeriods = []; }
  _vacationCurrentMonth = new Date();
  _vacationRangeStart = null;
  await loadUserCountry();
  renderVacationCalendar();
  renderVacationList();
  openOverlayPopup('vacationPlannerOverlay');
}

// Public holidays per country (returns Set of 'YYYY-MM-DD' strings)
function _computeEaster(year) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d2 = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d2 - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const easterMonth = Math.floor((h + l - 7 * m + 114) / 31);
  const easterDay = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, easterMonth - 1, easterDay);
}
function _isoDate(dt) { return dt.getFullYear() + '-' + String(dt.getMonth()+1).padStart(2,'0') + '-' + String(dt.getDate()).padStart(2,'0'); }
function _addDays(dt, n) { const nd = new Date(dt); nd.setDate(nd.getDate()+n); return nd; }

const COUNTRIES = {
  FR: 'France', BE: 'Belgique', CH: 'Suisse', LU: 'Luxembourg', CA: 'Canada (Quebec)',
};

function getHolidaysForCountry(year, country) {
  const easter = _computeEaster(year);
  const dates = [];
  const c = country || 'FR';
  if (c === 'FR') {
    dates.push(year+'-01-01', _isoDate(_addDays(easter,1)), year+'-05-01', year+'-05-08',
      _isoDate(_addDays(easter,39)), _isoDate(_addDays(easter,50)), year+'-07-14',
      year+'-08-15', year+'-11-01', year+'-11-11', year+'-12-25');
  } else if (c === 'BE') {
    dates.push(year+'-01-01', _isoDate(_addDays(easter,1)), year+'-05-01',
      _isoDate(_addDays(easter,39)), _isoDate(_addDays(easter,50)), year+'-07-21',
      year+'-08-15', year+'-11-01', year+'-11-11', year+'-12-25');
  } else if (c === 'CH') {
    dates.push(year+'-01-01', year+'-01-02', _isoDate(_addDays(easter,-2)), _isoDate(_addDays(easter,1)),
      year+'-05-01', _isoDate(_addDays(easter,39)), _isoDate(_addDays(easter,50)),
      year+'-08-01', year+'-12-25', year+'-12-26');
  } else if (c === 'LU') {
    dates.push(year+'-01-01', _isoDate(_addDays(easter,1)), year+'-05-01', year+'-05-09',
      _isoDate(_addDays(easter,39)), _isoDate(_addDays(easter,50)), year+'-06-23',
      year+'-08-15', year+'-11-01', year+'-12-25', year+'-12-26');
  } else if (c === 'CA') {
    dates.push(year+'-01-01', _isoDate(_addDays(easter,-2)), _isoDate(_addDays(easter,1)),
      year+'-05-20', year+'-06-24', year+'-07-01', year+'-09-02',
      year+'-10-14', year+'-12-25', year+'-12-26');
  }
  return new Set(dates);
}

async function loadUserCountry() {
  try {
    const user = (await sb.auth.getUser()).data.user;
    if (!user) return;
    const { data } = await sb.from('marketplace_profiles').select('country').eq('user_id', user.id).maybeSingle();
    if (data && data.country) _userCountry = data.country;
  } catch(e) { console.error('loadUserCountry:', e); }
  const sel = document.getElementById('vacationCountrySelect');
  if (sel) sel.value = _userCountry;
}

async function saveNotifPref(field, value) {
  try {
    const user = (await sb.auth.getUser()).data.user;
    if (!user) return;
    const payload = { user_id: user.id };
    payload[field] = value;
    await sb.from('marketplace_profiles').upsert(payload, { onConflict: 'user_id' });
    showToast((field === 'notif_email' ? 'Emails' : 'Push') + (value ? ' actives' : ' desactives'));
  } catch(e) { console.error('saveNotifPref:', e); showToast('Erreur: ' + e.message); }
}

async function saveProfileCountry(code) {
  _userCountry = code;
  try {
    const user = (await sb.auth.getUser()).data.user;
    if (!user) return;
    await sb.from('marketplace_profiles').upsert({ user_id: user.id, country: code }, { onConflict: 'user_id' });
    showToast('Pays enregistre');
  } catch(e) { console.error('save country:', e); showToast('Erreur: ' + e.message); }
}

function renderVacationCalendar() {
  const el = document.getElementById('vacationPlannerCalendar');
  if (!el) return;
  const d = _vacationCurrentMonth;
  const year = d.getFullYear();
  const month = d.getMonth();
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const startDow = (first.getDay() + 6) % 7; // Monday = 0
  const daysCount = last.getDate();
  const monthNames = ['Janvier','Fevrier','Mars','Avril','Mai','Juin','Juillet','Aout','Septembre','Octobre','Novembre','Decembre'];
  const now = new Date();
  const isCurrentOrFutureMonth = year > now.getFullYear() || (year === now.getFullYear() && month >= now.getMonth());
  const canGoBack = year > now.getFullYear() || (year === now.getFullYear() && month > now.getMonth());
  const holidays = getHolidaysForCountry(year, _userCountry);
  let html = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">';
  html += '<button onclick="vacationChangeMonth(-1)" ' + (canGoBack ? '' : 'disabled') + ' style="background:var(--surface2);border:1px solid var(--border2);color:var(--text);border-radius:8px;width:32px;height:32px;cursor:' + (canGoBack ? 'pointer' : 'not-allowed') + ';font-size:14px;opacity:' + (canGoBack ? '1' : '0.4') + ';">&lsaquo;</button>';
  html += '<div style="font-size:14px;font-weight:700;color:var(--text);text-transform:capitalize;">' + monthNames[month] + ' ' + year + '</div>';
  html += '<button onclick="vacationChangeMonth(1)" style="background:var(--surface2);border:1px solid var(--border2);color:var(--text);border-radius:8px;width:32px;height:32px;cursor:pointer;font-size:14px;">&rsaquo;</button>';
  html += '</div>';
  html += '<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px;font-size:11px;color:var(--text3);text-align:center;margin-bottom:4px;">';
  ['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'].forEach((dn, i) => {
    const weekendColor = i >= 5 ? 'color:#f59e0b;font-weight:600;' : '';
    html += '<div style="' + weekendColor + '">' + dn + '</div>';
  });
  html += '</div>';
  html += '<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px;">';
  for (let i = 0; i < startDow; i++) html += '<div></div>';
  const today = new Date().toISOString().split('T')[0];
  for (let day = 1; day <= daysCount; day++) {
    const dateStr = year + '-' + String(month+1).padStart(2,'0') + '-' + String(day).padStart(2,'0');
    const dow = new Date(year, month, day).getDay(); // 0=dim, 6=sam
    const isWeekend = dow === 0 || dow === 6;
    const isHoliday = holidays.has(dateStr);
    const isInVac = _vacationPeriods.some(p => dateStr >= p.from && dateStr <= p.to);
    const isToday = dateStr === today;
    const isStart = _vacationRangeStart === dateStr;
    const isPast = dateStr < today;
    let bg = 'var(--surface2)';
    let color = 'var(--text)';
    if (isWeekend) { bg = 'rgba(245,158,11,0.08)'; color = '#f59e0b'; }
    if (isHoliday) { bg = 'rgba(139,92,246,0.15)'; color = '#a78bfa'; }
    if (isInVac) { bg = 'rgba(233,69,96,0.3)'; color = '#e94560'; }
    if (isStart) { bg = 'rgba(108,99,255,0.4)'; color = '#fff'; }
    let border = isToday ? '2px solid var(--accent)' : '1px solid var(--border2)';
    const titleAttr = isHoliday ? ' title="Jour ferie"' : (isWeekend ? ' title="Weekend"' : '');
    if (isPast) {
      html += '<button disabled' + titleAttr + ' style="background:transparent;color:var(--text3);border:1px solid var(--border);border-radius:6px;padding:8px 0;font-size:12px;opacity:0.4;cursor:not-allowed;">' + day + '</button>';
    } else {
      html += '<button onclick="vacationClickDay(\'' + dateStr + '\')"' + titleAttr + ' style="background:' + bg + ';color:' + color + ';border:' + border + ';border-radius:6px;padding:8px 0;font-size:12px;cursor:pointer;font-weight:' + (isToday || isInVac || isHoliday ? '700' : '400') + ';">' + day + '</button>';
    }
  }
  html += '</div>';
  html += '<div style="display:flex;gap:12px;flex-wrap:wrap;margin-top:8px;font-size:10px;color:var(--text3);justify-content:center;">';
  html += '<span><span style="display:inline-block;width:10px;height:10px;background:rgba(245,158,11,0.3);border-radius:2px;vertical-align:middle;margin-right:4px;"></span>Weekend</span>';
  html += '<span><span style="display:inline-block;width:10px;height:10px;background:rgba(139,92,246,0.3);border-radius:2px;vertical-align:middle;margin-right:4px;"></span>Jour ferie</span>';
  html += '<span><span style="display:inline-block;width:10px;height:10px;background:rgba(233,69,96,0.4);border-radius:2px;vertical-align:middle;margin-right:4px;"></span>Conge</span>';
  html += '</div>';
  if (_vacationRangeStart) {
    html += '<div style="font-size:11px;color:var(--accent2);margin-top:8px;text-align:center;">Debut : ' + _vacationRangeStart + ' — cliquez une date de fin</div>';
  } else {
    html += '<div style="font-size:11px;color:var(--text3);margin-top:8px;text-align:center;">Cliquez une date de debut puis une date de fin pour ajouter une periode</div>';
  }
  el.innerHTML = html;
}

function vacationChangeMonth(delta) {
  _vacationCurrentMonth = new Date(_vacationCurrentMonth.getFullYear(), _vacationCurrentMonth.getMonth() + delta, 1);
  renderVacationCalendar();
}

async function vacationClickDay(dateStr) {
  if (!_vacationRangeStart) {
    _vacationRangeStart = dateStr;
    renderVacationCalendar();
    return;
  }
  const from = _vacationRangeStart < dateStr ? _vacationRangeStart : dateStr;
  const to = _vacationRangeStart < dateStr ? dateStr : _vacationRangeStart;
  _vacationPeriods.push({ from, to, note: '' });
  _vacationRangeStart = null;
  await saveVacationPeriods();
  renderVacationCalendar();
  renderVacationList();
}

function renderVacationList() {
  const el = document.getElementById('vacationPlannerList');
  if (!el) return;
  if (!_vacationPeriods.length) { el.innerHTML = '<div style="font-size:12px;color:var(--text3);text-align:center;padding:10px;">Aucune periode configuree</div>'; return; }
  let html = '<div style="font-size:11px;color:var(--text3);text-transform:uppercase;margin-bottom:6px;">Periodes enregistrees</div>';
  _vacationPeriods.forEach((p, i) => {
    html += '<div style="display:flex;align-items:center;gap:8px;padding:8px 10px;background:var(--surface2);border-radius:8px;margin-bottom:4px;font-size:12px;">';
    html += '<span style="flex:1;color:var(--text);">&#128197; Du <b>' + esc(p.from) + '</b> au <b>' + esc(p.to) + '</b></span>';
    html += '<button onclick="vacationRemove(' + i + ')" style="background:transparent;border:none;color:#e94560;font-size:14px;cursor:pointer;">&#128465;</button>';
    html += '</div>';
  });
  el.innerHTML = html;
}

async function vacationRemove(idx) {
  _vacationPeriods.splice(idx, 1);
  await saveVacationPeriods();
  renderVacationCalendar();
  renderVacationList();
}

async function saveVacationPeriods() {
  try {
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return;
    const { error } = await sb.from('marketplace_profiles').upsert({ user_id: user.id, vacation_periods: _vacationPeriods, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
    if (error) { console.error('saveVacation:', error); showToast('Erreur: ' + safeErr(error, 'sauvegarde impossible')); return; }
    showToast('✓ Conges enregistres');
  } catch(e) { console.error('saveVacation:', e); }
}

// Export to window so HTML onclick handlers can find them
window.showVacationPlanner = showVacationPlanner;
window.vacationChangeMonth = vacationChangeMonth;
window.vacationClickDay = vacationClickDay;
window.vacationRemove = vacationRemove;
window.saveVacationPeriods = saveVacationPeriods;
window.saveProfileCountry = saveProfileCountry;
window.saveNotifPref = saveNotifPref;
window.getHolidaysForCountry = getHolidaysForCountry;
// Shared state accessors (for other modules if needed)
Object.defineProperty(window, '_userCountry', { get: () => _userCountry, set: (v) => { _userCountry = v; } });
Object.defineProperty(window, '_vacationPeriods', { get: () => _vacationPeriods, set: (v) => { _vacationPeriods = v; } });
window.loadUserCountry = loadUserCountry;
