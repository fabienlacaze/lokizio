// Stripe Connect Embedded Components — browser glue.
//
// Exposes:
//   window.showStripeConnectOnboarding()   → opens a Lokizio modal with the
//                                              Stripe onboarding form inline.
//   window.showStripeConnectDashboard()    → opens the Stripe Express dashboard
//                                              (balance, payouts) inline.
//
// Both call the stripe-connect-onboard / stripe-connect-link Edge Functions to
// get an Account Session client_secret, then mount the Stripe Connect components
// inside a Lokizio modal. The user never leaves Lokizio's domain.
//
// Docs: https://docs.stripe.com/connect/embedded-components/quickstart

(function () {
  const STRIPE_CONNECT_JS = 'https://connect-js.stripe.com/v1.0/connect.js';
  let _stripeConnectInstance = null;

  async function loadStripeConnectJs() {
    if (window.StripeConnect) return;
    await new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = STRIPE_CONNECT_JS;
      s.async = true;
      s.onload = resolve;
      s.onerror = () => reject(new Error('Echec chargement Stripe Connect SDK'));
      document.head.appendChild(s);
    });
  }

  async function callEdgeFunction(name, body) {
    const session = (await sb.auth.getSession()).data.session;
    if (!session) throw new Error('Non connecte');
    const r = await fetch(SUPABASE_URL + '/functions/v1/' + name, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + session.access_token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body || {}),
    });
    if (!r.ok) {
      const err = await r.text();
      throw new Error('HTTP ' + r.status + ': ' + err.slice(0, 200));
    }
    return r.json();
  }

  // Get or create a StripeConnect instance.
  //
  // IMPORTANT: fetchClientSecret() is invoked by the Stripe SDK to refresh the
  // session token (default lifetime 5 min). It MUST return a freshly minted
  // client_secret each time — otherwise the embedded form silently breaks
  // after 5 min (audit finding wmlemqp4r serious #3).
  //
  // Strategy: on first call we use the secret from the onboard EF; subsequent
  // calls (refresh) hit stripe-connect-link which generates a new account_session
  // for the existing account.
  async function _ensureConnectInstance(body) {
    try {
      await loadStripeConnectJs();
      const initial = await callEdgeFunction('stripe-connect-onboard', body || {});
      if (!window.StripeConnect) throw new Error('StripeConnect SDK manquant');
      let secret = initial.client_secret;
      _stripeConnectInstance = window.StripeConnect.init({
        publishableKey: STRIPE_PK,
        fetchClientSecret: async () => {
          // First call: return the secret we just minted.
          if (secret) {
            const s = secret;
            secret = null; // single-use; next call will hit stripe-connect-link
            return s;
          }
          // Subsequent calls (refresh after 5 min): mint a new one.
          try {
            const refreshed = await callEdgeFunction('stripe-connect-link', {});
            return refreshed.client_secret;
          } catch (e) {
            console.error('stripe-connect-link refresh failed:', e);
            throw e;
          }
        },
        appearance: {
          overlays: 'dialog',
          variables: {
            colorPrimary: '#e94560',
            colorBackground: '#1a1a2e',
            colorText: '#f0f0f5',
            colorDanger: '#e94560',
            fontFamily: 'Inter, system-ui, sans-serif',
            borderRadius: '8px',
          },
        },
      });
      return {
        instance: _stripeConnectInstance,
        accountId: initial.account_id,
        chargesEnabled: initial.charges_enabled,
        detailsSubmitted: initial.details_submitted,
      };
    } catch (e) {
      showToast('Erreur Stripe Connect: ' + (e.message || e));
      console.error('stripe-connect init:', e);
      return null;
    }
  }

  function _openConnectModal(title, mountFn) {
    let html = '<div style="padding:4px;max-width:600px;width:90vw;max-height:80vh;">';
    html += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">';
    html += '<div style="font-size:16px;font-weight:700;color:var(--text);">' + title + '</div>';
    html += '<button class="btn btnSmall btnOutline" style="padding:6px 12px;font-size:11px;" onclick="closeMsg()">Fermer</button>';
    html += '</div>';
    html += '<div id="stripeConnectContainer" style="min-height:400px;background:var(--surface2);border-radius:8px;padding:10px;"></div>';
    html += '<div style="font-size:10px;color:var(--text3);margin-top:10px;text-align:center;">Formulaire securise affiche par Stripe directement dans Lokizio. Vos donnees ne transitent pas par nos serveurs.</div>';
    html += '</div>';
    showMsg(html, true);

    // Wait for the DOM to be ready, then mount
    setTimeout(() => {
      const container = document.getElementById('stripeConnectContainer');
      if (!container) return;
      try {
        mountFn(container);
      } catch (e) {
        container.innerHTML = '<div style="color:var(--danger);padding:14px;">Erreur affichage: ' + (e.message || e) + '</div>';
      }
    }, 100);
  }

  async function showStripeConnectOnboarding(country) {
    showToast('Chargement Stripe Connect...');
    const state = await _ensureConnectInstance({ country: country || 'FR' });
    if (!state) return;

    _openConnectModal('Activer les paiements en ligne', (container) => {
      const onboardingComponent = state.instance.create('account-onboarding');
      onboardingComponent.setOnExit(async () => {
        // Stripe calls this when the user is done (whether they completed or
        // bounced). Sync the status server-side and close the modal.
        try {
          await callEdgeFunction('stripe-connect-status', {});
        } catch (_) { /* best-effort */ }
        closeMsg();
        showToast('Etat des paiements mis a jour');
        // If a caller registered a callback, invoke it
        if (typeof window._stripeOnboardingDone === 'function') {
          try { window._stripeOnboardingDone(); } catch (_) {}
        }
      });
      container.appendChild(onboardingComponent);
    });
  }

  async function showStripeConnectDashboard() {
    showToast('Chargement de votre tableau de bord paiements...');
    const state = await _ensureConnectInstance({});
    if (!state) return;
    if (!state.detailsSubmitted) {
      // User hasn't finished onboarding — redirect to onboarding instead
      showToast('Terminez d\'abord la configuration des paiements');
      return showStripeConnectOnboarding();
    }
    _openConnectModal('Mes paiements en ligne', (container) => {
      // Stack the dashboard components vertically
      const banner = state.instance.create('notification-banner');
      container.appendChild(banner);
      const payments = state.instance.create('payments');
      container.appendChild(payments);
      const payouts = state.instance.create('payouts');
      container.appendChild(payouts);
    });
  }

  // Render the Stripe Connect status block in the personal profile overlay.
  // Reads the current member's stripe_charges_enabled / details_submitted
  // and shows the appropriate badge + action button.
  async function renderStripeConnectProfile() {
    const container = document.getElementById('stripeConnectProfileSection');
    if (!container) return;
    try {
      const { data: { user } } = await sb.auth.getUser();
      if (!user) {
        container.innerHTML = '<div style="font-size:11px;color:var(--text3);">Non connecte</div>';
        return;
      }
      const { data: member } = await sb
        .from('members')
        .select('stripe_account_id, stripe_charges_enabled, stripe_details_submitted, stripe_payouts_enabled, stripe_account_country')
        .eq('user_id', user.id)
        .eq('accepted', true)
        .not('stripe_account_id', 'is', null)
        .limit(1)
        .maybeSingle();

      let html = '';
      if (!member || !member.stripe_account_id) {
        // Not started
        html += '<div style="font-size:11px;color:var(--text3);margin-bottom:10px;line-height:1.5;">Active les paiements par carte sur tes factures. Stripe gere securite et identite. Lokizio prend 3% de commission.</div>';
        html += '<button class="btn btnPrimary" style="width:100%;padding:12px;font-size:13px;" onclick="showStripeConnectOnboarding()">&#128190; Activer les paiements</button>';
      } else if (member.stripe_charges_enabled && member.stripe_payouts_enabled) {
        // Fully active
        html += '<div style="display:flex;align-items:center;gap:8px;padding:10px 12px;background:rgba(52,211,153,0.10);border:1px solid rgba(52,211,153,0.30);border-radius:8px;margin-bottom:10px;">';
        html += '<span style="font-size:18px;">&#9989;</span>';
        html += '<div style="flex:1;"><div style="font-size:12px;font-weight:700;color:#34d399;">Paiements en ligne actifs</div>';
        html += '<div style="font-size:10px;color:var(--text3);margin-top:2px;">Tu peux recevoir des paiements sur tes factures. Pays: ' + (member.stripe_account_country || 'FR') + '</div></div>';
        html += '</div>';
        html += '<button class="btn btnOutline" style="width:100%;padding:10px;font-size:12px;" onclick="showStripeConnectDashboard()">&#128202; Mon tableau de bord paiements</button>';
        html += '<button class="btn btnSmall btnOutline" style="width:100%;padding:8px;font-size:11px;margin-top:6px;" onclick="showStripeConnectOnboarding()">&#9881; Modifier mes infos</button>';
      } else if (member.stripe_details_submitted) {
        // Submitted but not yet enabled (Stripe is reviewing)
        html += '<div style="display:flex;align-items:center;gap:8px;padding:10px 12px;background:rgba(245,158,11,0.10);border:1px solid rgba(245,158,11,0.30);border-radius:8px;margin-bottom:10px;">';
        html += '<span style="font-size:18px;">&#9203;</span>';
        html += '<div style="flex:1;"><div style="font-size:12px;font-weight:700;color:#f59e0b;">Verification en cours par Stripe</div>';
        html += '<div style="font-size:10px;color:var(--text3);margin-top:2px;">Tes infos sont en cours de revue (quelques minutes a 24h)</div></div>';
        html += '</div>';
        html += '<button class="btn btnOutline" style="width:100%;padding:10px;font-size:12px;" onclick="showStripeConnectOnboarding()">Verifier le statut</button>';
      } else {
        // Started but not finished
        html += '<div style="display:flex;align-items:center;gap:8px;padding:10px 12px;background:rgba(108,99,255,0.10);border:1px solid rgba(108,99,255,0.30);border-radius:8px;margin-bottom:10px;">';
        html += '<span style="font-size:18px;">&#9881;</span>';
        html += '<div style="flex:1;"><div style="font-size:12px;font-weight:700;color:var(--accent2);">Configuration a terminer</div>';
        html += '<div style="font-size:10px;color:var(--text3);margin-top:2px;">Il manque encore quelques infos pour activer les paiements</div></div>';
        html += '</div>';
        html += '<button class="btn btnPrimary" style="width:100%;padding:12px;font-size:13px;" onclick="showStripeConnectOnboarding()">&#128190; Terminer la configuration</button>';
      }
      container.innerHTML = html;
    } catch (e) {
      console.error('renderStripeConnectProfile:', e);
      container.innerHTML = '<div style="font-size:11px;color:var(--text3);margin-bottom:10px;">Active les paiements par carte. Lokizio prend 3% de commission.</div><button class="btn btnPrimary" style="width:100%;padding:12px;font-size:13px;" onclick="showStripeConnectOnboarding()">&#128190; Activer les paiements</button>';
    }
  }

  // Dashboard banner: discreet CTA for provider/concierge who haven't activated
  // Stripe Connect yet, ONLY IF they have at least one sent invoice (= signal
  // of a real client) AND they're a role that benefits (provider/concierge/owner).
  // Banner can be dismissed; dismissal is stored in localStorage.
  async function renderStripeConnectDashboardBanner() {
    const container = document.getElementById('dashStripeBanner');
    if (!container) return;
    // Skip if dismissed
    if (localStorage.getItem('mm_stripe_banner_dismissed') === '1') {
      container.innerHTML = '';
      return;
    }
    try {
      const role = (typeof API !== 'undefined' && API.getRole) ? API.getRole() : '';
      if (!['provider', 'concierge', 'owner'].includes(role)) {
        container.innerHTML = '';
        return;
      }
      const { data: { user } } = await sb.auth.getUser();
      if (!user) { container.innerHTML = ''; return; }
      // Check if user already has an active Stripe Connect account
      const { data: m } = await sb.from('members')
        .select('stripe_account_id, stripe_charges_enabled')
        .eq('user_id', user.id)
        .eq('accepted', true)
        .limit(1)
        .maybeSingle();
      if (m && m.stripe_charges_enabled) {
        container.innerHTML = ''; // already active, nothing to do
        return;
      }
      // Check if user has at least one sent invoice (signals a real use case)
      const org = (typeof API !== 'undefined' && API.getOrg) ? API.getOrg() : null;
      if (!org) { container.innerHTML = ''; return; }
      const { count: invoiceCount } = await sb.from('invoices')
        .select('id', { count: 'exact', head: true })
        .eq('org_id', org.id)
        .eq('created_by', user.id)
        .eq('is_quote', false)
        .in('status', ['sent', 'paid']);
      if (!invoiceCount || invoiceCount === 0) {
        container.innerHTML = ''; // not enough engagement yet
        return;
      }
      // Render the banner
      const startedMsg = m && m.stripe_account_id
        ? 'Termine la configuration de tes paiements en ligne'
        : 'Active les paiements en ligne pour facturer plus vite';
      const ctaLabel = m && m.stripe_account_id ? 'Terminer' : 'Activer';
      let html = '<div style="display:flex;align-items:center;gap:10px;padding:10px 14px;background:linear-gradient(135deg,rgba(99,91,255,0.10),rgba(108,99,255,0.05));border:1px solid rgba(108,99,255,0.30);border-radius:10px;">';
      html += '<span style="font-size:20px;">&#128179;</span>';
      html += '<div style="flex:1;">';
      html += '<div style="font-size:13px;font-weight:700;color:var(--accent2);">' + startedMsg + '</div>';
      html += '<div style="font-size:10px;color:var(--text3);margin-top:2px;">Tes clients pourront payer par carte en 1 clic depuis leur email. 3% de commission Lokizio.</div>';
      html += '</div>';
      html += '<button class="btn btnSmall btnPrimary" style="padding:8px 14px;font-size:11px;font-weight:700;" onclick="showStripeConnectOnboarding()">' + ctaLabel + '</button>';
      html += '<button title="Masquer cette suggestion" style="background:transparent;border:none;color:var(--text3);font-size:18px;cursor:pointer;padding:0 4px;" onclick="dismissStripeConnectBanner()">&times;</button>';
      html += '</div>';
      container.innerHTML = html;
    } catch (e) {
      console.error('renderStripeConnectDashboardBanner:', e);
      container.innerHTML = '';
    }
  }

  function dismissStripeConnectBanner() {
    localStorage.setItem('mm_stripe_banner_dismissed', '1');
    const el = document.getElementById('dashStripeBanner');
    if (el) el.innerHTML = '';
  }

  window.showStripeConnectOnboarding = showStripeConnectOnboarding;
  window.showStripeConnectDashboard = showStripeConnectDashboard;
  window.renderStripeConnectProfile = renderStripeConnectProfile;
  window.renderStripeConnectDashboardBanner = renderStripeConnectDashboardBanner;
  window.dismissStripeConnectBanner = dismissStripeConnectBanner;
  // Expose a hook so the onboarding completion auto-refreshes the profile badge
  // AND the dashboard banner.
  window._stripeOnboardingDone = function() {
    if (document.getElementById('stripeConnectProfileSection')) renderStripeConnectProfile();
    if (document.getElementById('dashStripeBanner')) renderStripeConnectDashboardBanner();
  };
})();
