// Sentry init for Lokizio
// The Sentry loader script (CDN) calls window.sentryOnLoad before initializing,
// so we expose our config there. See: https://docs.sentry.io/platforms/javascript/install/loader/

window.sentryOnLoad = function () {
  Sentry.init({
    environment: (location.hostname === 'localhost' || location.hostname === '127.0.0.1') ? 'development' : 'production',
    release: 'lokizio@' + (window.APP_VERSION || 'unknown'),
    sendDefaultPii: false,
    tracesSampleRate: 0,
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1,
    beforeSend: function (event) {
      try {
        var msg = (event.message || '').toLowerCase();
        if (msg.indexOf('beforeinstallpromptevent') !== -1) return null;
        if (msg.indexOf('non-error promise rejection captured') !== -1) return null;
        if (event.request && event.request.url) {
          event.request.url = String(event.request.url).split('?')[0];
        }
        if (event.breadcrumbs) {
          event.breadcrumbs.forEach(function (b) {
            if (b.data && b.data.url) b.data.url = String(b.data.url).split('?')[0];
            if (b.message) {
              b.message = String(b.message).replace(/(password|token|apikey|api_key|secret)["']?\s*[:=]\s*["']?[^"',\s]+/gi, '$1=***');
            }
          });
        }
      } catch (_) { /* never break sending */ }
      return event;
    },
  });
};

// Attach user context once Supabase is ready (anonymous UUID only, no PII)
(function attachUser() {
  function tryAttach() {
    if (!window.sb || !window.sb.auth || typeof Sentry === 'undefined' || !Sentry.setUser) {
      return setTimeout(tryAttach, 500);
    }
    window.sb.auth.getUser().then(function (res) {
      var user = res && res.data && res.data.user;
      if (user) Sentry.setUser({ id: user.id });
    }).catch(function () { /* anonymous, that's fine */ });
  }
  tryAttach();
})();
