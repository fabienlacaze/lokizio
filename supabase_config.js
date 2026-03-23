/**
 * supabase_config.js - Supabase client initialization
 */
const SUPABASE_URL = 'https://mrvejwyvhuivmipfwlzz.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1ydmVqd3l2aHVpdm1pcGZ3bHp6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQyNjU0NTksImV4cCI6MjA4OTg0MTQ1OX0.1pi-KN5N6sNG6hIu6N0wDsR_g_G1TTf-uPecmWQ2ovU';

let supabaseClient;
try {
  const mod = window.supabase;
  supabaseClient = mod.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  console.log('Supabase client initialized', supabaseClient.auth ? 'with auth' : 'WITHOUT auth');
} catch (e) {
  console.error('Supabase init error:', e);
}
// Expose as global
const supabase = supabaseClient;
