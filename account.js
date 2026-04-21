// Account & role management module
// Depends on: sb, API, esc, showMsg, closeMsg, showToast, customConfirm,
//   openOverlayPopup, closeOverlayPopup, VERSION_CHANGELOG, fmtDate,
//   closeAccountModal (defined below), t
// Exposes: showAccountModal, changePassword, changeEmail, deleteAccount,
//   showDeleteAnimation + all role-change functions

async function showAccountModal() {
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return;
  document.getElementById('accountEmail').textContent = user.email;
  // Super-admin only (Fabien): show legal settings button
  const legalBtn = document.getElementById('accLegalBtn');
  if (legalBtn) {
    legalBtn.style.display = 'none';
    try { const sa = await API.isSuperAdmin(); if (sa && legalBtn) legalBtn.style.display = ''; } catch {}
  }
  // Update theme toggle state
  const themeToggle = document.getElementById('themeToggleAccount');
  if (themeToggle) {
    const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
    themeToggle.checked = isDark;
    const spans = themeToggle.parentElement.querySelectorAll('span');
    if (spans[0]) spans[0].style.background = isDark ? 'var(--accent)' : 'var(--border2)';
    if (spans[1]) spans[1].style.left = isDark ? '22px' : '2px';
  }
  // Load profile info
  let member = API.getMember();
  // Fetch fresh data from DB so local member cache doesn't show stale values
  if (member && member.id) {
    try {
      const { data: freshMember } = await sb.from('members').select('*').eq('id', member.id).maybeSingle();
      if (freshMember) { Object.assign(member, freshMember); }
    } catch(e) { console.warn('Could not refresh member:', e); }
  }
  if (member) {
    document.getElementById('profileName').value = member.display_name || '';
    document.getElementById('profileEmail').value = user.email || member.invited_email || '';
    document.getElementById('profilePhone').value = member.phone || '';
    document.getElementById('profileAddress').value = member.address || '';
    // Load billing profile
    document.getElementById('billingCompany').value = member.company_name || '';
    document.getElementById('billingSiret').value = member.siret || '';
    document.getElementById('billingVat').value = member.vat_number || '';
    document.getElementById('billingAddress').value = member.billing_address || '';
    document.getElementById('billingVatRegime').value = member.vat_regime || 'micro';
  }
  try {
    const { data: mk } = await sb.from('marketplace_profiles').select('country').eq('user_id', user.id).maybeSingle();
    const sel = document.getElementById('profileCountry');
    if (sel) sel.value = (mk && mk.country) || 'FR';
    _userCountry = (mk && mk.country) || 'FR';
  } catch(e) { console.error('load country:', e); }
  const plan = API.getPlan();
  const planEl = document.getElementById('accountPlan');
  const isPaid = plan === 'premium' || plan === 'business' || plan === 'pro';
  const org = API.getOrg();
  const hasStripe = org && org.stripe_subscription_id;
  if (isPaid) {
    const planLabel = plan === 'business' ? 'Business' : 'Pro';
    const badgeColor = plan === 'business' ? 'background:#6c63ff;' : '';
    let planHtml = '<span style="color:var(--success);font-weight:700;">' + planLabel + '</span> <span class="premiumBadge" style="' + badgeColor + '">' + planLabel.toUpperCase() + '</span>';
    if (hasStripe) {
      planHtml += ' <a href="#" onclick="openStripePortal();return false;" style="color:var(--accent2);font-size:12px;margin-left:8px;">Gerer</a>';
    } else if (API.getTrialDaysLeft() > 0) {
      planHtml += ' <span style="color:var(--warning);font-size:11px;margin-left:8px;">(Essai ' + API.getTrialDaysLeft() + 'j)</span>';
    }
    planEl.innerHTML = planHtml;
  } else {
    planEl.innerHTML = '<span>' + (t('premium.plan.free') || 'Gratuit') + '</span> — <a href="#" onclick="showPremiumModal();closeAccountModal();return false;" style="color:var(--accent);">' + (t('premium.upgrade') || 'Passer a Premium') + '</a>';
  }
  document.getElementById('overlay').style.display = 'block';
  document.getElementById('accountModal').style.display = 'block';
}
async function showRoleChangeModal() {
  const roles = [
    { id: 'concierge', label: 'Concierge', icon: '&#127970;', color: '#e94560', desc: t('role.concierge.desc') },
    { id: 'owner', label: 'Proprietaire', icon: '&#127968;', color: '#f59e0b', desc: t('role.owner.desc') },
    { id: 'provider', label: 'Prestataire', icon: '&#129529;', color: '#34d399', desc: t('role.provider.desc') },
    { id: 'tenant', label: 'Locataire', icon: '&#128273;', color: '#a78bfa', desc: t('role.tenant.desc') },
  ];
  // Add Admin option only for super-admins (Fabien)
  try {
    const sa = await API.isSuperAdmin();
    if (sa) roles.unshift({ id: 'admin', label: 'Administrateur', icon: '&#9878;&#65039;', color: '#ef4444', desc: 'Super-admin (toutes permissions)' });
  } catch {}
  const currentRole = API.getRole();
  let html = '<div style="padding:10px;">';
  html += '<div style="font-size:14px;color:var(--text2);margin-bottom:14px;text-align:center;">Choisissez votre role :</div>';
  roles.forEach(r => {
    const isCurrent = r.id === currentRole;
    html += `<div onclick="changeRole('${r.id}')" style="display:flex;align-items:center;gap:12px;padding:12px;background:${isCurrent ? r.color + '15' : 'var(--surface2)'};border:${isCurrent ? '2px solid ' + r.color : '1px solid var(--border2)'};border-radius:10px;margin-bottom:8px;cursor:pointer;transition:all 0.2s;" onmouseover="this.style.borderColor='${r.color}'" onmouseout="this.style.borderColor='${isCurrent ? r.color : 'var(--border2)'}'">`;
    html += `<span style="font-size:24px;">${r.icon}</span>`;
    html += `<div style="flex:1;"><div style="font-weight:700;color:${r.color};font-size:14px;">${r.label}${isCurrent ? ' <span style="font-size:10px;opacity:0.6;">(actuel)</span>' : ''}</div>`;
    html += `<div style="font-size:11px;color:var(--text3);">${r.desc}</div></div>`;
    html += '</div>';
  });
  html += '</div>';
  document.getElementById('msgBody').innerHTML = html;
  document.getElementById('overlay').style.display = 'block';
  document.getElementById('msgModal').style.display = 'block';
  if (document.body.classList.contains('hasStackedOverlay')) document.body.classList.add('msgAboveStacked');
}

async function changeRole(newRole) {
  const currentRole = API.getRole();
  const plan = API.getPlan();
  const isPremium = API.isPremium();
  const trialDays = API.getTrialDaysLeft();
  const isTrial = trialDays > 0;

  // Same role — do nothing
  if (newRole === currentRole) { closeMsg(); return; }

  // If user has a paid premium (not trial), handle subscription changes
  if (isPremium && !isTrial) {
    const fromConcierge = (currentRole === 'concierge');
    const toConcierge = (newRole === 'concierge');
    const toOwner = (newRole === 'owner');
    const toProvider = (newRole === 'provider');

    // Concierge (19.99€) → Proprio: offer choice
    if (fromConcierge && toOwner) {
      closeMsg();
      let html = '<div style="padding:10px;text-align:center;">';
      html += '<div style="font-size:16px;font-weight:700;color:var(--accent);margin-bottom:12px;">Changement d\'abonnement</div>';
      html += '<div style="font-size:13px;color:var(--text2);margin-bottom:20px;">Vous passez de Conciergerie a Proprietaire.<br>Votre abonnement Premium est a 19.99€/mois.</div>';
      html += '<div style="display:flex;flex-direction:column;gap:10px;">';
      html += '<button class="btn btnPrimary" style="padding:14px;font-size:14px;" onclick="doChangeRole(\'owner\',\'keep\')">Garder 19.99€/mois <span style="font-size:11px;opacity:0.7;display:block;">Toutes les fonctionnalites restent actives</span></button>';
      html += '<button class="btn btnOutline" style="padding:14px;font-size:14px;" onclick="doChangeRole(\'owner\',\'downgrade\')">Passer a 3.99€/mois <span style="font-size:11px;opacity:0.7;display:block;">Credit au prorata sur votre prochaine facture</span></button>';
      html += '<button class="btn btnOutline" style="padding:14px;font-size:14px;" onclick="closeMsg()">Annuler</button>';
      html += '</div></div>';
      showMsg(html,true);
      return;
    }

    // Proprio → Concierge
    if (toOwner === false && toConcierge) {
      // Si l'utilisateur a deja un abonnement Premium actif, on garde le prix (prorating Stripe)
      if (isPremium && !isTrial) {
        closeMsg();
        let html = '<div style="padding:10px;text-align:center;">';
        html += '<div style="font-size:16px;font-weight:700;color:var(--accent);margin-bottom:12px;">Passer en Conciergerie</div>';
        html += '<div style="font-size:13px;color:var(--text2);margin-bottom:20px;">Votre abonnement Premium reste actif.<br>Le prix passera de 3.99€ a 19.99€/mois (proratise par Stripe).</div>';
        html += '<div style="display:flex;flex-direction:column;gap:10px;">';
        html += '<button class="btn btnPrimary" style="padding:14px;font-size:14px;" onclick="doChangeRole(\'concierge\',\'upgrade\')">Confirmer</button>';
        html += '<button class="btn btnOutline" style="padding:14px;font-size:14px;" onclick="closeMsg()">Annuler</button>';
        html += '</div></div>';
        showMsg(html,true);
        return;
      }
      // Sinon (plan gratuit ou essai): laisser le choix
      closeMsg();
      let html = '<div style="padding:10px;text-align:center;">';
      html += '<div style="font-size:16px;font-weight:700;color:#6c63ff;margin-bottom:12px;">Passer en mode Conciergerie</div>';
      html += '<div style="font-size:13px;color:var(--text2);margin-bottom:20px;">Choisissez votre formule :</div>';
      html += '<div style="display:flex;flex-direction:column;gap:10px;">';
      html += '<button class="btn" style="padding:14px;font-size:14px;background:var(--surface2);color:var(--text);border:1px solid var(--border2);border-radius:10px;" onclick="doChangeRole(\'concierge\',\'none\')">Gratuit <span style="font-size:11px;opacity:0.7;display:block;">1 bien, 2 prestataires, 5 generations/mois</span></button>';
      html += '<button class="btn btnPrimary" style="padding:14px;font-size:14px;background:linear-gradient(135deg,#6c63ff,#5a54e0);" onclick="doChangeRole(\'concierge\',\'upgrade\')">Premium 19.99€/mois <span style="font-size:11px;opacity:0.7;display:block;">Illimite + Marketplace</span></button>';
      html += '<button class="btn btnOutline" style="padding:14px;font-size:14px;" onclick="closeMsg()">Annuler</button>';
      html += '</div></div>';
      showMsg(html,true);
      return;
    }

    // Any → Provider: warn about losing premium
    if (toProvider) {
      closeMsg();
      let html = '<div style="padding:10px;text-align:center;">';
      html += '<div style="font-size:16px;font-weight:700;color:#34d399;margin-bottom:12px;">Passer en mode Prestataire</div>';
      html += '<div style="font-size:13px;color:var(--text2);margin-bottom:20px;">Le mode Prestataire est gratuit.<br>Votre abonnement Premium restera actif jusqu\'a la fin de la periode.</div>';
      html += '<div style="display:flex;flex-direction:column;gap:10px;">';
      html += '<button class="btn btnPrimary" style="padding:14px;font-size:14px;background:#34d399;" onclick="doChangeRole(\'provider\',\'keep\')">Confirmer</button>';
      html += '<button class="btn btnOutline" style="padding:14px;font-size:14px;" onclick="closeMsg()">Annuler</button>';
      html += '</div></div>';
      showMsg(html,true);
      return;
    }
  }

  // Free or trial: show confirmation with current plan info
  closeMsg();
  let html = '<div style="padding:10px;text-align:center;">';
  const roleLabels = { admin: 'Administrateur', concierge: 'Concierge', owner: 'Proprietaire', provider: 'Prestataire', tenant: 'Locataire' };
  const roleColors = { admin: '#ef4444', concierge: '#6c63ff', owner: '#f59e0b', provider: '#34d399', tenant: '#a78bfa' };
  html += '<div style="font-size:16px;font-weight:700;color:' + (roleColors[newRole]||'var(--text)') + ';margin-bottom:10px;">Passer en mode ' + (roleLabels[newRole]||newRole) + '</div>';
  if (isTrial) {
    html += '<div style="font-size:12px;color:var(--success);margin-bottom:12px;padding:8px;background:rgba(52,211,153,0.1);border-radius:8px;">&#127881; Essai gratuit en cours — ' + trialDays + ' jour' + (trialDays > 1 ? 's' : '') + ' restant' + (trialDays > 1 ? 's' : '') + '<br>Toutes les fonctionnalites restent disponibles.</div>';
  } else if (plan === 'free') {
    html += '<div style="font-size:12px;color:var(--text3);margin-bottom:12px;">Plan actuel : Gratuit</div>';
  }
  html += '<div style="display:flex;flex-direction:column;gap:8px;">';
  html += '<button class="btn btnPrimary" style="padding:14px;font-size:14px;background:' + (roleColors[newRole]||'#6c63ff') + ';" onclick="doChangeRole(\'' + newRole + '\',\'none\')">Confirmer</button>';
  html += '<button class="btn btnOutline" style="padding:12px;" onclick="closeMsg()">Annuler</button>';
  html += '</div></div>';
  showMsg(html, true);
}

async function doChangeRole(newRole, subscriptionAction) {
  // Whitelist: only allow DB-valid role values
  const VALID_ROLES = ['admin','concierge','owner','provider','tenant'];
  if (!VALID_ROLES.includes(newRole)) {
    console.error('doChangeRole invalid newRole:', newRole);
    showToast('Role invalide: ' + newRole);
    return;
  }
  // Update role in DB
  const member = API.getMember();
  const prevRole = API.getRole();
  let updateErr = null;
  if (!member) {
    const { data: { user } } = await sb.auth.getUser();
    if (user) {
      const { data: members } = await sb.from('members').select('id').eq('user_id', user.id).limit(1);
      if (members && members.length) {
        const { error } = await sb.from('members').update({ role: newRole }).eq('id', members[0].id);
        updateErr = error;
      }
    }
  } else {
    const { error } = await sb.from('members').update({ role: newRole }).eq('id', member.id);
    updateErr = error;
  }
  if (updateErr) {
    console.error('changeRole DB error:', updateErr);
    closeMsg();
    showToast('Erreur: impossible de changer le role (' + (updateErr.message || 'verifiez les droits') + ')');
    return;
  }

  // Handle subscription change via Stripe
  if (subscriptionAction === 'upgrade' || subscriptionAction === 'downgrade') {
    try {
      const userId = await (async()=>{ const{data:{user}}=await sb.auth.getUser(); return user.id; })();
      const newPriceId = subscriptionAction === 'upgrade' ? STRIPE_PRICE_BUSINESS : STRIPE_PRICE_PRO;
      const resp = await fetch(`${SUPABASE_URL}/functions/v1/change-subscription`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${SUPABASE_ANON_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, newPriceId, action: subscriptionAction })
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        console.error('Stripe change error:', err);
        showToast('Erreur lors du changement d\'abonnement. Contactez le support.');
      }
    } catch(e) { notifyError('Impossible de changer d\'abonnement', e); }
  }

  closeMsg();
  localStorage.removeItem('mm_cache_config');
  localStorage.removeItem('mm_panels_revealed');
  showRoleTransition(prevRole, newRole);
  setTimeout(() => location.reload(), 2500);
}

function showRoleTransition(fromRole, toRole) {
  const labels = { concierge: 'Concierge', owner: 'Proprietaire', provider: 'Prestataire' };
  const colors = { concierge: '#6c63ff', owner: '#f59e0b', provider: '#34d399' };
  const icons = { concierge: '🏢', owner: '🏠', provider: '🧹' };
  const fromLabel = labels[fromRole] || fromRole;
  const toLabel = labels[toRole] || toRole;
  const fromColor = colors[fromRole] || '#666';
  const toColor = colors[toRole] || '#666';
  const fromIcon = icons[fromRole] || '👤';
  const toIcon = icons[toRole] || '👤';

  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.7);z-index:99999;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(4px);animation:fadeIn 0.3s;';

  const card = document.createElement('div');
  card.style.cssText = 'background:var(--surface);border-radius:20px;padding:32px 40px;text-align:center;box-shadow:0 16px 48px rgba(0,0,0,0.5);animation:scaleIn 0.4s ease;';
  card.innerHTML = `
    <div style="font-size:13px;color:var(--text3);margin-bottom:16px;text-transform:uppercase;letter-spacing:1px;">Changement de role</div>
    <div style="display:flex;align-items:center;justify-content:center;gap:16px;">
      <div id="roleFrom" style="text-align:center;transition:all 0.6s ease;">
        <div style="font-size:36px;margin-bottom:6px;">${fromIcon}</div>
        <div style="font-size:13px;font-weight:700;color:${fromColor};padding:4px 12px;background:${fromColor}20;border-radius:8px;">${fromLabel}</div>
      </div>
      <div id="roleArrow" style="font-size:24px;color:var(--text3);transition:all 0.6s ease;">→</div>
      <div id="roleTo" style="text-align:center;opacity:0.4;transform:scale(0.8);transition:all 0.6s ease;">
        <div style="font-size:36px;margin-bottom:6px;">${toIcon}</div>
        <div style="font-size:13px;font-weight:700;color:${toColor};padding:4px 12px;background:${toColor}20;border-radius:8px;">${toLabel}</div>
      </div>
    </div>
    <div id="roleCheck" style="margin-top:16px;font-size:28px;opacity:0;transform:scale(0);transition:all 0.4s ease;">✅</div>
  `;
  overlay.appendChild(card);
  document.body.appendChild(overlay);

  // Animate: fade out "from", grow "to", show check
  setTimeout(() => {
    const from = document.getElementById('roleFrom');
    const to = document.getElementById('roleTo');
    const arrow = document.getElementById('roleArrow');
    if (from) { from.style.opacity = '0.3'; from.style.transform = 'scale(0.8)'; }
    if (arrow) { arrow.style.color = 'var(--accent)'; arrow.textContent = '→'; }
    if (to) { to.style.opacity = '1'; to.style.transform = 'scale(1.1)'; }
  }, 500);

  setTimeout(() => {
    const check = document.getElementById('roleCheck');
    if (check) { check.style.opacity = '1'; check.style.transform = 'scale(1)'; }
  }, 1200);

  setTimeout(() => {
    overlay.style.transition = 'opacity 0.5s';
    overlay.style.opacity = '0';
    setTimeout(() => overlay.remove(), 500);
  }, 2200);
}

function closeAccountModal() {
  document.getElementById('overlay').style.display = 'none';
  document.getElementById('accountModal').style.display = 'none';
}

async function showProfileModal() {
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return;
  // Load marketplace profile from DB
  try {
    const { data: mkProfile } = await sb.from('marketplace_profiles').select('*').eq('user_id', user.id).maybeSingle();
    const toggle = document.getElementById('mkVisibleToggle');
    const fields = document.getElementById('mkProfileFields');
    const visible = !!(mkProfile && mkProfile.visible);
    if (toggle) toggle.checked = visible;
    // Style toggle track
    const spans = toggle?.parentElement?.querySelectorAll('span');
    if (spans && spans[0]) spans[0].style.background = visible ? 'var(--accent)' : 'var(--border2)';
    if (spans && spans[1]) spans[1].style.left = visible ? '22px' : '2px';
    if (fields) fields.style.display = visible ? 'flex' : 'none';
    if (mkProfile) {
      const name = document.getElementById('mkName'); if (name) name.value = mkProfile.display_name || '';
      const city = document.getElementById('mkCity'); if (city) city.value = mkProfile.city || '';
      const phone = document.getElementById('mkPhone'); if (phone) phone.value = mkProfile.phone || '';
      const desc = document.getElementById('mkDescription'); if (desc) desc.value = mkProfile.description || '';
      const years = document.getElementById('mkExperienceYears'); if (years) years.value = mkProfile.experience_years || '';
      const avail = document.getElementById('mkAvailability'); if (avail) avail.value = mkProfile.availability || 'available';
    }
    // Render service checkboxes
    if (typeof renderMkServiceCheckboxes === 'function') renderMkServiceCheckboxes(mkProfile && mkProfile.services ? mkProfile.services : []);
  } catch(e) { console.error('showProfileModal error:', e); }
  document.getElementById('overlay').style.display = 'block';
  document.getElementById('profileModal').style.display = 'block';
}

function closeProfileModal() {
  document.getElementById('overlay').style.display = 'none';
  document.getElementById('profileModal').style.display = 'none';
}

// Toggle helpers for "save only if changed"
function showSaveBtn(id) { const b = document.getElementById(id); if (b) b.style.display = ''; }
function hideSaveBtn(id) { const b = document.getElementById(id); if (b) b.style.display = 'none'; }

// Check if a profile is currently on vacation (used in annuaire rendering)
function isProfileOnVacation(p) {
  if (!p || !Array.isArray(p.vacation_periods)) return false;
  const today = new Date().toISOString().split('T')[0];
  return p.vacation_periods.some(v => v && v.from && v.to && today >= v.from && today <= v.to);
}

// ══ Vacation planner moved to vacation.js ══


// Stacked popup overlays (stay on top of account modal, don't close it)
function _stackedOverlayClickHandler(e) {
  // Click on backdrop (not on the box itself) closes the overlay
  if (e.target.classList && e.target.classList.contains('stackedOverlay')) {
    closeOverlayPopup(e.target.id);
  }
}
async function openOverlayPopup(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.removeEventListener('click', _stackedOverlayClickHandler);
  el.addEventListener('click', _stackedOverlayClickHandler);
  // Preload data for specific overlays
  try {
    const { data: { user } } = await sb.auth.getUser();
    const member = API.getMember();
    if (id === 'personalProfileOverlay' && member) {
      document.getElementById('profileName').value = member.display_name || '';
      const userEmail = (user && user.email) || member.invited_email || '';
      document.getElementById('profileEmail').value = userEmail;
      const emailDisp = document.getElementById('profileEmailDisplay');
      if (emailDisp) emailDisp.textContent = userEmail || '—';
      document.getElementById('profilePhone').value = member.phone || '';
      document.getElementById('profileAddress').value = member.address || '';
      const roleDisp = document.getElementById('profileRoleDisplay');
      if (roleDisp) {
        const roleLabels = { admin: 'Administrateur', concierge: 'Concierge', owner: 'Proprietaire', provider: 'Prestataire', tenant: 'Locataire' };
        roleDisp.textContent = roleLabels[API.getRole()] || API.getRole() || '—';
      }
    } else if (id === 'billingProfileOverlay' && member) {
      document.getElementById('billingCompany').value = member.company_name || '';
      document.getElementById('billingSiret').value = member.siret || '';
      document.getElementById('billingVat').value = member.vat_number || '';
      document.getElementById('billingAddress').value = member.billing_address || '';
      document.getElementById('billingVatRegime').value = member.vat_regime || 'micro';
    } else if (id === 'marketplaceProfileOverlay') {
      if (typeof loadMarketplaceProfile === 'function') loadMarketplaceProfile();
    }
  } catch(e) { console.error('openOverlayPopup load error:', e); }
  el.classList.add('visible');
  document.body.classList.add('hasStackedOverlay');
}

function closeOverlayPopup(id) {
  // Force flush pending auto-saves before closing
  if (id === 'personalProfileOverlay' && _saveProfileTimer) { clearTimeout(_saveProfileTimer); _doSaveProfile(); }
  if (id === 'billingProfileOverlay' && _saveBillingTimer) { clearTimeout(_saveBillingTimer); _doSaveBilling(); }
  if (id === 'marketplaceProfileOverlay' && _autoSaveMkTimer) { clearTimeout(_autoSaveMkTimer); _doSaveMarketplace(); }
  const el = document.getElementById(id);
  if (el) el.classList.remove('visible');
  const anyVisible = document.querySelectorAll('.stackedOverlay.visible').length;
  if (!anyVisible) document.body.classList.remove('hasStackedOverlay');
}

async function showPersonalProfileModal() {
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return;
  const member = API.getMember();
  if (member) {
    document.getElementById('profileName').value = member.display_name || '';
    document.getElementById('profileEmail').value = user.email || member.invited_email || '';
    document.getElementById('profilePhone').value = member.phone || '';
    document.getElementById('profileAddress').value = member.address || '';
  }
  document.getElementById('overlay').style.display = 'block';
  document.getElementById('personalProfileModal').style.display = 'block';
}

function closePersonalProfileModal() {
  document.getElementById('overlay').style.display = 'none';
  document.getElementById('personalProfileModal').style.display = 'none';
}

async function showBillingProfileModal() {
  const member = API.getMember();
  if (member) {
    document.getElementById('billingCompany').value = member.company_name || '';
    document.getElementById('billingSiret').value = member.siret || '';
    document.getElementById('billingVat').value = member.vat_number || '';
    document.getElementById('billingAddress').value = member.billing_address || '';
    document.getElementById('billingVatRegime').value = member.vat_regime || 'micro';
  }
  document.getElementById('overlay').style.display = 'block';
  document.getElementById('billingProfileModal').style.display = 'block';
}

function closeBillingProfileModal() {
  document.getElementById('overlay').style.display = 'none';
  document.getElementById('billingProfileModal').style.display = 'none';
}
/* ── Team Management ── */
async function showTeamModal() {
  const org = API.getOrg();
  document.getElementById('teamOrgName').textContent = org ? org.name : 'Mon organisation';

  // Load members
  const members = await API.loadMembers();
  const list = document.getElementById('teamMembersList');
  if (members.length === 0) {
    list.innerHTML = '<div style="color:var(--text3);font-size:12px;padding:8px;">Aucun membre</div>';
  } else {
    const roleLabels = { concierge: '🏢 Concierge', owner: '🏠 Proprietaire', provider: '🧹 Prestataire' };
    const roleColors = { concierge: '#6c63ff', owner: '#34d399', provider: '#f59e0b' };
    list.innerHTML = members.map(m => {
      const email = m.profiles ? m.profiles.email : (m.invited_email || '?');
      const role = m.role || 'owner';
      const isMe = m.user_id === (sb.auth.getUser && sb.auth.getUser().then ? '' : '');
      return `<div style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:var(--surface2);border-radius:8px;margin-bottom:6px;">
        <span style="font-size:11px;font-weight:700;color:${roleColors[role]||'#888'};background:${roleColors[role]||'#888'}22;padding:3px 8px;border-radius:6px;">${roleLabels[role]||role}</span>
        <span style="flex:1;font-size:13px;">${esc(email)}</span>
        ${m.accepted ? '<span style="color:var(--success);font-size:11px;">✓</span>' : '<span style="color:var(--text3);font-size:11px;">En attente</span>'}
        ${API.getRole() === 'concierge' && members.length > 1 ? '<button class="btn btnSmall btnDanger" style="padding:2px 6px;font-size:11px;" onclick="removeTeamMember(\''+m.id+'\')">✕</button>' : ''}
      </div>`;
    }).join('');
  }

  document.getElementById('overlay').style.display = 'block';
  document.getElementById('teamModal').style.display = 'block';
}
function closeTeamModal() {
  document.getElementById('overlay').style.display = 'none';
  document.getElementById('teamModal').style.display = 'none';
}
async function toggleInviteTenantFields() {
  const role = document.getElementById('inviteRole').value;
  const block = document.getElementById('inviteTenantFields');
  if (!block) return;
  if (role === 'tenant') {
    block.style.display = '';
    // Populate property dropdown
    const sel = document.getElementById('inviteTenantProperty');
    if (sel && !sel.options.length) {
      const org = API.getOrg();
      if (org) {
        const { data: props } = await sb.from('properties').select('id,name').eq('org_id', org.id).order('name');
        sel.innerHTML = '<option value="">-- Choisir un bien --</option>' + (props || []).map(p => '<option value="' + p.id + '">' + esc(p.name || '—') + '</option>').join('');
      }
    }
    // Default dates: today → +7 days
    const s = document.getElementById('inviteTenantStart');
    const e = document.getElementById('inviteTenantEnd');
    if (s && !s.value) s.value = new Date().toISOString().split('T')[0];
    if (e && !e.value) e.value = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];
  } else {
    block.style.display = 'none';
  }
}

async function submitInvite() {
  const role = document.getElementById('inviteRole').value;
  if (role === 'tenant') return inviteTenantMember();
  return inviteTeamMember();
}

async function inviteTenantMember() {
  const email = document.getElementById('inviteEmail').value.trim();
  const propId = document.getElementById('inviteTenantProperty').value;
  const start = document.getElementById('inviteTenantStart').value;
  const end = document.getElementById('inviteTenantEnd').value;
  const access = document.getElementById('inviteTenantAccess').value.trim();

  if (!email) { showMsg(t('invite.email.required')); return; }
  if (!propId) { showMsg(t('invite.property.required')); return; }
  if (!start || !end) { showMsg('Renseignez les dates d\'arrivee et de depart.'); return; }
  if (start > end) { showMsg('La date de depart doit etre apres la date d\'arrivee.'); return; }
  if (!API.isConcierge()) {
    const role = API.getRole();
    if (role !== 'owner') { showMsg(t('invite.tenant.only_concierge_owner')); return; }
  }

  const org = API.getOrg();
  if (!org) { showMsg('Organisation introuvable.'); return; }

  try {
    // 1) Check if user already has an auth account (best-effort, may be blocked by RLS)
    const { data: existingProfile } = await sb.from('profiles').select('id').eq('email', email).maybeSingle();
    let tenantUserId = existingProfile?.id || null;

    // 2) Create member row with role=tenant (accepted=false, so they accept via auth)
    await sb.from('members').insert({
      org_id: org.id,
      user_id: tenantUserId,
      role: 'tenant',
      invited_email: email,
      accepted: tenantUserId ? true : false,
    });

    // 3) Create reservation
    const { data: reza, error: rezaErr } = await sb.from('reservations').insert({
      org_id: org.id,
      property_id: propId,
      tenant_user_id: tenantUserId,
      tenant_email: email,
      start_date: start,
      end_date: end,
      access_instructions: access || null,
      status: 'active',
    }).select('id').single();
    if (rezaErr) { showMsg('Erreur: ' + rezaErr.message); return; }

    // 4) Send invitation email (via send-email if configured)
    const appUrl = window.location.origin + window.location.pathname;
    const { data: props } = await sb.from('properties').select('name').eq('id', propId).single();
    const propName = props?.name || 'votre logement';
    const fmtD = (d) => d ? new Date(d + 'T12:00:00').toLocaleDateString('fr-FR') : '—';
    try {
      const session = (await sb.auth.getSession()).data.session;
      const html = '<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:20px;color:#222;">' +
        '<h2 style="color:#6c63ff;">🔑 Bienvenue chez ' + esc(propName) + ' !</h2>' +
        '<p>Vous avez ete invite(e) comme locataire par <strong>' + esc(org.name) + '</strong>.</p>' +
        '<p><strong>Dates du sejour :</strong> ' + fmtD(start) + ' → ' + fmtD(end) + '</p>' +
        (access ? '<div style="background:#f5f7ff;border-left:3px solid #6c63ff;padding:12px;margin:16px 0;border-radius:6px;"><strong>Consignes d\'acces :</strong><br>' + esc(access).replace(/\n/g, '<br>') + '</div>' : '') +
        '<p style="margin-top:24px;"><strong>Pour acceder a votre espace locataire :</strong><br>' +
        '1. Creez un compte ou connectez-vous sur : <a href="' + appUrl + '">' + appUrl + '</a><br>' +
        '2. Utilisez cet email : <strong>' + esc(email) + '</strong></p>' +
        '<p style="font-size:12px;color:#666;margin-top:24px;border-top:1px solid #eee;padding-top:12px;">Via votre espace, vous recevrez les notifications des interventions programmees dans votre logement et pourrez communiquer avec la conciergerie.</p>' +
        '</div>';
      await fetch(SUPABASE_URL + '/functions/v1/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + (session?.access_token || '') },
        body: JSON.stringify({ to: email, subject: 'Invitation Lokizio — ' + propName, html, type: 'invitation' }),
      });
    } catch(e) { console.warn('Email send failed:', e); }

    showToast('Locataire invite ! Email envoye a ' + email);
    document.getElementById('inviteEmail').value = '';
    document.getElementById('inviteTenantAccess').value = '';
    // Show copyable invitation message
    const msg = 'Bonjour,\n\nVous etes invite(e) comme locataire chez ' + propName + ' du ' + fmtD(start) + ' au ' + fmtD(end) + '.\n\nPour acceder a votre espace : ' + appUrl + '\nAvec l\'email : ' + email + '\n\n-- Lokizio';
    customConfirm('Locataire invite. Email envoye.\n\nVoulez-vous aussi copier le message ?', 'Copier').then(ok => {
      if (ok) { navigator.clipboard.writeText(msg).catch(() => {}); showToast('Message copie'); }
    });
  } catch(e) { console.error('inviteTenantMember:', e); showMsg('Erreur: ' + (e.message || e)); }
}

async function inviteTeamMember() {
  const email = document.getElementById('inviteEmail').value.trim();
  const role = document.getElementById('inviteRole').value;
  if (!email) { showMsg(t('team.email_required') || 'Entrez un email.'); return; }
  if (!API.isAdmin()) { showMsg(t('team.admin_only') || 'Seuls les gestionnaires peuvent inviter.'); return; }

  const result = await API.inviteMember(email, role);
  if (result) {
    // Show invitation link to copy
    const appUrl = window.location.origin + window.location.pathname;
    const roleLabels = { owner: 'proprietaire', provider: 'prestataire', concierge: 'concierge' };
    const msg = `Bonjour,\n\nVous etes invite(e) en tant que ${roleLabels[role] || role} sur Lokizio.\n\n1. Creez un compte sur : ${appUrl}\n2. Utilisez l'email : ${email}\n3. Votre acces sera automatiquement configure.\n\n-- Lokizio`;

    await customConfirm(
      t('invite.created') + email + ' (role: ' + (roleLabels[role] || role) + ').\n\nEnvoyez-lui ce lien pour creer son compte :\n' + appUrl + '\n\nAvec l\'email : ' + email,
      t('invite.copy_message')
    ).then(ok => {
      if (ok) {
        navigator.clipboard.writeText(msg).catch(() => {});
        showToast('Message d\'invitation copie !');
      }
    });

    document.getElementById('inviteEmail').value = '';
    showTeamModal();
  } else {
    showMsg(t('team.invite_error') || 'Erreur lors de l\'invitation.');
  }
}
async function removeTeamMember(memberId) {
  if (API.getRole() !== 'concierge') { showToast('Seul l\'administrateur peut retirer des membres'); return; }
  const ok = await customConfirm(t('team.remove_confirm') || 'Retirer ce membre de l\'equipe ?', t('btn.delete') || 'Retirer');
  if (!ok) return;
  await API.removeMember(memberId);
  showTeamModal(); // Refresh
}
async function changePassword() {
  closeAccountModal();
  showChangePasswordForm();
}

function showChangePasswordForm() {
  if (document.getElementById('changePwdOverlay')) return;
  const overlay = document.createElement('div');
  overlay.id = 'changePwdOverlay';
  overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.7);z-index:99999;display:flex;align-items:center;justify-content:center;padding:20px;';
  overlay.innerHTML = `
    <div style="max-width:400px;width:100%;background:#1a1a2e;border-radius:16px;padding:32px;border:1px solid rgba(255,255,255,0.06);">
      <div style="text-align:center;margin-bottom:24px;">
        <div style="width:60px;height:60px;background:linear-gradient(135deg,#e94560,#6c63ff);border-radius:16px;display:inline-flex;align-items:center;justify-content:center;font-size:28px;font-weight:800;color:#fff;">L</div>
        <h2 style="color:#fff;font-size:20px;margin:16px 0 8px;">&#128274; Changer de mot de passe</h2>
        <p style="color:#9ca3af;font-size:13px;margin:0;">Definissez votre nouveau mot de passe</p>
      </div>
      <div style="position:relative;margin-bottom:8px;">
        <input type="password" id="changePwd1" placeholder="${t('password.new')}" oninput="updateChangePwdStrength()" style="width:100%;padding:12px 44px 12px 16px;background:#0f0f1a;color:#fff;border:1px solid rgba(255,255,255,0.1);border-radius:10px;font-size:14px;box-sizing:border-box;font-family:Inter,sans-serif;">
        <button type="button" onclick="togglePwdVisibility('changePwd1', this)" aria-label="${t('password.show')}" style="position:absolute;right:8px;top:50%;transform:translateY(-50%);background:transparent;border:none;color:#9ca3af;font-size:16px;cursor:pointer;padding:6px;">&#128065;</button>
      </div>
      <div id="changePwdStrength" style="font-size:11px;color:#6b7280;line-height:1.5;margin-bottom:12px;">
        <div id="changePwdReq-len" style="display:flex;align-items:center;gap:4px;"><span class="pwdReq-icon">&#9675;</span> <span>8 caracteres minimum</span></div>
        <div id="changePwdReq-upper" style="display:flex;align-items:center;gap:4px;"><span class="pwdReq-icon">&#9675;</span> <span>Une majuscule</span></div>
        <div id="changePwdReq-lower" style="display:flex;align-items:center;gap:4px;"><span class="pwdReq-icon">&#9675;</span> <span>Une minuscule</span></div>
        <div id="changePwdReq-digit" style="display:flex;align-items:center;gap:4px;"><span class="pwdReq-icon">&#9675;</span> <span>Un chiffre</span></div>
        <div id="changePwdReq-special" style="display:flex;align-items:center;gap:4px;"><span class="pwdReq-icon">&#9675;</span> <span>Un caractere special (!@#$...)</span></div>
      </div>
      <div style="position:relative;margin-bottom:16px;">
        <input type="password" id="changePwd2" placeholder="${t('password.confirm')}" oninput="updateChangePwdStrength()" style="width:100%;padding:12px 44px 12px 16px;background:#0f0f1a;color:#fff;border:1px solid rgba(255,255,255,0.1);border-radius:10px;font-size:14px;box-sizing:border-box;font-family:Inter,sans-serif;">
        <button type="button" onclick="togglePwdVisibility('changePwd2', this)" aria-label="${t('password.show')}" style="position:absolute;right:8px;top:50%;transform:translateY(-50%);background:transparent;border:none;color:#9ca3af;font-size:16px;cursor:pointer;padding:6px;">&#128065;</button>
      </div>
      <div id="changePwdMsg" style="color:#e94560;font-size:12px;margin-bottom:12px;min-height:16px;"></div>
      <button id="submitChangePwdBtn" onclick="submitChangePassword()" disabled style="width:100%;padding:14px;background:linear-gradient(135deg,#e94560,#c73e54);color:#fff;border:none;border-radius:10px;font-size:14px;font-weight:600;cursor:not-allowed;opacity:0.5;transition:opacity 0.2s;">Mettre a jour</button>
      <button onclick="document.getElementById('changePwdOverlay').remove()" style="width:100%;padding:10px;background:transparent;color:#9ca3af;border:none;font-size:12px;cursor:pointer;margin-top:8px;">Annuler</button>
    </div>
  `;
  document.body.appendChild(overlay);
}

function updateChangePwdStrength() {
  const p = document.getElementById('changePwd1')?.value || '';
  const p2 = document.getElementById('changePwd2')?.value || '';
  const rules = { len: p.length >= 8, upper: /[A-Z]/.test(p), lower: /[a-z]/.test(p), digit: /[0-9]/.test(p), special: /[^A-Za-z0-9]/.test(p) };
  for (const key in rules) {
    const el = document.getElementById('changePwdReq-' + key);
    if (!el) continue;
    el.style.color = rules[key] ? '#34d399' : '#6b7280';
    const icon = el.querySelector('.pwdReq-icon');
    if (icon) icon.innerHTML = rules[key] ? '&#10003;' : '&#9675;';
  }
  const allOk = Object.values(rules).every(v => v) && p === p2 && p2.length > 0;
  const btn = document.getElementById('submitChangePwdBtn');
  if (btn) {
    btn.disabled = !allOk;
    btn.style.opacity = allOk ? '1' : '0.5';
    btn.style.cursor = allOk ? 'pointer' : 'not-allowed';
  }
}

async function submitChangePassword() {
  const p1 = document.getElementById('changePwd1').value;
  const p2 = document.getElementById('changePwd2').value;
  const msg = document.getElementById('changePwdMsg');
  msg.style.color = '#e94560';
  if (!p1 || p1.length < 8) { msg.textContent = '8 caracteres minimum'; return; }
  if (!/[A-Z]/.test(p1)) { msg.textContent = t('password.rule.upper'); return; }
  if (!/[a-z]/.test(p1)) { msg.textContent = t('password.rule.lower'); return; }
  if (!/[0-9]/.test(p1)) { msg.textContent = t('password.rule.digit'); return; }
  if (!/[^A-Za-z0-9]/.test(p1)) { msg.textContent = 'Au moins un caractere special requis (!@#$...)'; return; }
  if (p1 !== p2) { msg.textContent = t('password.mismatch'); return; }
  msg.textContent = '';
  try {
    const { error } = await sb.auth.updateUser({ password: p1 });
    if (error) throw error;
    document.getElementById('changePwdOverlay').remove();
    showToast(t('account.pwd_changed') || 'Mot de passe modifie !');
  } catch(e) {
    msg.textContent = 'Erreur: ' + (e.message || t('account.update_failed'));
  }
}
async function changeEmail() {
  const newEmail = await customPrompt(t('account.new_email') || 'Nouvel email :', '', {placeholder:'email@example.com'});
  if (!newEmail) return;
  const { error } = await sb.auth.updateUser({ email: newEmail });
  if (error) { showMsg((t('error') || 'Erreur') + ': ' + error.message); return; }
  showToast(t('account.email_sent') || 'Email de confirmation envoye a ' + newEmail);
}
async function deleteAccount() {
  closeAccountModal();
  const org = API.getOrg();
  const hasSubscription = org && org.stripe_subscription_id;
  const planName = API.getPlan();

  let html = '<div style="text-align:left;padding:8px 0;">';
  html += '<div style="font-size:14px;color:var(--accent);font-weight:700;margin-bottom:12px;">&#9888; Supprimer mon compte</div>';
  html += '<div style="font-size:13px;color:var(--text2);margin-bottom:12px;">Cette action est irreversible.</div>';
  html += '<div style="font-size:11px;color:var(--text3);padding:10px;background:var(--surface2);border-radius:8px;margin-bottom:12px;line-height:1.5;">&#128274; <b>Stockage des donnees</b><br>Vos donnees sont stockees sur <b>Supabase (Frankfurt, UE)</b> et chiffrees en transit (HTTPS/TLS). La suppression efface definitivement votre compte d\'authentification et toutes vos donnees personnelles.</div>';
  html += '<label style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:rgba(255,255,255,0.04);border-radius:8px;cursor:pointer;margin-bottom:8px;">';
  html += '<input type="checkbox" id="delCheckData" checked style="width:18px;height:18px;accent-color:var(--accent);">';
  html += '<div><div style="font-size:13px;color:var(--text);font-weight:600;">Supprimer toutes mes donnees</div><div style="font-size:11px;color:var(--text3);">Proprietes, plannings, prestataires, historique, messages</div></div>';
  html += '</label>';
  if (hasSubscription) {
    html += '<label style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:rgba(255,255,255,0.04);border-radius:8px;cursor:pointer;margin-bottom:8px;">';
    html += '<input type="checkbox" id="delCheckSub" checked style="width:18px;height:18px;accent-color:var(--accent);">';
    html += '<div><div style="font-size:13px;color:var(--text);font-weight:600;">Annuler mon abonnement ' + esc(planName) + '</div><div style="font-size:11px;color:var(--text3);">Vous ne serez plus facture</div></div>';
    html += '</label>';
  }
  html += '</div>';

  const ok = await customConfirm(html, 'Supprimer definitivement');
  if (!ok) return;

  const ok2 = await customConfirm(
    '<div style="text-align:center;"><div style="font-size:32px;margin-bottom:8px;">&#9888;</div><div style="font-size:14px;color:var(--text);">Derniere chance !<br>Cette action supprimera votre compte et toutes vos donnees.</div></div>',
    t('account.delete.confirm_text')
  );
  if (!ok2) return;

  try {
    const userId = (await sb.auth.getUser()).data.user.id;
    const deleteData = document.getElementById('delCheckData')?.checked !== false;
    const cancelSub = hasSubscription && document.getElementById('delCheckSub')?.checked !== false;

    showToast('Suppression en cours...');

    const session = (await sb.auth.getSession()).data.session;
    if (!session) throw new Error('Session expirée');
    const resp = await fetch(SUPABASE_URL + '/functions/v1/delete-account', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + session.access_token,
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({
        deleteData,
        cancelSubscription: cancelSub,
        stripeSubscriptionId: org?.stripe_subscription_id || null,
      }),
    });

    if (!resp.ok) throw new Error('Echec de la suppression');

    await sb.auth.signOut();
    localStorage.clear();
    // Show delete animation
    showDeleteAnimation();
  } catch (e) {
    showMsg((t('error') || 'Erreur') + ': ' + e.message);
  }
}
function showDeleteAnimation() {
  // Create fullscreen overlay
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:#0f0f1a;z-index:999999;display:flex;flex-direction:column;align-items:center;justify-content:center;';
  overlay.innerHTML = `
    <div style="position:relative;width:300px;height:200px;">
      <div id="delLogo" style="position:absolute;left:50%;top:40%;transform:translate(-50%,-50%);width:80px;height:80px;background:linear-gradient(135deg,#e94560,#6c63ff);border-radius:20px;display:flex;align-items:center;justify-content:center;font-size:40px;font-weight:900;color:#fff;transition:all 1.5s cubic-bezier(0.25,0.46,0.45,0.94);">L</div>
      <div id="delBroom" style="position:absolute;left:-60px;top:35%;font-size:48px;transform:translateY(-50%) rotate(-20deg);transition:all 1.5s cubic-bezier(0.25,0.46,0.45,0.94);">🧹</div>
      <div id="delTrash" style="position:absolute;right:20px;bottom:0;font-size:56px;transition:transform 0.3s ease;">🗑️</div>
    </div>
    <div id="delText" style="color:#e94560;font-size:16px;font-weight:700;margin-top:24px;opacity:0;transition:opacity 0.5s ease;">Compte supprime</div>
    <div id="delSubtext" style="color:rgba(255,255,255,0.4);font-size:13px;margin-top:8px;opacity:0;transition:opacity 0.5s ease;">Au revoir et merci !</div>
  `;
  document.body.appendChild(overlay);

  // Animation sequence
  setTimeout(() => {
    // Broom pushes logo to the right
    const broom = document.getElementById('delBroom');
    const logo = document.getElementById('delLogo');
    if (broom) { broom.style.left = '65%'; broom.style.transform = 'translateY(-50%) rotate(20deg)'; }
    if (logo) { logo.style.left = '82%'; logo.style.top = '70%'; logo.style.transform = 'translate(-50%,-50%) scale(0.5) rotate(45deg)'; logo.style.opacity = '0.3'; }
  }, 300);

  // Trash wobble when logo arrives
  setTimeout(() => {
    const trash = document.getElementById('delTrash');
    if (trash) { trash.style.transform = 'scale(1.2)'; setTimeout(() => { if(trash) trash.style.transform = 'scale(1)'; }, 200); }
  }, 1500);

  // Logo disappears into trash
  setTimeout(() => {
    const logo = document.getElementById('delLogo');
    if (logo) { logo.style.opacity = '0'; logo.style.transform = 'translate(-50%,-50%) scale(0) rotate(90deg)'; }
  }, 1700);

  // Show text
  setTimeout(() => {
    const t1 = document.getElementById('delText');
    const t2 = document.getElementById('delSubtext');
    if (t1) t1.style.opacity = '1';
    if (t2) t2.style.opacity = '1';
  }, 2200);

  // Redirect
  setTimeout(() => location.reload(), 4000);
}

// Exports
window.showAccountModal = showAccountModal;
window.closeAccountModal = closeAccountModal;
window.closeProfileModal = closeProfileModal;
window.showProfileModal = showProfileModal;
window.closePersonalProfileModal = closePersonalProfileModal;
window.showPersonalProfileModal = showPersonalProfileModal;
window.closeBillingProfileModal = closeBillingProfileModal;
window.showBillingProfileModal = showBillingProfileModal;
window.closeTeamModal = closeTeamModal;
window.showTeamModal = showTeamModal;
window.removeTeamMember = removeTeamMember;
window.inviteTeamMember = inviteTeamMember;
window.inviteTenantMember = inviteTenantMember;
window.submitInvite = submitInvite;
window.toggleInviteTenantFields = toggleInviteTenantFields;
window.changePassword = changePassword;
window.showChangePasswordForm = showChangePasswordForm;
window.submitChangePassword = submitChangePassword;
window.updateChangePwdStrength = updateChangePwdStrength;
window.changeEmail = changeEmail;
window.deleteAccount = deleteAccount;
window.showDeleteAnimation = showDeleteAnimation;
window.changeRole = changeRole;
window.doChangeRole = doChangeRole;
window.showRoleChangeModal = showRoleChangeModal;
window.showRoleTransition = showRoleTransition;
window.isProfileOnVacation = isProfileOnVacation;
window.openOverlayPopup = openOverlayPopup;
window.closeOverlayPopup = closeOverlayPopup;
window.showSaveBtn = showSaveBtn;
window.hideSaveBtn = hideSaveBtn;
