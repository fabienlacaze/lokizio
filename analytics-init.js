// Analytics initialization — Microsoft Clarity (heatmaps + session replays)
// and PostHog (funnels + retention). Both are GDPR-friendly and load only
// when explicit IDs are present in localStorage OR via window globals.
//
// To activate:
//   1. Create a Clarity project at https://clarity.microsoft.com
//      → copy the project ID (10-char alnum)
//   2. Create a PostHog project at https://eu.posthog.com (free tier 1M events/month)
//      → copy the project API key (starts with phc_...)
//   3. Set them in DevTools console:
//        localStorage.setItem('lokizio_clarity_id', 'YOUR_CLARITY_ID');
//        localStorage.setItem('lokizio_posthog_key', 'phc_YOUR_KEY');
//      OR put them in supabase_config.js as window.LOKIZIO_CLARITY_ID etc.
//   4. Reload — analytics loads next page view.

(function () {
  const CLARITY_ID = (window && window.LOKIZIO_CLARITY_ID) || (typeof localStorage !== 'undefined' && localStorage.getItem('lokizio_clarity_id'));
  const POSTHOG_KEY = (window && window.LOKIZIO_POSTHOG_KEY) || (typeof localStorage !== 'undefined' && localStorage.getItem('lokizio_posthog_key'));

  // RGPD: only load analytics for users who haven't opted out
  const optOut = typeof localStorage !== 'undefined' && localStorage.getItem('lokizio_analytics_opt_out') === '1';
  if (optOut) {
    console.info('[analytics] User opted out — skipped');
    return;
  }

  // ── Microsoft Clarity ──
  if (CLARITY_ID && /^[a-z0-9]{8,20}$/i.test(CLARITY_ID)) {
    (function (c, l, a, r, i, t, y) {
      c[a] = c[a] || function () { (c[a].q = c[a].q || []).push(arguments); };
      t = l.createElement(r); t.async = 1; t.src = "https://www.clarity.ms/tag/" + i;
      y = l.getElementsByTagName(r)[0]; y.parentNode.insertBefore(t, y);
    })(window, document, "clarity", "script", CLARITY_ID);
    console.info('[analytics] Clarity loaded:', CLARITY_ID);
  }

  // ── PostHog ──
  if (POSTHOG_KEY && /^phc_[a-zA-Z0-9]{20,80}$/.test(POSTHOG_KEY)) {
    (function () {
      const ph = document.createElement('script');
      ph.async = true;
      ph.src = 'https://eu.posthog.com/static/array.js';
      ph.onload = function () {
        if (window.posthog) {
          window.posthog.init(POSTHOG_KEY, {
            api_host: 'https://eu.posthog.com',
            // Respect Do Not Track
            respect_dnt: true,
            // Don't capture inputs (RGPD friendly default — text inputs masked)
            mask_all_text: false,
            mask_all_element_attributes: false,
            // Sanitize sensitive paths
            sanitize_properties: function (properties) {
              if (properties && properties.$current_url) {
                properties.$current_url = properties.$current_url
                  .replace(/access_token=[^&]+/g, 'access_token=REDACTED')
                  .replace(/refresh_token=[^&]+/g, 'refresh_token=REDACTED');
              }
              return properties;
            },
            // Identify users by stable Lokizio ID when possible
            loaded: async function () {
              try {
                if (typeof sb !== 'undefined') {
                  const { data: { user } } = await sb.auth.getUser();
                  if (user && window.posthog && window.posthog.identify) {
                    window.posthog.identify(user.id, {
                      app_version: window.APP_VERSION,
                    });
                  }
                }
              } catch (_) { /* best-effort */ }
            },
          });
          console.info('[analytics] PostHog loaded');
        }
      };
      ph.onerror = function () { console.warn('[analytics] PostHog script failed to load'); };
      document.head.appendChild(ph);
    })();
  }

  // ── Public API for opt-out + custom events ──
  window.analyticsOptOut = function () {
    localStorage.setItem('lokizio_analytics_opt_out', '1');
    if (window.posthog && window.posthog.opt_out_capturing) window.posthog.opt_out_capturing();
    if (window.clarity) try { window.clarity('stop'); } catch (_) {}
    if (typeof showToast === 'function') showToast('Analytics desactives. Pour reactiver: localStorage.removeItem(\'lokizio_analytics_opt_out\')');
  };
  window.trackEvent = function (event, props) {
    try {
      if (window.posthog && window.posthog.capture) {
        window.posthog.capture(event, props || {});
      }
      if (window.clarity) {
        window.clarity('event', event);
      }
    } catch (_) { /* best-effort */ }
  };
})();
