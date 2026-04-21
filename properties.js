// Properties / Services editor module
// Depends on: sb, API, esc, showMsg, closeMsg, showToast, customConfirm,
//   fullConfig, syncAndSaveConfig, debounce, getServicePrice,
//   getServiceLabel, getServiceIcon, computeServicePrice, safePhotoUrl,
//   uploadPhoto, SERVICE_CATALOG, SERVICE_FREQ_OPTIONS, getFreqLabel,
//   getDefaultPrice
// Exposes: renderPropertySelector, renderBiensPropertySelector,
//   switchBiensProperty, renderPropertyDetailsInline, renderInlineChecklist,
//   addInlineCheckItem, removeInlineCheckItem, handleInlinePropPhoto,
//   updateInlineIcalUrl, removeInlineIcal, recalcEstimate, scrollToPropField,
//   renderInlineServicesList, removeServiceFromProp, refreshInlineTotals,
//   openServiceEditor, renderServiceEditorBody, onSvcEditorFreqChange,
//   onServiceTypeChange, recomputeServiceEditorPrice, onServicePriceManualChange,
//   saveServiceEditor, saveInlinePropDetail

/* ── Property Management ── */
function renderPropertySelector() {
  const props = fullConfig.properties || [];
  const activePropId = API.getActivePropertyId();
  const activeProp = API.getActiveProperty(fullConfig);
  // Update dropdown button text
  const ddBtn = document.getElementById('propDropdownBtn');
  if (ddBtn && activeProp) ddBtn.innerHTML = '<span style="overflow:hidden;text-overflow:ellipsis;">' + esc(activeProp.name || 'Propriete') + '</span><span style="font-size:10px;opacity:0.6;flex-shrink:0;">&#9660;</span>';
  // Build dropdown menu
  const ddMenu = document.getElementById('propDropdownMenu');
  if (ddMenu) {
    let html = '';
    props.forEach(p => {
      const isActive = p.id === activePropId;
      html += `<div onclick="selectPropFromDropdown('${p.id}')" style="padding:10px 16px;cursor:pointer;font-size:14px;font-weight:${isActive?'700':'400'};color:${isActive?'var(--accent)':'var(--text)'};background:${isActive?'rgba(233,69,96,0.1)':'transparent'};transition:background 0.2s;border-bottom:1px solid var(--border);" onmouseover="this.style.background='rgba(255,255,255,0.06)'" onmouseout="this.style.background='${isActive?'rgba(233,69,96,0.1)':'transparent'}'">
        ${isActive ? '&#10003; ' : '&nbsp;&nbsp;&nbsp;'}${esc(p.name)}
      </div>`;
    });
    ddMenu.innerHTML = html;
  }
  // Hidden select for backward compat
  const sel = document.getElementById('propSelect');
  if (sel) {
    sel.innerHTML = '';
    for (const p of props) {
      const opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = p.name;
      if (p.id === activePropId) opt.selected = true;
      sel.appendChild(opt);
    }
  }
  // Render property list view
  const listDiv = document.getElementById('propertyListView');
  if (listDiv) {
    let html = '<table class="provTable" style="width:100%;">';
    html += '<tr><th style="width:20px;"></th><th>Nom</th><th style="text-align:center;">Type</th><th style="text-align:center;">Adresse</th><th style="text-align:center;width:36px;">&#9998;</th><th style="text-align:center;width:36px;">&#128205;</th><th style="text-align:center;width:36px;">&#128197;</th><th style="text-align:center;width:30px;"></th></tr>';
    const typeLabels = { apartment:'Appart.', house:'Maison', studio:'Studio', villa:'Villa', chalet:'Chalet', other:'Autre' };
    props.forEach((p, i) => {
      const isActive = p.id === activePropId;
      const bgStyle = isActive ? 'background:rgba(233,69,96,0.08);' : '';
      const shortAddr = p.address ? (p.address.length > 30 ? p.address.substring(0,30) + '...' : p.address) : '';
      html += `<tr style="${bgStyle}cursor:pointer;" onclick="selectPropFromDropdown('${p.id}')">
        <td><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${isActive ? 'var(--accent)' : 'var(--border2)'};"></span></td>
        <td style="font-weight:${isActive?'700':'400'};color:${isActive?'var(--accent)':'var(--text)'};">${esc(p.name)}</td>
        <td class="center" style="font-size:11px;color:var(--text3);">${typeLabels[p.type] || ''}</td>
        <td class="center" style="font-size:11px;color:var(--text3);max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${esc(p.address || '')}">${shortAddr}</td>
        <td class="center"><button class="btnLocation" onclick="event.stopPropagation();selectPropFromDropdown('${p.id}');setTimeout(openPropDetail,100)" title="Details" style="font-size:14px;">&#9998;</button></td>
        <td class="center"><button class="btnLocation ${p.lat ? 'hasLocation' : ''}" onclick="event.stopPropagation();selectPropFromDropdown('${p.id}');setTimeout(openMapForProperty,100)" title="Position" style="font-size:14px;">&#128205;</button></td>
        <td class="center"><button class="btnLocation" onclick="event.stopPropagation();selectPropFromDropdown('${p.id}');setTimeout(showIcalModal,100)" title="Calendriers" style="font-size:14px;">&#128197;</button></td>
        <td class="center"><button class="btn btnSmall btnDanger" style="padding:4px 8px;" onclick="event.stopPropagation();selectPropFromDropdown('${p.id}');setTimeout(removeCurrentProperty,100)">&#10005;</button></td>
      </tr>`;
    });
    html += '</table>';
    listDiv.innerHTML = html;
  }
  // Update propNameInput for backward compat
  const nameInput = document.getElementById('propNameInput');
  if (nameInput && activeProp) nameInput.value = activeProp.name || '';
}

/* ── Biens Property Selector (slider) ── */
let _biensActivePropertyId = null;

function renderBiensPropertySelector() {
  const container = document.getElementById('biensPropertySelector');
  if (!container) return;
  const props = fullConfig.properties || [];
  const activePropId = API.getActivePropertyId();
  _biensActivePropertyId = activePropId;
  if (props.length === 0) { container.innerHTML = '<div style="color:var(--text3);font-size:13px;text-align:center;padding:16px;">Aucun bien configure. Cliquez "+ Nouveau bien" pour commencer.</div>'; return; }
  let html = '<div style="display:flex;align-items:center;gap:8px;overflow-x:auto;padding-bottom:4px;-webkit-overflow-scrolling:touch;">';
  props.forEach(p => {
    const isActive = p.id === activePropId;
    html += `<button onclick="switchBiensProperty('${p.id}')" style="padding:8px 16px;border-radius:10px;font-size:12px;font-weight:${isActive ? '700' : '500'};cursor:pointer;white-space:nowrap;border:${isActive ? '2px solid var(--accent)' : '1px solid var(--border2)'};background:${isActive ? 'rgba(233,69,96,0.15)' : 'var(--surface2)'};color:${isActive ? 'var(--accent)' : 'var(--text)'};transition:all 0.2s;flex-shrink:0;">&#127968; ${esc(p.name)}</button>`;
  });
  html += `<button onclick="addNewProperty()" style="padding:8px 16px;border-radius:10px;font-size:12px;font-weight:600;cursor:pointer;white-space:nowrap;border:1px dashed var(--success);background:transparent;color:var(--success);transition:all 0.2s;flex-shrink:0;">+ Nouveau bien</button>`;
  html += '</div>';
  container.innerHTML = html;
}

function switchBiensProperty(propId) {
  _biensActivePropertyId = propId;
  API.setActiveProperty(propId);
  inlinePropCheckItems = [];
  renderBiensPropertySelector();
  renderPropertySelector();
  renderPropertyDetailsInline();
  loadActiveProperty();
}

/* ── Inline Property Details ── */
async function renderPropertyDetailsInline() {
  const container = document.getElementById('propertyDetailsInline');
  if (!container) return;
  const prop = API.getActiveProperty(fullConfig);
  if (!prop) { container.innerHTML = '<div style="color:var(--text3);font-size:13px;text-align:center;padding:24px;">Selectionnez un bien pour voir ses details.</div>'; return; }

  const hasOwner = prop.owner_id || prop.owner_email;
  const readonlyAttr = hasOwner ? 'readonly disabled style="opacity:0.6;"' : '';
  const typeOptions = [
    { v: 'apartment', l: 'Appartement' }, { v: 'house', l: 'Maison' }, { v: 'studio', l: 'Studio' },
    { v: 'villa', l: 'Villa' }, { v: 'chalet', l: 'Chalet' }, { v: 'other', l: 'Autre' }
  ];
  const durationOptions = [
    { v: '30', l: '30 min' }, { v: '45', l: '45 min' }, { v: '60', l: '1h' }, { v: '90', l: '1h30' },
    { v: '120', l: '2h' }, { v: '150', l: '2h30' }, { v: '180', l: '3h' }, { v: '240', l: '4h' }
  ];

  const inputStyle = 'width:100%;padding:10px 14px;background:var(--surface2);color:var(--text);border:1px solid var(--border2);border-radius:8px;font-size:13px;box-sizing:border-box;';
  const labelStyle = 'display:block;font-size:11px;color:var(--text3);margin-bottom:4px;text-transform:uppercase;letter-spacing:0.5px;font-weight:600;';
  const sectionStyle = 'background:var(--surface);border:1px solid var(--border2);border-radius:12px;padding:16px;margin-bottom:12px;';
  const sectionTitleStyle = 'font-size:12px;color:var(--text3);text-transform:uppercase;letter-spacing:1px;margin-bottom:12px;font-weight:700;display:flex;align-items:center;gap:6px;';

  let html = '';

  // ── Property completeness bar ──
  {
    let score = 0; let total = 7;
    const missing = [];
    // Each item: { label, target } — target is element id to focus
    if (prop.name && prop.name !== 'Mon logement' && prop.name !== 'Nouvelle propriete') score++; else missing.push({ label: 'Nom', icon: '&#128221;', target: 'inlinePropName' });
    if (prop.address) score++; else missing.push({ label: 'Adresse', icon: '&#128205;', target: 'inlinePropAddress' });
    if (prop.type && prop.rooms) score++; else missing.push({ label: 'Type/pieces', icon: '&#127968;', target: 'inlinePropType' });
    if (prop.photo) score++; else missing.push({ label: 'Photo', icon: '&#128247;', target: 'inlinePropPhotoPreview' });
    if (prop.icals && prop.icals.length && prop.icals.some(ic => ic.url)) score++; else missing.push({ label: 'Calendrier iCal', icon: '&#128197;', target: 'inlineIcal_0', action: 'openIcalSection' });
    if (prop.providers && prop.providers.length) score++; else missing.push({ label: 'Prestataire', icon: '&#128100;', target: 'inlinePropServicesChecks' });
    const svcCount = Object.values(prop.serviceConfig || {}).filter(c => c && c.enabled).length;
    if (svcCount > 0) score++; else missing.push({ label: 'Services/tarif', icon: '&#128736;', target: 'inlinePropServicesChecks' });
    const pct = Math.round((score / total) * 100);
    if (pct < 100) {
      const barColor = pct >= 80 ? '#34d399' : pct >= 50 ? '#f59e0b' : '#e94560';
      html += `<div style="${sectionStyle}padding:14px;border-left:3px solid ${barColor};">`;
      html += `<div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">`;
      html += `<div style="flex:1;font-size:13px;font-weight:600;color:var(--text);">Configuration du bien</div>`;
      html += `<span style="font-size:12px;font-weight:700;color:${barColor};">${pct}%</span>`;
      html += `</div>`;
      html += `<div style="height:6px;background:var(--surface2);border-radius:3px;overflow:hidden;margin-bottom:12px;">`;
      html += `<div style="height:100%;width:${pct}%;background:linear-gradient(90deg,#6c63ff,#34d399);border-radius:3px;transition:width 0.3s;"></div>`;
      html += `</div>`;
      html += `<div style="font-size:11px;color:var(--text3);margin-bottom:8px;">A completer :</div>`;
      html += `<div style="display:flex;flex-wrap:wrap;gap:8px;">`;
      missing.forEach(m => {
        html += `<button onclick="scrollToPropField('${m.target}', '${m.action||''}')" style="display:inline-flex;align-items:center;gap:6px;padding:7px 12px;background:rgba(108,99,255,0.12);color:var(--accent2);border:1px solid rgba(108,99,255,0.35);border-radius:20px;font-size:12px;font-weight:600;cursor:pointer;transition:all 0.15s;" onmouseover="this.style.background='rgba(108,99,255,0.22)'" onmouseout="this.style.background='rgba(108,99,255,0.12)'">${m.icon} ${esc(m.label)}</button>`;
      });
      html += `</div>`;
      html += `</div>`;
    } else {
      html += `<div style="${sectionStyle}padding:10px;border-left:3px solid #34d399;display:flex;align-items:center;gap:8px;">`;
      html += `<span style="font-size:16px;">&#9989;</span>`;
      html += `<span style="font-size:13px;font-weight:600;color:#34d399;">Bien entierement configure !</span>`;
      html += `</div>`;
    }
  }

  // Owner info banner (if has owner)
  if (hasOwner) {
    // Try to get owner member info for richer data
    let ownerName = prop.owner_name || '';
    let ownerEmail = prop.owner_email || '';
    let ownerPhone = prop.owner_phone || '';
    let ownerAddress = '';
    if (prop.owner_member_id) {
      try {
        const members = await API.loadMembers();
        const ownerMember = members.find(m => m.id === prop.owner_member_id);
        if (ownerMember) {
          if (ownerMember.display_name) ownerName = ownerMember.display_name;
          if (ownerMember.invited_email) ownerEmail = ownerMember.invited_email;
          if (ownerMember.phone) ownerPhone = ownerMember.phone;
          if (ownerMember.address) ownerAddress = ownerMember.address;
        }
      } catch(e) { /* best-effort, ignore */ }
    }
    html += `<div style="${sectionStyle}background:rgba(108,99,255,0.06);">`;
    html += `<div style="${sectionTitleStyle}">&#128100; Proprietaire</div>`;
    html += '<div style="display:flex;flex-direction:column;gap:4px;font-size:13px;">';
    html += '<div style="font-weight:600;color:var(--text);font-size:14px;">👤 ' + esc(ownerName || ownerEmail || 'Non renseigne') + '</div>';
    if (ownerEmail) html += '<div><a href="mailto:' + esc(ownerEmail) + '" style="color:var(--accent2);text-decoration:none;">✉️ ' + esc(ownerEmail) + '</a></div>';
    if (ownerPhone) html += '<div><a href="tel:' + esc(ownerPhone) + '" style="color:var(--accent2);text-decoration:none;">📞 ' + esc(ownerPhone) + '</a></div>';
    if (ownerAddress) html += '<div style="color:var(--text3);">📍 ' + esc(ownerAddress) + '</div>';
    html += '<div style="margin-top:6px;display:flex;gap:8px;">';
    if (ownerEmail) html += '<button class="btn btnSmall btnOutline" onclick="openChat(\'' + esc(ownerName || ownerEmail).replace(/'/g, "\\'") + '\')" style="padding:4px 10px;font-size:11px;">💬 Message</button>';
    if (ownerPhone) html += '<a href="tel:' + esc(ownerPhone) + '" class="btn btnSmall btnOutline" style="padding:4px 10px;font-size:11px;text-decoration:none;">📞 Appeler</a>';
    html += '</div>';
    html += '</div></div>';
  }

  // SECTION: Photo + General Info (photo left, fields right, stacks on mobile)
  html += `<details style="${sectionStyle}">`;
  html += `<summary style="list-style:none;cursor:pointer;"><div style="${sectionTitleStyle}margin-bottom:0;display:flex;justify-content:space-between;"><span>&#127968; Informations generales</span><span class="collapseArrow">&#9662;</span></div></summary>`;
  html += `<div style="margin-top:12px;"><div style="display:flex;gap:16px;flex-wrap:wrap;align-items:flex-start;">`;
  // Photo (left)
  html += `<div style="flex:0 0 200px;min-width:180px;">
    <div id="inlinePropPhotoPreview" style="width:100%;aspect-ratio:1/1;border-radius:12px;overflow:hidden;background:var(--surface2);display:flex;align-items:center;justify-content:center;cursor:pointer;" onclick="document.getElementById('inlinePropPhotoInput').click()">
      <span id="inlinePropPhotoPlaceholder" style="color:var(--text3);font-size:12px;text-align:center;padding:8px;${prop.photo ? 'display:none;' : ''}">&#128247; Cliquez pour ajouter une photo</span>
      <img id="inlinePropPhotoImg" src="${prop.photo ? esc(prop.photo) : ''}" style="width:100%;height:100%;object-fit:cover;${prop.photo ? '' : 'display:none;'}">
    </div>
    <input type="file" id="inlinePropPhotoInput" accept="image/*" style="display:none;" onchange="handleInlinePropPhoto(this)">
  </div>`;
  // Fields (right)
  html += `<div style="flex:1;min-width:240px;">`;
  // Name
  html += `<div style="margin-bottom:12px;"><label style="${labelStyle}">Nom</label>
    <input id="inlinePropName" type="text" value="${esc(prop.name || '')}" ${hasOwner ? 'readonly disabled' : ''} style="${inputStyle}${hasOwner ? 'opacity:0.6;' : ''}"></div>`;
  // Address + map button
  html += `<div style="margin-bottom:12px;"><label style="${labelStyle}">Adresse</label>
    <div style="display:flex;gap:8px;align-items:center;">
      <input id="inlinePropAddress" type="text" value="${esc(prop.address || '')}" placeholder="12 rue de France, Nice" ${hasOwner ? 'readonly disabled' : ''} style="${inputStyle}flex:1;margin-bottom:0;${hasOwner ? 'opacity:0.6;' : ''}">
      <button class="btn btnSmall" onclick="selectPropFromDropdown('${prop.id}');setTimeout(openMapForProperty,100)" style="padding:8px 12px;font-size:12px;white-space:nowrap;">📍 Carte</button>
    </div></div>`;
  // Type + Rooms + Surface
  html += `<div style="display:flex;gap:10px;margin-bottom:0;flex-wrap:wrap;">`;
  html += `<div style="flex:1;min-width:100px;"><label style="${labelStyle}">Type</label>
    <select id="inlinePropType" onchange="recalcEstimate()" ${hasOwner ? 'disabled' : ''} style="${inputStyle}${hasOwner ? 'opacity:0.6;' : ''}">`;
  typeOptions.forEach(o => { html += `<option value="${o.v}" ${prop.type === o.v ? 'selected' : ''}>${o.l}</option>`; });
  html += `</select></div>`;
  html += `<div style="flex:0.5;min-width:70px;"><label style="${labelStyle}">Pieces</label>
    <input id="inlinePropRooms" type="number" min="1" max="20" value="${prop.rooms || ''}" oninput="recalcEstimate()" ${hasOwner ? 'readonly disabled' : ''} style="${inputStyle}${hasOwner ? 'opacity:0.6;' : ''}"></div>`;
  html += `<div style="flex:0.7;min-width:90px;"><label style="${labelStyle}">Salle de bain</label>
    <input id="inlinePropBathrooms" type="number" min="0" max="10" value="${prop.bathrooms || 1}" oninput="recalcEstimate()" ${hasOwner ? 'readonly disabled' : ''} style="${inputStyle}${hasOwner ? 'opacity:0.6;' : ''}"></div>`;
  html += `<div style="flex:0.5;min-width:70px;"><label style="${labelStyle}">m&sup2;</label>
    <input id="inlinePropSurface" type="number" min="1" max="1000" value="${prop.surface || ''}" oninput="recalcEstimate()" ${hasOwner ? 'readonly disabled' : ''} style="${inputStyle}${hasOwner ? 'opacity:0.6;' : ''}"></div>`;
  html += `</div>`;
  html += `</div>`; // end right column
  html += `</div>`; // end flex row
  html += `</div>`; // end details body
  html += `</details>`; // end general info section

  // Hidden inputs (kept for backward compat / saveInlinePropDetail)
  const svcSum = Object.values(prop.serviceConfig || {}).filter(c => c && c.enabled).reduce((s, c) => s + (parseFloat(c.price)||0), 0);
  html += `<input id="inlinePropPrice" type="hidden" value="${svcSum}">`;

  // SECTION: Services requis (avec total integre)
  html += `<details style="${sectionStyle}">`;
  html += `<summary style="list-style:none;cursor:pointer;">`;
  html += `<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">`;
  html += `<div style="${sectionTitleStyle}margin-bottom:0;">&#128736; Services requis</div>`;
  html += `<div style="display:flex;align-items:center;gap:8px;font-size:13px;"><span style="color:var(--text3);">Total:</span><span id="inlinePropPriceDisplay" style="color:#34d399;font-weight:700;font-size:15px;">${svcSum.toFixed(2)} €</span><span class="collapseArrow">&#9662;</span></div>`;
  html += `</div>`;
  html += `</summary>`;
  html += `<div style="margin-top:12px;"><div id="inlinePropServicesChecks"></div></div>`;
  html += `</details>`;


  // SECTION: Horaires & Acces
  html += `<details style="${sectionStyle}">`;
  html += `<summary style="list-style:none;cursor:pointer;"><div style="${sectionTitleStyle}margin-bottom:0;display:flex;justify-content:space-between;"><span>&#128272; Horaires & Acces</span><span class="collapseArrow">&#9662;</span></div></summary>`;
  html += `<div style="margin-top:12px;">`;
  html += `<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px;">`;
  html += `<div><label style="${labelStyle}">Check-in</label>
    <input type="time" id="inlinePropCheckin" value="${prop.checkinTime || '15:00'}" style="${inputStyle}font-family:'Inter',sans-serif;"></div>`;
  html += `<div><label style="${labelStyle}">Check-out</label>
    <input type="time" id="inlinePropCheckout" value="${prop.checkoutTime || '11:00'}" style="${inputStyle}font-family:'Inter',sans-serif;"></div>`;
  html += `</div>`;
  html += `<div style="margin-bottom:12px;"><label style="${labelStyle}">Code d'acces / Digicode</label>
    <input type="text" id="inlinePropAccessCode" value="${esc(prop.accessCode || '')}" placeholder="Ex: 1234B, boite a cles..." style="${inputStyle}font-family:'Inter',sans-serif;"></div>`;
  html += `<div style="margin-bottom:12px;"><label style="${labelStyle}">Consignes d'arrivee</label>
    <textarea id="inlinePropConsignes" rows="2" placeholder="Parking, wifi, instructions..." style="${inputStyle}resize:vertical;font-family:'Inter',sans-serif;">${esc(prop.consignes || '')}</textarea></div>`;
  html += `<div style="margin-bottom:4px;"><label style="${labelStyle}">Notes</label>
    <textarea id="inlinePropNotes" rows="3" placeholder="${t('property.notes_placeholder')}" style="${inputStyle}resize:vertical;font-family:'Inter',sans-serif;">${esc(prop.notes || '')}</textarea></div>`;
  html += `</div>`;
  html += `</details>`;

  // SECTION: Calendriers iCal (collapsible, advanced)
  const icals = prop.icals || [];
  const icalCount = icals.length;
  html += `<details style="${sectionStyle}">`;
  html += `<summary style="list-style:none;cursor:pointer;display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;">`;
  html += `<div style="${sectionTitleStyle}margin-bottom:0;">&#128197; Synchronisation calendriers</div>`;
  html += `<div style="font-size:12px;color:${icalCount > 0 ? '#34d399' : 'var(--text3)'};">${icalCount > 0 ? '&#9989; ' + icalCount + ' calendrier' + (icalCount > 1 ? 's' : '') + ' connecte' + (icalCount > 1 ? 's' : '') : 'Aucun calendrier'}</div>`;
  html += `</summary>`;
  html += `<div style="margin-top:12px;padding-top:12px;border-top:1px solid var(--border);">`;
  html += `<div style="font-size:12px;color:var(--text3);line-height:1.6;margin-bottom:12px;padding:10px 12px;background:var(--surface2);border-radius:8px;border-left:3px solid #6c63ff;">`;
  html += `&#128161; <b>A quoi servent les iCal ?</b><br>`;
  html += `Connectez vos calendriers Airbnb / Booking pour synchroniser automatiquement les reservations. `;
  html += `Les services configures en <b>"fin de location"</b> ou <b>"debut de location"</b> (menage standard, check-in/out, etc.) seront declenches automatiquement aux bonnes dates.<br>`;
  html += `<span style="color:var(--text3);font-size:11px;">Pour les services <b>recurrents</b> (hebdomadaire, mensuel...), les iCal ne sont pas necessaires.</span>`;
  html += `</div>`;
  if (icals.length === 0) {
    html += `<div style="color:var(--text3);font-size:12px;text-align:center;padding:8px;">Aucun calendrier configure</div>`;
  } else {
    icals.forEach((ical, i) => {
      const platformLabels = { airbnb: 'Airbnb', booking: 'Booking', vrbo: 'VRBO', other: 'Autre' };
      html += `<div style="display:flex;gap:8px;align-items:center;margin-bottom:8px;">
        <span style="font-size:11px;font-weight:600;color:var(--text3);min-width:60px;">${platformLabels[ical.platform] || ical.platform}</span>
        <input type="text" id="inlineIcal_${i}" value="${esc(ical.url)}" placeholder="URL iCal..." style="flex:1;padding:8px;background:var(--surface2);color:var(--text);border:1px solid var(--border2);border-radius:6px;font-size:12px;box-sizing:border-box;" onchange="updateInlineIcalUrl(${i}, this.value)">
        <button class="btn btnSmall btnDanger" style="padding:4px 8px;" onclick="removeInlineIcal(${i})">&#10005;</button>
      </div>`;
    });
  }
  html += `<button class="btn btnSmall btnSuccess" onclick="showAddIcalModal()" style="padding:6px 14px;font-size:12px;margin-top:4px;">+ Ajouter un calendrier</button>`;
  html += `</div>`;
  html += `</details>`;


  // SECTION: Delete only (auto-save handles saving)
  if ((fullConfig.properties || []).length > 1) {
    html += `<div style="margin-bottom:16px;">`;
    html += `<button class="btn btnSmall btnDanger" onclick="customConfirm(t('property.delete_confirm'),'Supprimer').then(ok=>{if(ok){removeCurrentProperty();setTimeout(()=>{inlinePropCheckItems=[];renderBiensPropertySelector();renderPropertyDetailsInline()},300)}})" style="padding:10px 16px;font-size:13px;">&#128465; Supprimer le bien</button>`;
    html += `</div>`;
  }

  container.innerHTML = html;

  // Render services config (compact list + add button)
  renderInlineServicesList(prop);

  // Auto-save all property fields on change
  const _autoSaveInline = debounce(() => saveInlinePropDetail(), 1500);
  document.querySelectorAll('#propertyDetailsInline input, #propertyDetailsInline select, #propertyDetailsInline textarea').forEach(el => {
    el.addEventListener('input', _autoSaveInline);
    el.addEventListener('change', _autoSaveInline);
  });
}

let inlinePropCheckItems = [];

function renderInlineChecklist() {
  const prop = API.getActiveProperty(fullConfig);
  if (!prop) return;
  if (inlinePropCheckItems._propId !== prop.id) {
    inlinePropCheckItems = (prop.checklist || []).slice();
    inlinePropCheckItems._propId = prop.id;
  }
  const div = document.getElementById('inlinePropChecklist');
  if (!div) return;
  if (!inlinePropCheckItems.length) {
    div.innerHTML = '<div style="color:var(--text3);font-size:12px;text-align:center;padding:8px;">Aucune instruction</div>';
    return;
  }
  div.innerHTML = inlinePropCheckItems.map((item, i) => `
    <div style="display:flex;align-items:center;gap:8px;padding:6px 4px;border-bottom:1px solid var(--border);">
      <span style="flex:1;font-size:13px;color:var(--text);">${esc(item)}</span>
      <button class="btn btnSmall btnDanger" style="padding:2px 8px;font-size:11px;" onclick="removeInlineCheckItem(${i})">&#10005;</button>
    </div>
  `).join('');
}

function addInlineCheckItem() {
  const input = document.getElementById('inlinePropNewCheckItem');
  const val = input.value.trim();
  if (!val) return;
  inlinePropCheckItems.push(val);
  input.value = '';
  renderInlineChecklist();
}

function removeInlineCheckItem(idx) {
  inlinePropCheckItems.splice(idx, 1);
  renderInlineChecklist();
}

async function handleInlinePropPhoto(input) {
  const file = input.files[0];
  if (!file) return;
  if (file.size > 10000000) { showToast('Image trop lourde (max 10MB)'); return; }
  const prop = API.getActiveProperty(fullConfig);
  if (!prop) return;
  const img = document.getElementById('inlinePropPhotoImg');
  const placeholder = document.getElementById('inlinePropPhotoPlaceholder');
  // Show preview immediately with compressed version
  const { dataUrl } = await compressImage(file, 1400, 150);
  img.src = dataUrl;
  img.style.display = 'block';
  if (placeholder) placeholder.style.display = 'none';
  // Upload to Supabase Storage
  const url = await uploadPhoto(file, 'properties', prop.id);
  if (url) {
    img.src = url;
    prop.photo = url;
    saveInlinePropDetail();
    showToast('Photo enregistree');
  } else {
    // Fallback: save compressed base64 if storage fails
    prop.photo = dataUrl;
    saveInlinePropDetail();
  }
}

function updateInlineIcalUrl(idx, url) {
  const prop = API.getActiveProperty(fullConfig);
  if (!prop || !prop.icals || !prop.icals[idx]) return;
  prop.icals[idx].url = url.trim();
  syncIcalToOldFormat(prop);
  _debouncedSaveConfig();
}

function removeInlineIcal(idx) {
  const prop = API.getActiveProperty(fullConfig);
  if (!prop || !prop.icals) return;
  prop.icals.splice(idx, 1);
  syncIcalToOldFormat(prop);
  _debouncedSaveConfig();
  renderPropertyDetailsInline();
}

function recalcEstimate() {
  const type = document.getElementById('inlinePropType')?.value || 'apartment';
  const rooms = parseInt(document.getElementById('inlinePropRooms')?.value) || 0;
  const bathrooms = parseInt(document.getElementById('inlinePropBathrooms')?.value) || 0;
  const surface = parseInt(document.getElementById('inlinePropSurface')?.value) || 0;
  if (!rooms && !surface) return;

  // Base prices by type
  const basePrices = { studio: 30, apartment: 40, house: 55, villa: 80, chalet: 70, other: 45 };
  const baseDurations = { studio: 45, apartment: 60, house: 90, villa: 120, chalet: 105, other: 75 };

  let price = basePrices[type] || 45;
  let duration = baseDurations[type] || 75;

  // Adjust for rooms
  if (rooms > 1) { price += (rooms - 1) * 8; duration += (rooms - 1) * 15; }
  // Adjust for bathrooms
  if (bathrooms > 1) { price += (bathrooms - 1) * 10; duration += (bathrooms - 1) * 15; }
  // Adjust for surface
  if (surface > 50) { price += Math.floor((surface - 50) / 25) * 5; duration += Math.floor((surface - 50) / 25) * 10; }

  // Round to nearest 5
  price = Math.round(price / 5) * 5;
  duration = Math.round(duration / 15) * 15;

  // Update fields only if they're empty or were auto-filled
  const priceEl = document.getElementById('inlinePropPrice');
  const durationEl = document.getElementById('inlinePropDuration');
  if (priceEl && (!priceEl.value || priceEl.dataset.auto === '1')) {
    priceEl.value = price;
    priceEl.dataset.auto = '1';
  }
  if (durationEl && durationEl.dataset.auto !== '0') {
    // Find closest duration option
    const opts = Array.from(durationEl.options).map(o => parseInt(o.value));
    const closest = opts.reduce((a, b) => Math.abs(b - duration) < Math.abs(a - duration) ? b : a);
    durationEl.value = String(closest);
  }

  // Also update service config prices if they're empty
  document.querySelectorAll('.svcPrice').forEach(input => {
    if (!input.value || input.dataset.auto === '1') {
      const svcId = input.dataset.svc;
      // Ménage standard = full price, others = fraction
      const svcPrices = { cleaning_standard: price, cleaning_deep: Math.round(price * 1.5 / 5) * 5, windows: Math.round(price * 0.4 / 5) * 5, laundry: 15, ironing: 15, pressing: 25, checkin: 20, checkout: 15, key_handover: 10, gardening: 30, pool: 25, snow: 35, shopping: 20, handyman: 40, cooking: 50, childcare: 25, petcare: 20 };
      if (svcPrices[svcId] !== undefined) { input.value = svcPrices[svcId]; input.dataset.auto = '1'; }
    }
  });
  // Auto-save after recalculation
  saveInlinePropDetail();
}

// Scroll to a property field and focus/highlight it
function scrollToPropField(targetId, action) {
  const el = document.getElementById(targetId);
  if (!el) return;
  // Open any ancestor <details> that is collapsed
  let parent = el.parentElement;
  while (parent) {
    if (parent.tagName && parent.tagName.toLowerCase() === 'details' && !parent.open) {
      parent.open = true;
    }
    parent = parent.parentElement;
  }
  // Legacy action hook (iCal section) - still supported
  if (action === 'openIcalSection') {
    document.querySelectorAll('details').forEach(d => {
      const s = d.querySelector('summary');
      if (s && s.textContent.toLowerCase().includes('calendriers')) d.open = true;
    });
  }
  setTimeout(() => {
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    // Highlight effect (1s)
    const prevOutline = el.style.outline;
    const prevTransition = el.style.transition;
    el.style.transition = 'outline 0.3s ease, box-shadow 0.3s ease';
    el.style.outline = '2px solid #6c63ff';
    el.style.boxShadow = '0 0 0 4px rgba(108,99,255,0.25)';
    setTimeout(() => {
      el.style.outline = prevOutline || '';
      el.style.boxShadow = '';
      el.style.transition = prevTransition || '';
    }, 1000);
    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT') {
      try { el.focus(); } catch(e) { /* element unavailable, ignore */ }
    }
  }, 200);
}

// Render compact active services list + Add button
function renderInlineServicesList(prop) {
  const container = document.getElementById('inlinePropServicesChecks');
  if (!container) return;
  const svcConfig = prop.serviceConfig || {};
  const active = Object.entries(svcConfig).filter(([k,v]) => v && v.enabled);
  let html = '';
  if (active.length === 0) {
    html += `<div style="padding:16px;text-align:center;color:var(--text3);font-size:12px;background:var(--surface2);border-radius:8px;border:1px dashed var(--border2);">Aucun service configure</div>`;
  } else {
    active.forEach(([svcId, cfg]) => {
      const label = getServiceLabel(svcId);
      let freqLabel = getFreqLabel(cfg.frequency || 'booking_end');
      if (cfg.frequency === 'one_time' && cfg.scheduled_date) {
        try { freqLabel = 'Ponctuel · ' + new Date(cfg.scheduled_date + 'T12:00:00').toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }); } catch(e) { /* malformed date, keep default label */ }
      }
      const formula = SERVICE_PRICING[svcId];
      const summary = formula && cfg.params ? formula.summary(cfg.params) : '';
      const price = parseFloat(cfg.price) || 0;
      html += `<div style="background:var(--surface2);border:1px solid var(--border2);border-radius:8px;padding:10px 12px;margin-bottom:6px;display:flex;align-items:center;gap:10px;">`;
      html += `<div style="flex:1;min-width:0;">`;
      html += `<div style="font-size:13px;font-weight:600;color:var(--text);display:flex;align-items:center;gap:6px;flex-wrap:wrap;">${label}<span style="font-size:11px;color:var(--text3);font-weight:400;">· ${esc(freqLabel)}</span><span style="font-size:13px;color:#34d399;font-weight:700;">${price.toFixed(2)}€</span></div>`;
      if (summary) html += `<div style="font-size:11px;color:var(--text3);margin-top:2px;">${esc(summary)}</div>`;
      html += `</div>`;
      html += `<button onclick="openServiceEditor('${svcId}')" title="Modifier" style="background:transparent;border:none;color:var(--text3);font-size:16px;cursor:pointer;padding:4px 8px;">&#9881;</button>`;
      html += `<button onclick="removeServiceFromProp('${svcId}')" title="Retirer" style="background:transparent;border:none;color:#e94560;font-size:14px;cursor:pointer;padding:4px 8px;">&#128465;</button>`;
      html += `</div>`;
    });
  }
  html += `<button onclick="openServiceEditor()" style="width:100%;margin-top:8px;padding:10px;background:linear-gradient(135deg,#6c63ff,#5a54e0);color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;">+ Ajouter un service</button>`;
  container.innerHTML = html;
}

// Remove a service from active property
async function removeServiceFromProp(svcId) {
  const ok = await customConfirm(t('property.remove_service_confirm'), 'Confirmation');
  if (!ok) return;
  const prop = API.getActiveProperty(fullConfig);
  if (!prop || !prop.serviceConfig) return;
  delete prop.serviceConfig[svcId];
  syncAndSaveConfig();
  renderInlineServicesList(prop);
  refreshInlineTotals(prop);
}

// Refresh totals display
function refreshInlineTotals(prop) {
  const svcSum = Object.values(prop.serviceConfig || {}).filter(c => c && c.enabled).reduce((s, c) => s + (parseFloat(c.price)||0), 0);
  const disp = document.getElementById('inlinePropPriceDisplay');
  if (disp) disp.textContent = svcSum.toFixed(2) + ' €';
  const hidden = document.getElementById('inlinePropPrice');
  if (hidden) hidden.value = svcSum;
}

// Open popup to add or edit a service
function openServiceEditor(existingSvcId) {
  const prop = API.getActiveProperty(fullConfig);
  if (!prop) return;
  const svcConfig = prop.serviceConfig || {};
  const editing = !!existingSvcId;
  const current = editing ? svcConfig[existingSvcId] : null;
  let selectedSvc = existingSvcId || null;

  const overlay = document.createElement('div');
  overlay.id = 'serviceEditorOverlay';
  overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.7);z-index:99999;display:flex;align-items:center;justify-content:center;padding:20px;overflow-y:auto;';
  overlay.innerHTML = `
    <div style="max-width:480px;width:100%;background:var(--surface);border-radius:16px;padding:24px;border:1px solid var(--border);max-height:90vh;overflow-y:auto;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
        <h2 style="color:var(--text);font-size:18px;margin:0;">${editing ? '&#9881; Modifier le service' : '+ Ajouter un service'}</h2>
        <button onclick="document.getElementById('serviceEditorOverlay').remove()" style="background:transparent;border:none;color:var(--text3);font-size:22px;cursor:pointer;">&times;</button>
      </div>
      <div id="serviceEditorBody"></div>
    </div>
  `;
  document.body.appendChild(overlay);
  renderServiceEditorBody(selectedSvc, current, editing);
}

function renderServiceEditorBody(selectedSvc, current, editing) {
  const body = document.getElementById('serviceEditorBody');
  if (!body) return;
  const prop = API.getActiveProperty(fullConfig);
  let html = '';

  // Step 1: Service type selector (if not editing)
  if (!editing) {
    html += `<label style="display:block;font-size:12px;color:var(--text3);margin-bottom:6px;text-transform:uppercase;letter-spacing:0.5px;">Type de service</label>`;
    html += `<select id="svcEditorType" onchange="onServiceTypeChange(this.value)" style="width:100%;padding:10px 12px;background:var(--surface2);color:var(--text);border:1px solid var(--border2);border-radius:8px;font-size:14px;margin-bottom:16px;">`;
    html += `<option value="">-- Choisir un service --</option>`;
    SERVICE_CATALOG.forEach(cat => {
      html += `<optgroup label="${esc(cat.label)}">`;
      cat.services.forEach(s => {
        // Skip already-active services (except if editing)
        const already = prop.serviceConfig && prop.serviceConfig[s.id] && prop.serviceConfig[s.id].enabled;
        if (already) return;
        const selAttr = selectedSvc === s.id ? 'selected' : '';
        html += `<option value="${s.id}" ${selAttr}>${s.icon} ${esc(s.label)}</option>`;
      });
      html += `</optgroup>`;
    });
    html += `</select>`;
  } else {
    html += `<div style="padding:10px 12px;background:var(--surface2);border:1px solid var(--border2);border-radius:8px;font-size:14px;font-weight:600;color:var(--text);margin-bottom:16px;">${getServiceLabel(selectedSvc)}</div>`;
  }

  // Step 2: Details if service is selected
  if (selectedSvc) {
    const freqVal = current ? current.frequency : 'booking_end';
    const scheduledDate = current && current.scheduled_date ? current.scheduled_date : '';
    html += `<label style="display:block;font-size:12px;color:var(--text3);margin-bottom:6px;text-transform:uppercase;letter-spacing:0.5px;">Declencheur</label>`;
    html += `<select id="svcEditorFreq" onchange="onSvcEditorFreqChange()" style="width:100%;padding:10px 12px;background:var(--surface2);color:var(--text);border:1px solid var(--border2);border-radius:8px;font-size:14px;margin-bottom:16px;">`;
    SERVICE_FREQ_OPTIONS.forEach(o => { html += `<option value="${o.v}" ${freqVal === o.v ? 'selected' : ''}>${esc(o.l)}</option>`; });
    html += `</select>`;

    // Date picker (visible only when freq = one_time)
    html += `<div id="svcEditorDateRow" style="display:${freqVal === 'one_time' ? 'block' : 'none'};margin-bottom:16px;">`;
    html += `<label style="display:block;font-size:12px;color:var(--text3);margin-bottom:6px;text-transform:uppercase;letter-spacing:0.5px;">Date du service</label>`;
    html += `<input type="date" id="svcEditorDate" value="${esc(scheduledDate)}" style="width:100%;padding:10px 12px;background:var(--surface2);color:var(--text);border:1px solid var(--border2);border-radius:8px;font-size:14px;box-sizing:border-box;">`;
    html += `</div>`;

    const formula = SERVICE_PRICING[selectedSvc];
    const currentParams = (current && current.params) || {};
    if (formula) {
      // Split params: those coming from prop (read-only) vs user-editable
      const fromPropParams = formula.params.filter(p => p.fromProp);
      const editableParams = formula.params.filter(p => !p.fromProp);

      if (fromPropParams.length > 0) {
        html += `<div style="font-size:12px;color:var(--text3);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px;">Donnees du bien</div>`;
        html += `<div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:12px;padding:10px 12px;background:var(--surface2);border:1px solid var(--border2);border-radius:8px;font-size:12px;color:var(--text2);">`;
        fromPropParams.forEach(p => {
          const val = prop[p.fromProp] !== undefined ? prop[p.fromProp] : (p.default||0);
          html += `<span><b>${esc(p.label)}:</b> ${esc(String(val))}</span>`;
          html += `<input type="hidden" class="svcEditorParam" data-key="${p.key}" value="${val}">`;
        });
        html += `</div>`;
      }

      if (editableParams.length > 0) {
        html += `<div style="font-size:12px;color:var(--text3);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px;">Parametres</div>`;
        html += `<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:16px;">`;
        editableParams.forEach(p => {
          let val = currentParams[p.key];
          if (val === undefined || val === null || val === '') val = p.default;
          html += `<div>`;
          html += `<label style="display:block;font-size:11px;color:var(--text3);margin-bottom:4px;">${esc(p.label)}</label>`;
          html += `<input type="${p.type}" class="svcEditorParam" data-key="${p.key}" min="${p.min||0}" step="${p.step||1}" value="${val}" oninput="recomputeServiceEditorPrice()" style="width:100%;padding:8px 10px;background:var(--surface2);color:var(--text);border:1px solid var(--border2);border-radius:8px;font-size:13px;">`;
          html += `</div>`;
        });
        html += `</div>`;
      }
    }

    // Price: calculated + editable
    // For initial computation, merge fromProp values into params (they're read-only but still feed the formula)
    const effectiveParams = Object.assign({}, currentParams);
    if (formula) {
      formula.params.forEach(p => {
        if (effectiveParams[p.key] === undefined || effectiveParams[p.key] === null || effectiveParams[p.key] === '') {
          if (p.fromProp && prop[p.fromProp] !== undefined) effectiveParams[p.key] = prop[p.fromProp];
          else effectiveParams[p.key] = p.default;
        }
      });
    }
    const computed = formula ? formula.calc(effectiveParams) : 0;
    const priceVal = current && current.price !== undefined ? current.price : computed;
    const priceAuto = current ? (current.priceAuto !== false) : true;
    html += `<label style="display:block;font-size:12px;color:var(--text3);margin-bottom:6px;text-transform:uppercase;letter-spacing:0.5px;">Prix estime (€)</label>`;
    html += `<div style="display:flex;gap:8px;align-items:center;margin-bottom:8px;">`;
    html += `<input type="number" id="svcEditorPrice" min="0" step="1" value="${priceVal}" oninput="onServicePriceManualChange()" style="flex:1;padding:10px 12px;background:var(--surface2);color:var(--text);border:1px solid var(--border2);border-radius:8px;font-size:14px;">`;
    html += `<button onclick="recomputeServiceEditorPrice(true)" title="Recalculer auto" style="padding:10px 14px;background:var(--surface2);color:var(--accent);border:1px solid var(--border2);border-radius:8px;font-size:13px;cursor:pointer;">&#128259;</button>`;
    html += `</div>`;
    html += `<div id="svcEditorPriceInfo" style="font-size:11px;color:var(--text3);margin-bottom:16px;">${priceAuto ? 'Calcul automatique actif' : 'Prix personnalise (cliquez sur &#128259; pour recalculer)'}</div>`;
    html += `<input type="hidden" id="svcEditorPriceAuto" value="${priceAuto ? '1' : '0'}" data-svc="${esc(selectedSvc)}">`;

    // Actions
    html += `<div style="display:flex;gap:10px;margin-top:8px;">`;
    html += `<button onclick="document.getElementById('serviceEditorOverlay').remove()" style="flex:1;padding:12px;background:var(--surface2);color:var(--text2);border:1px solid var(--border2);border-radius:8px;font-size:14px;cursor:pointer;">Annuler</button>`;
    html += `<button onclick="saveServiceEditor('${selectedSvc}')" style="flex:1;padding:12px;background:linear-gradient(135deg,#6c63ff,#5a54e0);color:#fff;border:none;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;">${editing ? 'Enregistrer' : 'Ajouter'}</button>`;
    html += `</div>`;
  }

  body.innerHTML = html;
}

function onSvcEditorFreqChange() {
  const sel = document.getElementById('svcEditorFreq');
  const row = document.getElementById('svcEditorDateRow');
  if (!sel || !row) return;
  row.style.display = sel.value === 'one_time' ? 'block' : 'none';
}

function onServiceTypeChange(svcId) {
  if (!svcId) return;
  renderServiceEditorBody(svcId, null, false);
}

function recomputeServiceEditorPrice(forceAuto) {
  const svcType = document.getElementById('svcEditorType')?.value || document.querySelector('#serviceEditorBody [data-editing-svc]')?.dataset.editingSvc;
  const svcId = svcType || window.__svcEditorCurrentSvc;
  // Find the current svcId from context by reading the last selected service - simpler: use a global
  const body = document.getElementById('serviceEditorBody');
  if (!body) return;
  const inputs = body.querySelectorAll('.svcEditorParam');
  const params = {};
  inputs.forEach(el => {
    const v = parseFloat(el.value);
    params[el.dataset.key] = isNaN(v) ? 0 : v;
  });
  // Resolve svcId from the editor state
  let currentSvcId = null;
  const sel = document.getElementById('svcEditorType');
  if (sel && sel.value) currentSvcId = sel.value;
  if (!currentSvcId) {
    // Editing mode: look at the header
    const hiddenAuto = document.getElementById('svcEditorPriceAuto');
    if (hiddenAuto && hiddenAuto.dataset.svc) currentSvcId = hiddenAuto.dataset.svc;
  }
  if (!currentSvcId) return;
  const formula = SERVICE_PRICING[currentSvcId];
  if (!formula) return;
  const priceInput = document.getElementById('svcEditorPrice');
  const autoFlag = document.getElementById('svcEditorPriceAuto');
  const infoEl = document.getElementById('svcEditorPriceInfo');
  const isAuto = autoFlag && autoFlag.value === '1';
  if (isAuto || forceAuto) {
    const computed = formula.calc(params);
    if (priceInput) priceInput.value = computed;
    if (autoFlag) autoFlag.value = '1';
    if (infoEl) infoEl.textContent = 'Calcul automatique actif';
  }
}

function onServicePriceManualChange() {
  const autoFlag = document.getElementById('svcEditorPriceAuto');
  const infoEl = document.getElementById('svcEditorPriceInfo');
  if (autoFlag) autoFlag.value = '0';
  if (infoEl) infoEl.innerHTML = 'Prix personnalise (cliquez sur &#128259; pour recalculer)';
}

function saveServiceEditor(svcId) {
  const prop = API.getActiveProperty(fullConfig);
  if (!prop) return;
  const sel = document.getElementById('svcEditorType');
  const finalSvcId = (sel && sel.value) ? sel.value : svcId;
  if (!finalSvcId) { showToast('Choisissez un service'); return; }
  const freq = document.getElementById('svcEditorFreq')?.value || 'booking_end';
  const scheduledDate = document.getElementById('svcEditorDate')?.value || '';
  if (freq === 'one_time' && !scheduledDate) { showToast('Choisissez une date pour ce service ponctuel'); return; }
  const price = parseFloat(document.getElementById('svcEditorPrice')?.value) || 0;
  const autoFlag = document.getElementById('svcEditorPriceAuto');
  const priceAuto = autoFlag ? autoFlag.value === '1' : true;
  const params = {};
  document.querySelectorAll('.svcEditorParam').forEach(el => {
    const v = parseFloat(el.value);
    params[el.dataset.key] = isNaN(v) ? 0 : v;
  });
  prop.serviceConfig = prop.serviceConfig || {};
  prop.serviceConfig[finalSvcId] = {
    enabled: true,
    frequency: freq,
    scheduled_date: freq === 'one_time' ? scheduledDate : '',
    price: price,
    priceAuto: priceAuto,
    params: params,
  };
  prop.cleaningPrice = Object.values(prop.serviceConfig).filter(c => c && c.enabled).reduce((s, c) => s + (parseFloat(c.price)||0), 0);
  prop.required_services = Object.keys(prop.serviceConfig).filter(k => prop.serviceConfig[k] && prop.serviceConfig[k].enabled);
  syncAndSaveConfig();
  document.getElementById('serviceEditorOverlay')?.remove();
  renderInlineServicesList(prop);
  refreshInlineTotals(prop);
  showToast('Service enregistre');
}

function saveInlinePropDetail() {
  const prop = API.getActiveProperty(fullConfig);
  if (!prop) return;
  prop.name = (document.getElementById('inlinePropName').value || '').trim() || 'Mon logement';
  prop.address = (document.getElementById('inlinePropAddress').value || '').trim();
  prop.type = document.getElementById('inlinePropType').value;
  prop.rooms = parseInt(document.getElementById('inlinePropRooms').value) || 0;
  prop.bathrooms = parseInt(document.getElementById('inlinePropBathrooms')?.value) || 0;
  prop.surface = parseInt(document.getElementById('inlinePropSurface').value) || 0;
  prop.cleaningPrice = parseInt(document.getElementById('inlinePropPrice').value) || 0;
  prop.ownerPrice = parseInt(document.getElementById('inlinePropOwnerPrice').value) || 0;
  prop.cleaningDuration = parseInt(document.getElementById('inlinePropDuration').value) || 90;
  prop.notes = (document.getElementById('inlinePropNotes') || {}).value || '';
  prop.checkinTime = document.getElementById('inlinePropCheckin').value;
  prop.checkoutTime = document.getElementById('inlinePropCheckout').value;
  prop.accessCode = (document.getElementById('inlinePropAccessCode').value || '').trim();
  prop.consignes = (document.getElementById('inlinePropConsignes').value || '').trim();
  prop.checklist = inlinePropCheckItems.slice();
  // serviceConfig is managed directly via the service popup — keep existing
  prop.serviceConfig = prop.serviceConfig || {};
  // cleaningPrice is now computed from serviceConfig sum (kept for backward compat)
  prop.cleaningPrice = Object.values(prop.serviceConfig).filter(c => c && c.enabled).reduce((sum, c) => sum + (parseFloat(c.price)||0), 0);
  // Maintain requiredServices for backward compatibility
  prop.required_services = Object.keys(prop.serviceConfig).filter(k => prop.serviceConfig[k] && prop.serviceConfig[k].enabled);
  // Photo
  const img = document.getElementById('inlinePropPhotoImg');
  if (img && img.style.display !== 'none' && img.src && img.src.startsWith('data:')) {
    prop.photo = img.src;
  }
  syncAndSaveConfig();
  renderPropertySelector();
  renderBiensPropertySelector();
  showToast(t('prop.detail.saved') || 'Propriete enregistree');
}


window.renderPropertySelector = renderPropertySelector;
window.renderBiensPropertySelector = renderBiensPropertySelector;
window.switchBiensProperty = switchBiensProperty;
window.renderPropertyDetailsInline = renderPropertyDetailsInline;
window.renderInlineChecklist = renderInlineChecklist;
window.addInlineCheckItem = addInlineCheckItem;
window.removeInlineCheckItem = removeInlineCheckItem;
window.handleInlinePropPhoto = handleInlinePropPhoto;
window.updateInlineIcalUrl = updateInlineIcalUrl;
window.removeInlineIcal = removeInlineIcal;
window.recalcEstimate = recalcEstimate;
window.scrollToPropField = scrollToPropField;
window.renderInlineServicesList = renderInlineServicesList;
window.removeServiceFromProp = removeServiceFromProp;
window.refreshInlineTotals = refreshInlineTotals;
window.openServiceEditor = openServiceEditor;
window.renderServiceEditorBody = renderServiceEditorBody;
window.onSvcEditorFreqChange = onSvcEditorFreqChange;
window.onServiceTypeChange = onServiceTypeChange;
window.recomputeServiceEditorPrice = recomputeServiceEditorPrice;
window.onServicePriceManualChange = onServicePriceManualChange;
window.saveServiceEditor = saveServiceEditor;
window.saveInlinePropDetail = saveInlinePropDetail;
