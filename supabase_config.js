/**
 * supabase_config.js - Supabase client initialization
 */
// Allow E2E tests to override Supabase endpoint via localStorage (set BEFORE page load).
// In production, both keys are hardcoded and the localStorage check is a no-op.
const SUPABASE_URL = (typeof localStorage !== 'undefined' && localStorage.getItem('__lokizio_test_url')) || 'https://mrvejwyvhuivmipfwlzz.supabase.co';
const SUPABASE_ANON_KEY = (typeof localStorage !== 'undefined' && localStorage.getItem('__lokizio_test_anon')) || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1ydmVqd3l2aHVpdm1pcGZ3bHp6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQyNjU0NTksImV4cCI6MjA4OTg0MTQ1OX0.1pi-KN5N6sNG6hIu6N0wDsR_g_G1TTf-uPecmWQ2ovU';

const STRIPE_PK = 'pk_test_51TEArcKQ0zQs7QqVpiF87akM3xuO2eV4dLLtoAd4iZTohfRvEECYdOG20BdMRp9WtKQZTFKKJhI01AMWmJoQeapx00gsk6COgi';
const STRIPE_PRICE_PRO = 'price_1TEBJA3uvj2cFz0kVaA3CLPb';      // 3.99€/mois
const STRIPE_PRICE_BUSINESS = 'price_1TEwgr3uvj2cFz0kQ29jzCbR';  // 19.99€/mois
const STRIPE_PRICE_ID = STRIPE_PRICE_PRO; // Default

var sb;
// Capture recovery flag BEFORE Supabase consumes the URL hash
window.__isPasswordRecovery = !!(window.location.hash && window.location.hash.includes('type=recovery'));
function initSupabase() {
  if (window.supabase && window.supabase.createClient) {
    // Use URL param ?session=X to isolate auth sessions per tab
    const sessionId = new URLSearchParams(window.location.search).get('session') || 'default';
    const storageKey = sessionId === 'default' ? undefined : 'sb-' + sessionId + '-auth-token';
    const opts = storageKey ? { auth: { storageKey } } : {};
    sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, opts);
    // v9.102 perf+IO: memoise sb.auth.getUser(). Chaque getUser() = un round-trip
    // /auth/v1/user (lent quand le Disk IO Budget Supabase s'epuise, car GoTrue
    // ecrit en base a chaque appel). L'app l'appelle des centaines de fois (dont
    // plusieurs au boot). Memoisation ~10s + dedup in-flight: 1 seul round-trip
    // auth par fenetre au lieu de N -> moins d'IO consommee + boot plus rapide.
    // Le 1er appel rafraichit le token (anti ecran-noir conserve). getUser(jwt)
    // explicite N'EST PAS memoise. Cache invalide sur SIGNED_IN/OUT/USER_UPDATED.
    try {
      const _origGetUser = sb.auth.getUser.bind(sb.auth);
      let _guCache = null, _guAt = 0, _guInflight = null;
      sb.auth.getUser = function(jwt) {
        if (jwt !== undefined) return _origGetUser(jwt);
        const now = Date.now();
        if (_guAt && (now - _guAt) < 10000 && _guCache) return Promise.resolve(_guCache);
        if (_guInflight) return _guInflight;
        _guInflight = _origGetUser().then(function(r) { _guCache = r; _guAt = Date.now(); return r; });
        _guInflight.finally(function () { _guInflight = null; });
        return _guInflight;
      };
      sb.auth.__invalidateUserCache = function () { _guCache = null; _guAt = 0; _guInflight = null; };
    } catch (_) { /* structure sb.auth inattendue -> on garde le getUser natif */ }
    // Also listen for PASSWORD_RECOVERY event (fires when Supabase detects recovery token)
    sb.auth.onAuthStateChange((event) => {
      // v9.102: invalider le cache getUser quand l'identite change. Pas sur
      // TOKEN_REFRESHED (eviterait une auto-invalidation en boucle, un getUser
      // qui refresh declenche TOKEN_REFRESHED).
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'USER_UPDATED') {
        if (sb.auth.__invalidateUserCache) sb.auth.__invalidateUserCache();
      }
      if (event === 'PASSWORD_RECOVERY') {
        window.__isPasswordRecovery = true;
        if (typeof showPasswordRecoveryForm === 'function') showPasswordRecoveryForm();
      }
    });
    return true;
  }
  return false;
}
// Try immediately
if (!initSupabase()) {
  // Retry when DOM is ready
  document.addEventListener('DOMContentLoaded', function() {
    if (!sb) initSupabase();
  });
}
