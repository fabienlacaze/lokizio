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
    // Also listen for PASSWORD_RECOVERY event (fires when Supabase detects recovery token)
    sb.auth.onAuthStateChange((event) => {
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
