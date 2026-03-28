/**
 * ical_parser.js - Port of ical_parser.py to JavaScript
 * Downloads and parses iCal files, generates cleaning planning with weighted round-robin.
 * Runs entirely in the browser.
 */

const FRENCH_DAYS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

function getFrenchDay(dt) {
  // JS: 0=Sun, Python: 0=Mon. Convert.
  const d = dt.getDay();
  return FRENCH_DAYS[d === 0 ? 6 : d - 1];
}

function parseIcalDate(value) {
  const m = value.match(/:(.+)$/);
  const dateStr = m ? m[1].trim() : value.trim();

  const m2 = dateStr.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z?$/);
  if (m2) return new Date(Date.UTC(+m2[1], +m2[2] - 1, +m2[3], +m2[4], +m2[5], +m2[6]));

  const m3 = dateStr.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (m3) return new Date(+m3[1], +m3[2] - 1, +m3[3]);

  return null;
}

async function fetchIcalDirect(url, source) {
  const log = typeof dbg === 'function' ? dbg : console.log;
  if (!url) return '';

  try {
    log(`${source}: recuperation via Edge Function...`, 'info');
    const resp = await fetch(`${SUPABASE_URL}/functions/v1/ical-proxy`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url }),
    });
    if (resp.ok) {
      const text = await resp.text();
      if (text.includes('BEGIN:VCALENDAR')) {
        log(`${source}: ${text.length} chars`, 'ok');
        return text;
      }
    }
    log(`${source}: reponse invalide (HTTP ${resp.status})`, 'warn');
  } catch (e) {
    log(`${source}: erreur: ${e.message}`, 'err');
  }
  return '';
}

function parseIcalText(content, source) {
  const events = [];
  // RFC 5545 line unfolding
  content = content.replace(/\r\n /g, '').replace(/\r\n\t/g, '');
  const lines = content.split('\n');
  let inEvent = false, dtStart = '', dtEnd = '', summary = '';

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === 'BEGIN:VEVENT') {
      inEvent = true; dtStart = dtEnd = summary = '';
    } else if (trimmed === 'END:VEVENT') {
      if (inEvent && dtStart) {
        const start = parseIcalDate(dtStart);
        const end = dtEnd ? parseIcalDate(dtEnd) : start;
        if (start) events.push({ start, end: end || start, summary, source });
      }
      inEvent = false;
    } else if (inEvent) {
      if (trimmed.startsWith('DTSTART')) dtStart = trimmed;
      else if (trimmed.startsWith('DTEND')) dtEnd = trimmed;
      else if (trimmed.startsWith('SUMMARY:')) summary = trimmed.substring(8).trim();
    }
  }
  return events;
}

function isOnVacation(provider, checkDate) {
  const vacStr = provider.vacations || '';
  if (!vacStr) return false;
  const checkISO = toISO(checkDate);
  return vacStr.split('|').filter(v => v).some(period => {
    const parts = period.split('/');
    if (parts.length === 2) return checkISO >= parts[0] && checkISO <= parts[1];
    return false;
  });
}

function toISO(d) {
  if (typeof d === 'string') return d;
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0'), day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

async function generatePlanningFromICal(config, previousPlanning, transmittedDates) {
  const log = typeof dbg === 'function' ? dbg : console.log;
  previousPlanning = previousPlanning || [];
  transmittedDates = transmittedDates || [];
  log('generatePlanning: ' + (config.providers||[]).length + ' prestataires, ' + previousPlanning.length + ' plannings precedents');

  // Build lookup: checkinDate -> previous cleaning
  const prevByDate = {};
  for (const c of previousPlanning) {
    const d = c.checkinDate || c.date || '';
    if (d) prevByDate[d] = c;
  }

  const providers = config.providers || [];
  let allEvents = [];
  const errors = [];

  // Build sources from dynamic icals list or legacy fields
  const PLATFORM_NAMES = { airbnb:'Airbnb', booking:'Booking', vrbo:'Vrbo', tripadvisor:'Tripadvisor', holidu:'Holidu', gites:'Gites de France', other:'Autre' };
  let sources = [];
  if (config.icals && config.icals.length) {
    sources = config.icals.filter(i => i.url).map(i => ({ url: i.url, name: PLATFORM_NAMES[i.platform] || i.platform }));
  } else {
    if (config.airbnbIcalUrl) sources.push({ url: config.airbnbIcalUrl, name: 'Airbnb' });
    if (config.bookingIcalUrl) sources.push({ url: config.bookingIcalUrl, name: 'Booking' });
  }
  for (const src of sources) {
    if (!src.url) { log(src.name + ': pas d\'URL, skip', 'info'); continue; }
    log('Lecture ' + src.name + '...', 'info');
    try {
      const text = await fetchIcalDirect(src.url, src.name);
      if (text) {
        const evts = parseIcalText(text, src.name);
        log(src.name + ': ' + evts.length + ' evenement(s) trouves', 'ok');
        allEvents = allEvents.concat(evts);
      } else {
        log(src.name + ': impossible de recuperer le calendrier.', 'warn');
      }
    } catch (e) {
      log(src.name + ' ERREUR: ' + e.message, 'err');
      errors.push(`${src.name}: ${e.message}`);
    }
  }

  // Inject manual reservations
  if (config.manualReservations && config.manualReservations.length) {
    for (const mr of config.manualReservations) {
      if (mr.checkin && mr.checkout) {
        allEvents.push({
          start: new Date(mr.checkin),
          end: new Date(mr.checkout),
          summary: mr.guestName || 'Reservation manuelle',
          source: mr.source || 'Direct',
        });
      }
    }
    log('Reservations manuelles: ' + config.manualReservations.length + ' ajoutee(s)', 'ok');
  }

  log('Total: ' + allEvents.length + ' evenement(s), ' + errors.length + ' erreur(s)');
  if (!allEvents.length && errors.length) return { error: errors.join('; ') };

  allEvents.sort((a, b) => a.start - b.start);

  // Build reservations list (for calendar)
  const reservations = allEvents.map(ev => ({
    start: toISO(ev.start), end: toISO(ev.end), summary: ev.summary, source: ev.source
  }));

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Airbnb dates for cross-referencing
  const airbnbDates = new Set();
  for (const ev of allEvents) {
    if (ev.source === 'Airbnb') {
      const sl = ev.summary.toLowerCase();
      if (!sl.includes('not available') && !sl.includes('closed')) airbnbDates.add(toISO(ev.start));
    }
  }

  const cleanings = [];

  for (let i = 0; i < allEvents.length; i++) {
    const current = allEvents[i];
    const checkinDate = new Date(current.start);
    checkinDate.setHours(0, 0, 0, 0);
    if (checkinDate < today) continue;

    const summaryLower = current.summary.toLowerCase();
    const dateStr = toISO(checkinDate);
    let source = current.source;

    if (summaryLower.includes('not available') || summaryLower.includes('closed')) {
      if (source === 'Booking' && !airbnbDates.has(dateStr)) {
        source = 'Booking';
      } else {
        continue;
      }
    }

    if (cleanings.some(c => c.date === dateStr)) continue;

    let prevCheckout = '';
    if (i > 0) prevCheckout = toISO(allEvents[i - 1].end);

    cleanings.push({
      date: dateStr,
      dayName: getFrenchDay(checkinDate),
      checkinDate: dateStr,
      cleaningDate: dateStr,
      checkoutDate: toISO(current.end),
      prevCheckout,
      summary: current.summary,
      source,
      provider: '',
      providerPhone: ''
    });
  }

  // Mark new cleanings
  for (const cleaning of cleanings) {
    cleaning.isNew = !(cleaning.checkinDate in prevByDate);
  }

  // Round-robin assignment
  if (providers.length && cleanings.length) {
    const counters = {};
    const providerNames = providers.map(p => p.name);
    for (const p of providers) counters[p.name] = 0;

    // Phase 1: preserve previous assignments
    for (const cleaning of cleanings) {
      const d = cleaning.checkinDate;
      if (d in prevByDate) {
        const prev = prevByDate[d];
        const prevProv = prev.provider || '';
        const prevCleaningDate = prev.cleaningDate || '';
        if (prevCleaningDate && prevCleaningDate !== d) cleaning.cleaningDate = prevCleaningDate;
        if (prevProv && providerNames.includes(prevProv)) {
          cleaning.provider = prevProv;
          const pp = providers.find(p => p.name === prevProv);
          cleaning.providerPhone = pp ? (pp.phone || '') : '';
          cleaning.isLocked = true;
          counters[prevProv]++;
          continue;
        }
      }
      cleaning.isLocked = false;
    }

    // Count cleanings per provider per day
    const dailyCounts = {};
    function getDailyCount(provName, date) {
      return (dailyCounts[provName + '_' + date] || 0);
    }
    function addDailyCount(provName, date) {
      dailyCounts[provName + '_' + date] = (dailyCounts[provName + '_' + date] || 0) + 1;
    }
    // Init daily counts from locked assignments
    for (const c of cleanings) {
      if (c.isLocked && c.provider) addDailyCount(c.provider, c.cleaningDate || c.date);
    }

    // Haversine distance (km)
    function haversine(lat1, lon1, lat2, lon2) {
      if (!lat1 || !lon1 || !lat2 || !lon2) return 0;
      const R = 6371;
      const dLat = (lat2 - lat1) * Math.PI / 180;
      const dLon = (lon2 - lon1) * Math.PI / 180;
      const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) * Math.sin(dLon/2)**2;
      return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    }

    // Get property location for distance check
    const propLat = config.lat || null;
    const propLng = config.lng || null;

    // Phase 2: smart assignment (% + availability + daily limit + distance)
    for (const cleaning of cleanings) {
      if (cleaning.isLocked) continue;

      const cleaningDate = new Date(cleaning.date + 'T00:00:00');
      const dateStr = cleaning.cleaningDate || cleaning.date;
      const totalAssigned = Math.max(Object.values(counters).reduce((s, v) => s + v, 0), 1);

      let bestProvider = null, bestScore = -999999;

      for (const p of providers) {
        // Skip if on vacation
        if (isOnVacation(p, cleaningDate)) continue;

        // Skip if daily max reached (default 3, configurable via p.maxPerDay)
        const maxPerDay = parseInt(p.maxPerDay) || 3;
        if (getDailyCount(p.name, dateStr) >= maxPerDay) continue;

        // Skip if out of geographic range
        if (propLat && propLng && p.lat && p.lng) {
          const dist = haversine(p.lat, p.lng, propLat, propLng);
          const radius = parseFloat(p.radius) || 50;
          if (dist > radius) continue;
        }

        // Score: higher = better candidate
        const currentRatio = (counters[p.name] / totalAssigned) * 100;
        const deficit = (parseInt(p.percentage) || 0) - currentRatio;
        let score = deficit * 10; // Base score from % deficit

        // Bonus: less daily load = better
        score -= getDailyCount(p.name, dateStr) * 5;

        // Bonus: closer = better (if geo available)
        if (propLat && propLng && p.lat && p.lng) {
          const dist = haversine(p.lat, p.lng, propLat, propLng);
          score -= dist * 0.1; // Slight penalty for distance
        }

        if (bestProvider === null || score > bestScore) {
          bestProvider = p;
          bestScore = score;
        }
      }

      // Fallback if all filtered out (vacation + overloaded + out of range)
      if (!bestProvider) {
        for (const p of providers) {
          const currentRatio = (counters[p.name] / totalAssigned) * 100;
          const deficit = (parseInt(p.percentage) || 0) - currentRatio;
          if (bestProvider === null || deficit > bestScore) {
            bestProvider = p;
            bestScore = deficit;
          }
        }
      }

      cleaning.provider = bestProvider.name;
      cleaning.providerPhone = bestProvider.phone || '';
      counters[bestProvider.name]++;
      addDailyCount(bestProvider.name, dateStr);
    }
  }

  // Summary
  const providerSummary = providers.map(p => {
    const assigned = cleanings.filter(c => c.provider === p.name).length;
    const actual = cleanings.length ? Math.round((assigned / cleanings.length) * 1000) / 10 : 0;
    return { name: p.name, phone: p.phone || '', assigned, target: parseInt(p.percentage) || 0, actual };
  });

  return {
    fetchDate: new Date().toISOString(),
    reservations,
    cleanings,
    summary: { total: cleanings.length, providers: providerSummary },
    error: null
  };
}
