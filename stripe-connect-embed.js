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

  // Get or create a StripeConnect instance bound to a fresh client_secret.
  // Returns null if anything fails (toast displayed).
  async function _ensureConnectInstance(body) {
    try {
      await loadStripeConnectJs();
      const { client_secret, account_id, charges_enabled, details_submitted } =
        await callEdgeFunction('stripe-connect-onboard', body || {});
      if (!window.StripeConnect) throw new Error('StripeConnect SDK manquant');
      _stripeConnectInstance = window.StripeConnect.init({
        publishableKey: STRIPE_PK,
        fetchClientSecret: () => Promise.resolve(client_secret),
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
        accountId: account_id,
        chargesEnabled: charges_enabled,
        detailsSubmitted: details_submitted,
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

  window.showStripeConnectOnboarding = showStripeConnectOnboarding;
  window.showStripeConnectDashboard = showStripeConnectDashboard;
  window.renderStripeConnectProfile = renderStripeConnectProfile;
  // Expose a hook so the onboarding completion auto-refreshes the profile badge
  window._stripeOnboardingDone = function() {
    if (document.getElementById('stripeConnectProfileSection')) renderStripeConnectProfile();
  };
})();
