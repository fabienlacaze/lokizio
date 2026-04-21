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
      } catch(e) {}
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
        const wantDisconnect = await customConfirm('Vous etes deja connecte avec ' + targetName + '. Voulez-vous vous deconnecter ?', 'Se deconnecter');
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
    work: 'Collaborer sur des prestations',
    hire: 'Recruter / Proposer des missions',
    service: 'Demander un service pour mes biens',
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
    const ok = await customConfirm('Annuler votre demande de connexion' + (targetName ? ' a ' + targetName : '') + ' ?', 'Confirmation');
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
    // Sub-tabs: Mes contacts / Rechercher
    fullHtml += '<div style="display:flex;gap:4px;background:var(--surface2);padding:4px;border-radius:10px;margin-bottom:14px;">';
    fullHtml += '<button id="annSubTab_team" class="annSubTab annSubTabActive" onclick="switchAnnuaireSubTab(\'team\')" style="flex:1;padding:10px 14px;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;">&#128101; Mes contacts</button>';
    fullHtml += '<button id="annSubTab_search" class="annSubTab" onclick="switchAnnuaireSubTab(\'search\')" style="flex:1;padding:10px 14px;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;">&#128269; Rechercher</button>';
    fullHtml += '</div>';
    // Team panel
    fullHtml += '<div id="annuairePanel_team"><div id="annuaireTeam"></div></div>';
    // Search panel
    fullHtml += '<div id="annuairePanel_search" style="display:none;">';
    fullHtml += '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px;">';
    fullHtml += '<select id="annRoleFilter" onchange="filterAnnuaire()" style="padding:8px 12px;background:var(--surface2);color:var(--text);border:1px solid var(--border2);border-radius:8px;font-size:13px;">';
    fullHtml += '<option value="">Tous les profils</option><option value="provider">Prestataires</option><option value="owner">Proprietaires</option><option value="concierge">Conciergeries</option></select>';
    fullHtml += '<input type="text" id="annCityFilter" placeholder="Ville ou code postal..." oninput="filterAnnuaire()" style="flex:1;min-width:120px;padding:8px 12px;background:var(--surface2);color:var(--text);border:1px solid var(--border2);border-radius:8px;font-size:13px;">';
    fullHtml += '<select id="annSortFilter" onchange="filterAnnuaire()" style="padding:8px 12px;background:var(--surface2);color:var(--text);border:1px solid var(--border2);border-radius:8px;font-size:13px;">';
    fullHtml += '<option value="recent">Plus recents</option><option value="rating">Meilleure note</option><option value="cleanings">Plus d\'experience</option></select>';
    fullHtml += '</div>';
    fullHtml += '<div id="annServiceFilters" style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px;"></div>';
    fullHtml += '<div id="annuaireResults" style="min-height:200px;"></div>';
    fullHtml += '</div>';
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
      pHtml += '<button onclick="showAccountModal()" style="padding:10px 20px;background:linear-gradient(135deg,#6c63ff,#5a54e0);color:#fff;border:none;border-radius:10px;font-size:13px;font-weight:600;cursor:pointer;">Creer mon profil</button>';
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
        tHtml += '<div style="margin-bottom:12px;">';
        tHtml += '<div style="font-size:13px;font-weight:700;color:var(--text);margin-bottom:8px;">&#128101; Mon equipe (' + members.length + ')</div>';
        tHtml += '<div style="display:flex;gap:8px;overflow-x:auto;padding-bottom:6px;">';
        members.forEach(m => {
          const mColor = roleColors[m.role] || '#6c63ff';
          tHtml += '<div style="flex-shrink:0;text-align:center;width:60px;">';
          tHtml += '<div style="width:40px;height:40px;border-radius:50%;background:' + mColor + ';display:flex;align-items:center;justify-content:center;font-size:15px;font-weight:700;color:#fff;margin:0 auto 4px;">' + esc((m.display_name || '?').charAt(0).toUpperCase()) + '</div>';
          tHtml += '<div style="font-size:10px;color:var(--text2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + esc(m.display_name || 'Sans nom') + '</div>';
          tHtml += '</div>';
        });
        tHtml += '</div></div>';
      }
    }
    // Empty state if no contacts
    if (memberCount <= 1) {
      tHtml += '<div style="text-align:center;padding:40px 20px;background:var(--surface2);border-radius:12px;border:1px dashed var(--border2);">';
      tHtml += '<div style="font-size:48px;margin-bottom:12px;opacity:0.6;">&#128101;</div>';
      tHtml += '<div style="font-size:15px;font-weight:700;color:var(--text);margin-bottom:6px;">Aucun contact pour l\'instant</div>';
      tHtml += '<div style="font-size:12px;color:var(--text3);line-height:1.5;margin-bottom:14px;">Recherchez des prestataires, proprietaires ou conciergeries dans l\'onglet <b>Rechercher</b> pour les ajouter a votre reseau.</div>';
      tHtml += '<button onclick="switchAnnuaireSubTab(\'search\')" style="padding:10px 20px;background:linear-gradient(135deg,#6c63ff,#5a54e0);color:#fff;border:none;border-radius:10px;font-size:13px;font-weight:600;cursor:pointer;">&#128269; Rechercher des contacts</button>';
      tHtml += '</div>';
    }
    teamContainer.innerHTML = tHtml;
  }

  // ── 5. Load marketplace profiles ──
  try {
    // Store current user id for self-exclusion in filterAnnuaire
    try { const { data: { user: _u } } = await sb.auth.getUser(); if (_u) window.__currentUserId = _u.id; } catch(_) {}
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

function switchAnnuaireSubTab(tab) {
  const teamBtn = document.getElementById('annSubTab_team');
  const searchBtn = document.getElementById('annSubTab_search');
  const teamPanel = document.getElementById('annuairePanel_team');
  const searchPanel = document.getElementById('annuairePanel_search');
  if (!teamBtn || !searchBtn || !teamPanel || !searchPanel) return;
  if (tab === 'team') {
    teamBtn.classList.add('annSubTabActive');
    searchBtn.classList.remove('annSubTabActive');
    teamPanel.style.display = '';
    searchPanel.style.display = 'none';
  } else {
    searchBtn.classList.add('annSubTabActive');
    teamBtn.classList.remove('annSubTabActive');
    teamPanel.style.display = 'none';
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
  } catch(e) {}
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
      if (isConcierge) rtip = 'Note moyenne de ' + rating.toFixed(1) + '/5 sur ' + ratingCount + ' avis verifie' + (ratingCount > 1 ? 's' : '') + '. Donnee par les proprietaires et prestataires avec lesquels cette conciergerie a travaille.';
      else if (isOwnerRole) rtip = 'Note moyenne de ' + rating.toFixed(1) + '/5 sur ' + ratingCount + ' avis verifie' + (ratingCount > 1 ? 's' : '') + '. Donnee par les prestataires et conciergeries ayant collabore avec ce proprietaire.';
      else rtip = 'Note moyenne de ' + rating.toFixed(1) + '/5 sur ' + ratingCount + ' avis verifie' + (ratingCount > 1 ? 's' : '') + '. Donnee par les conciergeries et proprietaires apres validation de chaque prestation realisee.';
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
        ? 'Aucune prestation organisee a ce jour via Lokizio.'
        : cleanings + ' prestation' + (cleanings > 1 ? 's' : '') + ' planifiee' + (cleanings > 1 ? 's' : '') + ' et coordonnee' + (cleanings > 1 ? 's' : '') + ' par cette conciergerie via Lokizio.';
    } else if (isOwnerRole) {
      statLabel = cleanings + ' bien' + (cleanings > 1 ? 's' : '') + ' gere' + (cleanings > 1 ? 's' : '');
      cleanTip = cleanings === 0
        ? 'Ce proprietaire n\'a pas encore de prestations realisees sur ses biens via Lokizio.'
        : cleanings + ' prestation' + (cleanings > 1 ? 's' : '') + ' realisee' + (cleanings > 1 ? 's' : '') + ' sur les biens de ce proprietaire via Lokizio.';
    } else {
      statLabel = cleanings + ' prestation' + (cleanings > 1 ? 's' : '');
      cleanTip = cleanings === 0
        ? 'Aucune prestation validee a ce jour via Lokizio.'
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
      html += '<span style="font-size:11px;color:var(--text3);cursor:help;" title="Inscrit sur Lokizio depuis le ' + _escHtml(joinedDate) + '">&#128197; ' + memberSince + '</span>';
    }
    if (p.experience_years) html += '<span style="font-size:11px;color:var(--text2);cursor:help;" title="Experience professionnelle declaree par l\'utilisateur">&#128188; ' + p.experience_years + ' ans d\'exp.</span>';
    if (p.tarif) html += '<span style="font-size:11px;color:var(--text2);" title="Tarif indicatif">&#128176; ' + _escHtml(p.tarif) + '</span>';
    if (availHtml) {
      let availTip;
      if (isProfileOnVacation(p)) availTip = 'Actuellement en conges, ne prendra pas de nouvelles missions.';
      else if (isConcierge) availTip = 'Cette conciergerie accepte de nouveaux proprietaires et prestataires.';
      else if (isOwnerRole) availTip = 'Ce proprietaire cherche des services pour ses biens.';
      else availTip = 'Ce prestataire est disponible pour de nouvelles missions.';
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
        html += '<button onclick="cancelConnectionRequest(\'' + _escHtml(p.user_id) + '\',\'' + _escHtml(p.display_name || '') + '\')" style="padding:6px 10px;background:none;color:var(--text3);border:1px solid var(--border2);border-radius:8px;font-size:10px;cursor:pointer;" title="Annuler la demande">Annuler</button>';
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
  } catch(e) {}
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
            ${p.user_id !== _mkMyUserId ? (_mkConnected.has(p.user_id) ? `<span style="margin-left:auto;display:inline-flex;align-items:center;gap:4px;padding:6px 10px;background:rgba(52,211,153,0.1);border:1px solid rgba(52,211,153,0.3);border-radius:8px;font-size:11px;color:#34d399;font-weight:600;">&#10003; Connecte</span><button onclick="disconnectUser('${_escHtml(p.user_id)}','${_escHtml(p.display_name)}')" style="padding:6px 10px;background:none;color:var(--text3);border:1px solid var(--border2);border-radius:8px;font-size:10px;cursor:pointer;">Retirer</button>` : _mkPending.has(p.user_id) ? `<span style="margin-left:auto;padding:6px 14px;background:rgba(245,158,11,0.1);border:1px solid rgba(245,158,11,0.3);border-radius:8px;font-size:11px;color:#f59e0b;font-weight:600;">&#9203; En attente</span>` : API.isPremium() ? `<button onclick="sendConnectionRequest('${_escHtml(p.user_id)}','${_escHtml(p.display_name)}','${_escHtml(p.role)}')" style="margin-left:auto;padding:7px 16px;background:linear-gradient(135deg,#6c63ff,#5a54e0);color:#fff;border:none;border-radius:8px;font-size:11px;font-weight:600;cursor:pointer;">&#128279; Se connecter</button>` : `<button onclick="showPremiumModal('Passez Premium pour vous connecter.')" style="margin-left:auto;padding:7px 16px;background:var(--surface);color:var(--text3);border:1px solid var(--border2);border-radius:8px;font-size:11px;cursor:pointer;">&#128274; Premium</button>`) : ''}
          </div>
        </div>
      </div>
    </div>`;
  });
  container.innerHTML = html;
}

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
window.sendConnectionRequest = sendConnectionRequest;
window.submitConnectionRequest = submitConnectionRequest;
window.openConnectRequestPopup = openConnectRequestPopup;
window.loadConnectionRequests = loadConnectionRequests;
window.showConnectionRequests = showConnectionRequests;
window.respondConnectionRequest = respondConnectionRequest;
window.cancelConnectionRequest = cancelConnectionRequest;
window.disconnectUser = disconnectUser;
window.updateConnectionBadge = updateConnectionBadge;
