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

  window.showStripeConnectOnboarding = showStripeConnectOnboarding;
  window.showStripeConnectDashboard = showStripeConnectDashboard;
})();
