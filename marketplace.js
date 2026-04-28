// Marketplace / Annuaire module
// Depends on: sb, API, esc, showMsg, closeMsg, showToast, customConfirm,
//   openOverlayPopup, closeOverlayPopup, loadLeaflet (lazy), safePhotoUrl,
//   SERVICE_CATALOG, getServiceIcon, _escHtml, isOnVacation
// Exposes: showMarketplace, renderMarketplaceResults, renderAnnuaireTab,
//   closeMarketplace, openMarketplaceFilters, ...

// ═══ MARKETPLACE / ANNUAIRE ═══
let _mkAllProfiles = [];

let _mkRefreshInterval = null;
async function showMarketplace(prefillAddress) {
  document.getElementById('overlay').style.display = 'block';
  document.getElementById('marketplaceModal').style.display = 'block';
  // Auto-refresh every 15s while marketplace is open
  if (_mkRefreshInterval) clearInterval(_mkRefreshInterval);
  _mkRefreshInterval = setInterval(() => {
    if (document.getElementById('marketplaceModal')?.style.display === 'block') loadMarketplaceData();
    else clearInterval(_mkRefreshInterval);
  }, 15000);
  document.getElementById('mkResults').innerHTML = '<div style="text-align:center;padding:30px;color:var(--text3);">Chargement...</div>';
  // Pre-fill city from provided address or user's property address
  const cityInput = document.getElementById('mkCityFilter');
  if (cityInput && !cityInput.value) {
    let address = prefillAddress || '';
    if (!address) {
      try {
        const props = await API.loadProperties();
        if (props && props.length && props[0].address) address = props[0].address;
      } catch(e) { /* best-effort pre-fill, ignore */ }
    }
    if (address) {
      const parts = address.split(',').map(p => p.trim());
      // Find postal code (5 digits) and use it, or find city name before department
      const postalIdx = parts.findIndex(p => /^\d{5}$/.test(p));
      if (postalIdx > 0) {
        // Use the postal code — best for marketplace geo search
        cityInput.value = parts[postalIdx];
      } else if (parts.length >= 3) {
        cityInput.value = parts[parts.length - 2];
      } else {
        cityInput.value = parts[0];
      }
    }
  }
  try {
    await loadMarketplaceData();
  } catch (e) {
    console.error('Marketplace load error:', e);
    document.getElementById('mkResults').innerHTML = '<div style="text-align:center;padding:30px;color:var(--text3);">Erreur de chargement</div>';
  }
}

// ── Connection Requests ──
async function disconnectUser(targetUserId, targetName) {
  const ok = await customConfirm('Retirer ' + targetName + ' de votre equipe ?', 'Retirer');
  if (!ok) return;
  try {
    const org = API.getOrg();
    const { data: { user } } = await sb.auth.getUser();
    if (org) {
      // Remove from members
      const { error: delErr } = await sb.from('members').delete().eq('org_id', org.id).eq('user_id', targetUserId);
      if (delErr) console.error('Delete member error:', delErr);
    }
    // Update ALL connection_requests between us to refused
    if (user) {
      await sb.from('connection_requests').update({ status: 'refused', updated_at: new Date().toISOString() })
        .or('and(sender_id.eq.' + user.id + ',receiver_id.eq.' + targetUserId + '),and(sender_id.eq.' + targetUserId + ',receiver_id.eq.' + user.id + ')')
        .eq('status', 'accepted');
    }
    showToast(targetName + ' retire de votre equipe');
    // Reload org memberships
    await API.loadOrganization();
    // Send notification to disconnected user
    if (org) {
      const member = API.getMember();
      const myName = member?.display_name || 'Gestionnaire';
      await sendAutoMessage(org.id, myName, API.getRole(), targetName,
        '&#128279; ' + myName + ' vous a retire de l\'equipe ' + (org.name || '') + '.');
    }
    // Refresh both views
    await renderAnnuaireTab();
    // Also refresh marketplace modal if open
    if (document.getElementById('marketplaceModal')?.style.display === 'block') {
      try { await loadMarketplaceData(); } catch(e) { console.error('Marketplace refresh:', e); }
    }
  } catch(e) { console.error('disconnectUser error:', e); showToast('Erreur'); }
}

async function sendConnectionRequest(targetUserId, targetName, targetRole, customMessage) {
  try {
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return;
    const member = API.getMember();
    const org = API.getOrg();
    const myName = member?.display_name || user.email.split('@')[0];
    const myRole = API.getRole();

    // Check if already sent (recherche sans .maybeSingle pour gerer les historiques refused multiples)
    const { data: existingList } = await sb.from('connection_requests')
      .select('id,status,sender_id,receiver_id')
      .or(`and(sender_id.eq.${user.id},receiver_id.eq.${targetUserId}),and(sender_id.eq.${targetUserId},receiver_id.eq.${user.id})`)
      .order('created_at', { ascending: false });
    const active = (existingList || []).find(r => r.status === 'pending' || r.status === 'accepted');
    if (active) {
      if (active.status === 'pending') { showToast('Demande deja envoyee'); return; }
      if (active.status === 'accepted') {
        const wantDisconnect = await customConfirm(t('marketplace.already_connected_with') + targetName + '. Voulez-vous vous deconnecter ?', 'Se deconnecter');
        if (wantDisconnect) await disconnectUser(targetUserId, targetName);
        return;
      }
    }

    // Determine the role to propose
    let proposedRole = 'provider';
    if (myRole === 'concierge') proposedRole = targetRole === 'owner' ? 'owner' : 'provider';
    else if (myRole === 'owner') proposedRole = 'owner';
    else if (myRole === 'provider') proposedRole = 'provider';

    const { error } = await sb.from('connection_requests').insert({
      sender_id: user.id,
      sender_name: myName,
      sender_role: myRole,
      sender_org_id: org?.id,
      receiver_id: targetUserId,
      receiver_name: targetName,
      receiver_role: targetRole,
      proposed_role: proposedRole,
      status: 'pending',
      message: customMessage || ''
    });
    if (error) throw error;
    showToast('Demande envoyee a ' + targetName + ' !');
    // Send auto-message notification
    if (org) {
      await sendAutoMessage(org.id, myName, myRole, targetName,
        '&#128279; ' + myName + ' souhaite se connecter avec vous sur Lokizio');
    }
    // Refresh annuaire so button updates to "En attente"
    if (typeof renderAnnuaireTab === 'function') setTimeout(() => renderAnnuaireTab(), 300);
  } catch(e) {
    console.error('sendConnectionRequest error:', e);
    showToast('Erreur: ' + (e.message || 'Impossible d\'envoyer'));
  }
}

let _pendingConnect = null;
async function openConnectRequestPopup(targetUserId, targetName, targetRole) {
  _pendingConnect = { targetUserId, targetName, targetRole };
  const tgt = document.getElementById('connectReqTarget');
  if (tgt) tgt.textContent = targetName || '';
  const reason = document.getElementById('connectReqReason');
  if (reason) reason.value = 'work';
  const msg = document.getElementById('connectReqMessage');
  if (msg) msg.value = '';
  const cnt = document.getElementById('connectReqCounter');
  if (cnt) cnt.textContent = '0 / 300';
  // Render services checkboxes, pre-checked based on user's marketplace profile
  const container = document.getElementById('connectReqServices');
  if (container) {
    let myServices = [];
    try {
      const { data: { user } } = await sb.auth.getUser();
      if (user) {
        const { data: mk } = await sb.from('marketplace_profiles').select('services').eq('user_id', user.id).maybeSingle();
        if (mk && Array.isArray(mk.services)) myServices = mk.services;
      }
    } catch(e) { console.warn('load my services:', e); }
    let chtml = '';
    SERVICE_CATALOG.forEach(cat => {
      cat.services.forEach(s => {
        const isChecked = myServices.includes(s.id) ? 'checked' : '';
        chtml += '<label style="display:inline-flex;align-items:center;gap:4px;padding:5px 10px;background:var(--surface);border:1px solid var(--border2);border-radius:16px;font-size:11px;cursor:pointer;color:var(--text);"><input type="checkbox" class="connectReqServiceCb" value="' + s.id + '" ' + isChecked + ' style="accent-color:#6c63ff;margin:0;"> ' + s.icon + ' ' + s.label + '</label>';
      });
    });
    container.innerHTML = chtml;
  }
  openOverlayPopup('connectRequestOverlay');
}

async function submitConnectionRequest() {
  if (!_pendingConnect) { closeOverlayPopup('connectRequestOverlay'); return; }
  const reason = document.getElementById('connectReqReason')?.value || 'work';
  const message = (document.getElementById('connectReqMessage')?.value || '').trim().slice(0, 300);
  const reasonLabels = {
    work: t('marketplace.goal.collaborate'),
    hire: 'Recruter / Proposer des missions',
    service: t('marketplace.goal.request_service'),
    network: 'Reseau professionnel',
    other: 'Autre'
  };
  const selectedServices = [...document.querySelectorAll('.connectReqServiceCb:checked')].map(c => c.value);
  const svcLabels = selectedServices.map(id => getServiceLabel(id)).join(', ');
  let fullMessage = '[' + (reasonLabels[reason] || reason) + ']';
  if (svcLabels) fullMessage += ' Services: ' + svcLabels + '.';
  if (message) fullMessage += ' ' + message;
  closeOverlayPopup('connectRequestOverlay');
  const { targetUserId, targetName, targetRole } = _pendingConnect;
  _pendingConnect = null;
  await sendConnectionRequest(targetUserId, targetName, targetRole, fullMessage);
}

async function cancelConnectionRequest(targetUserId, targetName) {
  try {
    const ok = await customConfirm(t('marketplace.cancel_request') + (targetName ? ' a ' + targetName : '') + ' ?', 'Confirmation');
    if (!ok) return;
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return;
    const { error } = await sb.from('connection_requests').delete()
      .eq('sender_id', user.id)
      .eq('receiver_id', targetUserId)
      .eq('status', 'pending');
    if (error) { showToast('Erreur: ' + safeErr(error, 'suppression impossible')); return; }
    showToast('Demande annulee');
    if (typeof renderAnnuaireTab === 'function') setTimeout(() => renderAnnuaireTab(), 200);
  } catch(e) { console.error('cancelConnectionRequest:', e); showToast('Erreur'); }
}

async function loadConnectionRequests() {
  try {
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return [];
    const { data } = await sb.from('connection_requests')
      .select('*')
      .eq('receiver_id', user.id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });
    return data || [];
  } catch(e) { return []; }
}

async function respondConnectionRequest(requestId, accept) {
  try {
    const { data: req } = await sb.from('connection_requests').select('*').eq('id', requestId).single();
    if (!req) return;

    if (accept) {
      // Add sender to my org as proposed role
      const org = API.getOrg();
      if (org) {
        await sb.from('members').insert({
          org_id: org.id,
          user_id: req.sender_id,
          role: req.proposed_role || 'provider',
          display_name: req.sender_name,
          invited_email: '',
          accepted: true
        });
        await sb.from('connection_requests').update({ status: 'accepted' }).eq('id', requestId);
        showToast(req.sender_name + ' a rejoint votre equipe !');
        await sendAutoMessage(org.id, API.getMember()?.display_name || 'Gestionnaire', API.getRole(), req.sender_name,
          '&#9989; Votre demande de connexion a ete acceptee ! Bienvenue dans l\'equipe.');
        // Reload memberships so the new member sees updated org list
        await API.loadOrganization();
      }
    } else {
      await sb.from('connection_requests').update({ status: 'refused' }).eq('id', requestId);
      showToast('Demande refusee');
      // Notify sender that request was refused
      const org = API.getOrg();
      if (org) {
        await sendAutoMessage(org.id, API.getMember()?.display_name || 'Gestionnaire', API.getRole(), req.sender_name,
          '&#10060; Votre demande de connexion a ete refusee.');
      }
    }
    closeMsg();
    // Refresh notifications badge
    updateConnectionBadge();
  } catch(e) { console.error('respondConnectionRequest error:', e); showToast('Erreur'); }
}

async function showConnectionRequests() {
  const requests = await loadConnectionRequests();
  if (!requests.length) { showToast('Aucune demande en attente'); return; }
  let html = '<div style="padding:8px;">';
  html += '<div style="font-size:16px;font-weight:700;color:var(--text);margin-bottom:12px;text-align:center;">&#128279; Demandes de connexion</div>';
  requests.forEach(r => {
    const roleColors = { owner: '#f59e0b', provider: '#34d399', concierge: '#6c63ff' };
    const roleLabels = { owner: 'Proprietaire', provider: 'Prestataire', concierge: 'Conciergerie' };
    html += '<div style="padding:12px;background:var(--surface2);border-radius:10px;margin-bottom:8px;border-left:3px solid ' + (roleColors[r.sender_role] || '#6c63ff') + ';">';
    html += '<div style="font-weight:700;font-size:14px;color:var(--text);">' + esc(r.sender_name) + '</div>';
    html += '<div style="font-size:11px;color:' + (roleColors[r.sender_role] || '#6c63ff') + ';margin-bottom:8px;">' + (roleLabels[r.sender_role] || r.sender_role) + '</div>';
    if (r.message) html += '<div style="font-size:12px;color:var(--text3);margin-bottom:8px;">' + esc(r.message) + '</div>';
    html += '<div style="display:flex;gap:8px;">';
    html += '<button class="btn btnSuccess" style="flex:1;padding:8px;font-size:12px;" onclick="respondConnectionRequest(\'' + r.id + '\',true)">&#10003; Accepter</button>';
    html += '<button class="btn btnDanger" style="flex:1;padding:8px;font-size:12px;" onclick="respondConnectionRequest(\'' + r.id + '\',false)">&#10007; Refuser</button>';
    html += '</div></div>';
  });
  html += '</div>';
  showMsg(html, true);
}

let _annuaireProfiles = [];
async function renderAnnuaireTab() {
  // Determine which container to use (admin tab, provider or owner inline)
  const container = document.getElementById('annuaireResults') || document.getElementById('provAnnuaireContent') || document.getElementById('ownerAnnuaireContent');
  if (!container) return;

  const roleColors = { owner: '#f59e0b', provider: '#34d399', concierge: '#6c63ff' };
  const roleLabels = { owner: 'Proprietaire', provider: 'Prestataire', concierge: 'Conciergerie' };
  const isPrem = API.isPremium();

  // For provider/owner: build complete HTML including filters
  const isInline = container.id === 'provAnnuaireContent' || container.id === 'ownerAnnuaireContent';
  if (isInline) {
    let fullHtml = '';
    // Requests section
    fullHtml += '<div id="annuaireRequests"></div>';
    // My profile section
    fullHtml += '<div id="annuaireMyProfile"></div>';
    // Sub-tabs: Mes contacts / Rechercher / Mes annonces
    fullHtml += '<div style="display:flex;gap:4px;background:var(--surface2);padding:4px;border-radius:10px;margin-bottom:14px;">';
    fullHtml += '<button id="annSubTab_team" class="annSubTab annSubTabActive" onclick="switchAnnuaireSubTab(\'team\')" style="flex:1;padding:10px 10px;border:none;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;">&#128101; Mes contacts</button>';
    fullHtml += '<button id="annSubTab_search" class="annSubTab" onclick="switchAnnuaireSubTab(\'search\')" style="flex:1;padding:10px 10px;border:none;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;">&#128269; Rechercher</button>';
    fullHtml += '<button id="annSubTab_jobs" class="annSubTab" onclick="switchAnnuaireSubTab(\'jobs\')" style="flex:1;padding:10px 10px;border:none;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;">&#128221; Mes annonces</button>';
    fullHtml += '</div>';
    // Team panel
    fullHtml += '<div id="annuairePanel_team"><div id="annuaireTeam"></div></div>';
    // Search panel
    fullHtml += '<div id="annuairePanel_search" style="display:none;">';
    fullHtml += '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px;">';
    fullHtml += '<select id="annRoleFilter" onchange="filterAnnuaire()" style="padding:8px 12px;background:var(--surface2);color:var(--text);border:1px solid var(--border2);border-radius:8px;font-size:13px;">';
    fullHtml += '<option value="">' + t('marketplace.all_profiles') + '</option><option value="provider">Prestataires</option><option value="owner">Proprietaires</option><option value="concierge">Conciergeries</option></select>';
    fullHtml += '<input type="text" id="annCityFilter" placeholder="' + t('marketplace.city_or_postal') + '" oninput="filterAnnuaire()" style="flex:1;min-width:120px;padding:8px 12px;background:var(--surface2);color:var(--text);border:1px solid var(--border2);border-radius:8px;font-size:13px;">';
    fullHtml += '<select id="annSortFilter" onchange="filterAnnuaire()" style="padding:8px 12px;background:var(--surface2);color:var(--text);border:1px solid var(--border2);border-radius:8px;font-size:13px;">';
    fullHtml += '<option value="recent">Plus recents</option><option value="rating">Meilleure note</option><option value="cleanings">Plus d\'experience</option></select>';
    fullHtml += '</div>';
    fullHtml += '<div id="annServiceFilters" style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px;"></div>';
    fullHtml += '<div id="annuaireResults" style="min-height:200px;"></div>';
    fullHtml += '</div>';
    // Jobs panel (Mes annonces)
    fullHtml += '<div id="annuairePanel_jobs" style="display:none;"><div id="annuaireMyJobs"></div></div>';
    container.innerHTML = fullHtml;
  }

  // ── 1. Connection requests ──
  const reqContainer = document.getElementById('annuaireRequests');
  if (reqContainer) {
    const requests = await loadConnectionRequests();
    let rHtml = '';
    if (requests.length) {
      rHtml += '<div class="panel" style="margin-bottom:12px;padding:12px;border-left:3px solid #e94560;">';
      rHtml += '<div style="font-size:15px;font-weight:700;color:var(--text);margin-bottom:10px;">&#128276; ' + requests.length + ' demande' + (requests.length > 1 ? 's' : '') + ' en attente</div>';
      requests.forEach(r => {
        rHtml += '<div style="display:flex;align-items:center;gap:10px;padding:10px;background:var(--surface2);border-radius:10px;margin-bottom:6px;">';
        rHtml += '<div style="width:36px;height:36px;border-radius:50%;background:' + (roleColors[r.sender_role] || '#6c63ff') + ';display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:700;color:#fff;">' + esc((r.sender_name || '?').charAt(0).toUpperCase()) + '</div>';
        rHtml += '<div style="flex:1;min-width:0;">';
        rHtml += '<div style="font-weight:600;font-size:13px;color:var(--text);">' + esc(r.sender_name) + '</div>';
        rHtml += '<div style="font-size:11px;color:' + (roleColors[r.sender_role] || '#6c63ff') + ';">' + (roleLabels[r.sender_role] || r.sender_role) + '</div>';
        rHtml += '</div>';
        rHtml += '<button class="btn btnSuccess" style="padding:6px 12px;font-size:11px;" onclick="respondConnectionRequest(\'' + r.id + '\',true).then(()=>renderAnnuaireTab())">&#10003;</button>';
        rHtml += '<button class="btn btnDanger" style="padding:6px 12px;font-size:11px;" onclick="respondConnectionRequest(\'' + r.id + '\',false).then(()=>renderAnnuaireTab())">&#10007;</button>';
        rHtml += '</div>';
      });
      rHtml += '</div>';
    }
    reqContainer.innerHTML = rHtml;
  }

  // ── 2. My profile completeness ──
  const profContainer = document.getElementById('annuaireMyProfile');
  if (profContainer) {
    await _ensureMkUserId();
    const { data: myProf } = await sb.from('marketplace_profiles').select('*').eq('user_id', _mkMyUserId).maybeSingle();
    let pHtml = '';
    if (!myProf || !myProf.visible) {
      pHtml += '<div class="panel" style="margin-bottom:12px;padding:14px;background:linear-gradient(135deg,rgba(108,99,255,0.1),rgba(233,69,96,0.1));border:1px dashed var(--accent);border-radius:12px;text-align:center;">';
      pHtml += '<div style="font-size:14px;font-weight:700;color:var(--text);margin-bottom:6px;">&#127758; Rendez-vous visible !</div>';
      pHtml += '<div style="font-size:12px;color:var(--text3);margin-bottom:10px;line-height:1.5;">Creez votre profil pour que les autres utilisateurs puissent vous trouver et se connecter avec vous.</div>';
      pHtml += '<button onclick="createAnnuaireProfile()" style="padding:10px 20px;background:linear-gradient(135deg,#6c63ff,#5a54e0);color:#fff;border:none;border-radius:10px;font-size:13px;font-weight:600;cursor:pointer;">Creer mon profil</button>';
      pHtml += '</div>';
    } else {
      // Profile completeness bar
      let score = 0; let total = 6;
      if (myProf.display_name) score++;
      if (myProf.city) score++;
      if (myProf.description) score++;
      if (myProf.phone) score++;
      if (myProf.services && myProf.services.length > 0) score++;
      if (myProf.experience_years) score++;
      const pct = Math.round((score / total) * 100);
      if (pct < 100) {
        const barColor = pct >= 80 ? '#34d399' : pct >= 50 ? '#f59e0b' : '#e94560';
        const missing = [];
        if (!myProf.display_name) missing.push({ label: 'Nom affiche', icon: '&#128221;' });
        if (!myProf.city) missing.push({ label: 'Ville', icon: '&#127961;' });
        if (!myProf.phone) missing.push({ label: 'Telephone', icon: '&#128222;' });
        if (!myProf.description) missing.push({ label: 'Description', icon: '&#128172;' });
        if (!myProf.services || !myProf.services.length) missing.push({ label: 'Services', icon: '&#128736;' });
        if (!myProf.experience_years) missing.push({ label: 'Experience', icon: '&#11088;' });
        pHtml += '<div class="panel" style="margin-bottom:12px;padding:14px;border-left:3px solid ' + barColor + ';">';
        pHtml += '<div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">';
        pHtml += '<div style="flex:1;font-size:13px;font-weight:600;color:var(--text);">Mon profil annuaire</div>';
        pHtml += '<span style="font-size:12px;font-weight:700;color:' + barColor + ';">' + pct + '%</span>';
        pHtml += '</div>';
        pHtml += '<div style="height:6px;background:var(--surface2);border-radius:3px;overflow:hidden;margin-bottom:12px;">';
        pHtml += '<div style="height:100%;width:' + pct + '%;background:linear-gradient(90deg,#6c63ff,#34d399);border-radius:3px;transition:width 0.3s;"></div>';
        pHtml += '</div>';
        pHtml += '<div style="font-size:11px;color:var(--text3);margin-bottom:8px;">A completer :</div>';
        pHtml += '<div style="display:flex;flex-wrap:wrap;gap:8px;">';
        missing.forEach(m => {
          pHtml += '<button onclick="showAccountModal();setTimeout(()=>openOverlayPopup(\'marketplaceProfileOverlay\'),150)" style="display:inline-flex;align-items:center;gap:6px;padding:7px 12px;background:rgba(108,99,255,0.12);color:var(--accent2);border:1px solid rgba(108,99,255,0.35);border-radius:20px;font-size:12px;font-weight:600;cursor:pointer;transition:all 0.15s;" onmouseover="this.style.background=\'rgba(108,99,255,0.22)\'" onmouseout="this.style.background=\'rgba(108,99,255,0.12)\'">' + m.icon + ' ' + esc(m.label) + '</button>';
        });
        pHtml += '</div>';
        pHtml += '</div>';
      }
    }
    profContainer.innerHTML = pHtml;
  }

  // ── 3. Service filter chips ──
  const chipContainer = document.getElementById('annServiceFilters');
  if (chipContainer) {
    let cHtml = '';
    const popularServices = ['cleaning_standard', 'cleaning_deep', 'checkin', 'checkout', 'laundry', 'gardening', 'pool', 'handyman'];
    popularServices.forEach(sId => {
      const label = getServiceLabel(sId);
      cHtml += '<button class="annServiceChip" data-service="' + sId + '" onclick="toggleAnnServiceFilter(this)" style="padding:4px 10px;border-radius:16px;border:1px solid var(--border2);background:var(--surface2);color:var(--text3);font-size:11px;cursor:pointer;transition:all 0.2s;">' + label + '</button>';
    });
    chipContainer.innerHTML = cHtml;
  }

  // ── 4. My team ──
  const teamContainer = document.getElementById('annuaireTeam');
  if (teamContainer) {
    const org = API.getOrg();
    let tHtml = '';
    let memberCount = 0;
    if (org) {
      const { data: members } = await sb.from('members').select('*').eq('org_id', org.id);
      if (members) memberCount = members.length;
      if (members && members.length > 1) {
        // Index members by id so the detail popup can look them up by id
        window._teamMembersById = {};
        members.forEach(m => { if (m && m.id) window._teamMembersById[m.id] = m; });
        tHtml += '<div style="margin-bottom:12px;">';
        tHtml += '<div style="font-size:13px;font-weight:700;color:var(--text);margin-bottom:8px;">&#128101; Mon equipe (' + members.length + ')</div>';
        tHtml += '<div style="display:flex;gap:8px;overflow-x:auto;padding-bottom:6px;">';
        members.forEach(m => {
          const mColor = roleColors[m.role] || '#6c63ff';
          tHtml += '<button onclick="showTeamMemberDetail(\'' + m.id + '\')" style="flex-shrink:0;text-align:center;width:64px;background:transparent;border:none;padding:4px;border-radius:10px;cursor:pointer;transition:background 0.15s;" onmouseover="this.style.background=\'var(--surface2)\'" onmouseout="this.style.background=\'transparent\'">';
          tHtml += '<div style="width:40px;height:40px;border-radius:50%;background:' + mColor + ';display:flex;align-items:center;justify-content:center;font-size:15px;font-weight:700;color:#fff;margin:0 auto 4px;">' + esc((m.display_name || '?').charAt(0).toUpperCase()) + '</div>';
          tHtml += '<div style="font-size:10px;color:var(--text2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + esc(m.display_name || 'Sans nom') + '</div>';
          tHtml += '</button>';
        });
        tHtml += '</div></div>';
      }
    }
    // Empty state if no contacts
    if (memberCount <= 1) {
      tHtml += '<div style="text-align:center;padding:40px 20px;background:var(--surface2);border-radius:12px;border:1px dashed var(--border2);">';
      tHtml += '<div style="font-size:48px;margin-bottom:12px;opacity:0.6;">&#128101;</div>';
      tHtml += '<div style="font-size:15px;font-weight:700;color:var(--text);margin-bottom:6px;">Aucun contact pour l\'instant</div>';
      tHtml += '<div style="font-size:12px;color:var(--text3);line-height:1.5;margin-bottom:18px;">Trois facons d\'ajouter un contact :</div>';
      tHtml += '<div style="display:flex;flex-direction:column;gap:8px;max-width:340px;margin:0 auto;">';
      // 1. Search marketplace
      tHtml += '<button onclick="switchAnnuaireSubTab(\'search\')" style="display:flex;align-items:center;gap:10px;padding:12px 14px;background:linear-gradient(135deg,#6c63ff,#5a54e0);color:#fff;border:none;border-radius:10px;font-size:13px;font-weight:600;cursor:pointer;text-align:left;">';
      tHtml += '<span style="font-size:20px;">&#128269;</span><div style="flex:1;">Rechercher dans l\'annuaire<div style="font-size:11px;font-weight:400;opacity:0.85;">Trouver des contacts deja inscrits</div></div></button>';
      // 2. Invite via the existing referral modal (WhatsApp / SMS / Email / Telegram)
      tHtml += '<button onclick="showInviteModal()" style="display:flex;align-items:center;gap:10px;padding:12px 14px;background:var(--surface);color:var(--text);border:1px solid var(--accent2);border-radius:10px;font-size:13px;font-weight:600;cursor:pointer;text-align:left;">';
      tHtml += '<span style="font-size:20px;">&#127873;</span><div style="flex:1;">Envoyer une invitation<div style="font-size:11px;font-weight:400;color:var(--text3);">WhatsApp, SMS, email, Telegram</div></div></button>';
      // 3. Manual add
      tHtml += '<button onclick="showAddManualContact()" style="display:flex;align-items:center;gap:10px;padding:12px 14px;background:var(--surface);color:var(--text);border:1px solid var(--border2);border-radius:10px;font-size:13px;font-weight:600;cursor:pointer;text-align:left;">';
      tHtml += '<span style="font-size:20px;">&#128221;</span><div style="flex:1;">Ajouter manuellement<div style="font-size:11px;font-weight:400;color:var(--text3);">Saisir un contact (sans email obligatoire)</div></div></button>';
      tHtml += '</div></div>';
    }
    teamContainer.innerHTML = tHtml;
  }

  // ── 5. Load marketplace profiles ──
  try {
    // Store current user id for self-exclusion in filterAnnuaire
    try { const { data: { user: _u } } = await sb.auth.getUser(); if (_u) window.__currentUserId = _u.id; } catch(_) { /* best-effort user fetch, ignore */ }
    const { data: mkData } = await sb.from('marketplace_profiles').select('*').eq('visible', true);
    _annuaireProfiles = mkData || [];
    // Also add org members not on marketplace
    const org = API.getOrg();
    if (org) {
      const { data: allMembers } = await sb.from('members').select('*').eq('org_id', org.id);
      if (allMembers) {
        const mkUserIds = _annuaireProfiles.map(p => p.user_id);
        allMembers.forEach(m => {
          if (!mkUserIds.includes(m.user_id) && m.role !== 'concierge') {
            _annuaireProfiles.push({ user_id: m.user_id, display_name: m.display_name || '', email: m.invited_email || '', role: m.role, org_id: m.org_id, visible: true, _fromMembers: true });
          }
        });
      }
    }
    filterAnnuaire();
  } catch(e) {
    console.error('loadAnnuaire error:', e);
    const res = document.getElementById('annuaireResults');
    if (res) res.innerHTML = '<div style="text-align:center;padding:30px;color:var(--text3);">Erreur de chargement</div>';
  }
}

let _annActiveServices = [];
function toggleAnnServiceFilter(btn) {
  const sId = btn.dataset.service;
  const idx = _annActiveServices.indexOf(sId);
  if (idx >= 0) {
    _annActiveServices.splice(idx, 1);
    btn.style.background = 'var(--surface2)';
    btn.style.color = 'var(--text3)';
    btn.style.borderColor = 'var(--border2)';
  } else {
    _annActiveServices.push(sId);
    btn.style.background = 'rgba(108,99,255,0.2)';
    btn.style.color = '#a78bfa';
    btn.style.borderColor = '#6c63ff';
  }
  filterAnnuaire();
}

// Render the "Mes annonces" sub-tab: list marketplace_jobs the current user
// (or his org) has posted, with status + a way to cancel an open one.
async function renderMyJobs() {
  const container = document.getElementById('annuaireMyJobs');
  if (!container) return;
  container.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text3);">Chargement...</div>';
  try {
    const { data: { user } } = await sb.auth.getUser();
    if (!user) { container.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text3);">Non connecte</div>'; return; }
    const org = (typeof API !== 'undefined' && API.getOrg) ? API.getOrg() : null;
    let query = sb.from('marketplace_jobs').select('*').order('created_at', { ascending: false });
    if (org && org.id) {
      query = query.or('org_id.eq.' + org.id + ',posted_by.eq.' + user.id);
    } else {
      query = query.eq('posted_by', user.id);
    }
    const { data: jobs, error } = await query;
    if (error) {
      container.innerHTML = '<div style="text-align:center;padding:20px;color:#ef4444;">Erreur: ' + esc(error.message) + '</div>';
      return;
    }
    if (!jobs || jobs.length === 0) {
      container.innerHTML = '<div style="text-align:center;padding:30px 20px;color:var(--text3);"><div style="font-size:32px;opacity:0.4;margin-bottom:8px;">&#128221;</div><div style="font-size:13px;">Aucune annonce publiee.</div><div style="font-size:11px;margin-top:6px;opacity:0.7;">Publiez une annonce depuis une prestation sans prestataire pour qu\'elle apparaisse ici.</div></div>';
      return;
    }
    const statusLabels = {
      open: { label: 'Ouverte', color: '#34d399', bg: 'rgba(52,211,153,0.15)' },
      taken: { label: 'Acceptee', color: '#6c63ff', bg: 'rgba(108,99,255,0.15)' },
      cancelled: { label: 'Annulee', color: '#94a3b8', bg: 'rgba(148,163,184,0.15)' },
      expired: { label: 'Expiree', color: '#f59e0b', bg: 'rgba(245,158,11,0.15)' }
    };
    const svcLabel = (sid) => (typeof getServiceLabel === 'function') ? getServiceLabel(sid) : sid;
    let html = '';
    jobs.forEach(j => {
      const st = statusLabels[j.status] || statusLabels.open;
      const dateLbl = j.requested_date ? new Date(j.requested_date + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' }) : '';
      const expLbl = j.expires_at ? new Date(j.expires_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : '';
      html += '<div style="padding:12px 14px;background:var(--surface2);border:1px solid var(--border2);border-radius:12px;margin-bottom:8px;">';
      html += '<div style="display:flex;align-items:center;gap:10px;margin-bottom:6px;">';
      html += '<div style="font-weight:700;font-size:14px;color:var(--text);flex:1;">&#129529; ' + esc(svcLabel(j.service_type) || 'Mission') + '</div>';
      html += '<span style="font-size:11px;font-weight:600;padding:3px 10px;border-radius:10px;background:' + st.bg + ';color:' + st.color + ';">' + st.label + '</span>';
      html += '</div>';
      if (j.property_name) html += '<div style="font-size:12px;color:var(--text2);margin-bottom:3px;">&#127968; ' + esc(j.property_name) + '</div>';
      if (dateLbl) html += '<div style="font-size:12px;color:var(--text3);text-transform:capitalize;">&#128197; ' + dateLbl + '</div>';
      if (expLbl && j.status === 'open') html += '<div style="font-size:11px;color:var(--text3);margin-top:4px;">&#9203; Expire le ' + expLbl + '</div>';
      if (j.status === 'open') {
        html += '<div style="margin-top:8px;display:flex;justify-content:flex-end;">';
        html += '<button onclick="cancelMyJob(\'' + j.id + '\')" style="padding:6px 12px;background:rgba(239,68,68,0.12);color:#ef4444;border:1px solid rgba(239,68,68,0.3);border-radius:8px;font-size:11px;font-weight:600;cursor:pointer;">Retirer l\'annonce</button>';
        html += '</div>';
      }
      html += '</div>';
    });
    container.innerHTML = html;
  } catch (e) {
    console.error('renderMyJobs error:', e);
    container.innerHTML = '<div style="text-align:center;padding:20px;color:#ef4444;">Erreur de chargement</div>';
  }
}
window.renderMyJobs = renderMyJobs;

async function cancelMyJob(jobId) {
  const ok = await customConfirm('Retirer cette annonce de l\'annuaire ?', 'Retirer');
  if (!ok) return;
  try {
    const { error } = await sb.from('marketplace_jobs').update({ status: 'cancelled' }).eq('id', jobId);
    if (error) { showToast('Erreur: ' + error.message); return; }
    showToast('Annonce retiree');
    renderMyJobs();
  } catch (e) {
    showToast('Erreur lors du retrait');
  }
}
window.cancelMyJob = cancelMyJob;

function switchAnnuaireSubTab(tab) {
  const teamBtn = document.getElementById('annSubTab_team');
  const searchBtn = document.getElementById('annSubTab_search');
  const jobsBtn = document.getElementById('annSubTab_jobs');
  const teamPanel = document.getElementById('annuairePanel_team');
  const searchPanel = document.getElementById('annuairePanel_search');
  const jobsPanel = document.getElementById('annuairePanel_jobs');
  if (!teamBtn || !searchBtn || !teamPanel || !searchPanel) return;
  // Reset all
  [teamBtn, searchBtn, jobsBtn].forEach(b => b && b.classList.remove('annSubTabActive'));
  if (teamPanel) teamPanel.style.display = 'none';
  if (searchPanel) searchPanel.style.display = 'none';
  if (jobsPanel) jobsPanel.style.display = 'none';
  if (tab === 'team') {
    teamBtn.classList.add('annSubTabActive');
    teamPanel.style.display = '';
  } else if (tab === 'jobs') {
    if (jobsBtn) jobsBtn.classList.add('annSubTabActive');
    if (jobsPanel) jobsPanel.style.display = '';
    if (typeof renderMyJobs === 'function') renderMyJobs();
  } else {
    searchBtn.classList.add('annSubTabActive');
    searchPanel.style.display = '';
  }
}

function filterAnnuaire() {
  const roleEl = document.getElementById('annRoleFilter');
  const cityEl = document.getElementById('annCityFilter');
  const sortEl = document.getElementById('annSortFilter');
  const role = roleEl ? roleEl.value : '';
  const city = cityEl ? cityEl.value.trim().toLowerCase() : '';
  const sort = sortEl ? sortEl.value : 'recent';

  let filtered = _annuaireProfiles;

  // Exclude self from the annuaire listing
  if (window.__currentUserId) filtered = filtered.filter(p => p.user_id !== window.__currentUserId);

  // Role filter
  if (role) {
    filtered = filtered.filter(p => p.role === role);
  }

  // City filter
  if (city) {
    filtered = filtered.filter(p => (p.city || '').toLowerCase().includes(city) || (p.postal_code || '').includes(city) || (p.display_name || '').toLowerCase().includes(city));
  }

  // Service filter
  if (_annActiveServices.length > 0) {
    filtered = filtered.filter(p => {
      if (!p.services || !p.services.length) return false;
      return _annActiveServices.some(s => p.services.includes(s));
    });
  }

  // Sort
  filtered = [...filtered];
  if (sort === 'rating') filtered.sort((a, b) => (b.rating || 0) - (a.rating || 0));
  else if (sort === 'cleanings') filtered.sort((a, b) => (b.cleanings_done || 0) - (a.cleanings_done || 0));
  else filtered.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));

  renderAnnuaireResults(filtered);
}

async function renderAnnuaireResults(profiles) {
  await _ensureMkUserId();
  const container = document.getElementById('annuaireResults');
  if (!container) return;
  const isPrem = API.isPremium();
  // Load existing connections to show correct button
  let connectedUserIds = new Set();
  let pendingUserIds = new Set();
  try {
    const { data: { user } } = await sb.auth.getUser();
    if (user) {
      const { data: conns } = await sb.from('connection_requests').select('sender_id,receiver_id,status').or('sender_id.eq.' + user.id + ',receiver_id.eq.' + user.id);
      if (conns) conns.forEach(c => {
        const otherId = c.sender_id === user.id ? c.receiver_id : c.sender_id;
        if (c.status === 'accepted') connectedUserIds.add(otherId);
        if (c.status === 'pending') pendingUserIds.add(otherId);
      });
      // Members of same org
      const org = API.getOrg();
      if (org) {
        const { data: members } = await sb.from('members').select('user_id').eq('org_id', org.id);
        if (members) members.forEach(m => { if (m.user_id) connectedUserIds.add(m.user_id); });
      }
    }
  } catch(e) { /* best-effort, ignore */ }
  const roleColors = { provider: '#34d399', owner: '#f59e0b', concierge: '#6c63ff' };
  const roleLabels = { provider: 'Prestataire', owner: 'Proprietaire', concierge: 'Conciergerie' };
  const availLabels = { available: '&#128994; Disponible', full: '&#128308; Complet', vacation: '&#127796; En vacances' };

  if (!profiles.length) {
    container.innerHTML = '<div style="text-align:center;padding:40px 20px;"><div style="font-size:48px;margin-bottom:12px;opacity:0.4;">&#128269;</div><div style="font-size:15px;font-weight:600;color:var(--text);margin-bottom:6px;">Aucun profil trouve</div><div style="font-size:12px;color:var(--text3);line-height:1.6;">Essayez d\'elargir votre recherche ou de supprimer les filtres.</div></div>';
    return;
  }

  let html = '<div style="font-size:12px;color:var(--text3);margin-bottom:8px;">' + profiles.length + ' profil' + (profiles.length > 1 ? 's' : '') + ' trouve' + (profiles.length > 1 ? 's' : '') + '</div>';

  profiles.forEach(p => {
    const color = roleColors[p.role] || '#6c63ff';
    const label = roleLabels[p.role] || p.role;
    const name = p.display_name || 'Sans nom';
    const initial = (name.charAt(0) || '?').toUpperCase();
    const isNew = p.created_at && (Date.now() - new Date(p.created_at).getTime()) < 7 * 86400000;
    const services = p.services || [];
    const availHtml = isProfileOnVacation(p) ? availLabels['vacation'] : (availLabels[p.availability] || '');

    html += '<div style="padding:14px;margin-bottom:8px;background:var(--surface2);border-radius:12px;border-left:4px solid ' + color + ';transition:transform 0.15s;" onmouseenter="this.style.transform=\'translateY(-1px)\'" onmouseleave="this.style.transform=\'\'">';
    html += '<div style="display:flex;gap:12px;align-items:flex-start;">';
    html += '<div style="width:42px;height:42px;border-radius:50%;background:' + color + ';display:flex;align-items:center;justify-content:center;font-size:17px;font-weight:700;color:#fff;flex-shrink:0;">' + _escHtml(initial) + '</div>';
    html += '<div style="flex:1;min-width:0;">';
    // Name + badges
    html += '<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-bottom:3px;">';
    html += '<span style="font-weight:700;font-size:14px;color:var(--text);">' + _escHtml(name) + '</span>';
    if (p.verified) html += '<span title="Verifie" style="color:#34d399;font-size:13px;font-weight:700;">&#10003;</span>';
    html += '<span style="font-size:10px;padding:2px 7px;border-radius:10px;background:' + color + ';color:#fff;font-weight:600;">' + label + '</span>';
    if (isNew) html += '<span style="font-size:10px;padding:2px 7px;border-radius:10px;background:linear-gradient(135deg,#6c63ff,#a855f7);color:#fff;font-weight:600;">Nouveau</span>';
    html += '</div>';
    // Info line
    html += '<div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:4px;">';
    // Role-specific wording
    const isConcierge = (p.role === 'concierge');
    const isOwnerRole = (p.role === 'owner');
    // Rating
    const rating = parseFloat(p.rating) || 0;
    const ratingCount = parseInt(p.rating_count) || 0;
    if (rating > 0) {
      const stars = '&#11088;'.repeat(Math.round(rating));
      let rtip;
      if (isConcierge) rtip = t('marketplace.avg_rating') + rating.toFixed(1) + '/5 sur ' + ratingCount + ' avis verifie' + (ratingCount > 1 ? 's' : '') + '. Donnee par les proprietaires et prestataires avec lesquels cette conciergerie a travaille.';
      else if (isOwnerRole) rtip = t('marketplace.avg_rating') + rating.toFixed(1) + '/5 sur ' + ratingCount + ' avis verifie' + (ratingCount > 1 ? 's' : '') + '. Donnee par les prestataires et conciergeries ayant collabore avec ce proprietaire.';
      else rtip = t('marketplace.avg_rating') + rating.toFixed(1) + '/5 sur ' + ratingCount + ' avis verifie' + (ratingCount > 1 ? 's' : '') + '. Donnee par les conciergeries et proprietaires apres validation de chaque prestation realisee.';
      html += '<span style="font-size:11px;color:#f59e0b;cursor:help;" title="' + _escHtml(rtip) + '">' + stars + ' ' + rating.toFixed(1) + '/5</span>';
    } else {
      let notip;
      if (isConcierge) notip = 'Aucun avis pour le moment. Les notes sont donnees par les proprietaires et prestataires ayant collabore avec cette conciergerie.';
      else if (isOwnerRole) notip = 'Aucun avis pour le moment. Les notes sont donnees par les prestataires et conciergeries ayant travaille avec ce proprietaire.';
      else notip = 'Aucun avis pour le moment. Les notes sont donnees par les clients apres validation d\'une prestation.';
      html += '<span style="font-size:11px;color:var(--text3);cursor:help;" title="' + _escHtml(notip) + '">&#9734;&#9734;&#9734;&#9734;&#9734; Pas encore note</span>';
    }
    // Stat count (prestations realisees OU organisees OU gerees selon role)
    const cleanings = parseInt(p.cleanings_done) || 0;
    let statLabel, cleanTip;
    if (isConcierge) {
      statLabel = cleanings + ' prestation' + (cleanings > 1 ? 's' : '') + ' organisee' + (cleanings > 1 ? 's' : '');
      cleanTip = cleanings === 0
        ? t('marketplace.no_organized_prestations')
        : cleanings + ' prestation' + (cleanings > 1 ? 's' : '') + ' planifiee' + (cleanings > 1 ? 's' : '') + ' et coordonnee' + (cleanings > 1 ? 's' : '') + ' par cette conciergerie via Lokizio.';
    } else if (isOwnerRole) {
      statLabel = cleanings + ' bien' + (cleanings > 1 ? 's' : '') + ' gere' + (cleanings > 1 ? 's' : '');
      cleanTip = cleanings === 0
        ? 'Ce proprietaire n\'a pas encore de prestations realisees sur ses biens via Lokizio.'
        : cleanings + ' prestation' + (cleanings > 1 ? 's' : '') + ' realisee' + (cleanings > 1 ? 's' : '') + ' sur les biens de ce proprietaire via Lokizio.';
    } else {
      statLabel = cleanings + ' prestation' + (cleanings > 1 ? 's' : '');
      cleanTip = cleanings === 0
        ? t('marketplace.no_validated_prestations')
        : cleanings + ' prestation' + (cleanings > 1 ? 's' : '') + ' realisee' + (cleanings > 1 ? 's' : '') + ' et validee' + (cleanings > 1 ? 's' : '') + ' via Lokizio.';
    }
    html += '<span style="font-size:11px;color:var(--text2);cursor:help;" title="' + _escHtml(cleanTip) + '">&#128700; ' + statLabel + '</span>';
    // Anciennete dans l'annuaire
    if (p.created_at) {
      const daysSince = Math.floor((Date.now() - new Date(p.created_at).getTime()) / 86400000);
      let memberSince;
      if (daysSince < 30) memberSince = daysSince + ' jour' + (daysSince > 1 ? 's' : '');
      else if (daysSince < 365) memberSince = Math.round(daysSince / 30) + ' mois';
      else memberSince = Math.floor(daysSince / 365) + ' an' + (daysSince >= 730 ? 's' : '');
      const joinedDate = new Date(p.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
      html += '<span style="font-size:11px;color:var(--text3);cursor:help;" title="' + t('marketplace.registered_since') + _escHtml(joinedDate) + '">&#128197; ' + memberSince + '</span>';
    }
    if (p.experience_years) html += '<span style="font-size:11px;color:var(--text2);cursor:help;" title="Experience professionnelle declaree par l\'utilisateur">&#128188; ' + p.experience_years + ' ans d\'exp.</span>';
    if (p.tarif) html += '<span style="font-size:11px;color:var(--text2);" title="Tarif indicatif">&#128176; ' + _escHtml(p.tarif) + '</span>';
    if (availHtml) {
      let availTip;
      if (isProfileOnVacation(p)) availTip = t('marketplace.on_vacation');
      else if (isConcierge) availTip = t('marketplace.concierge_accepts_new');
      else if (isOwnerRole) availTip = t('marketplace.owner_seeks_services');
      else availTip = t('marketplace.provider_available');
      html += '<span style="font-size:11px;cursor:help;" title="' + _escHtml(availTip) + '">' + availHtml + '</span>';
    }
    html += '</div>';
    if (p.city) html += '<div style="font-size:11px;color:var(--text3);margin-bottom:4px;">&#128205; ' + _escHtml(p.city) + (p.postal_code ? ' (' + _escHtml(p.postal_code) + ')' : '') + '</div>';
    if (p.description) html += '<div style="font-size:12px;color:var(--text3);margin-bottom:6px;line-height:1.4;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;">' + _escHtml(p.description) + '</div>';
    if (services.length) {
      html += '<div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:6px;">';
      services.slice(0, 5).forEach(s => { html += '<span style="font-size:10px;padding:2px 6px;border-radius:10px;background:rgba(108,99,255,0.12);color:#a78bfa;">' + getServiceLabel(s) + '</span>'; });
      if (services.length > 5) html += '<span style="font-size:10px;color:var(--text3);">+' + (services.length - 5) + '</span>';
      html += '</div>';
    }
    // Actions
    html += '<div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;">';
    if (p.phone) html += '<a href="tel:' + _escHtml(p.phone) + '" style="display:inline-flex;align-items:center;gap:3px;font-size:11px;color:#34d399;text-decoration:none;padding:4px 8px;background:rgba(52,211,153,0.1);border-radius:6px;">&#128222; Appeler</a>';
    if (p.email) html += '<a href="mailto:' + _escHtml(p.email) + '" style="display:inline-flex;align-items:center;gap:3px;font-size:11px;color:var(--accent);text-decoration:none;padding:4px 8px;background:rgba(108,99,255,0.1);border-radius:6px;">&#9993; Email</a>';
    if (p.user_id !== _mkMyUserId) {
      const isConnected = connectedUserIds.has(p.user_id);
      const isPending = pendingUserIds.has(p.user_id);
      if (isConnected) {
        html += '<span style="margin-left:auto;display:inline-flex;align-items:center;gap:4px;padding:6px 10px;background:rgba(52,211,153,0.1);border:1px solid rgba(52,211,153,0.3);border-radius:8px;font-size:11px;color:#34d399;font-weight:600;">&#10003; Connecte</span>';
        html += '<button onclick="disconnectUser(\'' + _escHtml(p.user_id) + '\',\'' + _escHtml(p.display_name || '') + '\')" style="padding:6px 10px;background:none;color:var(--text3);border:1px solid var(--border2);border-radius:8px;font-size:10px;cursor:pointer;" title="Se deconnecter">Retirer</button>';
      } else if (isPending) {
        html += '<span style="margin-left:auto;padding:6px 14px;background:rgba(245,158,11,0.1);border:1px solid rgba(245,158,11,0.3);border-radius:8px;font-size:11px;color:#f59e0b;font-weight:600;">&#9203; En attente</span>';
        html += '<button onclick="cancelConnectionRequest(\'' + _escHtml(p.user_id) + '\',\'' + _escHtml(p.display_name || '') + '\')" style="padding:6px 10px;background:none;color:var(--text3);border:1px solid var(--border2);border-radius:8px;font-size:10px;cursor:pointer;" title="' + t('marketplace.cancel_my_request') + '">Annuler</button>';
      } else if (isPrem) {
        html += '<button onclick="openConnectRequestPopup(\'' + _escHtml(p.user_id) + '\',\'' + _escHtml(p.display_name || '') + '\',\'' + _escHtml(p.role) + '\')" style="margin-left:auto;padding:6px 14px;background:linear-gradient(135deg,#6c63ff,#5a54e0);color:#fff;border:none;border-radius:8px;font-size:11px;font-weight:600;cursor:pointer;">&#128279; Se connecter</button>';
      } else {
        html += '<button onclick="showPremiumModal(\'Passez Premium pour vous connecter avec d\\\'autres professionnels.\')" style="margin-left:auto;padding:6px 14px;background:var(--surface);color:var(--text3);border:1px solid var(--border2);border-radius:8px;font-size:11px;cursor:pointer;">&#128274; Premium</button>';
      }
    }
    html += '</div>';
    html += '</div></div></div>';
  });

  container.innerHTML = html;
}

let _connectionBadgeInterval = null;
async function updateConnectionBadge() {
  const requests = await loadConnectionRequests();
  const badge = document.getElementById('connectionBadge');
  const btn = document.getElementById('btnConnections');
  if (badge) {
    badge.textContent = requests.length;
    badge.style.display = requests.length > 0 ? 'flex' : 'none';
  }
  if (btn) {
    btn.style.display = requests.length > 0 ? '' : 'none';
  }
  // Start auto-refresh every 30s if not already running
  if (!_connectionBadgeInterval) {
    _connectionBadgeInterval = setInterval(async () => {
      const reqs = await loadConnectionRequests();
      const b = document.getElementById('connectionBadge');
      const bt = document.getElementById('btnConnections');
      if (b) { b.textContent = reqs.length; b.style.display = reqs.length > 0 ? 'flex' : 'none'; }
      if (bt) { bt.style.display = reqs.length > 0 ? '' : 'none'; }
    }, 30000);
  }
}

async function loadMarketplaceData() {
  const { data: mkData, error: mkErr } = await sb
    .from('marketplace_profiles')
    .select('*')
    .eq('visible', true);
  if (mkErr) throw mkErr;
  _mkAllProfiles = mkData || [];
  // Also load org members not yet on marketplace
  const { data: allMembers } = await sb.from('members').select('*').eq('org_id', API.getOrg()?.id);
  if (allMembers) {
    const mkUserIds = _mkAllProfiles.map(p => p.user_id);
    allMembers.forEach(m => {
      if (!mkUserIds.includes(m.user_id) && m.role !== 'concierge') {
        _mkAllProfiles.push({
          user_id: m.user_id, display_name: m.display_name || m.invited_email || '',
          email: m.invited_email || '', role: m.role, org_id: m.org_id, visible: true, _fromMembers: true
        });
      }
    });
  }
  filterMarketplace();
}

function closeMarketplace() {
  if (_mkRefreshInterval) { clearInterval(_mkRefreshInterval); _mkRefreshInterval = null; }
  document.getElementById('overlay').style.display = 'none';
  document.getElementById('marketplaceModal').style.display = 'none';
}

function filterMarketplace() {
  const role = document.getElementById('mkRoleFilter').value;
  const city = document.getElementById('mkCityFilter').value.trim().toLowerCase();
  const radius = parseInt(document.getElementById('mkRadiusFilter').value) || 0;
  const sort = document.getElementById('mkSortFilter')?.value || 'recent';
  let filtered = _mkAllProfiles;
  if (role) {
    filtered = filtered.filter(p => {
      return p.role === role;
    });
  }
  if (city) filtered = filtered.filter(p => !p.city || (p.city || '').toLowerCase().includes(city) || (p.postal_code || '').includes(city) || (p.display_name || '').toLowerCase().includes(city));
  if (radius > 0) {
    filtered = filtered.filter(p => {
      if (!p.lat || !p.lng) return true;
      return true;
    });
  }
  // Sort
  filtered = [...filtered];
  if (sort === 'rating') {
    filtered.sort((a, b) => (b.rating || 0) - (a.rating || 0));
  } else if (sort === 'cleanings') {
    filtered.sort((a, b) => (b.cleanings_done || 0) - (a.cleanings_done || 0));
  } else if (sort === 'price_asc') {
    filtered.sort((a, b) => (parseFloat(a.tarif) || 9999) - (parseFloat(b.tarif) || 9999));
  } else if (sort === 'price_desc') {
    filtered.sort((a, b) => (parseFloat(b.tarif) || 0) - (parseFloat(a.tarif) || 0));
  } else {
    filtered.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
  }
  renderMarketplaceResults(filtered);
}

function _mkStarRating(rating) {
  const r = Math.round((rating || 0) * 2) / 2;
  let stars = '';
  for (let i = 1; i <= 5; i++) {
    if (i <= r) stars += '<span style="color:#f59e0b;">&#9733;</span>';
    else if (i - 0.5 <= r) stars += '<span style="color:#f59e0b;">&#9733;</span>';
    else stars += '<span style="color:#444;">&#9733;</span>';
  }
  return stars;
}

function _mkIsNew(createdAt) {
  if (!createdAt) return false;
  const diff = Date.now() - new Date(createdAt).getTime();
  return diff < 7 * 24 * 60 * 60 * 1000;
}

let _mkMyUserId = null;
async function _ensureMkUserId() {
  if (!_mkMyUserId) { const { data: { user } } = await sb.auth.getUser(); _mkMyUserId = user?.id; }
}

async function renderMarketplaceResults(profiles) {
  await _ensureMkUserId();
  const container = document.getElementById('mkResults');
  const myRole = API.getRole();
  // Load connection status for all profiles
  let _mkConnected = new Set();
  let _mkPending = new Set();
  try {
    const { data: { user } } = await sb.auth.getUser();
    if (user) {
      const { data: conns } = await sb.from('connection_requests').select('sender_id,receiver_id,status').or('sender_id.eq.' + user.id + ',receiver_id.eq.' + user.id);
      if (conns) conns.forEach(c => {
        const otherId = c.sender_id === user.id ? c.receiver_id : c.sender_id;
        if (c.status === 'accepted') _mkConnected.add(otherId);
        if (c.status === 'pending') _mkPending.add(otherId);
      });
      const org = API.getOrg();
      if (org) {
        const { data: members } = await sb.from('members').select('user_id').eq('org_id', org.id);
        if (members) members.forEach(m => { if (m.user_id) _mkConnected.add(m.user_id); });
      }
    }
  } catch(e) { /* best-effort, ignore */ }
  if (!profiles.length) {
    container.innerHTML = `<div style="text-align:center;padding:40px 20px;">
      <div style="font-size:48px;margin-bottom:12px;opacity:0.4;">&#128269;</div>
      <div style="font-size:16px;font-weight:600;color:var(--text);margin-bottom:8px;">Aucun profil trouve</div>
      <div style="font-size:13px;color:var(--text3);line-height:1.6;">Essayez d'elargir votre recherche :<br>
      &#8226; Supprimez le filtre de ville<br>
      &#8226; Augmentez le rayon de recherche<br>
      &#8226; Selectionnez "Tous les profils"</div>
    </div>`;
    return;
  }
  const roleColors = { provider: '#34d399', owner: '#f59e0b', concierge: '#6c63ff' };
  const roleLabels = { provider: 'Prestataire', owner: 'Proprietaire', concierge: 'Concierge' };
  const availLabels = { available: '&#128994; Disponible', full: '&#128308; Complet', vacation: '&#127796; En vacances' };
  let html = '';
  profiles.forEach(p => {
    const color = roleColors[p.role] || '#6c63ff';
    const label = roleLabels[p.role] || p.role;
    const name = p.display_name || 'Sans nom';
    const initial = (name.charAt(0) || '?').toUpperCase();
    const isNew = _mkIsNew(p.created_at);
    const services = p.services || [];
    const starHtml = _mkStarRating(p.rating);
    const availHtml = isProfileOnVacation(p) ? availLabels['vacation'] : (availLabels[p.availability] || '');

    html += `<div style="padding:16px;margin-bottom:10px;background:var(--surface2);border-radius:12px;border-left:4px solid ${color};transition:transform 0.15s,box-shadow 0.15s;cursor:default;" onmouseenter="this.style.transform='translateY(-2px)';this.style.boxShadow='0 4px 20px rgba(0,0,0,0.3)';" onmouseleave="this.style.transform='';this.style.boxShadow='';">
      <div style="display:flex;gap:12px;align-items:flex-start;">
        <div style="width:44px;height:44px;border-radius:50%;background:${color};display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:700;color:#fff;flex-shrink:0;">${_escHtml(initial)}</div>
        <div style="flex:1;min-width:0;">
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:4px;">
            <span style="font-weight:700;font-size:15px;color:var(--text);">${_escHtml(name)}</span>
            ${p.verified ? '<span title="Verifie" style="color:#34d399;font-size:14px;font-weight:700;">&#10003;</span>' : ''}
            <span style="font-size:10px;padding:2px 8px;border-radius:10px;background:${color};color:#fff;font-weight:600;">${label}</span>
            ${isNew ? '<span style="font-size:10px;padding:2px 8px;border-radius:10px;background:linear-gradient(135deg,#6c63ff,#a855f7);color:#fff;font-weight:600;">Nouveau</span>' : ''}
          </div>
          <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:6px;">
            <span style="font-size:13px;">${starHtml}</span>
            ${p.reviews_count ? `<span style="font-size:11px;color:var(--text3);">(${p.reviews_count} avis)</span>` : ''}
            ${availHtml ? `<span style="font-size:11px;">${availHtml}</span>` : ''}
          </div>
          <div style="display:flex;gap:14px;flex-wrap:wrap;margin-bottom:6px;">
            ${p.cleanings_done ? `<span style="font-size:11px;color:var(--text2);">&#128700; ${p.cleanings_done} menages</span>` : ''}
            ${p.experience_years ? `<span style="font-size:11px;color:var(--text2);">&#128188; ${p.experience_years} ans exp.</span>` : ''}
            ${p.tarif ? `<span style="font-size:11px;color:var(--text2);">&#128176; ${_escHtml(p.tarif)}</span>` : ''}
          </div>
          ${p.city ? `<div style="font-size:12px;color:var(--text2);margin-bottom:6px;">&#128205; ${_escHtml(p.city)}${p.postal_code ? ' (' + _escHtml(p.postal_code) + ')' : ''}</div>` : ''}
          ${p.description ? `<div style="font-size:12px;color:var(--text3);margin-bottom:8px;line-height:1.5;overflow:hidden;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;">${_escHtml(p.description)}</div>` : ''}
          ${services.length ? `<div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:8px;">${services.map(s => `<span style="font-size:10px;padding:3px 8px;border-radius:12px;background:rgba(108,99,255,0.15);color:#a78bfa;font-weight:500;">${_escHtml(s)}</span>`).join('')}</div>` : ''}
          <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
            ${p.phone ? `<a href="tel:${_escHtml(p.phone)}" style="display:inline-flex;align-items:center;gap:4px;font-size:12px;color:#34d399;text-decoration:none;padding:5px 10px;background:rgba(52,211,153,0.1);border-radius:8px;border:1px solid rgba(52,211,153,0.2);transition:background 0.2s;" onmouseenter="this.style.background='rgba(52,211,153,0.2)'" onmouseleave="this.style.background='rgba(52,211,153,0.1)'">&#128222; Appeler</a>` : ''}
            ${p.email ? `<a href="mailto:${_escHtml(p.email)}" style="display:inline-flex;align-items:center;gap:4px;font-size:12px;color:var(--accent);text-decoration:none;padding:5px 10px;background:rgba(108,99,255,0.1);border-radius:8px;border:1px solid rgba(108,99,255,0.2);transition:background 0.2s;" onmouseenter="this.style.background='rgba(108,99,255,0.2)'" onmouseleave="this.style.background='rgba(108,99,255,0.1)'">&#9993; Email</a>` : ''}
            ${p.user_id && p.user_id !== _mkMyUserId ? `<button onclick="openAnnuaireMessage('${_escHtml(p.user_id)}','${_escHtml(p.display_name || '').replace(/'/g, "\\'")}')" style="display:inline-flex;align-items:center;gap:4px;font-size:12px;color:#f59e0b;background:rgba(245,158,11,0.1);border:1px solid rgba(245,158,11,0.2);border-radius:8px;padding:5px 10px;cursor:pointer;transition:background 0.2s;" onmouseenter="this.style.background='rgba(245,158,11,0.2)'" onmouseleave="this.style.background='rgba(245,158,11,0.1)'">&#128172; Message</button>` : ''}
            ${p.user_id !== _mkMyUserId ? (_mkConnected.has(p.user_id) ? `<span style="margin-left:auto;display:inline-flex;align-items:center;gap:4px;padding:6px 10px;background:rgba(52,211,153,0.1);border:1px solid rgba(52,211,153,0.3);border-radius:8px;font-size:11px;color:#34d399;font-weight:600;">&#10003; Connecte</span><button onclick="disconnectUser('${_escHtml(p.user_id)}','${_escHtml(p.display_name)}')" style="padding:6px 10px;background:none;color:var(--text3);border:1px solid var(--border2);border-radius:8px;font-size:10px;cursor:pointer;">Retirer</button>` : _mkPending.has(p.user_id) ? `<span style="margin-left:auto;padding:6px 14px;background:rgba(245,158,11,0.1);border:1px solid rgba(245,158,11,0.3);border-radius:8px;font-size:11px;color:#f59e0b;font-weight:600;">&#9203; En attente</span>` : API.isPremium() ? `<button onclick="sendConnectionRequest('${_escHtml(p.user_id)}','${_escHtml(p.display_name)}','${_escHtml(p.role)}')" style="margin-left:auto;padding:7px 16px;background:linear-gradient(135deg,#6c63ff,#5a54e0);color:#fff;border:none;border-radius:8px;font-size:11px;font-weight:600;cursor:pointer;">&#128279; Se connecter</button>` : `<button onclick="showPremiumModal(t('marketplace.premium_required_connect'))" style="margin-left:auto;padding:7px 16px;background:var(--surface);color:var(--text3);border:1px solid var(--border2);border-radius:8px;font-size:11px;cursor:pointer;">&#128274; Premium</button>`) : ''}
          </div>
        </div>
      </div>
    </div>`;
  });
  container.innerHTML = html;
}

// Detail popup for a team member (clicked from the "Mon equipe" bubbles
// in the annuaire). Shows name, role, email, phone, notes + actions.
function showTeamMemberDetail(memberId) {
  const m = (window._teamMembersById || {})[memberId];
  if (!m) { showToast('Contact introuvable'); return; }
  document.getElementById('teamMemberDetailOverlay')?.remove();
  const overlay = document.createElement('div');
  overlay.id = 'teamMemberDetailOverlay';
  overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.7);z-index:99999;display:flex;align-items:center;justify-content:center;padding:20px;';
  overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
  const roleLabels = { owner: 'Proprietaire', provider: 'Prestataire', concierge: 'Conciergerie', admin: 'Admin', manager: 'Manager', tenant: 'Locataire' };
  const roleColors = { owner: '#f59e0b', provider: '#34d399', concierge: '#6c63ff', admin: '#e94560', manager: '#a78bfa', tenant: '#06b6d4' };
  const roleLbl = roleLabels[m.role] || m.role || '';
  const roleColor = roleColors[m.role] || '#6c63ff';
  const name = m.display_name || m.invited_email || 'Sans nom';
  const initial = (name.charAt(0) || '?').toUpperCase();
  const safeName = name.replace(/'/g, "\\'");
  let html = '<div style="max-width:440px;width:100%;background:var(--surface);border-radius:14px;border:1px solid var(--border);overflow:hidden;">';
  html += '<div style="padding:18px 18px 14px;display:flex;align-items:center;gap:14px;border-bottom:1px solid var(--border);">';
  html += '<div style="width:54px;height:54px;border-radius:50%;background:' + roleColor + ';display:inline-flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:22px;flex-shrink:0;">' + esc(initial) + '</div>';
  html += '<div style="flex:1;min-width:0;">';
  html += '<div style="font-size:16px;font-weight:700;color:var(--text);">' + esc(name) + '</div>';
  html += '<div style="font-size:12px;color:' + roleColor + ';margin-top:3px;">' + esc(roleLbl) + (m.accepted ? '' : ' &middot; <span style="color:var(--text3);">contact manuel</span>') + '</div>';
  html += '</div>';
  html += '<button aria-label="Fermer" onclick="document.getElementById(\'teamMemberDetailOverlay\').remove()" style="background:transparent;border:none;color:var(--text3);font-size:22px;cursor:pointer;line-height:1;">&times;</button>';
  html += '</div>';
  html += '<div style="padding:16px 18px;display:flex;flex-direction:column;gap:10px;">';
  if (m.invited_email) html += '<div style="font-size:13px;color:var(--text2);"><span style="color:var(--text3);">&#9993; Email :</span> ' + esc(m.invited_email) + '</div>';
  if (m.phone) html += '<div style="font-size:13px;color:var(--text2);"><span style="color:var(--text3);">&#128222; Telephone :</span> ' + esc(m.phone) + '</div>';
  if (m.address) html += '<div style="font-size:13px;color:var(--text2);"><span style="color:var(--text3);">&#128205; Adresse :</span> ' + esc(m.address) + '</div>';
  if (m.company_name) html += '<div style="font-size:13px;color:var(--text2);"><span style="color:var(--text3);">&#127970; Entreprise :</span> ' + esc(m.company_name) + '</div>';
  if (m.siret) html += '<div style="font-size:13px;color:var(--text2);"><span style="color:var(--text3);">SIRET :</span> ' + esc(m.siret) + '</div>';
  if (m.notes) html += '<div style="font-size:13px;color:var(--text2);background:var(--surface2);padding:10px 12px;border-radius:8px;border-left:3px solid ' + roleColor + ';"><span style="color:var(--text3);font-size:11px;text-transform:uppercase;letter-spacing:0.5px;display:block;margin-bottom:4px;">Notes</span>' + esc(m.notes) + '</div>';
  if (!m.invited_email && !m.phone && !m.address && !m.notes) {
    html += '<div style="font-size:12px;color:var(--text3);text-align:center;padding:18px 0;">Aucune information supplementaire.</div>';
  }
  // Actions
  html += '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:6px;">';
  if (m.phone) html += '<a href="tel:' + esc(m.phone) + '" style="flex:1;min-width:90px;padding:9px;text-align:center;background:rgba(52,211,153,0.12);color:#34d399;text-decoration:none;border:1px solid rgba(52,211,153,0.3);border-radius:8px;font-size:12px;font-weight:600;">&#128222; Appeler</a>';
  if (m.invited_email) html += '<a href="mailto:' + esc(m.invited_email) + '" style="flex:1;min-width:90px;padding:9px;text-align:center;background:rgba(108,99,255,0.12);color:#a5a0ff;text-decoration:none;border:1px solid rgba(108,99,255,0.3);border-radius:8px;font-size:12px;font-weight:600;">&#9993; Email</a>';
  if (m.user_id) html += '<button onclick="openAnnuaireMessage(\'' + esc(m.user_id) + '\',\'' + safeName + '\')" style="flex:1;min-width:90px;padding:9px;background:rgba(245,158,11,0.12);color:#f59e0b;border:1px solid rgba(245,158,11,0.3);border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;">&#128172; Message</button>';
  html += '</div>';
  // Delete option for manual contacts (no auth user)
  if (!m.user_id) {
    html += '<button onclick="deleteTeamMember(\'' + esc(m.id) + '\',\'' + safeName + '\')" style="margin-top:10px;padding:9px;background:transparent;color:#ef4444;border:1px dashed rgba(239,68,68,0.4);border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;">&#128465; Supprimer ce contact</button>';
  }
  html += '</div></div>';
  overlay.innerHTML = html;
  document.body.appendChild(overlay);
}
window.showTeamMemberDetail = showTeamMemberDetail;

async function deleteTeamMember(memberId, memberName) {
  const ok = await customConfirm('Supprimer le contact "' + memberName + '" ?', 'Supprimer');
  if (!ok) return;
  try {
    const { error } = await sb.from('members').delete().eq('id', memberId);
    if (error) { showToast('Erreur: ' + error.message); return; }
    document.getElementById('teamMemberDetailOverlay')?.remove();
    showToast('Contact supprime');
    if (typeof renderAnnuaireTab === 'function') setTimeout(() => renderAnnuaireTab(), 200);
  } catch (e) {
    showToast('Erreur lors de la suppression');
  }
}
window.deleteTeamMember = deleteTeamMember;

// In-app message popup from an annuaire card. Sends a row in `messages`
// addressed to the recipient's user_id and triggers a push notification.
function openAnnuaireMessage(recipientUserId, recipientName) {
  if (!recipientUserId) return;
  const existing = document.getElementById('annMsgOverlay');
  if (existing) existing.remove();
  const overlay = document.createElement('div');
  overlay.id = 'annMsgOverlay';
  overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.6);z-index:99998;display:flex;align-items:center;justify-content:center;padding:20px;';
  overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
  const safeName = (recipientName || 'cet utilisateur').replace(/'/g, "\\'");
  let html = '<div style="max-width:440px;width:100%;background:var(--surface);border-radius:14px;border:1px solid var(--border);overflow:hidden;">';
  html += '<div style="padding:16px 18px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--border);">';
  html += '<div style="font-size:15px;font-weight:700;color:var(--text);">&#128172; Message a ' + _escHtml(recipientName || 'utilisateur') + '</div>';
  html += '<button onclick="document.getElementById(\'annMsgOverlay\').remove()" style="background:transparent;border:none;color:var(--text3);font-size:20px;cursor:pointer;line-height:1;">&times;</button>';
  html += '</div>';
  html += '<div style="padding:16px 18px;">';
  html += '<textarea id="annMsgBody" rows="5" placeholder="Bonjour, je vous contacte depuis l\'annuaire Lokizio..." style="width:100%;padding:10px 12px;background:var(--surface2);color:var(--text);border:1px solid var(--border2);border-radius:10px;font-size:13px;font-family:inherit;resize:vertical;box-sizing:border-box;"></textarea>';
  html += '<div style="display:flex;gap:8px;margin-top:12px;">';
  html += '<button onclick="document.getElementById(\'annMsgOverlay\').remove()" style="flex:1;padding:10px;background:var(--surface2);color:var(--text);border:1px solid var(--border2);border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;">Annuler</button>';
  html += '<button onclick="sendAnnuaireMessage(\'' + recipientUserId + '\',\'' + safeName + '\')" style="flex:2;padding:10px;background:linear-gradient(135deg,#6c63ff,#5a54e0);color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;">&#128231; Envoyer</button>';
  html += '</div>';
  html += '</div>';
  html += '</div>';
  overlay.innerHTML = html;
  document.body.appendChild(overlay);
  setTimeout(() => { const ta = document.getElementById('annMsgBody'); if (ta) ta.focus(); }, 80);
}
window.openAnnuaireMessage = openAnnuaireMessage;

async function sendAnnuaireMessage(recipientUserId, recipientName) {
  const ta = document.getElementById('annMsgBody');
  const body = (ta?.value || '').trim();
  if (!body) { showToast('Message vide'); return; }
  try {
    const { data: { user } } = await sb.auth.getUser();
    if (!user) { showToast('Non connecte'); return; }
    const org = (typeof API !== 'undefined' && API.getOrg) ? API.getOrg() : null;
    let senderName = user.email || 'Utilisateur';
    let senderRole = 'concierge';
    try {
      const { data: m } = await sb.from('members').select('display_name,role').eq('user_id', user.id).maybeSingle();
      if (m) { senderName = m.display_name || senderName; senderRole = m.role || senderRole; }
    } catch(_) { /* best-effort sender info */ }
    const payload = {
      sender_id: user.id,
      sender_name: senderName,
      sender_role: senderRole,
      recipient_user_id: recipientUserId,
      recipient_name: recipientName || '',
      body: body,
    };
    if (org && org.id) payload.org_id = org.id;
    const { error } = await sb.from('messages').insert(payload);
    if (error) { showToast('Erreur: ' + error.message); return; }
    if (typeof sendPushToUser === 'function') {
      try { await sendPushToUser(recipientUserId, '&#128172; Nouveau message', senderName + ' vous a envoye un message', { tag: 'msg-' + user.id }); } catch(_) { /* push optional */ }
    }
    showToast('Message envoye');
    document.getElementById('annMsgOverlay')?.remove();
  } catch (e) {
    console.error('sendAnnuaireMessage error:', e);
    showToast('Erreur envoi');
  }
}
window.sendAnnuaireMessage = sendAnnuaireMessage;

window.showMarketplace = showMarketplace;
window.closeMarketplace = closeMarketplace;
window.filterMarketplace = filterMarketplace;
window.renderMarketplaceResults = renderMarketplaceResults;
window.renderAnnuaireTab = renderAnnuaireTab;
window.renderAnnuaireResults = renderAnnuaireResults;
window.switchAnnuaireSubTab = switchAnnuaireSubTab;
window.toggleAnnServiceFilter = toggleAnnServiceFilter;
window.filterAnnuaire = filterAnnuaire;
window.loadMarketplaceData = loadMarketplaceData;

// Click handler for the "Creer mon profil" CTA in the Annuaire tab.
// 1. Switch to the Annuaire tab if not already there
// 2. Open the marketplace profile overlay
// 3. Force the visibility toggle ON (auto-saves on change)
async function createAnnuaireProfile() {
  // Make sure we are on the Annuaire tab (concierge / provider / owner navs all use 'annuaire')
  const role = (typeof API !== 'undefined' && API.getRole) ? API.getRole() : '';
  if (typeof switchMainTab === 'function' && role === 'concierge') {
    try { switchMainTab('annuaire'); } catch(e) { /* ignore */ }
  } else if (typeof switchProviderNav === 'function' && role === 'provider') {
    try { switchProviderNav('annuaire'); } catch(e) { /* ignore */ }
  } else if (typeof switchOwnerNav === 'function' && role === 'owner') {
    try { switchOwnerNav('annuaire'); } catch(e) { /* ignore */ }
  }
  // Open the overlay AFTER nav has rendered
  setTimeout(() => {
    if (typeof openOverlayPopup === 'function') {
      openOverlayPopup('marketplaceProfileOverlay');
    }
    // Activate the visible toggle on next tick (the overlay loads async)
    setTimeout(() => {
      const toggle = document.getElementById('mkVisibleToggle');
      if (toggle && !toggle.checked) {
        toggle.checked = true;
        if (typeof toggleMarketplaceVisibility === 'function') {
          toggleMarketplaceVisibility(true);
        } else {
          // Fallback: dispatch native change event so any listener catches it
          toggle.dispatchEvent(new Event('change', { bubbles: true }));
        }
      }
    }, 400);
  }, 200);
}
window.createAnnuaireProfile = createAnnuaireProfile;

// ─── Manual contact + email invite (Mes contacts empty state) ───

// Open a popup to invite a contact by email (sends invite link via email).
async function showInviteContactByEmail() {
  const overlay = document.createElement('div');
  overlay.id = 'inviteContactOverlay';
  overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.7);z-index:99999;display:flex;align-items:center;justify-content:center;padding:20px;';
  overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
  let html = '<div style="max-width:420px;width:100%;background:var(--surface);border-radius:14px;border:1px solid var(--border);overflow:hidden;">';
  html += '<div style="display:flex;justify-content:space-between;align-items:center;padding:14px 16px;border-bottom:1px solid var(--border);">';
  html += '<div style="font-size:14px;font-weight:700;color:var(--text);">&#9993;&#65039; Inviter par email</div>';
  html += '<button aria-label="Fermer" onclick="document.getElementById(\'inviteContactOverlay\').remove()" style="background:transparent;border:none;color:var(--text3);font-size:20px;cursor:pointer;">&times;</button>';
  html += '</div>';
  html += '<div style="padding:16px;">';
  html += '<label style="display:block;font-size:11px;color:var(--text3);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;">Email du contact</label>';
  html += '<input id="inviteContactEmail" type="email" placeholder="prenom@example.com" autocomplete="email" style="width:100%;padding:11px 12px;background:var(--surface2);color:var(--text);border:1px solid var(--border2);border-radius:8px;font-size:14px;box-sizing:border-box;margin-bottom:12px;">';
  html += '<label style="display:block;font-size:11px;color:var(--text3);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;">Role attendu</label>';
  html += '<select id="inviteContactRole" style="width:100%;padding:10px 12px;background:var(--surface2);color:var(--text);border:1px solid var(--border2);border-radius:8px;font-size:14px;margin-bottom:12px;">';
  html += '<option value="provider">&#129529; Prestataire</option>';
  html += '<option value="owner">&#127968; Proprietaire</option>';
  html += '<option value="concierge">&#127970; Conciergerie</option>';
  html += '</select>';
  html += '<label style="display:block;font-size:11px;color:var(--text3);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;">Message (optionnel)</label>';
  html += '<textarea id="inviteContactMessage" rows="3" placeholder="Bonjour, je vous invite a rejoindre Lokizio pour collaborer sur des prestations..." style="width:100%;padding:10px 12px;background:var(--surface2);color:var(--text);border:1px solid var(--border2);border-radius:8px;font-size:13px;font-family:Inter,sans-serif;resize:vertical;box-sizing:border-box;margin-bottom:14px;"></textarea>';
  html += '<div style="display:flex;gap:10px;">';
  html += '<button onclick="document.getElementById(\'inviteContactOverlay\').remove()" style="flex:1;padding:12px;background:var(--surface2);color:var(--text2);border:1px solid var(--border2);border-radius:8px;font-size:14px;cursor:pointer;">Annuler</button>';
  html += '<button onclick="sendContactInvite()" style="flex:1;padding:12px;background:linear-gradient(135deg,#6c63ff,#5a54e0);color:#fff;border:none;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;">&#128231; Envoyer</button>';
  html += '</div>';
  html += '</div></div>';
  overlay.innerHTML = html;
  document.body.appendChild(overlay);
}
window.showInviteContactByEmail = showInviteContactByEmail;

async function sendContactInvite() {
  const email = (document.getElementById('inviteContactEmail') || {}).value?.trim() || '';
  const role = (document.getElementById('inviteContactRole') || {}).value || 'provider';
  const customMsg = (document.getElementById('inviteContactMessage') || {}).value?.trim() || '';
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    showToast('Email invalide');
    return;
  }
  const appUrl = window.location.origin + window.location.pathname;
  const roleLabels = { provider: 'prestataire', owner: 'proprietaire', concierge: 'conciergerie' };
  const subject = 'Invitation Lokizio';
  const body = (customMsg || ('Vous etes invite a rejoindre Lokizio en tant que ' + roleLabels[role] + '.'))
    + '\n\nCreez votre compte ici: ' + appUrl
    + '\nUtilisez l\'email: ' + email
    + '\n\n-- Lokizio';
  // Try edge function send-email if available; otherwise fall back to mailto
  try {
    const { data: { session } } = await sb.auth.getSession();
    if (session) {
      const resp = await fetch(`${SUPABASE_URL}/functions/v1/send-email`, {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + session.access_token,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: email, subject, html: body.replace(/\n/g, '<br>'),
          type: 'connection',
        }),
      });
      if (resp.ok) {
        document.getElementById('inviteContactOverlay')?.remove();
        showToast('Invitation envoyee a ' + email);
        return;
      }
    }
  } catch (e) { /* fall back */ }
  // Fallback: open default mail client
  window.location.href = 'mailto:' + email + '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body);
  document.getElementById('inviteContactOverlay')?.remove();
  showToast('Email pret a envoyer');
}
window.sendContactInvite = sendContactInvite;

// Open a popup to add a contact manually (saved as a private contact, no email required).
async function showAddManualContact() {
  const overlay = document.createElement('div');
  overlay.id = 'manualContactOverlay';
  overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.7);z-index:99999;display:flex;align-items:center;justify-content:center;padding:20px;';
  overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
  let html = '<div style="max-width:420px;width:100%;background:var(--surface);border-radius:14px;border:1px solid var(--border);overflow:hidden;">';
  html += '<div style="display:flex;justify-content:space-between;align-items:center;padding:14px 16px;border-bottom:1px solid var(--border);">';
  html += '<div style="font-size:14px;font-weight:700;color:var(--text);">&#128221; Ajouter un contact</div>';
  html += '<button aria-label="Fermer" onclick="document.getElementById(\'manualContactOverlay\').remove()" style="background:transparent;border:none;color:var(--text3);font-size:20px;cursor:pointer;">&times;</button>';
  html += '</div>';
  html += '<div style="padding:16px;max-height:70vh;overflow-y:auto;">';
  html += '<label style="display:block;font-size:11px;color:var(--text3);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;">Nom <span style="color:#ef4444;">*</span></label>';
  html += '<input id="mcName" type="text" placeholder="Marie Dupont" style="width:100%;padding:11px 12px;background:var(--surface2);color:var(--text);border:1px solid var(--border2);border-radius:8px;font-size:14px;box-sizing:border-box;margin-bottom:10px;">';
  html += '<label style="display:block;font-size:11px;color:var(--text3);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;">Role</label>';
  html += '<select id="mcRole" style="width:100%;padding:10px 12px;background:var(--surface2);color:var(--text);border:1px solid var(--border2);border-radius:8px;font-size:14px;margin-bottom:10px;">';
  html += '<option value="provider">&#129529; Prestataire</option>';
  html += '<option value="owner">&#127968; Proprietaire</option>';
  html += '<option value="concierge">&#127970; Conciergerie</option>';
  html += '<option value="other">&#128100; Autre</option>';
  html += '</select>';
  html += '<label style="display:block;font-size:11px;color:var(--text3);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;">Telephone</label>';
  html += '<input id="mcPhone" type="tel" placeholder="06 12 34 56 78" autocomplete="tel" style="width:100%;padding:11px 12px;background:var(--surface2);color:var(--text);border:1px solid var(--border2);border-radius:8px;font-size:14px;box-sizing:border-box;margin-bottom:10px;">';
  html += '<label style="display:block;font-size:11px;color:var(--text3);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;">Email (optionnel)</label>';
  html += '<input id="mcEmail" type="email" placeholder="prenom@example.com" autocomplete="email" style="width:100%;padding:11px 12px;background:var(--surface2);color:var(--text);border:1px solid var(--border2);border-radius:8px;font-size:14px;box-sizing:border-box;margin-bottom:10px;">';
  html += '<label style="display:block;font-size:11px;color:var(--text3);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;">Notes</label>';
  html += '<textarea id="mcNotes" rows="2" placeholder="Disponible le week-end, vehicule, etc." style="width:100%;padding:10px 12px;background:var(--surface2);color:var(--text);border:1px solid var(--border2);border-radius:8px;font-size:13px;font-family:Inter,sans-serif;resize:vertical;box-sizing:border-box;margin-bottom:14px;"></textarea>';
  html += '<div style="display:flex;gap:10px;">';
  html += '<button onclick="document.getElementById(\'manualContactOverlay\').remove()" style="flex:1;padding:12px;background:var(--surface2);color:var(--text2);border:1px solid var(--border2);border-radius:8px;font-size:14px;cursor:pointer;">Annuler</button>';
  html += '<button onclick="saveManualContact()" style="flex:1;padding:12px;background:linear-gradient(135deg,#6c63ff,#5a54e0);color:#fff;border:none;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;">&#128190; Enregistrer</button>';
  html += '</div>';
  html += '</div></div>';
  overlay.innerHTML = html;
  document.body.appendChild(overlay);
}
window.showAddManualContact = showAddManualContact;

async function saveManualContact() {
  // Loud feedback helper: always surfaces an error to the user, even if showToast is broken.
  const tell = (msg, kind) => {
    console.warn('[saveManualContact]', msg);
    try { if (typeof showToast === 'function') showToast(msg, kind || ''); } catch (_) { /* toast unavailable */ }
    if (kind === 'error') { try { alert(msg); } catch (_) { /* alert unavailable */ } }
  };
  const nameEl = document.getElementById('mcName');
  const roleEl = document.getElementById('mcRole');
  const phoneEl = document.getElementById('mcPhone');
  const emailEl = document.getElementById('mcEmail');
  const notesEl = document.getElementById('mcNotes');
  if (!nameEl) { tell('Erreur: champ Nom introuvable', 'error'); return; }
  const name = (nameEl.value || '').trim();
  const role = (roleEl?.value) || 'provider';
  const phone = (phoneEl?.value || '').trim();
  const email = (emailEl?.value || '').trim();
  const notes = (notesEl?.value || '').trim();
  if (!name) { tell('Le nom est obligatoire', 'error'); nameEl.focus(); return; }

  const org = (typeof API !== 'undefined' && API.getOrg) ? API.getOrg() : null;
  if (!org || !org.id) { tell('Organisation introuvable — recharge la page', 'error'); return; }

  // Save as a member with accepted=false (manual contact, no auth user yet)
  try {
    const payload = {
      org_id: org.id,
      role: role === 'other' ? 'provider' : role,
      invited_email: email || null,
      display_name: name,
      phone: phone || null,
      notes: notes || null,
      accepted: false,
    };
    // Use the SECURITY DEFINER RPC to bypass the RLS quirk on members.insert
    // (PostgREST evaluates auth.uid() differently in the policy WITH CHECK).
    // The RPC re-checks membership server-side, so security is preserved.
    let { data, error } = await sb.rpc('add_manual_contact', {
      p_org_id: payload.org_id,
      p_role: payload.role,
      p_name: payload.display_name,
      p_email: payload.invited_email,
      p_phone: payload.phone,
      p_notes: payload.notes,
    });
    // Fallback to direct insert if RPC isn't deployed yet
    if (error && /function.*add_manual_contact|does not exist/i.test(error.message || '')) {
      console.warn('[saveManualContact] RPC not found, fallback to direct insert');
      ({ data, error } = await sb.from('members').insert(payload).select().maybeSingle());
    }
    if (error) {
      console.error('[saveManualContact] insert error:', error);
      tell('Erreur: ' + (error.message || error.details || error.code || 'inconnue'), 'error');
      return;
    }
    document.getElementById('manualContactOverlay')?.remove();
    tell('Contact ajoute : ' + name);
    if (typeof renderAnnuaireTab === 'function') setTimeout(() => renderAnnuaireTab(), 200);
  } catch (e) {
    console.error('[saveManualContact] exception:', e);
    tell('Erreur: ' + (e?.message || String(e)), 'error');
  }
}
window.saveManualContact = saveManualContact;
window.sendConnectionRequest = sendConnectionRequest;
window.submitConnectionRequest = submitConnectionRequest;
window.openConnectRequestPopup = openConnectRequestPopup;
window.loadConnectionRequests = loadConnectionRequests;
window.showConnectionRequests = showConnectionRequests;
window.respondConnectionRequest = respondConnectionRequest;
window.cancelConnectionRequest = cancelConnectionRequest;
window.disconnectUser = disconnectUser;
window.updateConnectionBadge = updateConnectionBadge;
