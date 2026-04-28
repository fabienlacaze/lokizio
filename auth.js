// Auth module — login, register, recovery, logout
// Depends on: sb, t, showMsg, showToast, esc, checkEmailBeforeRegister (if any)
// Exposes: authMode, switchAuthTab, authSubmit, checkAuth, authLogin,
//   authRegister, forgotPassword, authLogout

let authMode = 'login';
function switchAuthTab(mode) {
  authMode = mode;
  const errEl = document.getElementById('authError');
  errEl.textContent = ''; errEl.style.color = '#e94560';
  const tabLogin = document.getElementById('tabLogin');
  const tabRegister = document.getElementById('tabRegister');
  const confirmWrap = document.getElementById('authConfirmWrap');
  const submitBtn = document.getElementById('authSubmitBtn');
  const rgpdCheck = document.getElementById('authRgpdCheck');
  if (mode === 'login') {
    tabLogin.style.background = 'linear-gradient(135deg,#e94560,#c73e54)'; tabLogin.style.color = '#fff';
    tabRegister.style.background = 'var(--surface2)'; tabRegister.style.color = 'var(--text3)';
    confirmWrap.style.display = 'none';
    if (rgpdCheck) rgpdCheck.style.display = 'none';
    submitBtn.textContent = t('auth.login.btn');
  } else {
    tabRegister.style.background = 'linear-gradient(135deg,#6c63ff,#5a52d5)'; tabRegister.style.color = '#fff';
    tabLogin.style.background = 'var(--surface2)'; tabLogin.style.color = 'var(--text3)';
    confirmWrap.style.display = 'block';
    if (rgpdCheck) rgpdCheck.style.display = 'block';
    submitBtn.textContent = t('auth.register.btn');
  }
}
async function authSubmit() {
  if (authMode === 'login') { await authLogin(); return; }
  // Register: enforce RGPD consent
  const rgpd = document.getElementById('authRgpdAccept');
  if (!rgpd || !rgpd.checked) {
    const errEl = document.getElementById('authError');
    if (errEl) { errEl.textContent = 'Veuillez accepter les CGU et la politique de confidentialite pour creer un compte.'; errEl.style.color = '#e94560'; }
    return;
  }
  await authRegister();
}
async function checkAuth() {
  try {
    // If user arrived via password recovery link, show recovery form immediately
    if (window.__isPasswordRecovery) {
      document.getElementById('authScreen').style.display = 'none';
      document.getElementById('appMain').style.display = 'none';
      if (typeof showPasswordRecoveryForm === 'function') showPasswordRecoveryForm();
      return;
    }
    const { data: { user } } = await sb.auth.getUser();
    if (user) {
      document.getElementById('authScreen').style.display = 'none';
      // Don't show appMain yet — init() will decide (onboarding or app)
      const emailEl = document.getElementById('userEmail');
      if (emailEl) emailEl.textContent = user.email;
      init();
    } else {
      document.getElementById('authScreen').style.display = 'flex';
      document.getElementById('appMain').style.display = 'none';
      // Load remembered credentials
      const savedEmail = localStorage.getItem('mm_remember_email');
      if (savedEmail) {
        const emailInput = document.getElementById('authEmail');
        if (emailInput) emailInput.value = savedEmail;
      }
      // Password not stored for security reasons — Supabase session handles persistence
    }
  } catch (e) {
    console.error('Auth check error:', e);
    document.getElementById('authScreen').style.display = 'flex';
    document.getElementById('appMain').style.display = 'none';
  }
}
async function authLogin() {
  const email = document.getElementById('authEmail').value.trim();
  const pass = document.getElementById('authPass').value;
  const remember = document.getElementById('rememberMe')?.checked;
  const errEl = document.getElementById('authError');
  errEl.textContent = ''; errEl.style.color = '#e94560';
  if (!email || !pass) { errEl.textContent = t('auth.fill.all'); return; }
  try {
    const { error } = await sb.auth.signInWithPassword({ email, password: pass });
    if (error) { errEl.textContent = error.message === 'Invalid login credentials' ? t('auth.login.invalid') : error.message; return; }
    if (remember) { localStorage.setItem('mm_remember_email', email); }
    else { localStorage.removeItem('mm_remember_email'); }
    checkAuth();
  } catch (e) {
    console.error('Login error:', e);
    errEl.textContent = t('auth.network_error');
  }
}
async function authRegister() {
  const email = document.getElementById('authEmail').value.trim();
  const pass = document.getElementById('authPass').value;
  const passConfirm = document.getElementById('authPassConfirm').value;
  const errEl = document.getElementById('authError');
  const submitBtn = document.getElementById('authSubmitBtn');
  errEl.textContent = ''; errEl.style.color = '#e94560';
  if (!email || !pass) { errEl.textContent = t('auth.fill.all'); return; }
  if (pass.length < 8) { errEl.textContent = '8 caracteres minimum'; return; }
  if (!/[A-Z]/.test(pass)) { errEl.textContent = t('password.rule.upper'); return; }
  if (!/[a-z]/.test(pass)) { errEl.textContent = t('password.rule.lower'); return; }
  if (!/[0-9]/.test(pass)) { errEl.textContent = t('password.rule.digit'); return; }
  if (!/[^A-Za-z0-9]/.test(pass)) { errEl.textContent = 'Au moins un caractere special requis (!@#$...)'; return; }
  if (pass !== passConfirm) { errEl.textContent = t('auth.pass.mismatch'); return; }
  try {
    submitBtn.disabled = true; submitBtn.textContent = t('auth.register.loading');
    const { data, error } = await sb.auth.signUp({ email, password: pass });
    submitBtn.disabled = false; submitBtn.textContent = t('auth.register.btn');
    if (error) {
      // Handle rate limit / too many requests
      const match = error.message.match(/after (\d+) second/);
      const isRateLimit = match || error.message.includes('rate limit') || error.message.includes('Too Many') || error.status === 429;
      if (isRateLimit) {
        errEl.style.color = '#f59e0b';
        errEl.textContent = 'Trop de tentatives. Verifiez votre boite mail — un email de confirmation a peut-etre deja ete envoye.';
        submitBtn.disabled = false;
        submitBtn.textContent = t('auth.register.btn');
        return;
      } else if (error.message && (error.message.includes('504') || error.message.includes('timeout') || error.message.includes('Gateway'))) {
        errEl.style.color = '#f59e0b';
        errEl.textContent = 'Timeout serveur. Essayez de vous connecter directement ou re-essayez dans quelques minutes.';
        submitBtn.disabled = false;
        submitBtn.textContent = t('auth.register.btn');
      } else {
        errEl.textContent = error.message;
      }
      return;
    }
    if (data.user && data.user.identities && data.user.identities.length === 0) {
      errEl.textContent = t('auth.email.taken'); return;
    }
    // Log RGPD consent (art. 7 — proof of consent)
    try {
      if (data.user?.id) {
        await sb.from('rgpd_consents').insert({
          user_id: data.user.id,
          email: email,
          consent_type: 'cgu_cgv_privacy_inscription',
          cgu_version: '2026-04-19',
          privacy_version: '2.0',
          user_agent: navigator.userAgent.slice(0, 500),
        });
      }
    } catch (e) { console.warn('RGPD consent log failed:', e); }
    // Always show confirmation popup after successful signup
    errEl.textContent = '';
    try { await sb.auth.signOut(); } catch(e) { /* best-effort logout, ignore */ }
    // Show inline confirmation in auth screen (modal is inside appMain which is hidden)
    const authBox = document.querySelector('#authScreen > div');
    if (authBox) {
      authBox.innerHTML = '<div style="text-align:center;padding:30px 20px;">'
        + '<div style="font-size:48px;margin-bottom:12px;">&#9993;</div>'
        + '<div style="font-size:18px;font-weight:700;color:#34d399;margin-bottom:8px;">Compte cree !</div>'
        + '<div style="font-size:14px;color:var(--text2);margin-bottom:12px;">Un email de confirmation a ete envoye a</div>'
        + '<div style="font-size:15px;font-weight:600;color:var(--text);margin-bottom:16px;">' + esc(email) + '</div>'
        + '<div style="font-size:13px;color:var(--text3);line-height:1.6;">Cliquez sur le lien dans l\'email<br>puis revenez vous connecter.<br><br><span style="font-size:11px;">Si vous ne trouvez pas l\'email, verifiez vos spams.</span></div>'
        + '<button onclick="location.reload()" style="margin-top:20px;padding:12px 32px;background:linear-gradient(135deg,#e94560,#c73e54);color:#fff;border:none;font-size:14px;font-weight:600;cursor:pointer;border-radius:8px;">Retour a la connexion</button>'
        + '</div>';
    }
    return;
  } catch (e) {
    submitBtn.disabled = false; submitBtn.textContent = t('auth.register.btn');
    console.error('Register error:', e);
    // Timeout or network error — account may have been created anyway
    if (e.message && (e.message.includes('504') || e.message.includes('timeout') || e.message.includes('Failed to fetch') || e.message.includes('Gateway'))) {
      errEl.style.color = '#f59e0b';
      errEl.textContent = 'Timeout serveur. Essayez de vous connecter directement ou re-essayez dans quelques minutes.';
    } else {
      errEl.textContent = 'Erreur: ' + e.message;
    }
  }
}
async function forgotPassword() {
  const email = document.getElementById('authEmail').value.trim();
  const errEl = document.getElementById('authError');
  if (!email) { errEl.textContent = t('auth.fill.all'); return; }
  errEl.textContent = '';
  try {
    const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + window.location.pathname });
    if (error) { errEl.textContent = error.message; return; }
    errEl.style.color = '#34d399';
    errEl.textContent = t('auth.reset.sent') || 'Email de reinitialisation envoye ! Verifiez votre boite mail.';
  } catch (e) {
    console.error('Reset password error:', e);
    errEl.textContent = t('auth.network_error');
  }
}
async function authLogout() {
  // Stop background timers that pollute the next session if not cleared
  // (marketplace auto-refresh, connection badge poll, etc.)
  try {
    if (typeof _mkRefreshInterval !== 'undefined' && _mkRefreshInterval) { clearInterval(_mkRefreshInterval); _mkRefreshInterval = null; }
  } catch (_) { /* timer not declared in this context */ }
  try {
    if (typeof _connectionBadgeInterval !== 'undefined' && _connectionBadgeInterval) { clearInterval(_connectionBadgeInterval); _connectionBadgeInterval = null; }
  } catch (_) { /* timer not declared in this context */ }
  try {
    if (typeof _autoRefreshInterval !== 'undefined' && _autoRefreshInterval) { clearInterval(_autoRefreshInterval); _autoRefreshInterval = null; }
  } catch (_) { /* timer not declared in this context */ }

  await sb.auth.signOut();
  // Keep persistent settings, clear session data
  const keep = ['mm_onboarded', 'mm_lang', 'mm_theme', 'mm_remember_email'];
  const saved = {};
  keep.forEach(k => { const v = localStorage.getItem(k); if (v !== null) saved[k] = v; });
  localStorage.clear();
  Object.entries(saved).forEach(([k, v]) => localStorage.setItem(k, v));
  checkAuth();
}

window.authMode = authMode;
window.switchAuthTab = switchAuthTab;
window.authSubmit = authSubmit;
window.checkAuth = checkAuth;
window.authLogin = authLogin;
window.authRegister = authRegister;
window.forgotPassword = forgotPassword;
window.authLogout = authLogout;
