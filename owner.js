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
