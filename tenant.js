// Tenant (locataire) mode module
// Depends on: sb, setupBottomNav, updatePlanUI, esc, showToast
// Exposes: showTenantMode, switchTenantNav, renderTenantHome,
//   renderTenantInterventions, renderTenantChat, loadTenantMessages, tenantSendMessage

let _tenantReservation = null;
let _tenantProperty = null;
let _tenantOrgId = null;

async function showTenantMode() {
  setupBottomNav('tenant');
  updatePlanUI();
  const selector = document.getElementById('prestPropertySelector');
  if (selector) selector.style.display = 'none';

  const content = document.querySelector('.content');
  if (!content) return;

  const { data: { user } } = await sb.auth.getUser();
  if (!user) return;
  const { data: rezas } = await sb.from('reservations').select('*, properties(*)')
    .eq('tenant_user_id', user.id).eq('status', 'active')
    .order('start_date', { ascending: false }).limit(1);
  if (!rezas || !rezas.length) {
    content.innerHTML =
      '<div id="tenantContent" style="padding:8px 2px 80px;">' +
      '<div id="tenantPanel_home"><div style="background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:24px;text-align:center;margin:8px;"><div style="font-size:32px;margin-bottom:10px;">&#128273;</div><div style="font-size:16px;font-weight:700;margin-bottom:8px;">Aucune reservation active</div><div style="font-size:13px;color:var(--text3);line-height:1.6;">Vous n\'avez pas encore de logement associe. Contactez votre concierge ou proprietaire pour qu\'il vous lie a une propriete.</div></div></div>' +
      '<div id="tenantPanel_interventions" style="display:none;"><div style="text-align:center;color:var(--text3);font-size:13px;padding:30px 20px;">Disponible une fois votre logement associe.</div></div>' +
      '<div id="tenantPanel_chat" style="display:none;"><div style="text-align:center;color:var(--text3);font-size:13px;padding:30px 20px;">Disponible une fois votre logement associe.</div></div>' +
      '</div>';
    return;
  }
  _tenantReservation = rezas[0];
  _tenantProperty = _tenantReservation.properties;
  _tenantOrgId = _tenantReservation.org_id;

  content.innerHTML =
    '<div id="tenantContent" style="padding:8px 2px 80px;">' +
    '<div id="tenantPanel_home"></div>' +
    '<div id="tenantPanel_interventions" style="display:none;"></div>' +
    '<div id="tenantPanel_chat" style="display:none;"></div>' +
    '</div>';
  renderTenantHome();
}

function switchTenantNav(tab) {
  const panels = {
    home: document.getElementById('tenantPanel_home'),
    interventions: document.getElementById('tenantPanel_interventions'),
    chat: document.getElementById('tenantPanel_chat'),
  };
  Object.values(panels).forEach(p => p && (p.style.display = 'none'));
  if (panels[tab]) panels[tab].style.display = '';
  document.querySelectorAll('#bottomNav .bottomNav-item').forEach(n => n.classList.remove('active'));
  const navEl = document.getElementById('nav_' + tab);
  if (navEl) navEl.classList.add('active');
  if (tab === 'home') renderTenantHome();
  if (tab === 'interventions') renderTenantInterventions();
  if (tab === 'chat') renderTenantChat();
  window.scrollTo(0, 0);
}

function renderTenantHome() {
  const el = document.getElementById('tenantPanel_home');
  if (!el || !_tenantProperty) return;
  const p = _tenantProperty;
  const r = _tenantReservation || {};
  const fmtD = (d) => d ? new Date(d + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' }) : '—';
  let h = '<div style="background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:16px;margin-bottom:14px;">';
  h += '<div style="font-size:18px;font-weight:800;color:var(--text);margin-bottom:4px;">&#127968; ' + esc(p.name || t('tenant.home_title')) + '</div>';
  if (p.address) h += '<div style="font-size:12px;color:var(--text3);margin-bottom:10px;">' + esc(p.address) + '</div>';
  if (p.photo) h += '<img src="' + esc(p.photo) + '" style="width:100%;max-height:220px;object-fit:cover;border-radius:10px;margin-bottom:10px;">';
  h += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px;">';
  h += '<div style="background:var(--surface2);border-radius:10px;padding:10px;text-align:center;"><div style="font-size:10px;color:var(--text3);text-transform:uppercase;">Arrivee</div><div style="font-size:13px;font-weight:700;color:var(--text);margin-top:4px;">' + fmtD(r.start_date) + '</div></div>';
  h += '<div style="background:var(--surface2);border-radius:10px;padding:10px;text-align:center;"><div style="font-size:10px;color:var(--text3);text-transform:uppercase;">Depart</div><div style="font-size:13px;font-weight:700;color:var(--text);margin-top:4px;">' + fmtD(r.end_date) + '</div></div>';
  h += '</div>';
  if (r.access_instructions) h += '<div style="margin-top:12px;padding:12px;background:rgba(167,139,250,0.1);border-left:3px solid #a78bfa;border-radius:8px;font-size:12px;line-height:1.5;"><strong>&#128273; Acces:</strong><br>' + esc(r.access_instructions).replace(/\n/g, '<br>') + '</div>';
  if (r.notes) h += '<div style="margin-top:8px;padding:10px;background:var(--surface2);border-radius:8px;font-size:12px;line-height:1.5;color:var(--text2);">' + esc(r.notes).replace(/\n/g, '<br>') + '</div>';
  h += '</div>';
  el.innerHTML = h;
}

async function renderTenantInterventions() {
  const el = document.getElementById('tenantPanel_interventions');
  if (!el || !_tenantProperty) return;
  el.innerHTML = '<div style="text-align:center;color:var(--text3);padding:20px;">Chargement...</div>';
  const today = new Date().toISOString().split('T')[0];
  const periodStart = _tenantReservation.start_date || today;
  const periodEnd = _tenantReservation.end_date || '2099-12-31';
  const { data: sr } = await sb.from('service_requests')
    .select('id, service_type, requested_date, status, notes, assigned_provider')
    .eq('property_id', _tenantProperty.id)
    .gte('requested_date', periodStart).lte('requested_date', periodEnd)
    .order('requested_date', { ascending: true });
  const items = sr || [];
  let h = '<div style="font-size:16px;font-weight:700;color:var(--text);margin:6px 4px 12px;">&#129529; Interventions pendant votre sejour</div>';
  if (!items.length) {
    h += '<div style="background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:24px;text-align:center;font-size:13px;color:var(--text3);">Aucune intervention prevue pendant votre sejour.</div>';
    el.innerHTML = h; return;
  }
  const labels = { cleaning_standard: 'Menage', cleaning_deep: 'Menage approfondi', windows: 'Vitres', handyman: 'Bricolage', laundry: 'Linge', ironing: 'Repassage', checkin: 'Check-in', checkout: 'Check-out', key_handover: t('tenant.key_handover'), gardening: 'Jardinage', pool: 'Piscine', pressing: 'Pressing' };
  items.forEach(r => {
    const d = r.requested_date ? new Date(r.requested_date + 'T12:00:00') : null;
    const when = d ? d.toLocaleDateString('fr-FR', { weekday: 'long', day: '2-digit', month: 'long' }) : '—';
    const isToday = r.requested_date === today;
    const isPast = r.requested_date && r.requested_date < today;
    const badgeColor = isToday ? '#34d399' : (isPast ? 'var(--text3)' : '#a78bfa');
    const badgeBg = isToday ? 'rgba(52,211,153,0.2)' : (isPast ? 'rgba(128,128,144,0.2)' : 'rgba(167,139,250,0.2)');
    const badgeText = isToday ? 'Aujourd\'hui' : (isPast ? 'Termine' : 'A venir');
    h += '<div style="background:var(--surface);border:1px solid var(--border);border-left:3px solid ' + badgeColor + ';border-radius:10px;padding:12px;margin-bottom:8px;">';
    h += '<div style="font-size:11px;color:var(--text3);margin-bottom:3px;">' + when + ' <span style="padding:2px 8px;background:' + badgeBg + ';color:' + badgeColor + ';border-radius:4px;font-size:9px;font-weight:700;text-transform:uppercase;margin-left:4px;">' + badgeText + '</span></div>';
    h += '<div style="font-size:14px;font-weight:700;color:var(--text);">' + esc(labels[r.service_type] || r.service_type || 'Intervention') + '</div>';
    if (r.assigned_provider) h += '<div style="font-size:11px;color:var(--text3);margin-top:3px;">&#128100; ' + esc(r.assigned_provider) + '</div>';
    if (r.notes) h += '<div style="font-size:11px;color:var(--text3);margin-top:4px;">' + esc(r.notes) + '</div>';
    h += '</div>';
  });
  el.innerHTML = h;
}

async function renderTenantChat() {
  const el = document.getElementById('tenantPanel_chat');
  if (!el) return;
  let h = '<div style="font-size:16px;font-weight:700;color:var(--text);margin:6px 4px 12px;">&#128172; Messages avec la conciergerie</div>';
  h += '<div style="background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:12px;">';
  h += '<div id="tenantChatMessages" style="max-height:55vh;overflow-y:auto;padding:4px;margin-bottom:10px;"></div>';
  h += '<div style="display:flex;gap:8px;"><input type="text" id="tenantChatInput" placeholder="' + t('chat.write_message') + '" onkeydown="if(event.key===\'Enter\')tenantSendMessage()" style="flex:1;padding:10px;background:var(--surface2);color:var(--text);border:1px solid var(--border2);border-radius:8px;font-size:13px;">';
  h += '<button onclick="tenantSendMessage()" style="background:var(--accent);color:#fff;border:none;padding:10px 16px;border-radius:8px;cursor:pointer;font-size:13px;font-weight:600;">Envoyer</button></div>';
  h += '</div>';
  el.innerHTML = h;
  await loadTenantMessages();
}

async function loadTenantMessages() {
  if (!_tenantOrgId) return;
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return;
  // Filtrage strict: seulement les messages lies a la reservation/property du tenant,
  // ou les messages qu'il a lui-meme ecrits, ou adresses explicitement a lui.
  const resId = _tenantReservation?.id || null;
  const propId = _tenantProperty?.id || null;
  const orFilters = [
    'sender_id.eq.' + user.id,
    'recipient_user_id.eq.' + user.id,
  ];
  if (resId) orFilters.push('reservation_id.eq.' + resId);
  if (propId) orFilters.push('property_id.eq.' + propId);
  const { data: msgs, error } = await sb.from('messages').select('*')
    .eq('org_id', _tenantOrgId)
    .or(orFilters.join(','))
    .order('created_at', { ascending: true }).limit(100);
  if (error) { if (typeof notifyError === 'function') notifyError('Chargement messages', error); return; }
  const list = document.getElementById('tenantChatMessages');
  if (!list) return;
  const items = msgs || [];
  if (!items.length) { list.innerHTML = '<div style="text-align:center;color:var(--text3);font-size:12px;padding:20px;font-style:italic;">Aucun message pour l\'instant. Ecrivez a la conciergerie pour toute question.</div>'; return; }
  let h = '';
  items.forEach(m => {
    const isMine = m.sender_id === user?.id;
    const who = isMine ? 'Vous' : (m.sender_name || 'Contact');
    const time = new Date(m.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    const bg = isMine ? 'background:var(--accent2);color:#fff;margin-left:40px;' : 'background:var(--surface2);color:var(--text);margin-right:40px;';
    h += '<div style="padding:8px 10px;margin-bottom:6px;border-radius:10px;font-size:12px;line-height:1.5;' + bg + '"><div style="font-size:10px;opacity:0.7;margin-bottom:2px;">' + esc(who) + ' &middot; ' + time + '</div>' + esc(m.body || '').replace(/\n/g, '<br>') + '</div>';
  });
  list.innerHTML = h;
  list.scrollTop = list.scrollHeight;
}

async function tenantSendMessage() {
  const input = document.getElementById('tenantChatInput');
  if (!input) return;
  const body = input.value.trim();
  if (!body || !_tenantOrgId) return;
  input.value = '';
  const { data: { user } } = await sb.auth.getUser();
  const { error } = await sb.from('messages').insert({
    org_id: _tenantOrgId,
    sender_id: user.id,
    sender_name: user.email,
    sender_role: 'tenant',
    recipient_name: 'concierge',
    body: body,
    property_id: _tenantProperty?.id || null,
    reservation_id: _tenantReservation?.id || null,
  });
  if (error) { if (typeof notifyError === 'function') notifyError('Envoi message', error); else showToast('Erreur: ' + error.message); return; }
  await loadTenantMessages();
}

window.showTenantMode = showTenantMode;
window.switchTenantNav = switchTenantNav;
window.renderTenantHome = renderTenantHome;
window.renderTenantInterventions = renderTenantInterventions;
window.renderTenantChat = renderTenantChat;
window.loadTenantMessages = loadTenantMessages;
window.tenantSendMessage = tenantSendMessage;
