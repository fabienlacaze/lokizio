/**
 * api_bridge.js - Full client-side API bridge using Supabase.
 * Supports multiple properties per user (freemium: 1 free, unlimited premium).
 */

const PLAN_LIMITS = {
  free: { maxProviders: 2, maxProperties: 1, maxIcals: 2, maxGenerates: 2, ads: true },
  premium: { maxProviders: Infinity, maxProperties: Infinity, maxIcals: Infinity, maxGenerates: Infinity, ads: false },
};

let currentPlan = 'free';
let activePropertyId = null;

const API = (function() {

  async function getUserId() {
    const { data: { user } } = await sb.auth.getUser();
    if (!user) throw new Error('Non authentifie');
    return user.id;
  }

  async function loadRaw(column, defaultVal) {
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

  async function saveRaw(column, data) {
    localStorage.setItem('mm_cache_' + column, JSON.stringify(data));
    const userId = await getUserId();
    const { error } = await sb
      .from('user_data')
      .update({ [column]: data, updated_at: new Date().toISOString() })
      .eq('user_id', userId);
    if (error) console.error('Save error:', error);
    return { ok: !error };
  }

  // Ensure config has multi-property structure
  function migrateConfig(config) {
    if (config && config.properties && Array.isArray(config.properties)) {
      return config; // Already migrated
    }
    // Migrate from single-property format
    const secureToken = (len) => { const a = new Uint8Array(len); crypto.getRandomValues(a); return Array.from(a, b => b.toString(16).padStart(2,'0')).join(''); };
    const propId = secureToken(4);
    const newConfig = {
      properties: [{
        id: propId,
        name: (config && config.property) || 'Mon logement',
        airbnbIcalUrl: (config && config.airbnbIcalUrl) || '',
        bookingIcalUrl: (config && config.bookingIcalUrl) || '',
        providers: (config && config.providers) || [],
        readonlyToken: (config && config.readonlyToken) || secureToken(8),
      }],
      activeProperty: propId,
    };
    // Copy provider tokens
    for (const p of newConfig.properties[0].providers) {
      if (!p.token) p.token = secureToken(4);
    }
    return newConfig;
  }

  // Migrate planning/transmitted to per-property format
  function migratePlanning(data, propId) {
    if (data && typeof data === 'object' && !Array.isArray(data)) {
      return data; // Already per-property object
    }
    // Migrate from array to { propId: [...] }
    if (Array.isArray(data)) {
      return { [propId]: data };
    }
    return {};
  }

  function getActiveProp(config) {
    if (!config || !config.properties || !config.properties.length) return null;
    const id = activePropertyId || config.activeProperty || config.properties[0].id;
    return config.properties.find(p => p.id === id) || config.properties[0];
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
        if (data.plan === 'premium' && data.current_period_end) {
          const expiry = new Date(data.current_period_end);
          if (expiry < new Date()) { currentPlan = 'free'; return 'free'; }
        }
        currentPlan = data.plan || 'free';
        return currentPlan;
      } catch (e) { currentPlan = 'free'; return 'free'; }
    },
    getPlan() { return currentPlan; },
    getLimits() { return PLAN_LIMITS[currentPlan] || PLAN_LIMITS.free; },
    isPremium() { return currentPlan === 'premium'; },

    // Config (multi-property)
    async load_config() {
      const raw = await loadRaw('config', {});
      const config = migrateConfig(raw);
      // Set active property
      const prop = getActiveProp(config);
      if (prop) activePropertyId = prop.id;
      return config;
    },

    async save_config(config) {
      const secureToken = (len) => { const a = new Uint8Array(len); crypto.getRandomValues(a); return Array.from(a, b => b.toString(16).padStart(2,'0')).join(''); };
      // Ensure tokens for all properties
      for (const prop of (config.properties || [])) {
        if (!prop.readonlyToken) prop.readonlyToken = secureToken(8);
        for (const p of (prop.providers || [])) {
          if (!p.token) p.token = secureToken(4);
        }
      }
      // Enforce plan limits
      const limits = this.getLimits();
      if ((config.properties || []).length > limits.maxProperties) {
        return { ok: false, error: 'limit_properties', max: limits.maxProperties };
      }
      const activeProp = getActiveProp(config);
      if (activeProp && (activeProp.providers || []).length > limits.maxProviders) {
        return { ok: false, error: 'limit_providers', max: limits.maxProviders };
      }
      await saveRaw('config', config);
      return { ok: true, config };
    },

    // Property helpers
    getActiveProperty(config) { return getActiveProp(config); },
    setActiveProperty(propId) { activePropertyId = propId; },
    getActivePropertyId() { return activePropertyId; },

    addProperty(config, name) {
      const secureToken = (len) => { const a = new Uint8Array(len); crypto.getRandomValues(a); return Array.from(a, b => b.toString(16).padStart(2,'0')).join(''); };
      const id = secureToken(4);
      config.properties.push({
        id, name: name || 'Nouvelle propriete',
        airbnbIcalUrl: '', bookingIcalUrl: '',
        providers: [], readonlyToken: secureToken(8),
      });
      config.activeProperty = id;
      activePropertyId = id;
      return config;
    },

    removeProperty(config, propId) {
      config.properties = config.properties.filter(p => p.id !== propId);
      if (config.activeProperty === propId && config.properties.length > 0) {
        config.activeProperty = config.properties[0].id;
        activePropertyId = config.properties[0].id;
      }
      return config;
    },

    // Planning (per-property)
    async load_planning() {
      const raw = await loadRaw('planning', {});
      if (!activePropertyId) return [];
      const data = migratePlanning(raw, activePropertyId);
      return data[activePropertyId] || [];
    },
    async save_planning(cleanings) {
      const raw = await loadRaw('planning', {});
      const data = migratePlanning(raw, activePropertyId);
      data[activePropertyId] = cleanings;
      return await saveRaw('planning', data);
    },

    // Transmitted (per-property)
    async load_transmitted() {
      const raw = await loadRaw('transmitted', {});
      if (!activePropertyId) return [];
      const data = (typeof raw === 'object' && !Array.isArray(raw)) ? raw : { [activePropertyId]: raw || [] };
      return data[activePropertyId] || [];
    },
    async save_transmitted(dates) {
      const raw = await loadRaw('transmitted', {});
      const data = (typeof raw === 'object' && !Array.isArray(raw)) ? raw : {};
      data[activePropertyId] = dates;
      return await saveRaw('transmitted', data);
    },

    // History (per-property)
    async load_history() {
      const raw = await loadRaw('history', {});
      if (!activePropertyId) return [];
      const data = (typeof raw === 'object' && !Array.isArray(raw)) ? raw : { [activePropertyId]: raw || [] };
      return data[activePropertyId] || [];
    },
    async save_history(history) {
      const raw = await loadRaw('history', {});
      const data = (typeof raw === 'object' && !Array.isArray(raw)) ? raw : {};
      data[activePropertyId] = history;
      return await saveRaw('history', data);
    },

    // Linens (per-property)
    async load_linens() {
      const raw = await loadRaw('linens', {});
      if (!activePropertyId) return [];
      const data = (typeof raw === 'object' && !Array.isArray(raw)) ? raw : { [activePropertyId]: raw || [] };
      return data[activePropertyId] || [];
    },
    async save_linens(linens) {
      const raw = await loadRaw('linens', {});
      const data = (typeof raw === 'object' && !Array.isArray(raw)) ? raw : {};
      data[activePropertyId] = linens;
      return await saveRaw('linens', data);
    },

    // Generate planning (uses active property)
    async generate_planning() {
      const log = typeof dbg === 'function' ? dbg : console.log;
      log('Chargement config...');
      const fullConfig = await this.load_config();
      const prop = getActiveProp(fullConfig);
      if (!prop) return { error: 'Aucune propriete configuree' };
      // Build config for generator with all iCal sources
      const genConfig = {
        airbnbIcalUrl: prop.airbnbIcalUrl || '',
        bookingIcalUrl: prop.bookingIcalUrl || '',
        icals: prop.icals || [],
        providers: prop.providers,
        property: prop.name,
      };
      const icalCount = (genConfig.icals || []).filter(i => i.url).length || ((genConfig.airbnbIcalUrl?1:0)+(genConfig.bookingIcalUrl?1:0));
      log('Config: ' + (genConfig.providers||[]).length + ' prestataires, ' + icalCount + ' calendrier(s)', 'ok');
      const previousPlanning = (await this.load_planning()) || [];
      log('Planning precedent: ' + previousPlanning.length + ' entree(s)', 'ok');
      const transmittedDates = await this.load_transmitted();
      log('Dates transmises: ' + transmittedDates.length, 'ok');
      log('Lancement generatePlanning()...');
      return await generatePlanningFromICal(genConfig, previousPlanning, transmittedDates);
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
