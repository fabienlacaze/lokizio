// Owner mode module — property details, add/save, find conciergerie, nav
// Depends on: sb, API, esc, showMsg, showToast, customConfirm, fullConfig,
//   loadInvoices, renderAnnuaireTab, loadOwnerInvoices (from owner-invoices)
// Exposes: switchOwnerProperty, renderOwnerPropertyDetails, ownerAddNewProperty,
//   saveOwnerPropDetail, handleOwnerPropPhoto, findConciergerie, switchOwnerNav


/* ── Owner Nav Switching ── */
function switchOwnerProperty(idx) {
  document.querySelectorAll('.ownerPropCard').forEach(c => c.style.display = 'none');
  document.querySelectorAll('.ownerPropBtn').forEach(b => { b.style.fontWeight='500'; b.style.border='1px solid var(--border2)'; b.style.background='var(--surface2)'; b.style.color='var(--text)'; });
  const card = document.querySelector('.ownerPropCard[data-idx="' + idx + '"]');
  if (card) card.style.display = '';
  const btn = document.querySelector('.ownerPropBtn[data-idx="' + idx + '"]');
  if (btn) { btn.style.fontWeight='700'; btn.style.border='2px solid var(--accent)'; btn.style.background='rgba(233,69,96,0.15)'; btn.style.color='var(--accent)'; }
}

async function renderOwnerPropertyDetails() {
  const org = API.getOrg();
  if (!org) return;
  const member = API.getMember();
  const { data: allProps } = await sb.from('properties').select('*').eq('org_id', org.id);
  const { data: { user: _ownerUser } } = await sb.auth.getUser();
  let properties = (allProps || []).filter(p => p.owner_member_id === member.id || p.owner_email === (_ownerUser?.email || ''));

  // Render selector
  const selContainer = document.getElementById('ownerBiensSelector');
  if (selContainer && properties.length > 0) {
    const activeId = window._ownerActivePropId || properties[0].id;
    let sHtml = '<div style="display:flex;gap:8px;overflow-x:auto;padding-bottom:4px;">';
    properties.forEach(p => {
      const isActive = p.id === activeId;
      sHtml += '<button onclick="window._ownerActivePropId=\'' + p.id + '\';renderOwnerPropertyDetails()" style="padding:8px 16px;border-radius:10px;font-size:12px;font-weight:' + (isActive ? '700' : '500') + ';cursor:pointer;white-space:nowrap;border:' + (isActive ? '2px solid var(--accent)' : '1px solid var(--border2)') + ';background:' + (isActive ? 'rgba(233,69,96,0.15)' : 'var(--surface2)') + ';color:' + (isActive ? 'var(--accent)' : 'var(--text)') + ';flex-shrink:0;">🏠 ' + esc(p.name) + '</button>';
    });
    sHtml += '<button onclick="ownerAddNewProperty()" style="padding:8px 16px;border-radius:10px;font-size:12px;font-weight:600;cursor:pointer;white-space:nowrap;border:1px dashed var(--success);background:transparent;color:var(--success);transition:all 0.2s;flex-shrink:0;">+ Nouveau bien</button>';
    sHtml += '</div>';
    selContainer.innerHTML = sHtml;
    if (!window._ownerActivePropId) window._ownerActivePropId = properties[0].id;
  }

  // Find active property
  const activeProp = properties.find(p => p.id === window._ownerActivePropId) || properties[0];
  if (!activeProp) return;

  // Render same form as admin but owner can edit everything (no hasOwner restriction)
  const detailContainer = document.getElementById('ownerPropertyDetailsInline');
  if (!detailContainer) return;

  // Temporarily set active property so renderPropertyDetailsInline works
  // We'll build a simplified version here that the owner can edit
  const prop = activeProp;
  const sectionStyle = 'background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:16px;margin-bottom:12px;';
  const labelStyle = 'font-size:11px;color:var(--text3);text-transform:uppercase;display:block;margin-bottom:4px;';
  const inputStyle = 'width:100%;padding:10px;background:var(--surface2);color:var(--text);border:1px solid var(--border2);border-radius:8px;font-size:13px;margin-bottom:10px;box-sizing:border-box;';

  let html = '';

  // ── Property completeness bar (clickable items as chips) ──
  {
    let score = 0; let total = 6;
    const missing = [];
    if (prop.name && prop.name !== 'Mon logement' && prop.name !== 'Nouveau bien') score++; else missing.push({ label: 'Nom', icon: '&#128221;', target: 'ownerPropName' });
    if (prop.address) score++; else missing.push({ label: 'Adresse', icon: '&#128205;', target: 'ownerPropAddress' });
    if (prop.type && prop.rooms) score++; else missing.push({ label: 'Type/pieces', icon: '&#127968;', target: 'ownerPropType' });
    if (prop.photo) score++; else missing.push({ label: 'Photo', icon: '&#128247;', target: 'ownerPropPhotoInput' });
    if (prop.checkinTime && prop.checkoutTime) score++; else missing.push({ label: 'Horaires', icon: '&#128336;', target: 'ownerPropCheckin' });
    if (prop.accessCode) score++; else missing.push({ label: 'Code d\'acces', icon: '&#128274;', target: 'ownerPropAccessCode' });
    const pct = Math.round((score / total) * 100);
    if (pct < 100) {
      const barColor = pct >= 80 ? '#34d399' : pct >= 50 ? '#f59e0b' : '#e94560';
      html += '<div style="' + sectionStyle + 'padding:14px;border-left:3px solid ' + barColor + ';">';
      html += '<div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">';
      html += '<div style="flex:1;font-size:13px;font-weight:600;color:var(--text);">Configuration du bien</div>';
      html += '<span style="font-size:12px;font-weight:700;color:' + barColor + ';">' + pct + '%</span>';
      html += '</div>';
      html += '<div style="height:6px;background:var(--surface2);border-radius:3px;overflow:hidden;margin-bottom:12px;">';
      html += '<div style="height:100%;width:' + pct + '%;background:linear-gradient(90deg,#6c63ff,#34d399);border-radius:3px;transition:width 0.3s;"></div>';
      html += '</div>';
      html += '<div style="font-size:11px;color:var(--text3);margin-bottom:8px;">A completer :</div>';
      html += '<div style="display:flex;flex-wrap:wrap;gap:8px;">';
      missing.forEach(m => {
        html += '<button onclick="scrollToPropField(\'' + m.target + '\')" style="display:inline-flex;align-items:center;gap:6px;padding:7px 12px;background:rgba(108,99,255,0.12);color:var(--accent2);border:1px solid rgba(108,99,255,0.35);border-radius:20px;font-size:12px;font-weight:600;cursor:pointer;transition:all 0.15s;" onmouseover="this.style.background=\'rgba(108,99,255,0.22)\'" onmouseout="this.style.background=\'rgba(108,99,255,0.12)\'">' + m.icon + ' ' + esc(m.label) + '</button>';
      });
      html += '</div></div>';
    }
  }

  // Ma conciergerie section (top of page)
  const { data: adminsOfOrg } = await sb.from('members').select('*').eq('org_id', org.id).eq('role', 'concierge');
  const concierge = adminsOfOrg && adminsOfOrg.find(m => m.user_id !== user.id);
  if (concierge) {
    html += '<div style="' + sectionStyle + 'border-color:#6c63ff;background:rgba(108,99,255,0.08);">';
    html += '<div style="font-size:13px;font-weight:700;text-transform:uppercase;color:#6c63ff;margin-bottom:10px;">&#127970; Ma conciergerie</div>';
    html += '<div style="display:flex;align-items:center;gap:12px;">';
    html += '<div style="width:42px;height:42px;border-radius:10px;background:linear-gradient(135deg,#6c63ff,#5a54e0);display:flex;align-items:center;justify-content:center;font-size:18px;color:#fff;font-weight:700;">' + (concierge.display_name || org.name || 'C').charAt(0).toUpperCase() + '</div>';
    html += '<div style="flex:1;">';
    html += '<div style="font-size:14px;font-weight:700;color:var(--text);">' + esc(concierge.display_name || org.name || 'Conciergerie') + '</div>';
    if (concierge.phone) html += '<div style="font-size:11px;color:var(--text3);margin-top:2px;">&#128222; ' + esc(concierge.phone) + '</div>';
    if (concierge.email) html += '<div style="font-size:11px;color:var(--text3);margin-top:1px;">&#128233; ' + esc(concierge.email) + '</div>';
    html += '</div>';
    html += '<a href="#" onclick="switchTab(\'chat\');return false;" style="padding:8px 12px;background:rgba(108,99,255,0.15);border-radius:8px;color:#6c63ff;font-size:11px;font-weight:600;text-decoration:none;">&#128172; Chat</a>';
    html += '</div></div>';
  } else {
    // No concierge — show "Trouver une conciergerie"
    const ownerAddr = (prop.address || '').replace(/'/g, "\\'");
    html += '<div style="margin-bottom:12px;"><button onclick="findConciergerie()" style="width:100%;padding:12px 20px;background:linear-gradient(135deg,#6c63ff,#5a54e0);color:#fff;border:none;border-radius:10px;font-size:14px;font-weight:600;cursor:pointer;">&#127970; Trouver une conciergerie</button></div>';
  }

  const sectionTitleStyle = 'font-size:12px;color:var(--text3);text-transform:uppercase;letter-spacing:1px;font-weight:700;display:flex;align-items:center;gap:6px;';
  const typeOptions = [{ v:'apartment',l:'Appartement'},{v:'house',l:'Maison'},{v:'studio',l:'Studio'},{v:'villa',l:'Villa'},{v:'chalet',l:'Chalet'},{v:'other',l:'Autre'}];

  // SECTION: Photo + General Info (photo left, fields right, stacks on mobile)
  html += '<details style="' + sectionStyle + '">';
  html += '<summary style="list-style:none;cursor:pointer;"><div style="' + sectionTitleStyle + 'margin-bottom:0;display:flex;justify-content:space-between;"><span>&#127968; Informations generales</span><span class="collapseArrow">&#9662;</span></div></summary>';
  html += '<div style="margin-top:12px;"><div style="display:flex;gap:16px;flex-wrap:wrap;align-items:flex-start;">';
  // Photo (left)
  html += '<div style="flex:0 0 200px;min-width:180px;">';
  html += '<div style="width:100%;aspect-ratio:1/1;border-radius:12px;overflow:hidden;background:var(--surface2);display:flex;align-items:center;justify-content:center;cursor:pointer;" onclick="document.getElementById(\'ownerPropPhotoInput\').click()">';
  if (prop.photo) html += '<img src="' + esc(prop.photo) + '" style="width:100%;height:100%;object-fit:cover;">';
  else html += '<span style="color:var(--text3);font-size:12px;text-align:center;padding:8px;">&#128247; Cliquez pour ajouter la photo</span>';
  html += '</div>';
  html += '<input type="file" id="ownerPropPhotoInput" accept="image/*" style="display:none;" onchange="handleOwnerPropPhoto(this)">';
  html += '</div>';
  // Fields (right)
  html += '<div style="flex:1;min-width:240px;">';
  html += '<div style="margin-bottom:12px;"><label style="' + labelStyle + '">Nom</label>';
  html += '<input id="ownerPropName" type="text" value="' + esc(prop.name || '') + '" style="' + inputStyle + '"></div>';
  html += '<div style="margin-bottom:12px;"><label style="' + labelStyle + '">Adresse</label>';
  html += '<input id="ownerPropAddress" type="text" value="' + esc(prop.address || '') + '" placeholder="12 rue de France, Nice" style="' + inputStyle + '"></div>';
  html += '<div style="display:flex;gap:10px;flex-wrap:wrap;">';
  html += '<div style="flex:1;min-width:100px;"><label style="' + labelStyle + '">Type</label><select id="ownerPropType" style="' + inputStyle + '">';
  typeOptions.forEach(o => { html += '<option value="' + o.v + '" ' + (prop.type === o.v ? 'selected' : '') + '>' + o.l + '</option>'; });
  html += '</select></div>';
  html += '<div style="flex:0.5;min-width:70px;"><label style="' + labelStyle + '">Pieces</label><input id="ownerPropRooms" type="number" min="1" max="20" value="' + (prop.rooms || '') + '" style="' + inputStyle + '"></div>';
  html += '<div style="flex:0.7;min-width:90px;"><label style="' + labelStyle + '">Salle de bain</label><input id="ownerPropBathrooms" type="number" min="0" max="10" value="' + (prop.bathrooms || 1) + '" style="' + inputStyle + '"></div>';
  html += '<div style="flex:0.5;min-width:70px;"><label style="' + labelStyle + '">m²</label><input id="ownerPropSurface" type="number" min="1" max="1000" value="' + (prop.surface || '') + '" style="' + inputStyle + '"></div>';
  html += '</div>';
  html += '</div>'; // end right col
  html += '</div>'; // end flex row
  html += '</div>'; // end details body
  html += '</details>';

  // SECTION: Hours + Access
  html += '<details style="' + sectionStyle + '">';
  html += '<summary style="list-style:none;cursor:pointer;"><div style="' + sectionTitleStyle + 'margin-bottom:0;display:flex;justify-content:space-between;"><span>&#128272; Horaires & Acces</span><span class="collapseArrow">&#9662;</span></div></summary>';
  html += '<div style="margin-top:12px;">';
  html += '<div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:12px;">';
  html += '<div style="flex:1;min-width:100px;"><label style="' + labelStyle + '">Check-in</label><input id="ownerPropCheckin" type="time" value="' + (prop.checkinTime || '15:00') + '" style="' + inputStyle + '"></div>';
  html += '<div style="flex:1;min-width:100px;"><label style="' + labelStyle + '">Check-out</label><input id="ownerPropCheckout" type="time" value="' + (prop.checkoutTime || '11:00') + '" style="' + inputStyle + '"></div>';
  html += '</div>';
  html += '<div style="margin-bottom:12px;"><label style="' + labelStyle + '">Code d\'acces</label>';
  html += '<input id="ownerPropAccessCode" type="text" value="' + esc(prop.accessCode || '') + '" placeholder="Ex: 1234" style="' + inputStyle + '"></div>';
  html += '<div style="margin-bottom:12px;"><label style="' + labelStyle + '">Instructions d\'arrivee</label>';
  html += '<textarea id="ownerPropArrival" rows="2" placeholder="Indications pour arriver..." style="' + inputStyle + 'resize:vertical;font-family:\'Inter\',sans-serif;">' + esc(prop.arrivalInstructions || '') + '</textarea></div>';
  html += '<div style="margin-bottom:4px;"><label style="' + labelStyle + '">Notes</label>';
  html += '<textarea id="ownerPropNotes" rows="3" placeholder="Notes..." style="' + inputStyle + 'resize:vertical;font-family:\'Inter\',sans-serif;">' + esc(prop.notes || '') + '</textarea></div>';
  html += '</div>';
  html += '</details>';

  // Save button
  // Auto-save: add onchange to all inputs/selects/textareas after render
  setTimeout(() => {
    const container = document.getElementById('ownerPropertyDetailsInline');
    if (container) container.querySelectorAll('input,select,textarea').forEach(el => {
      if (!el.id || el.id === 'ownerPropPhotoInput') return;
      el.addEventListener('change', () => saveOwnerPropDetail());
    });
  }, 100);

  detailContainer.innerHTML = html;
}

async function ownerAddNewProperty() {
  const org = API.getOrg();
  const member = API.getMember();
  if (!org || !member) return;
  const { data: newProp, error } = await sb.from('properties').insert({
    org_id: org.id, owner_member_id: member.id, name: 'Nouveau bien',
    address: '', type: 'apartment', rooms: 1, bathrooms: 1, surface: 0,
    checkinTime: '15:00', checkoutTime: '11:00',
  }).select().single();
  if (error) { showToast('Erreur: ' + error.message); return; }
  window._ownerActivePropId = newProp.id;
  await renderOwnerPropertyDetails();
  showToast('Nouveau bien cree');
}

async function saveOwnerPropDetail() {
  const propId = window._ownerActivePropId;
  if (!propId) return;
  const org = API.getOrg();
  const { error } = await sb.from('properties').update({
    name: document.getElementById('ownerPropName')?.value || '',
    address: document.getElementById('ownerPropAddress')?.value || '',
    type: document.getElementById('ownerPropType')?.value || 'apartment',
    rooms: parseInt(document.getElementById('ownerPropRooms')?.value) || 0,
    bathrooms: parseInt(document.getElementById('ownerPropBathrooms')?.value) || 0,
    surface: parseInt(document.getElementById('ownerPropSurface')?.value) || 0,
    checkinTime: document.getElementById('ownerPropCheckin')?.value || '15:00',
    checkoutTime: document.getElementById('ownerPropCheckout')?.value || '11:00',
    accessCode: document.getElementById('ownerPropAccessCode')?.value || '',
    arrivalInstructions: document.getElementById('ownerPropArrival')?.value || '',
    notes: document.getElementById('ownerPropNotes')?.value || '',
  }).eq('id', propId);
  if (error) { showToast('Erreur: ' + error.message); return; }
  showToast('Bien enregistre !');
}

async function handleOwnerPropPhoto(input) {
  if (!input.files || !input.files[0]) return;
  const file = input.files[0];
  if (file.size > 10000000) return showToast('Photo trop grande (max 10MB)');
  const propId = window._ownerActivePropId;
  if (!propId) return;
  const url = await uploadPhoto(file, 'properties', propId);
  if (url) {
    await sb.from('properties').update({ photo: url }).eq('id', propId);
  } else {
    const { dataUrl } = await compressImage(file, 1400, 150);
    await sb.from('properties').update({ photo: dataUrl }).eq('id', propId);
  }
  showToast('Photo mise a jour !');
  renderOwnerPropertyDetails();
}

async function findConciergerie() {
  // Switch to annuaire tab (triggers renderAnnuaireTab which loads data)
  switchOwnerNav('annuaire');
  // Wait for render to complete (data load + DOM), then apply filter
  await new Promise(r => setTimeout(r, 600));
  if (typeof switchAnnuaireSubTab === 'function') switchAnnuaireSubTab('search');
  await new Promise(r => setTimeout(r, 100));
  const f = document.getElementById('annRoleFilter');
  if (f) { f.value = 'concierge'; if (typeof filterAnnuaire === 'function') filterAnnuaire(); }
}

function switchOwnerNav(tab) {
  const overview = document.getElementById('ownerContentOverview');
  const properties = document.getElementById('ownerContentProperties');
  const prestations = document.getElementById('ownerContentPrestations');
  const billing = document.getElementById('ownerContentBilling');
  const chatPage = document.getElementById('ownerContentChat');
  const annuairePage = document.getElementById('ownerContentAnnuaire');
  if (overview) overview.style.display = tab === 'overview' ? '' : 'none';
  if (properties) { properties.style.display = tab === 'properties' ? '' : 'none'; if (tab === 'properties') renderOwnerPropertyDetails(); }
  if (prestations) prestations.style.display = tab === 'prestations' ? '' : 'none';
  if (billing) billing.style.display = tab === 'billing' ? '' : 'none';
  if (chatPage) chatPage.style.display = tab === 'chat' ? '' : 'none';
  if (annuairePage) annuairePage.style.display = tab === 'annuaire' ? '' : 'none';
  if (tab === 'chat') initOwnerFullChat();
  if (tab === 'annuaire') renderAnnuaireTab();
  document.querySelectorAll('#bottomNav .bottomNav-item').forEach(n => n.classList.remove('active'));
  const navEl = document.getElementById('nav_' + tab);
  if (navEl) navEl.classList.add('active');
  window.scrollTo(0, 0);
}

window.switchOwnerProperty = switchOwnerProperty;
window.renderOwnerPropertyDetails = renderOwnerPropertyDetails;
window.ownerAddNewProperty = ownerAddNewProperty;
window.saveOwnerPropDetail = saveOwnerPropDetail;
window.handleOwnerPropPhoto = handleOwnerPropPhoto;
window.findConciergerie = findConciergerie;
window.switchOwnerNav = switchOwnerNav;
async function showOwnerMode() {
  try {
  setupBottomNav('owner');
  updateConnectionBadge();
  const content = document.querySelector('.content');
  if (!content) return;
  content.innerHTML = '';

  const { data: { user } } = await sb.auth.getUser();
  if (!user) return;

  const org = API.getOrg();
  if (!org) {
    content.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text3);">Aucune organisation trouvee.</div>';
    return;
  }

  // Get member info to find which properties this owner can see
  const member = API.getMember();

  // Load properties
  const { data: allProperties } = await sb.from('properties').select('*').eq('org_id', org.id);
  // Filter: owner sees only properties assigned to them (or where owner_email matches)
  let properties = (allProperties || []).filter(p => p.owner_member_id === member.id || p.owner_email === user.email);
  // Free plan: limit to 1 property
  const ownerPlanCheck = API.getPlan();
  const isOwnerProCheck = ownerPlanCheck === 'pro' || ownerPlanCheck === 'premium' || ownerPlanCheck === 'business';
  if (!isOwnerProCheck && properties.length > 1) properties = properties.slice(0, 1);

  // Header
  const headerEl = document.querySelector('.header');
  if (headerEl) {
    const h1 = headerEl.querySelector('h1');
    if (h1) {
      h1.innerHTML = 'Lokizio';
      appendRoleBadge(h1);
    }
    document.querySelectorAll('.header-actions .btnHelp').forEach(btn => {
      const onclick = btn.getAttribute('onclick') || '';
      if (!onclick.includes('authLogout') && !onclick.includes('toggleTheme') && !onclick.includes('showAccountModal') && !onclick.includes('showMarketplace') && !onclick.includes('showInviteModal') && !onclick.includes('showConnectionRequests')) {
        btn.style.display = 'none';
      }
    });
  }

  const today = new Date().toISOString().split('T')[0];
  const weekEnd = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];
  let allCleanings = [];
  let totalCost = 0;

  for (const prop of properties) {
    const { data: planning } = await sb.from('plannings').select('cleanings').eq('property_id', prop.id).single();
    if (planning && planning.cleanings) {
      planning.cleanings.forEach(c => {
        allCleanings.push({ ...c, propertyId: prop.id, propertyName: prop.name });
        if ((c.cleaningDate || c.date) >= today) {
          // Use unified pricing: property > org > defaults
          totalCost += getServicePriceForDate(prop.id, 'cleaning_standard', 'price_owner', c.cleaningDate || c.date);
        }
      });
    }
  }

  const futureCleanings = allCleanings.filter(c => (c.cleaningDate || c.date) >= today);
  const weekCleanings = futureCleanings.filter(c => (c.cleaningDate || c.date) <= weekEnd);

  // Load validations
  const validations = {};
  for (const prop of properties) {
    const { data: vals } = await sb.from('cleaning_validations').select('*').eq('property_id', prop.id);
    if (vals) vals.forEach(v => { validations[v.property_id + '_' + v.cleaning_date + '_' + v.provider_name] = v; });
  }

  // Load service requests for owner's properties
  const { data: ownerSvcRequests } = await sb.from('service_requests').select('*').eq('org_id', org.id).in('status', ['pending','assigned','accepted','in_progress','done','pending_validation','disputed']);
  const ownerPropertyIds = properties.map(p => p.id);
  const ownerServiceRequests = (ownerSvcRequests || []).filter(r => ownerPropertyIds.includes(r.property_id));

  // Build unified owner prestations
  const ownerUnified = [];
  futureCleanings.forEach(c => {
    const dateStr = c.cleaningDate || c.date;
    const key = c.propertyId + '_' + dateStr + '_' + (c.provider || '');
    const v = validations[key];
    ownerUnified.push({
      _source: 'cleaning',
      type: 'cleaning_standard',
      date: dateStr,
      propertyName: c.propertyName,
      provider: c.provider,
      status: v ? v.status : 'pending',
      propertyId: c.propertyId,
      _validation: v
    });
  });
  ownerServiceRequests.forEach(r => {
    const rDate = r.requested_date || r.preferred_date || '';
    // Hide past service requests
    if (rDate && rDate < today) return;
    ownerUnified.push({
      _source: 'service_request',
      _id: r.id,
      type: r.service_type,
      date: rDate,
      propertyName: r.property_name || '',
      status: r.status,
      notes: r.notes,
      provider: r.assigned_provider || '',
    });
  });
  ownerUnified.sort((a, b) => (a.date || '').localeCompare(b.date || ''));

  // Count by category for owner filters
  const ownerCatCounts = { all: ownerUnified.length };
  ownerUnified.forEach(u => {
    const catObj = SERVICE_CATALOG.find(c => c.services.some(s => s.id === u.type));
    const catKey = catObj ? catObj.cat : 'autre';
    ownerCatCounts[catKey] = (ownerCatCounts[catKey] || 0) + 1;
  });

  let html = '';

  // ═══ TAB 1: Apercu (Overview) ═══
  html += '<div id="ownerContentOverview">';

  // Org switcher (if owner belongs to multiple orgs)
  const memberships = API.getAllMemberships();
  if (memberships.length > 1) {
    html += `<div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;flex-wrap:wrap;">
      <span style="font-size:12px;color:var(--text3);">Conciergerie :</span>
      <select onchange="switchOwnerOrg(this.value)" style="flex:1;padding:8px 12px;background:var(--surface2);color:var(--text);border:1px solid var(--border2);border-radius:8px;font-size:13px;font-weight:600;">`;
    memberships.forEach(m => {
      const orgName = m.organizations?.name || 'Organisation';
      const selected = m.org_id === org.id ? ' selected' : '';
      html += `<option value="${m.org_id}"${selected}>${_escHtml(orgName)}</option>`;
    });
    html += `</select></div>`;
  }

  // KPI cards - clickable to navigate to planning/overview tabs
  html += `<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:10px;margin-bottom:16px;">
    <div onclick="switchOwnerNav('prestations')" style="background:linear-gradient(135deg,#f59e0b,#d97706);border-radius:12px;padding:16px;text-align:center;cursor:pointer;transition:transform 0.1s,opacity 0.1s;" onpointerdown="this.style.transform='scale(0.95)';this.style.opacity='0.85'" onpointerup="this.style.transform='';this.style.opacity=''" onpointerleave="this.style.transform='';this.style.opacity=''">
      <div style="font-size:24px;font-weight:800;color:#fff;">${weekCleanings.length}</div>
      <div style="font-size:11px;color:rgba(255,255,255,0.8);">${t('kpi.this_week')}</div>
    </div>
    <div style="background:linear-gradient(135deg,#34d399,#059669);border-radius:12px;padding:16px;text-align:center;cursor:pointer;transition:transform 0.1s,opacity 0.1s;" onpointerdown="this.style.transform='scale(0.95)';this.style.opacity='0.85'" onpointerup="this.style.transform='';this.style.opacity=''" onpointerleave="this.style.transform='';this.style.opacity=''">
      <div style="font-size:24px;font-weight:800;color:#fff;">${totalCost}€</div>
      <div style="font-size:11px;color:rgba(255,255,255,0.8);">${t('kpi.cost')}</div>
    </div>
  </div>`;

  // Concierge info card
  const { data: adminMembers } = await sb.from('members').select('*').eq('org_id', org.id).eq('role', 'concierge');
  if (adminMembers && adminMembers.length) {
    const admin = adminMembers[0];
    const adminEmail = admin.invited_email || '';
    const adminName = admin.display_name || adminEmail.split('@')[0] || 'Gestionnaire';
    // Try to find phone from properties providers config
    let adminPhone = '';
    html += `<div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:14px 16px;margin-bottom:12px;display:flex;align-items:center;gap:14px;">
      <div style="width:44px;height:44px;background:linear-gradient(135deg,#e94560,#c73e54);border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:20px;color:#fff;flex-shrink:0;">&#127970;</div>
      <div style="flex:1;">
        <div style="font-size:11px;color:var(--text3);text-transform:uppercase;margin-bottom:2px;">Ma conciergerie</div>
        <div style="font-weight:700;font-size:14px;">${_escHtml(org.name || adminName)}</div>
        <div style="font-size:12px;color:var(--text3);margin-top:2px;">${_escHtml(adminEmail)}</div>
      </div>
      <a href="mailto:${_escHtml(adminEmail)}" style="background:var(--surface2);border:1px solid var(--border2);border-radius:8px;padding:8px 12px;font-size:12px;color:var(--text);text-decoration:none;font-weight:600;">&#9993; Contacter</a>
    </div>`;
  }

  // Today's cleanings summary in overview
  const todayCleaningsOwner = allCleanings.filter(c => (c.cleaningDate || c.date) === today);
  if (todayCleaningsOwner.length > 0) {
    html += `<details style="background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:16px;margin-bottom:12px;">
      <summary style="list-style:none;cursor:pointer;display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;"><div style="font-weight:700;font-size:14px;">&#128197; Aujourd'hui — ${todayCleaningsOwner.length} prestation(s)</div><span class="collapseArrow">&#9662;</span></summary>`;
    todayCleaningsOwner.forEach(c => {
      const key = c.propertyId + '_' + (c.cleaningDate || c.date) + '_' + (c.provider || '');
      const v = validations[key];
      const status = v ? v.status : 'pending';
      const statusIcons = { done: '&#9989;', departed: '&#128682;', in_progress: '&#129529;', arrived: '&#127968;', assigned: '&#128228;', accepted: '&#10003;&#10003;', seen: '&#128065;', sent: '&#9993;', refused: '&#10060;', pending: '&#9203;' };
      html += `<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-top:1px solid var(--border);font-size:13px;">
        <div style="flex:1;font-weight:600;">${esc(c.propertyName)}</div>
        <div style="color:var(--text2);">${esc(c.provider || '?')}</div>
        <span style="font-size:11px;color:${getStatusColor(status)};white-space:nowrap;">${statusIcons[status] || '&#9203;'} ${getStatusLabel(status)}</span>
      </div>`;
    });
    html += '</details>';
  } else {
    html += `<details style="background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:16px;margin-bottom:12px;">
      <summary style="list-style:none;cursor:pointer;display:flex;justify-content:space-between;align-items:center;"><div style="font-weight:700;font-size:14px;">&#128197; Aujourd'hui</div><span class="collapseArrow">&#9662;</span></summary>
      <div style="color:var(--text3);font-size:13px;margin-top:8px;">Aucune prestation prevue aujourd'hui</div>
    </details>`;
  }

  // Upcoming prestations for owner
  const ownerUpcoming = ownerUnified.filter(u => {
    const d = u.date || '';
    return d > today && !['done','cancelled','departed'].includes(u.status);
  }).slice(0, 8);
  if (ownerUpcoming.length > 0) {
    const _osc = { done:'#34d399', in_progress:'#3b82f6', assigned:'#8b5cf6', accepted:'#34d399', pending:'#f59e0b', pending_validation:'#f59e0b', refused:'#ef4444' };
    const _osl = { done:'Termine', in_progress:'En cours', assigned:'En attente de reponse', accepted:'Accepte', pending:'Attente', pending_validation:'Validation', refused:'Refuse' };
    html += '<details style="background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:16px;margin-bottom:12px;">';
    html += '<summary style="list-style:none;cursor:pointer;display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;"><div style="font-weight:700;font-size:14px;">&#128203; Prochaines prestations</div><span class="collapseArrow">&#9662;</span></summary>';
    ownerUpcoming.forEach(u => {
      const svcLabel = getServiceLabel(u.type);
      html += '<div onclick="goToPrestation(\'' + (u.date||'') + '\',\'' + (u.type||'') + '\',\'' + esc(u.provider||'').replace(/'/g,"\\\\'") + '\')" style="display:flex;align-items:center;gap:8px;padding:8px 0;border-top:1px solid var(--border);cursor:pointer;" onmouseover="this.style.background=\'rgba(255,255,255,0.03)\'" onmouseout="this.style.background=\'\'">';
      html += '<div style="min-width:40px;font-size:11px;color:var(--text3);">' + fmtDate(u.date).substring(0,5) + '</div>';
      html += '<div style="flex:1;font-size:12px;font-weight:600;">' + svcLabel + '</div>';
      if (u.propertyName) html += '<div style="font-size:11px;color:var(--text3);">' + esc(u.propertyName) + '</div>';
      if (u.provider) html += '<div style="font-size:11px;color:var(--text3);">' + esc(u.provider) + '</div>';
      html += '<span style="font-size:10px;padding:2px 6px;border-radius:4px;background:' + (_osc[u.status]||'#666') + '22;color:' + (_osc[u.status]||'#666') + ';font-weight:600;">' + (_osl[u.status]||u.status) + '</span>';
      html += '</div>';
    });
    if (ownerUnified.filter(u => (u.date||'') > today && !['done','cancelled','departed'].includes(u.status)).length > 8) {
      html += '<div onclick="switchOwnerNav(\'prestations\')" style="text-align:center;padding:8px;font-size:11px;color:var(--accent2);cursor:pointer;font-weight:600;">Voir tout &#8250;</div>';
    }
    html += '</details>';
  }

  // Monthly cost history
  const costByMonth = {};
  allCleanings.forEach(c => {
    const d = c.cleaningDate || c.date || '';
    if (!d) return;
    const month = d.substring(0, 7);
    const price = getServicePriceForDate(c.propertyId || '', 'cleaning_standard', 'price_owner', d);
    if (!costByMonth[month]) costByMonth[month] = { count: 0, total: 0 };
    costByMonth[month].count++;
    costByMonth[month].total += price;
  });
  const sortedMonths = Object.keys(costByMonth).sort().slice(-6);
  if (sortedMonths.length > 1) {
    html += '<details style="background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:16px;margin-bottom:12px;">';
    html += '<summary style="list-style:none;cursor:pointer;display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;"><div style="font-weight:700;font-size:14px;">&#128200; Historique depenses</div><span class="collapseArrow">&#9662;</span></summary>';
    const maxCost = Math.max(...sortedMonths.map(m => costByMonth[m].total));
    sortedMonths.forEach(m => {
      const d = costByMonth[m];
      const pct = maxCost > 0 ? Math.round(d.total / maxCost * 100) : 0;
      const monthLabel = new Date(m + '-15').toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' });
      html += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">';
      html += '<div style="width:50px;font-size:11px;color:var(--text3);text-align:right;">' + monthLabel + '</div>';
      html += '<div style="flex:1;height:18px;background:var(--surface2);border-radius:4px;overflow:hidden;">';
      html += '<div style="height:100%;width:' + pct + '%;background:linear-gradient(90deg,#6c63ff,#a78bfa);border-radius:4px;transition:width 0.3s;display:flex;align-items:center;justify-content:flex-end;padding-right:4px;">';
      if (pct > 25) html += '<span style="font-size:9px;color:#fff;font-weight:700;">' + d.total + '&euro;</span>';
      html += '</div></div>';
      if (pct <= 25) html += '<span style="font-size:10px;color:var(--text3);">' + d.total + '&euro;</span>';
      html += '</div>';
    });
    html += '</details>';
  }

  html += '</div>'; // close ownerContentOverview

  // ═══ TAB 2: Biens (Properties) — uses same inline form as admin ═══
  html += '<div id="ownerContentProperties" style="display:none;">';
  html += '<div id="ownerBiensSelector" style="margin-bottom:8px;"></div>';
  html += '<div id="ownerPropertyDetailsInline"></div>';
  html += '</div>'; // close ownerContentProperties

  // ═══ TAB: Equipe ═══
  html += '<div id="ownerContentAnnuaire" style="display:none;"><div id="ownerAnnuaireContent"></div></div>';

  // ═══ TAB 3: Prestations (unified) ═══
  html += '<div id="ownerContentPrestations" style="display:none;">';

  // Header with + Demander button
  html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">';
  html += '<div style="font-size:16px;font-weight:700;color:var(--text);">📋 Prestations</div>';
  html += '<button class="btn btnSmall btnPrimary" onclick="showServiceRequestModal()" style="padding:8px 14px;font-size:12px;">+ Demander</button>';
  html += '</div>';

  // Filter buttons
  html += '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px;">';
  html += '<button class="prestFilter active" onclick="filterPrestations(\'all\')">Tout (' + ownerCatCounts.all + ')</button>';
  SERVICE_CATALOG.forEach(cat => {
    if (ownerCatCounts[cat.cat]) {
      html += '<button class="prestFilter" onclick="filterPrestations(\'' + cat.cat + '\')">' + (cat.services[0] ? cat.services[0].icon : '') + ' ' + cat.label + ' (' + ownerCatCounts[cat.cat] + ')</button>';
    }
  });
  html += '</div>';

  if (ownerUnified.length === 0) {
    html += `<div style="text-align:center;padding:40px 20px;">
      <div style="font-size:40px;margin-bottom:12px;">&#128197;</div>
      <div style="font-size:16px;font-weight:700;color:var(--text);margin-bottom:8px;">Aucune prestation prevue</div>
      <div style="font-size:13px;color:var(--text3);">Votre conciergerie n'a pas encore programme de prestations.</div>
    </div>`;
  } else {
    const _omonths = ['Jan','Fev','Mar','Avr','Mai','Jun','Jul','Aou','Sep','Oct','Nov','Dec'];
    const _omonthsFull = ['Janvier','Fevrier','Mars','Avril','Mai','Juin','Juillet','Aout','Septembre','Octobre','Novembre','Decembre'];
    const _odays = ['Dim','Lun','Mar','Mer','Jeu','Ven','Sam'];
    let ownerLastMonth = '';
    ownerUnified.forEach(u => {
      const dateStr = u.date || '';
      // Month group (collapsible)
      if (dateStr) {
        const monthKey = dateStr.substring(0, 7);
        if (monthKey !== ownerLastMonth) {
          if (ownerLastMonth !== '') html += '</details>';
          ownerLastMonth = monthKey;
          const gd = new Date(dateStr + 'T12:00:00');
          const monthLabel = _omonthsFull[gd.getMonth()] + ' ' + gd.getFullYear();
          html += '<details open style="margin-bottom:8px;"><summary style="list-style:none;cursor:pointer;display:flex;align-items:center;gap:8px;padding:10px 4px;font-size:13px;font-weight:700;color:var(--text2);text-transform:capitalize;border-bottom:1px solid var(--border);"><span class="collapseArrow">&#9662;</span>' + monthLabel + '</summary>';
        }
      }
      const catObj = SERVICE_CATALOG.find(c => c.services.some(s => s.id === u.type));
      const catKey = catObj ? catObj.cat : 'autre';
      const svcObj = (catObj ? catObj.services : []).find(s => s.id === u.type);
      const svcIcon = svcObj ? svcObj.icon : '📋';
      const svcName = svcObj ? svcObj.label : u.type;
      const color = getStatusColor(u.status);
      const label = getStatusLabel(u.status) || u.status;
      const isToday = dateStr === today;

      // Date block parts
      let dayNum = '', monthStr = '', dowStr = '';
      if (dateStr) {
        const d = new Date(dateStr + 'T12:00:00');
        dayNum = d.getDate();
        monthStr = _omonths[d.getMonth()];
        dowStr = _odays[d.getDay()];
      }

      const ownerPrestPayload = encodeURIComponent(JSON.stringify({
        _source: u._source, _id: u._id || '', type: u.type, date: dateStr, propertyName: u.propertyName,
        propertyId: u.propertyId, provider: u.provider, status: u.status, source: u.source,
        priority: u.priority, description: u.description, cancel_reason: u.cancel_reason,
        cancel_penalty_amount: u.cancel_penalty_amount
      }));
      html += '<div class="adminPrestCard" data-category="' + catKey + '" data-date="' + dateStr + '" data-type="' + (u.type||'') + '" data-provider="' + esc(u.provider||'') + '" onclick="showPrestationDetail(\'' + ownerPrestPayload + '\', event)" style="border-left:4px solid ' + color + ';cursor:pointer;' + (isToday ? 'box-shadow:0 0 0 1px rgba(233,69,96,0.3);' : '') + '">';
      html += '<div style="display:flex;align-items:stretch;gap:0;padding:0;">';
      if (dayNum) {
        html += '<div class="card-date-block">';
        html += '<div class="card-dow">' + dowStr + '</div>';
        html += '<div class="card-day">' + dayNum + '</div>';
        html += '<div class="card-month">' + monthStr + '</div>';
        html += '</div>';
      }
      html += '<div style="display:flex;align-items:center;padding:0 8px;font-size:26px;flex-shrink:0;">' + svcIcon + '</div>';
      html += '<div style="flex:1;min-width:0;padding:10px 8px 10px 0;">';
      html += '<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">';
      html += '<span style="font-size:14px;font-weight:700;color:var(--text);">' + esc(svcName) + '</span>';
      if (u.source) html += '<span style="font-size:9px;padding:1px 5px;border-radius:3px;background:' + (u.source.toLowerCase().includes('airbnb') ? '#e9456030' : '#2563eb30') + ';color:' + (u.source.toLowerCase().includes('airbnb') ? '#e94560' : '#2563eb') + ';font-weight:700;">' + esc(u.source).toUpperCase() + '</span>';
      html += '</div>';
      html += '<div style="font-size:11px;color:var(--text3);margin-top:3px;">';
      const mp = [];
      if (u.propertyName) mp.push('&#127968; ' + esc(u.propertyName));
      if (u.provider) mp.push('&#128100; ' + esc(u.provider));
      html += mp.join(' &middot; ');
      html += '</div>';
      html += '</div>';
      html += '<div style="display:flex;align-items:center;gap:6px;flex-shrink:0;padding:0 12px;">';
      html += '<span class="card-status" title="' + (getStatusHint(u.status)||'') + '" style="background:' + color + '18;color:' + color + ';cursor:help;">' + label + '</span>';
      const ownerCanCancel = u._source === 'service_request' && !['done','departed','in_progress','cancelled'].includes(u.status);
      if (ownerCanCancel) {
        const _cp = getServicePriceForDate(u.propertyId || '', u.type || 'cleaning_standard', 'price_owner', dateStr);
        html += '<a href="#" onclick="showCancelModal(\'' + u._id + '\',\'' + dateStr + '\',\'' + esc(svcName).replace(/'/g,"\\\\'") + '\',' + _cp + ');return false;" style="font-size:10px;color:var(--text3);text-decoration:none;" title="Annuler">&#128465;</a>';
      }
      if (u.status === 'pending_validation' && u._source === 'service_request') {
        html += '<button onclick="ownerValidateService(\'' + u._id + '\',true)" style="padding:4px 8px;font-size:10px;background:#34d399;color:#fff;border:none;border-radius:6px;cursor:pointer;" title="Valider">&#10003;</button>';
        html += '<button onclick="ownerDisputeService(\'' + u._id + '\',\'' + esc(u.provider || '').replace(/'/g,"\\\\'") + '\',\'' + esc(svcName).replace(/'/g,"\\\\'") + '\')" style="padding:4px 8px;font-size:10px;background:#e94560;color:#fff;border:none;border-radius:6px;cursor:pointer;" title="Contester">&#10007;</button>';
      }
      if ((u.status === 'done' || u.status === 'pending_validation') && u._source === 'service_request' && u.provider) {
        html += '<a href="#" onclick="showRatingModal(\'' + u._id + '\',\'' + esc(u.provider).replace(/'/g,"\\\\'") + '\');return false;" style="font-size:10px;color:#f59e0b;text-decoration:none;" title="Noter">&#11088;</a>';
      }
      html += '</div>';
      html += '</div>';
      html += '</div>';
    });
    if (ownerLastMonth !== '') html += '</details>';
  }

  html += '</div>'; // close ownerContentPrestations

  // Recent activity (Pro only) — appended to overview tab via JS after render
  let activityHtml = '';
  const ownerPlan = API.getPlan();
  const isOwnerPro = ownerPlan === 'pro' || ownerPlan === 'premium' || ownerPlan === 'business';
  if (isOwnerPro) {
    const { data: recentMsgs } = await sb.from('messages').select('*').eq('org_id', org.id).eq('sender_role', 'provider').order('created_at', { ascending: false }).limit(10);
    if (recentMsgs && recentMsgs.length) {
      activityHtml += `<details style="background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:16px;margin-bottom:12px;">
        <summary style="list-style:none;cursor:pointer;display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;"><div style="font-weight:700;font-size:14px;">&#128276; Activite recente</div><span class="collapseArrow">&#9662;</span></summary>`;
      recentMsgs.forEach(m => {
        const time = new Date(m.created_at).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
        activityHtml += `<div onclick="switchOwnerNav('prestations')" style="padding:6px 0;border-top:1px solid var(--border);font-size:12px;cursor:pointer;line-height:1.5;" onmouseover="this.style.background='rgba(255,255,255,0.03)'" onmouseout="this.style.background=''">
          <span style="color:var(--text3);">${time}</span> — ${esc(m.body)}
        </div>`;
      });
      activityHtml += '</details>';
    }
  } else {
    // Free: show locked activity section
    activityHtml += `<div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:16px;margin-bottom:12px;position:relative;overflow:hidden;">
      <div style="font-weight:700;font-size:14px;margin-bottom:10px;">&#128276; Activite recente</div>
      <div style="filter:blur(4px);pointer-events:none;">
        <div style="padding:6px 0;border-top:1px solid var(--border);font-size:12px;color:var(--text3);">28/03 16:14 — prestataire a confirme — menage termine</div>
        <div style="padding:6px 0;border-top:1px solid var(--border);font-size:12px;color:var(--text3);">28/03 16:14 — prestataire a termine et quitte</div>
      </div>
      <div style="position:absolute;top:0;left:0;width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;background:rgba(15,15,26,0.7);border-radius:12px;cursor:pointer;" onclick="showPremiumModal('L\\'activite recente est reservee aux abonnes Pro')">
        <span style="font-size:32px;">&#128274;</span>
        <span style="color:#fff;font-size:13px;font-weight:600;margin-top:8px;">Pro</span>
      </div>
    </div>`;
  }

  // Chat button
  // Chat page (hidden, shown by nav Messages tab)
  // Billing page (redesigned)
  html += '<div id="ownerContentBilling" style="display:none;">';
  html += '<div style="font-size:16px;font-weight:700;color:var(--text);margin-bottom:12px;">💰 Mes factures</div>';
  // Tabs
  html += '<div style="display:flex;gap:4px;background:var(--surface2);padding:4px;border-radius:10px;margin-bottom:14px;">';
  html += '<button id="ownerFinTab_create" class="annSubTab" onclick="switchOwnerFinTab(\'create\')" style="flex:1;padding:10px 14px;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;">&#10133; Creer</button>';
  html += '<button id="ownerFinTab_list" class="annSubTab annSubTabActive" onclick="switchOwnerFinTab(\'list\')" style="flex:1;padding:10px 14px;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;">&#128196; Consulter</button>';
  html += '</div>';
  html += '<div id="ownerFinPanel_create" style="display:none;">';
  html += '<div style="display:inline-flex;gap:2px;margin-bottom:12px;padding:3px;background:var(--surface2);border-radius:8px;">';
  html += '<div id="ownerDocType_invoice_btn" onclick="setOwnerDocType(\'invoice\')" class="finFactModeBtn finFactModeActive" style="cursor:pointer;padding:5px 14px;border-radius:6px;font-size:11px;font-weight:500;">&#128196; Facture</div>';
  html += '<div id="ownerDocType_quote_btn" onclick="setOwnerDocType(\'quote\')" class="finFactModeBtn" style="cursor:pointer;padding:5px 14px;border-radius:6px;font-size:11px;font-weight:500;">&#128203; Devis</div>';
  html += '</div>';
  html += '<div id="ownerDocTypeHint" style="font-size:13px;color:var(--text2);margin-bottom:10px;">A la conciergerie (remboursement, frais...)</div>';
  html += '<button onclick="openOwnerInvoice(\'owner_to_concierge\')" style="padding:18px 14px;background:linear-gradient(135deg,#f59e0b,#d97706);color:#fff;border:none;border-radius:12px;font-weight:700;cursor:pointer;width:100%;">';
  html += '<div style="font-size:28px;margin-bottom:6px;">&#129529;</div><div style="font-size:14px;">A la conciergerie</div>';
  html += '<div style="font-size:10px;opacity:0.85;margin-top:4px;font-weight:400;">Remboursement, frais, etc.</div>';
  html += '</button></div>';
  html += '<div id="ownerFinPanel_list">';
  html += '<div id="ownerInvoiceSummary" style="margin-bottom:12px;"></div>';
  html += '<div style="display:flex;gap:8px;margin-bottom:8px;flex-wrap:wrap;align-items:center;">';
  html += '<div style="flex:1;min-width:200px;position:relative;"><span style="position:absolute;left:10px;top:50%;transform:translateY(-50%);color:var(--text3);font-size:13px;">&#128269;</span><input type="text" id="ownerInvoiceSearch" placeholder="Numero, propriete..." oninput="renderOwnerInvoicesView()" style="width:100%;padding:7px 10px 7px 30px;background:var(--surface2);color:var(--text);border:1px solid var(--border2);border-radius:8px;font-size:12px;box-sizing:border-box;"></div>';
  html += '<div id="ownerInvoicePeriodChips" style="display:flex;gap:4px;flex-wrap:wrap;"></div>';
  html += '</div>';
  html += '<div id="ownerInvoiceStatusChips" style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:10px;"></div>';
  html += '<div id="ownerInvoicesList"></div>';
  html += '</div>'; // close ownerFinPanel_list
  // Upcoming prestations section (forecast) — same layout as admin prestation list
  html += '<details style="margin-top:16px;"><summary style="cursor:pointer;font-size:13px;font-weight:700;color:var(--text);padding:8px 0;list-style:none;display:flex;align-items:center;gap:6px;"><span class="collapseArrow">&#9662;</span> Prestations a venir (' + futureCleanings.length + ')</summary>';
  html += '<div style="padding-top:8px;">';
  if (futureCleanings.length === 0) {
    html += '<div style="text-align:center;padding:20px;color:var(--text3);font-size:13px;">Aucune prestation prevue</div>';
  } else {
    // Group by month like admin list
    const _monthsFull = ['Janvier','Fevrier','Mars','Avril','Mai','Juin','Juillet','Aout','Septembre','Octobre','Novembre','Decembre'];
    const _days = ['Dim','Lun','Mar','Mer','Jeu','Ven','Sam'];
    const _monthsShort = ['Jan','Fev','Mar','Avr','Mai','Jun','Jul','Aou','Sep','Oct','Nov','Dec'];
    const groups = {};
    futureCleanings.forEach(c => {
      const d = c.cleaningDate || c.date || '';
      const key = d.substring(0, 7);
      if (!groups[key]) groups[key] = [];
      groups[key].push(c);
    });
    const keys = Object.keys(groups).sort();
    keys.forEach(mk => {
      const list = groups[mk];
      const [yy, mm] = mk.split('-');
      const monthLabel = _monthsFull[parseInt(mm)-1] + ' ' + yy;
      const monthTotal = list.reduce((s, c) => s + (getServicePriceForDate(c.propertyId || '', 'cleaning_standard', 'price_owner', c.cleaningDate || c.date || '') || 0), 0);
      html += '<details open style="margin-bottom:8px;">';
      html += '<summary style="list-style:none;cursor:pointer;display:flex;align-items:center;justify-content:space-between;padding:8px 4px;font-size:12px;font-weight:700;color:var(--text2);border-bottom:1px solid var(--border);">';
      html += '<span style="display:flex;align-items:center;gap:6px;"><span class="collapseArrow">&#9662;</span>' + monthLabel + ' <span style="color:var(--text3);font-weight:400;font-size:11px;">(' + list.length + ')</span></span>';
      html += '<span style="font-size:11px;color:var(--text3);font-weight:400;">Total <b style="color:#f59e0b;">' + monthTotal.toFixed(0) + '€</b></span>';
      html += '</summary><div style="padding-top:6px;">';
      list.forEach(c => {
        const dateStr = c.cleaningDate || c.date || '';
        const dt = dateStr ? new Date(dateStr + 'T12:00:00') : null;
        const dayNum = dt ? dt.getDate() : '';
        const dowStr = dt ? _days[dt.getDay()] : '';
        const monthStr = dt ? _monthsShort[dt.getMonth()] : '';
        const price = getServicePriceForDate(c.propertyId || '', 'cleaning_standard', 'price_owner', dateStr);
        const svcIcon = (typeof getServiceIcon === 'function') ? getServiceIcon('cleaning_standard') : '🧹';
        const svcLabel = (typeof getServiceLabel === 'function') ? getServiceLabel('cleaning_standard') : 'Menage';
        const provColor = c.provider ? (typeof getProvColor === 'function' ? getProvColor(c.provider) : '#6c63ff') : '#888';
        html += '<div class="adminPrestCard" style="border-left:4px solid #f59e0b;cursor:default;">';
        html += '<div style="display:flex;align-items:stretch;gap:0;padding:0;">';
        html += '<div class="card-date-block"><div class="card-dow">' + dowStr + '</div><div class="card-day">' + dayNum + '</div><div class="card-month">' + monthStr + '</div></div>';
        html += '<div style="display:flex;align-items:center;padding:0 8px;font-size:26px;flex-shrink:0;">' + svcIcon + '</div>';
        html += '<div style="flex:1;min-width:0;padding:8px 4px;">';
        html += '<div style="font-size:14px;font-weight:700;color:var(--text);">' + esc(svcLabel) + '</div>';
        html += '<div style="font-size:11px;color:var(--text3);margin-top:2px;">&#127968; ' + esc(c.propertyName || '') + (c.provider ? ' · <span style="color:' + provColor + ';">&#129529; ' + esc(c.provider) + '</span>' : ' · <span style="color:var(--text3);">Non assigne</span>') + '</div>';
        html += '</div>';
        html += '<div style="display:flex;flex-direction:column;justify-content:center;align-items:flex-end;padding:8px 12px;flex-shrink:0;">';
        html += '<div style="font-weight:800;font-size:16px;color:#f59e0b;">' + (price > 0 ? price + '€' : '-') + '</div>';
        html += '<span style="font-size:10px;padding:2px 8px;background:rgba(245,158,11,0.15);color:#f59e0b;border-radius:4px;font-weight:600;margin-top:4px;">A facturer</span>';
        html += '</div></div></div>';
      });
      html += '</div></details>';
    });
  }
  html += '</div></details>';
  html += '</div>';

  html += '<div id="ownerContentChat" style="display:none;">';
  html += '<div style="display:flex;flex-direction:column;height:calc(100vh - 210px);">';
  html += '<div style="font-size:16px;font-weight:700;color:var(--text);margin-bottom:12px;">💬 Messages — Gestionnaire</div>';
  html += '<div id="ownerFullChatMessages" style="flex:1;overflow-y:auto;padding:16px;background:var(--surface);border:1px solid var(--border);border-radius:12px;margin-bottom:10px;min-height:200px;"></div>';
  html += '<div style="display:flex;gap:8px;">';
  html += '<input type="text" id="ownerFullChatInput" placeholder="Ecrire un message..." onkeydown="if(event.key===\'Enter\')sendOwnerFullChatMessage()" style="flex:1;padding:12px 16px;background:var(--surface2);color:var(--text);border:1px solid var(--border2);border-radius:12px;font-size:14px;font-family:\'Inter\',sans-serif;">';
  html += '<button onclick="sendOwnerFullChatMessage()" style="background:linear-gradient(135deg,#6c63ff,#5a54e0);color:#fff;border:none;padding:12px 20px;border-radius:12px;font-size:16px;cursor:pointer;">➤</button>';
  html += '</div></div></div>';

  // Floating chat button (opens mini widget)
  html += `<button onclick="openOwnerChat()" style="position:fixed;bottom:110px;right:20px;width:56px;height:56px;border-radius:50%;background:linear-gradient(135deg,#6c63ff,#5a54e0);color:#fff;border:none;font-size:24px;cursor:pointer;box-shadow:0 4px 12px rgba(108,99,255,0.4);z-index:50;">&#128172;</button>`;

  content.innerHTML = html;

  // Append activity to overview tab after render
  const overviewTab = document.getElementById('ownerContentOverview');
  if (overviewTab && activityHtml) overviewTab.insertAdjacentHTML('beforeend', activityHtml);
  // Load owner invoices
  loadOwnerInvoices();
  } catch(err) { console.error('showOwnerMode error:', err); showToast('Erreur chargement mode proprietaire: ' + (err.message || 'Probleme de connexion')); }
}

window.showOwnerMode = showOwnerMode;
let _ownerInvoicesCache = [];
let _ownerInvoicePeriod = 'all';
let _ownerInvoiceStatus = 'all';

async function loadOwnerInvoices() {
  try {
    const org = API.getOrg();
    if (!org) return;
    const member = API.getMember();
    const { data: { user } } = await sb.auth.getUser();
    const ownerName = member?.display_name || user?.email?.split('@')[0] || '';
    const { data: allInvoices } = await sb.from('invoices').select('*')
      .eq('org_id', org.id).in('type', ['concierge_to_owner','provider_to_owner'])
      .order('created_at', { ascending: false }).limit(200);
    let myPropNames = [];
    if (member?.id) {
      const { data: p1 } = await sb.from('properties').select('name').eq('org_id', org.id).eq('owner_member_id', member.id);
      (p1 || []).forEach(p => { if (p.name && !myPropNames.includes(p.name)) myPropNames.push(p.name); });
    }
    if (user?.email) {
      const { data: p2 } = await sb.from('properties').select('name').eq('org_id', org.id).eq('owner_email', user.email);
      (p2 || []).forEach(p => { if (p.name && !myPropNames.includes(p.name)) myPropNames.push(p.name); });
    }
    _ownerInvoicesCache = (allInvoices || []).filter(inv => {
      if (inv.client_name && ownerName && inv.client_name.toLowerCase().includes(ownerName.toLowerCase())) return true;
      if (inv.property_name && myPropNames.includes(inv.property_name)) return true;
      return false;
    });
    renderOwnerInvoicesView();
  } catch(e) { console.error('loadOwnerInvoices error:', e); }
}

function renderOwnerInvoicesView() {
  const container = document.getElementById('ownerInvoicesList');
  if (!container) return;
  const today = new Date().toISOString().split('T')[0];
  const search = (document.getElementById('ownerInvoiceSearch')?.value || '').trim().toLowerCase();
  const now = new Date();
  const thisMonthStart = now.getFullYear() + '-' + String(now.getMonth()+1).padStart(2,'0') + '-01';
  const lastMonth = new Date(now.getFullYear(), now.getMonth()-1, 1);
  const lastMonthStart = lastMonth.getFullYear() + '-' + String(lastMonth.getMonth()+1).padStart(2,'0') + '-01';
  const lastMonthEnd = now.getFullYear() + '-' + String(now.getMonth()+1).padStart(2,'0') + '-01';
  const thisYearStart = now.getFullYear() + '-01-01';
  const inPeriod = (inv) => {
    const d = (inv.created_at || '').substring(0, 10);
    if (_ownerInvoicePeriod === 'all') return true;
    if (_ownerInvoicePeriod === 'thisMonth') return d >= thisMonthStart;
    if (_ownerInvoicePeriod === 'lastMonth') return d >= lastMonthStart && d < lastMonthEnd;
    if (_ownerInvoicePeriod === 'thisYear') return d >= thisYearStart;
    return true;
  };
  const isOv = (inv) => inv.status === 'sent' && inv.due_date && inv.due_date < today;
  const statusOf = (inv) => isOv(inv) ? 'overdue' : inv.status;
  const matchSearch = (inv) => {
    if (!search) return true;
    const hay = [inv.invoice_number, inv.property_name].filter(Boolean).join(' ').toLowerCase();
    return hay.includes(search);
  };
  const periodFiltered = _ownerInvoicesCache.filter(inPeriod);
  const filtered = periodFiltered.filter(inv => {
    if (_ownerInvoiceStatus !== 'all' && statusOf(inv) !== _ownerInvoiceStatus) return false;
    return matchSearch(inv);
  });
  renderOwnerInvoiceSummary(periodFiltered);
  renderOwnerInvoicePeriodChips();
  renderOwnerInvoiceStatusChips(periodFiltered);
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
    html += '<span style="font-size:11px;color:var(--text3);font-weight:400;">Total <b style="color:var(--text);">' + monthTotal.toFixed(0) + '€</b> — Paye <b style="color:#34d399;">' + monthPaid.toFixed(0) + '€</b></span>';
    html += '</summary><div style="padding-top:6px;">';
    list.forEach(inv => { html += _renderOwnerInvoiceCard(inv, today); });
    html += '</div></details>';
  });
  container.innerHTML = html;
}

function _renderOwnerInvoiceCard(inv, today) {
  const isPaid = inv.status === 'paid';
  const isOverdue = inv.status === 'sent' && inv.due_date && inv.due_date < today;
  const color = isPaid ? '#34d399' : (isOverdue ? '#e94560' : '#f59e0b');
  const label = isPaid ? 'Payee' : (isOverdue ? 'En retard' : 'A payer');
  const dateStr = new Date(inv.created_at).toLocaleDateString('fr-FR');
  const firstItem = (inv.items && inv.items.length) ? inv.items[0] : null;
  const prestLabel = firstItem && firstItem.description ? firstItem.description : (inv.property_name || 'Facture');
  let dueHint = '';
  if (inv.due_date && !isPaid) {
    const d = new Date(inv.due_date + 'T12:00:00');
    const daysDiff = Math.floor((d - new Date()) / 86400000);
    if (daysDiff < 0) dueHint = '<span style="font-size:10px;color:#e94560;font-weight:600;">&#9888; Echeance depassee de ' + Math.abs(daysDiff) + 'j</span>';
    else if (daysDiff <= 7) dueHint = '<span style="font-size:10px;color:#f59e0b;">&#9201; A payer dans ' + daysDiff + 'j</span>';
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
  html += '<div style="font-size:17px;font-weight:800;color:var(--text);">' + (inv.total_ttc || 0).toFixed(2) + ' \u20ac</div>';
  html += '<span style="display:inline-block;margin-top:4px;font-size:11px;padding:2px 8px;background:' + color + '20;color:' + color + ';border-radius:4px;font-weight:600;">' + label + '</span>';
  html += '</div></div>';
  html += '<div style="display:flex;gap:6px;margin-top:10px;flex-wrap:wrap;" onclick="event.stopPropagation()">';
  html += '<button class="btn btnSmall btnOutline" style="padding:4px 8px;font-size:11px;" onclick="showInvoiceDetail(\'' + inv.id + '\')">&#128065; Voir</button>';
  html += '<button class="btn btnSmall btnOutline" style="padding:4px 8px;font-size:11px;" onclick="downloadInvoicePDF(\'' + inv.id + '\')">&#128196; PDF</button>';
  if (!isPaid) html += '<button class="btn btnSmall" style="padding:4px 8px;font-size:11px;background:linear-gradient(135deg,#6c63ff,#5a54e0);color:#fff;" onclick="ownerPayInvoice(\'' + inv.id + '\',' + (inv.total_ttc || 0) + ')">&#128179; Payer</button>';
  html += '</div></div>';
  return html;
}

function renderOwnerInvoiceSummary(invoices) {
  const div = document.getElementById('ownerInvoiceSummary');
  if (!div) return;
  const today = new Date().toISOString().split('T')[0];
  const totalToPay = invoices.filter(i => i.status === 'sent' && !(i.due_date && i.due_date < today)).reduce((s, i) => s + (i.total_ttc || 0), 0);
  const totalPaid = invoices.filter(i => i.status === 'paid').reduce((s, i) => s + (i.total_ttc || 0), 0);
  const overdue = invoices.filter(i => i.status === 'sent' && i.due_date && i.due_date < today);
  const overdueTotal = overdue.reduce((s, i) => s + (i.total_ttc || 0), 0);
  const tileStyle = 'flex:1;min-width:110px;border-radius:12px;padding:12px;text-align:center;cursor:pointer;transition:transform 0.15s;';
  let html = '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:10px;">';
  html += '<div onclick="setOwnerInvoiceStatus(\'sent\')" onmouseover="this.style.transform=\'translateY(-2px)\'" onmouseout="this.style.transform=\'\'" style="' + tileStyle + 'background:rgba(245,158,11,0.15);border:1px solid rgba(245,158,11,0.3);"><div style="font-size:18px;font-weight:800;color:#f59e0b;">' + totalToPay.toFixed(0) + ' \u20ac</div><div style="font-size:10px;color:var(--text3);">A payer</div></div>';
  html += '<div onclick="setOwnerInvoiceStatus(\'paid\')" onmouseover="this.style.transform=\'translateY(-2px)\'" onmouseout="this.style.transform=\'\'" style="' + tileStyle + 'background:rgba(52,211,153,0.15);border:1px solid rgba(52,211,153,0.3);"><div style="font-size:18px;font-weight:800;color:#34d399;">' + totalPaid.toFixed(0) + ' \u20ac</div><div style="font-size:10px;color:var(--text3);">Paye</div></div>';
  html += '<div onclick="setOwnerInvoiceStatus(\'overdue\')" onmouseover="this.style.transform=\'translateY(-2px)\'" onmouseout="this.style.transform=\'\'" style="' + tileStyle + 'background:rgba(233,69,96,' + (overdue.length > 0 ? '0.15' : '0.05') + ');border:1px solid rgba(233,69,96,0.3);"><div style="font-size:18px;font-weight:800;color:#e94560;">' + overdueTotal.toFixed(0) + ' \u20ac</div><div style="font-size:10px;color:var(--text3);">En retard</div></div>';
  html += '<div onclick="setOwnerInvoiceStatus(\'all\')" onmouseover="this.style.transform=\'translateY(-2px)\'" onmouseout="this.style.transform=\'\'" style="' + tileStyle + 'background:var(--surface2);border:1px solid var(--border2);"><div style="font-size:18px;font-weight:800;color:var(--text);">' + invoices.length + '</div><div style="font-size:10px;color:var(--text3);">Nb factures</div></div>';
  html += '</div>';
  div.innerHTML = html;
}

function renderOwnerInvoicePeriodChips() {
  const row = document.getElementById('ownerInvoicePeriodChips');
  if (!row) return;
  const chips = [ {id:'all',label:'Tout'}, {id:'thisMonth',label:'Ce mois'}, {id:'lastMonth',label:'Mois dernier'}, {id:'thisYear',label:'Cette annee'} ];
  row.innerHTML = chips.map(c => {
    const act = _ownerInvoicePeriod === c.id;
    return '<button onclick="setOwnerInvoicePeriod(\'' + c.id + '\')" style="padding:5px 10px;border-radius:20px;font-size:11px;border:1px solid ' + (act ? '#6c63ff' : 'var(--border2)') + ';background:' + (act ? 'rgba(108,99,255,0.2)' : 'var(--surface2)') + ';color:' + (act ? '#a78bfa' : 'var(--text3)') + ';cursor:pointer;white-space:nowrap;">' + c.label + '</button>';
  }).join('');
}

function renderOwnerInvoiceStatusChips(invoices) {
  const row = document.getElementById('ownerInvoiceStatusChips');
  if (!row) return;
  const today = new Date().toISOString().split('T')[0];
  const counts = { all: invoices.length, sent: 0, paid: 0, overdue: 0 };
  invoices.forEach(i => { if (i.status === 'sent' && i.due_date && i.due_date < today) counts.overdue++; else counts[i.status] = (counts[i.status] || 0) + 1; });
  const chips = [ {id:'all',label:'Toutes',color:'#888'}, {id:'sent',label:'A payer',color:'#f59e0b'}, {id:'paid',label:'Paye',color:'#34d399'}, {id:'overdue',label:'En retard',color:'#e94560'} ];
  row.innerHTML = chips.map(c => {
    const act = _ownerInvoiceStatus === c.id;
    const count = counts[c.id] || 0;
    if (c.id !== 'all' && count === 0) return '';
    return '<button onclick="setOwnerInvoiceStatus(\'' + c.id + '\')" style="padding:5px 10px;border-radius:20px;font-size:11px;border:1px solid ' + (act ? c.color : 'var(--border2)') + ';background:' + (act ? c.color + '20' : 'var(--surface2)') + ';color:' + (act ? c.color : 'var(--text3)') + ';cursor:pointer;white-space:nowrap;font-weight:' + (act ? '700' : '500') + ';">' + c.label + ' (' + count + ')</button>';
  }).join('');
}

function setOwnerInvoicePeriod(p) { _ownerInvoicePeriod = p; renderOwnerInvoicesView(); }
function setOwnerInvoiceStatus(s) { _ownerInvoiceStatus = s; renderOwnerInvoicesView(); }

let _ownerDocType = 'invoice';
function setOwnerDocType(t) {
  _ownerDocType = t;
  const invBtn = document.getElementById('ownerDocType_invoice_btn');
  const qBtn = document.getElementById('ownerDocType_quote_btn');
  const hint = document.getElementById('ownerDocTypeHint');
  if (invBtn) invBtn.classList.toggle('finFactModeActive', t === 'invoice');
  if (qBtn) qBtn.classList.toggle('finFactModeActive', t === 'quote');
  if (hint) hint.textContent = t === 'quote' ? 'Devis a la conciergerie (validation avant prestation)' : 'A la conciergerie (remboursement, frais...)';
}
function openOwnerInvoice(type) { showCreateInvoiceModal(type, _ownerDocType === 'quote'); }

function switchOwnerFinTab(tab) {
  const listBtn = document.getElementById('ownerFinTab_list');
  const createBtn = document.getElementById('ownerFinTab_create');
  const listPanel = document.getElementById('ownerFinPanel_list');
  const createPanel = document.getElementById('ownerFinPanel_create');
  if (!listBtn || !createBtn) return;
  if (tab === 'create') {
    listBtn.classList.remove('annSubTabActive');
    createBtn.classList.add('annSubTabActive');
    if (listPanel) listPanel.style.display = 'none';
    if (createPanel) createPanel.style.display = '';
  } else {
    listBtn.classList.add('annSubTabActive');
    createBtn.classList.remove('annSubTabActive');
    if (listPanel) listPanel.style.display = '';
    if (createPanel) createPanel.style.display = 'none';
    loadOwnerInvoices();
  }
}

async function ownerPayInvoice(invoiceId, amount) {
  // Create Stripe checkout for invoice payment
  try {
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return;
    showToast('Redirection vers le paiement...');
    const resp = await fetch(SUPABASE_URL + '/functions/v1/create-checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + (await sb.auth.getSession()).data.session.access_token },
      body: JSON.stringify({
        user_id: user.id,
        email: user.email,
        mode: 'payment',
        amount: Math.round(amount * 100),
        invoice_id: invoiceId,
        success_url: window.location.href,
        cancel_url: window.location.href,
      })
    });
    const data = await resp.json();
    if (data.url) window.location.href = data.url;
    else showToast('Erreur: impossible de creer le paiement');
  } catch(e) {
    console.error('ownerPayInvoice error:', e);
    showToast('Erreur paiement. Contactez votre conciergerie.');
  }
}

window.loadOwnerInvoices = loadOwnerInvoices;
window.renderOwnerInvoicesView = renderOwnerInvoicesView;
window._renderOwnerInvoiceCard = _renderOwnerInvoiceCard;
window.renderOwnerInvoiceSummary = renderOwnerInvoiceSummary;
window.renderOwnerInvoicePeriodChips = renderOwnerInvoicePeriodChips;
window.renderOwnerInvoiceStatusChips = renderOwnerInvoiceStatusChips;
window.setOwnerInvoicePeriod = setOwnerInvoicePeriod;
window.setOwnerInvoiceStatus = setOwnerInvoiceStatus;
window.setOwnerDocType = setOwnerDocType;
window.openOwnerInvoice = openOwnerInvoice;
window.switchOwnerFinTab = switchOwnerFinTab;
window.ownerPayInvoice = ownerPayInvoice;
