/**
 * supabase_config.js - Supabase client initialization
 */
const SUPABASE_URL = 'https://mrvejwyvhuivmipfwlzz.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1ydmVqd3l2aHVpdm1pcGZ3bHp6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQyNjU0NTksImV4cCI6MjA4OTg0MTQ1OX0.1pi-KN5N6sNG6hIu6N0wDsR_g_G1TTf-uPecmWQ2ovU';

const STRIPE_PK = 'pk_test_51TEArcKQ0zQs7QqVpiF87akM3xuO2eV4dLLtoAd4iZTohfRvEECYdOG20BdMRp9WtKQZTFKKJhI01AMWmJoQeapx00gsk6COgi';
const STRIPE_PRICE_ID = 'price_1TEBAA3uvj2cFz0kE06GGpQP';

var sb;
function initSupabase() {
  if (window.supabase && window.supabase.createClient) {
    sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
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
