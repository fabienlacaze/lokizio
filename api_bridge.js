/**
 * api_bridge.js - Full client-side API bridge using Supabase.
 * All data stored in Supabase PostgreSQL + localStorage cache.
 * Includes freemium plan management.
 */

// Plan limits
const PLAN_LIMITS = {
  free: { maxProviders: 2, maxProperties: 1, ads: true },
  premium: { maxProviders: Infinity, maxProperties: Infinity, ads: false },
};

let currentPlan = 'free';

const API = (function() {

  async function getUserId() {
    const { data: { user } } = await sb.auth.getUser();
    if (!user) throw new Error('Non authentifie');
    return user.id;
  }

  async function load(column, defaultVal) {
    try {
      const userId = await getUserId();
      const { data, error } = await sb
        .from('user_data')
        .select(column)
        .eq('user_id', userId)
        .single();
      if (error || !data) return defaultVal;
      const val = data[column];
      if (val !== null && val !== undefined) {
        localStorage.setItem('mm_cache_' + column, JSON.stringify(val));
        return val;
      }
      return defaultVal;
    } catch (e) {
      const cached = localStorage.getItem('mm_cache_' + column);
      if (cached) { try { return JSON.parse(cached); } catch(e2) { return defaultVal; } }
      return defaultVal;
    }
  }

  async function save(column, data) {
    localStorage.setItem('mm_cache_' + column, JSON.stringify(data));
    const userId = await getUserId();
    const { error } = await sb
      .from('user_data')
      .update({ [column]: data, updated_at: new Date().toISOString() })
      .eq('user_id', userId);
    if (error) console.error('Save error:', error);
    return { ok: !error };
  }

  return {
    // Plan management
    async load_plan() {
      try {
        const userId = await getUserId();
        const { data, error } = await sb
          .from('subscriptions')
          .select('plan, current_period_end')
          .eq('user_id', userId)
          .single();
        if (error || !data) { currentPlan = 'free'; return 'free'; }
        // Check if premium has expired
        if (data.plan === 'premium' && data.current_period_end) {
          const expiry = new Date(data.current_period_end);
          if (expiry < new Date()) { currentPlan = 'free'; return 'free'; }
        }
        currentPlan = data.plan || 'free';
        return currentPlan;
      } catch (e) {
        currentPlan = 'free';
        return 'free';
      }
    },

    getPlan() { return currentPlan; },
    getLimits() { return PLAN_LIMITS[currentPlan] || PLAN_LIMITS.free; },
    isPremium() { return currentPlan === 'premium'; },

    async load_config() {
      return await load('config', { airbnbIcalUrl: '', bookingIcalUrl: '', providers: [], property: 'Mon logement' });
    },

    async save_config(config) {
      const secureToken = (len) => { const a = new Uint8Array(len); crypto.getRandomValues(a); return Array.from(a, b => b.toString(16).padStart(2,'0')).join(''); };
      for (const p of (config.providers || [])) {
        if (!p.token) p.token = secureToken(4);
      }
      if (!config.readonlyToken) config.readonlyToken = secureToken(8);

      // Enforce plan limits
      const limits = this.getLimits();
      if ((config.providers || []).length > limits.maxProviders) {
        return { ok: false, error: 'limit', maxProviders: limits.maxProviders };
      }

      await save('config', config);
      return { ok: true, config };
    },

    async load_transmitted() { return await load('transmitted', []); },
    async save_transmitted(dates) { return await save('transmitted', dates); },

    async load_planning() { return await load('planning', null); },
    async save_planning(cleanings) { return await save('planning', cleanings); },

    async load_history() { return await load('history', []); },
    async save_history(history) { return await save('history', history); },

    async load_linens() { return await load('linens', []); },
    async save_linens(linens) { return await save('linens', linens); },

    async generate_planning() {
      const log = typeof dbg === 'function' ? dbg : console.log;
      log('Chargement config...');
      const config = await this.load_config();
      log('Config: ' + (config.providers||[]).length + ' prestataires, airbnb=' + (config.airbnbIcalUrl?'oui':'non') + ', booking=' + (config.bookingIcalUrl?'oui':'non'), 'ok');
      const previousPlanning = (await this.load_planning()) || [];
      log('Planning precedent: ' + previousPlanning.length + ' entree(s)', 'ok');
      const transmittedDates = await this.load_transmitted();
      log('Dates transmises: ' + transmittedDates.length, 'ok');
      log('Lancement generatePlanning()...');
      return await generatePlanningFromICal(config, previousPlanning, transmittedDates);
    },

    async export_csv(cleanings, filename) {
      let csv = 'Date menage;Jour;Arrivee;Depart;Prestataire;Telephone;Source\n';
      for (const c of cleanings) {
        csv += `${c.cleaningDateFR || c.dateFR || ''};${c.dayName || ''};${c.dateFR || ''};${c.checkoutDateFR || ''};${c.provider || ''};${c.providerPhone || ''};${c.source || ''}\n`;
      }
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = filename; a.click();
      URL.revokeObjectURL(url);
      return filename;
    },

    async open_whatsapp(phone, message) {
      let clean = phone.replace(/[\s.\-]/g, '');
      if (clean.startsWith('0') && clean.length === 10) clean = '+33' + clean.substring(1);
      const url = `https://wa.me/${clean}?text=${encodeURIComponent(message)}`;
      window.open(url, '_blank');
      return true;
    },

    async copy_whatsapp(provName, message) {
      try { await navigator.clipboard.writeText(message); }
      catch (e) {
        const ta = document.createElement('textarea');
        ta.value = message; document.body.appendChild(ta); ta.select();
        document.execCommand('copy'); document.body.removeChild(ta);
      }
      return true;
    },

    async setup_reminder() {
      return { ok: false, msg: 'Rappels non disponibles en mode web.' };
    },

    isMobile() { return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent); }
  };
})();
