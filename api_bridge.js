/**
 * api_bridge.js v3 - Full client-side API bridge using Supabase.
 * Phase 2: Uses organizations, properties, plannings tables.
 * Backward compatible with user_data table.
 */

const PLAN_LIMITS = {
  free: { maxProviders: 2, maxProperties: 1, maxIcals: 2, maxGenerates: 5, ads: true },
  pro: { maxProviders: Infinity, maxProperties: 5, maxIcals: Infinity, maxGenerates: Infinity, ads: false },
  premium: { maxProviders: Infinity, maxProperties: Infinity, maxIcals: Infinity, maxGenerates: Infinity, ads: false },
  business: { maxProviders: Infinity, maxProperties: Infinity, maxIcals: Infinity, maxGenerates: Infinity, ads: false },
};

let currentPlan = 'free';
let activePropertyId = null;
let currentOrg = null;
let currentMember = null;
let currentRole = 'admin';
let allMemberships = []; // All orgs the user belongs to

const API = (function() {

  const secureToken = (len) => { const a = new Uint8Array(len); crypto.getRandomValues(a); return Array.from(a, b => b.toString(16).padStart(2,'0')).join(''); };

  async function getUserId() {
    const { data: { user } } = await sb.auth.getUser();
    if (!user) throw new Error('Non authentifie');
    return user.id;
  }

  // Load user's organization(s) and role
  async function loadOrg() {
    try {
      const userId = await getUserId();
      const { data: members, error } = await sb
        .from('members')
        .select('*, organizations(*)')
        .eq('user_id', userId);
      if (error || !members || !members.length) {
        console.log('No org found, creating onboarding...');
        // Auto-create org + member + trial subscription
        const user = (await sb.auth.getUser()).data.user;
        const orgName = user.email ? user.email.split('@')[0] : 'Mon organisation';
        // Generate referral code
        const refCode = orgName.replace(/[^a-z0-9]/gi,'').substring(0,8).toUpperCase() + Math.random().toString(36).substring(2,6).toUpperCase();
        // Check if referred by someone
        const urlRef = new URLSearchParams(window.location.search).get('ref') || localStorage.getItem('mm_referral') || '';
        const { data: newOrg, error: orgErr } = await sb.from('organizations').insert({ name: orgName, plan: 'business', referral_code: refCode, referred_by: urlRef || null }).select().single();
        if (orgErr || !newOrg) { console.error('Onboarding org error:', orgErr); allMemberships = []; return null; }
        await sb.from('members').insert({ org_id: newOrg.id, user_id: userId, role: 'admin', invited_email: user.email, accepted: true });
        const trialEnd = new Date(); trialEnd.setDate(trialEnd.getDate() + 10);
        await sb.from('subscriptions').upsert({ user_id: userId, plan: 'business', current_period_end: trialEnd.toISOString() }, { onConflict: 'user_id' });
        // Reload
        const { data: newMembers } = await sb.from('members').select('*, organizations(*)').eq('user_id', userId);
        if (!newMembers || !newMembers.length) { allMemberships = []; return null; }
        allMemberships = newMembers;
        const m2 = newMembers[0];
        currentOrg = m2.organizations;
        currentMember = m2;
        currentRole = m2.role;
        // Reward referrer if applicable
        if (urlRef) {
          const { data: referrerOrg } = await sb.from('organizations').select('id, referral_rewards').eq('referral_code', urlRef).single();
          if (referrerOrg) {
            const newRewards = (referrerOrg.referral_rewards || 0) + 1;
            await sb.from('organizations').update({ referral_rewards: newRewards, plan: 'business' }).eq('id', referrerOrg.id);
            // Extend referrer's subscription by 30 days
            const { data: refMembers } = await sb.from('members').select('user_id').eq('org_id', referrerOrg.id).eq('role', 'admin').limit(1);
            if (refMembers && refMembers.length) {
              const { data: refSub } = await sb.from('subscriptions').select('*').eq('user_id', refMembers[0].user_id).single();
              if (refSub) {
                const currentEnd = refSub.current_period_end ? new Date(refSub.current_period_end) : new Date();
                const newEnd = new Date(Math.max(currentEnd.getTime(), Date.now()));
                newEnd.setDate(newEnd.getDate() + 30);
                await sb.from('subscriptions').update({ plan: 'business', current_period_end: newEnd.toISOString() }).eq('user_id', refMembers[0].user_id);
              }
            }
            console.log('Referrer rewarded: +30 days business');
          }
          localStorage.removeItem('mm_referral');
        }
        console.log('Onboarding complete: org=' + currentOrg.name);
        return currentOrg;
      }
      allMemberships = members;
      // Use saved active org or first one
      const savedOrgId = localStorage.getItem('mm_active_org');
      const saved = savedOrgId ? members.find(m => m.org_id === savedOrgId) : null;
      const m = saved || members[0];
      currentOrg = m.organizations;
      currentMember = m;
      currentRole = m.role;
      return currentOrg;
    } catch (e) {
      console.error('loadOrg error:', e);
      allMemberships = [];
      return null;
    }
  }

  function switchOrg(orgId) {
    const m = allMemberships.find(m => m.org_id === orgId);
    if (!m) return false;
    currentOrg = m.organizations;
    currentMember = m;
    currentRole = m.role;
    activePropertyId = null;
    localStorage.setItem('mm_active_org', orgId);
    return true;
  }

  // ─── NEW TABLES API ───

  async function loadProperties() {
    if (!currentOrg) return [];
    const { data, error } = await sb
      .from('properties')
      .select('*')
      .eq('org_id', currentOrg.id)
      .order('created_at');
    if (error) { console.error('loadProperties:', error); return []; }
    return data || [];
  }

  async function saveProperty(prop) {
    const { data, error } = await sb
      .from('properties')
      .update({
        name: prop.name,
        address: prop.address,
        lat: prop.lat,
        lng: prop.lng,
        type: prop.type,
        rooms: prop.rooms,
        surface: prop.surface,
        photo: prop.photo,
        tarif: prop.tarif,
        owner_price: prop.ownerPrice || 0,
        duration: prop.duration,
        checklist: prop.checklist || [],
        notes: prop.notes,
        icals: prop.icals || [],
        manual_reservations: prop.manualReservations || [],
        providers: prop.providers || [],
        readonly_token: prop.readonlyToken || prop.readonly_token,
        updated_at: new Date().toISOString(),
      })
      .eq('id', prop.id)
      .select()
      .single();
    if (error) console.error('saveProperty:', error);
    return data;
  }

  async function createProperty(name) {
    if (!currentOrg || !currentMember) return null;
    const { data, error } = await sb
      .from('properties')
      .insert({
        org_id: currentOrg.id,
        owner_member_id: currentMember.id,
        name: name || 'Nouvelle propriete',
        readonly_token: secureToken(16),
      })
      .select()
      .single();
    if (error) { console.error('createProperty:', error); return null; }
    return data;
  }

  async function deleteProperty(propId) {
    // Also deletes planning via CASCADE
    const { error } = await sb.from('properties').delete().eq('id', propId);
    if (error) console.error('deleteProperty:', error);
    return !error;
  }

  async function loadPlanning(propId) {
    const { data, error } = await sb
      .from('plannings')
      .select('*')
      .eq('property_id', propId)
      .single();
    if (error || !data) return { cleanings: [], transmitted: [], history: [] };
    return data;
  }

  async function savePlanningData(propId, field, value) {
    await sb.from('plannings').upsert(
      { property_id: propId, [field]: value, updated_at: new Date().toISOString() },
      { onConflict: 'property_id' }
    );
  }

  // ─── LEGACY FALLBACK ───

  async function loadRawLegacy(column, defaultVal) {
    try {
      const userId = await getUserId();
      const { data, error } = await sb.from('user_data').select(column).eq('user_id', userId).single();
      if (error || !data) return defaultVal;
      const val = data[column];
      if (val !== null && val !== undefined) return val;
      return defaultVal;
    } catch (e) { return defaultVal; }
  }

  // Convert DB property to frontend format (compatibility)
  function dbPropToFrontend(dbProp) {
    return {
      id: dbProp.id,
      name: dbProp.name || 'Mon logement',
      address: dbProp.address || '',
      lat: dbProp.lat,
      lng: dbProp.lng,
      type: dbProp.type || '',
      rooms: dbProp.rooms,
      surface: dbProp.surface,
      photo: dbProp.photo || '',
      tarif: dbProp.tarif,
      ownerPrice: dbProp.owner_price || 0,
      duration: dbProp.duration || '',
      checklist: dbProp.checklist || [],
      notes: dbProp.notes || '',
      icals: dbProp.icals || [],
      manualReservations: dbProp.manual_reservations || [],
      providers: dbProp.providers || [],
      readonlyToken: dbProp.readonly_token || '',
      // Legacy compat
      airbnbIcalUrl: (dbProp.icals || []).find(i => i.platform === 'airbnb')?.url || '',
      bookingIcalUrl: (dbProp.icals || []).find(i => i.platform === 'booking')?.url || '',
    };
  }

  function frontendPropToDb(prop) {
    return {
      id: prop.id,
      name: prop.name,
      address: prop.address,
      lat: prop.lat,
      lng: prop.lng,
      type: prop.type,
      rooms: prop.rooms,
      surface: prop.surface,
      photo: prop.photo,
      tarif: prop.tarif,
      owner_price: prop.ownerPrice || 0,
      duration: prop.duration,
      checklist: prop.checklist || [],
      notes: prop.notes || '',
      icals: prop.icals || [],
      providers: prop.providers || [],
      readonlyToken: prop.readonlyToken,
      readonly_token: prop.readonlyToken,
    };
  }

  return {
    // ─── Organization ───
    async loadOrganization() { return await loadOrg(); },
    getOrg() { return currentOrg; },
    getAllMemberships() { return allMemberships; },
    switchOrg(orgId) { return switchOrg(orgId); },
    getRole() { return currentRole; },
    getMember() { return currentMember; },
    isAdmin() { return currentRole === 'admin' || currentRole === 'manager'; },
    isProvider() { return currentRole === 'provider'; },

    // ─── Members ───
    async loadMembers() {
      if (!currentOrg) return [];
      const { data } = await sb.from('members').select('*').eq('org_id', currentOrg.id);
      return data || [];
    },
    async inviteMember(email, role) {
      if (!currentOrg) return null;
      // Create invite (user may not exist yet)
      const { data, error } = await sb.from('members').insert({
        org_id: currentOrg.id,
        invited_email: email,
        role: role || 'owner',
        accepted: false,
      }).select().single();
      if (error) console.error('inviteMember:', error);
      return data;
    },
    async removeMember(memberId) {
      const { error } = await sb.from('members').delete().eq('id', memberId);
      return !error;
    },

    // ─── Plan management ───
    async load_plan() {
      try {
        // Load org first if not loaded
        if (!currentOrg) await loadOrg();
        // Try org plan first (Phase 2)
        if (currentOrg) {
          currentPlan = currentOrg.plan || 'free';
          // Check trial expiration
          if (currentOrg.trial_start && !currentOrg.trial_used) {
            const trialEnd = new Date(currentOrg.trial_start);
            trialEnd.setDate(trialEnd.getDate() + 10);
            if (new Date() > trialEnd) {
              // Trial expired — downgrade to free
              currentPlan = 'free';
              currentOrg.plan = 'free';
              currentOrg.trial_used = true;
              await sb.from('organizations').update({ plan: 'free', trial_used: true }).eq('id', currentOrg.id);
            } else {
              // Trial still active
              currentOrg._trialDaysLeft = Math.ceil((trialEnd - new Date()) / 86400000);
            }
          }
          // Map 'pro' to 'premium' for backward compat
          if (currentPlan === 'pro') currentPlan = 'premium';
          return currentPlan;
        }
        // Fallback to subscriptions table
        const userId = await getUserId();
        const { data, error } = await sb.from('subscriptions').select('plan, current_period_end').eq('user_id', userId).single();
        if (error || !data) { currentPlan = 'free'; return 'free'; }
        if (data.plan === 'premium' && data.current_period_end) {
          if (new Date(data.current_period_end) < new Date()) { currentPlan = 'free'; return 'free'; }
        }
        currentPlan = data.plan || 'free';
        return currentPlan;
      } catch (e) { currentPlan = 'free'; return 'free'; }
    },
    getPlan() { return currentPlan; },
    getTrialDaysLeft() { return currentOrg ? (currentOrg._trialDaysLeft || 0) : 0; },
    getLimits() { return PLAN_LIMITS[currentPlan] || PLAN_LIMITS.free; },
    isPremium() { return currentPlan === 'premium' || currentPlan === 'pro' || currentPlan === 'business'; },

    // ─── Config (builds from properties table) ───
    async load_config() {
      // Try new tables first
      await loadOrg();
      if (currentOrg) {
        const dbProps = await loadProperties();
        if (dbProps.length > 0) {
          const config = {
            properties: dbProps.map(dbPropToFrontend),
            activeProperty: activePropertyId || dbProps[0].id,
          };
          const prop = config.properties.find(p => p.id === config.activeProperty) || config.properties[0];
          if (prop) activePropertyId = prop.id;
          localStorage.setItem('mm_cache_config', JSON.stringify(config));
          return config;
        }
      }
      // Fallback to legacy user_data
      const raw = await loadRawLegacy('config', {});
      if (raw && raw.properties && raw.properties.length) {
        const prop = raw.properties.find(p => p.id === (activePropertyId || raw.activeProperty)) || raw.properties[0];
        if (prop) activePropertyId = prop.id;
        return raw;
      }
      return { properties: [], activeProperty: null };
    },

    async save_config(config) {
      // Ensure tokens
      for (const prop of (config.properties || [])) {
        if (!prop.readonlyToken) prop.readonlyToken = secureToken(16);
        for (const p of (prop.providers || [])) {
          if (!p.token) p.token = secureToken(16);
        }
      }
      // Enforce plan limits
      const limits = this.getLimits();
      if ((config.properties || []).length > limits.maxProperties) {
        return { ok: false, error: 'limit_properties', max: limits.maxProperties };
      }
      const activeProp = config.properties.find(p => p.id === activePropertyId) || config.properties[0];
      if (activeProp && (activeProp.providers || []).length > limits.maxProviders) {
        return { ok: false, error: 'limit_providers', max: limits.maxProviders };
      }
      // Save each property to DB
      if (currentOrg) {
        for (const prop of (config.properties || [])) {
          await saveProperty(frontendPropToDb(prop));
        }
      }
      localStorage.setItem('mm_cache_config', JSON.stringify(config));
      return { ok: true, config };
    },

    // ─── Property helpers ───
    getActiveProperty(config) {
      if (!config || !config.properties || !config.properties.length) return null;
      const id = activePropertyId || config.activeProperty || config.properties[0].id;
      return config.properties.find(p => p.id === id) || config.properties[0];
    },
    setActiveProperty(propId) { activePropertyId = propId; },
    getActivePropertyId() { return activePropertyId; },

    async addProperty(config, name) {
      if (currentOrg) {
        const dbProp = await createProperty(name);
        if (dbProp) {
          config.properties.push(dbPropToFrontend(dbProp));
          config.activeProperty = dbProp.id;
          activePropertyId = dbProp.id;
        }
      } else {
        const id = secureToken(16);
        config.properties.push({
          id, name: name || 'Nouvelle propriete',
          airbnbIcalUrl: '', bookingIcalUrl: '',
          icals: [], providers: [], readonlyToken: secureToken(16),
        });
        config.activeProperty = id;
        activePropertyId = id;
      }
      return config;
    },

    async removeProperty(config, propId) {
      if (currentOrg) {
        await deleteProperty(propId);
      }
      config.properties = config.properties.filter(p => p.id !== propId);
      if (config.activeProperty === propId && config.properties.length > 0) {
        config.activeProperty = config.properties[0].id;
        activePropertyId = config.properties[0].id;
      }
      return config;
    },

    // ─── Planning ───
    async load_planning() {
      if (!activePropertyId) return [];
      if (currentOrg) {
        const p = await loadPlanning(activePropertyId);
        const cleanings = p.cleanings || [];
        localStorage.setItem('mm_cache_planning_' + activePropertyId, JSON.stringify(cleanings));
        return cleanings;
      }
      // Legacy
      const raw = await loadRawLegacy('planning', {});
      const data = (typeof raw === 'object' && !Array.isArray(raw)) ? raw : {};
      return data[activePropertyId] || (Array.isArray(raw) ? raw : []);
    },
    async save_planning(cleanings) {
      if (!activePropertyId) return;
      localStorage.setItem('mm_cache_planning_' + activePropertyId, JSON.stringify(cleanings));
      if (currentOrg) {
        await savePlanningData(activePropertyId, 'cleanings', cleanings);
      }
    },

    // ─── Reservations ───
    async load_reservations() {
      if (!activePropertyId) return [];
      if (currentOrg) {
        const p = await loadPlanning(activePropertyId);
        return p.reservations || [];
      }
      return [];
    },
    async save_reservations(reservations) {
      if (!activePropertyId || !reservations) return;
      if (currentOrg) {
        await savePlanningData(activePropertyId, 'reservations', reservations);
      }
    },

    // ─── Transmitted ───
    async load_transmitted() {
      if (!activePropertyId) return [];
      if (currentOrg) {
        const p = await loadPlanning(activePropertyId);
        return p.transmitted || [];
      }
      const raw = await loadRawLegacy('transmitted', {});
      const data = (typeof raw === 'object' && !Array.isArray(raw)) ? raw : {};
      return data[activePropertyId] || [];
    },
    async save_transmitted(dates) {
      if (!activePropertyId) return;
      if (currentOrg) {
        await savePlanningData(activePropertyId, 'transmitted', dates);
      }
    },

    // ─── History ───
    async load_history() {
      if (!activePropertyId) return [];
      if (currentOrg) {
        const p = await loadPlanning(activePropertyId);
        return p.history || [];
      }
      const raw = await loadRawLegacy('history', {});
      const data = (typeof raw === 'object' && !Array.isArray(raw)) ? raw : {};
      return data[activePropertyId] || [];
    },
    async save_history(history) {
      if (!activePropertyId) return;
      if (currentOrg) {
        await savePlanningData(activePropertyId, 'history', history);
      }
    },

    // ─── Linens ───
    async load_linens() {
      if (!activePropertyId) return [];
      // Linens stay in user_data for now (not critical for Phase 2)
      const raw = await loadRawLegacy('linens', {});
      const data = (typeof raw === 'object' && !Array.isArray(raw)) ? raw : {};
      return data[activePropertyId] || [];
    },
    async save_linens(linens) {
      // Keep in legacy for now
    },

    // ─── Cleaning Validations ───
    async loadValidations(propId) {
      const { data } = await sb.from('cleaning_validations').select('*').eq('property_id', propId || activePropertyId).order('cleaning_date');
      return data || [];
    },
    async validateCleaning(propId, cleaningDate, providerName, status, photos, notes) {
      const userId = await getUserId();
      const { data, error } = await sb.from('cleaning_validations').upsert({
        property_id: propId || activePropertyId,
        cleaning_date: cleaningDate,
        provider_name: providerName,
        status: status || 'done',
        photos: photos || [],
        notes: notes || '',
        validated_at: new Date().toISOString(),
        validated_by: userId,
      }, { onConflict: 'property_id,cleaning_date,provider_name' }).select().single();
      if (error) console.error('validateCleaning:', error);
      return data;
    },

    // ─── Dashboard (all properties) ───
    async loadDashboard() {
      if (!currentOrg) return { properties: [], cleanings: [], today: [] };
      const props = await loadProperties();
      const allCleanings = [];
      const today = new Date().toISOString().split('T')[0];
      const weekEnd = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];

      // Load all plannings in a single query instead of N+1
      const propIds = props.map(p => p.id);
      const { data: allPlannings } = propIds.length
        ? await sb.from('plannings').select('*').in('property_id', propIds)
        : { data: [] };
      const planMap = {};
      (allPlannings || []).forEach(p => { planMap[p.property_id] = p; });

      for (const prop of props) {
        const p = planMap[prop.id] || { cleanings: [] };
        const cleanings = (p.cleanings || []).map(c => ({ ...c, propertyId: prop.id, propertyName: prop.name }));
        allCleanings.push(...cleanings);
      }

      // Sort by date
      allCleanings.sort((a, b) => (a.date || a.cleaningDate || '').localeCompare(b.date || b.cleaningDate || ''));

      const todayCleanings = allCleanings.filter(c => (c.cleaningDate || c.date) === today);
      const weekCleanings = allCleanings.filter(c => {
        const d = c.cleaningDate || c.date || '';
        return d >= today && d <= weekEnd;
      });

      return {
        properties: props.map(dbPropToFrontend),
        allCleanings,
        todayCleanings,
        weekCleanings,
        totalProperties: props.length,
        totalProviders: [...new Set(allCleanings.map(c => c.provider))].length,
      };
    },

    // ─── Generate planning ───
    async generate_planning() {
      const log = typeof dbg === 'function' ? dbg : console.log;
      log('Chargement config...');
      const fullConfig = await this.load_config();
      const prop = this.getActiveProperty(fullConfig);
      if (!prop) return { error: 'Aucune propriete configuree' };
      const genConfig = {
        airbnbIcalUrl: prop.airbnbIcalUrl || '',
        bookingIcalUrl: prop.bookingIcalUrl || '',
        icals: prop.icals || [],
        manualReservations: prop.manualReservations || [],
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

    // ─── Export ───
    async export_csv(cleanings, filename) {
      const sep = '\t';
      let csv = '\uFEFF' + ['Date menage','Jour','Arrivee','Depart','Prestataire','Telephone','Source'].join(sep) + '\n';
      for (const c of cleanings) {
        csv += [c.cleaningDateFR || c.dateFR || '', c.dayName || '', c.dateFR || '', c.checkoutDateFR || '', c.provider || '', c.providerPhone || '', c.source || ''].join(sep) + '\n';
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

    isMobile() { return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent); }
  };
})();
