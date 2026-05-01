// Sentry init for Lokizio
// Loaded AFTER the Sentry CDN loader script — uses the `Sentry` global.
// Configures filters (RGPD, dev noise) and attaches user context once Supabase is ready.

(function () {
  if (typeof Sentry === 'undefined' || !Sentry.onLoad) return;

  Sentry.onLoad(function () {
    Sentry.init({
      // Tag environment so we can filter prod vs local in Sentry UI
      environment: location.hostname === 'localhost' || location.hostname === '127.0.0.1' ? 'development' : 'production',

      // Sample 100% of errors, 10% of sessions for replay, 100% of sessions WITH errors
      tracesSampleRate: 0,           // no perf tracing (saves quota)
      replaysSessionSampleRate: 0.1, // record 10% of sessions
      replaysOnErrorSampleRate: 1,   // always record sessions where an error happens

      // Strip sensitive data from events before sending
      beforeSend: function (event, hint) {
        try {
          // Drop noise we know about
          var msg = (event.message || '').toLowerCase();
          if (msg.includes('beforeinstallpromptevent')) return null; // PWA install banner noise
          if (msg.includes('non-error promise rejection captured')) return null;

          // Strip query strings that may contain tokens (referral, recovery, ?session=...)
          if (event.request && event.request.url) {
            event.request.url = event.request.url.split('?')[0];
          }

          // Scrub potentially sensitive values from breadcrumbs
          if (event.breadcrumbs) {
            event.breadcrumbs.forEach(function (b) {
              if (b.data && b.data.url) b.data.url = String(b.data.url).split('?')[0];
              if (b.message) {
                b.message = b.message.replace(/(password|token|apikey|api_key|secret)["']?\s*[:=]\s*["']?[^"',\s]+/gi, '$1=***');
              }
            });
          }
        } catch (_) { /* never break sending */ }
        return event;
      },

      // PII: Supabase JWTs travel via Authorization headers — drop them
      sendDefaultPii: false,

      // Tag the release with the app version so we can filter by deploy
      release: 'lokizio@' + (window.APP_VERSION || 'unknown'),
    });
  });

  // Once Supabase is ready, attach the current user as Sentry context
  // (so we know who hit the error — but only their UUID, no email)
  function attachUserContext() {
    if (!window.sb || !window.sb.auth) { setTimeout(attachUserContext, 500); return; }
    window.sb.auth.getUser().then(function (res) {
      var user = res && res.data && res.data.user;
      if (user && Sentry && Sentry.setUser) {
        Sentry.setUser({ id: user.id });
      }
    }).catch(function () { /* anonymous, that's fine */ });
  }
  attachUserContext();
})();
