/**
 * supabase_config.js - Supabase client initialization
 */
const SUPABASE_URL = 'https://mrvejwyvhuivmipfwlzz.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_AivB6qTeQWqmr-RliuMRiw_GJFNO_ha';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
