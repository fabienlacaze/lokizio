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

async function generatePlanning(config, previousPlanning, transmittedDates) {
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

  const airbnbUrl = config.airbnbIcalUrl || '';
  const bookingUrl = config.bookingIcalUrl || '';
  const providers = config.providers || [];
  let allEvents = [];
  const errors = [];

  const sources = [
    { url: airbnbUrl, name: 'Airbnb' },
    { url: bookingUrl, name: 'Booking' }
  ];
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

    // Phase 2: round-robin for new cleanings
    for (const cleaning of cleanings) {
      if (cleaning.isLocked) continue;

      const cleaningDate = new Date(cleaning.date + 'T00:00:00');
      const totalAssigned = Math.max(Object.values(counters).reduce((s, v) => s + v, 0), 1);

      let bestProvider = null, bestDeficit = -999999;

      for (const p of providers) {
        if (isOnVacation(p, cleaningDate)) continue;
        const currentRatio = (counters[p.name] / totalAssigned) * 100;
        const deficit = (parseInt(p.percentage) || 0) - currentRatio;
        if (bestProvider === null || deficit > bestDeficit) {
          bestProvider = p;
          bestDeficit = deficit;
        }
      }

      // Fallback if all on vacation
      if (!bestProvider) {
        for (const p of providers) {
          const currentRatio = (counters[p.name] / totalAssigned) * 100;
          const deficit = (parseInt(p.percentage) || 0) - currentRatio;
          if (bestProvider === null || deficit > bestDeficit) {
            bestProvider = p;
            bestDeficit = deficit;
          }
        }
      }

      cleaning.provider = bestProvider.name;
      cleaning.providerPhone = bestProvider.phone || '';
      counters[bestProvider.name]++;
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
