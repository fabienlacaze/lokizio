// Pure helper functions for Lokizio.
// No DOM/Supabase dependencies - safe to import in Node (tests).
// Exposed via window.LokizioHelpers for browser use.

(function(global) {
  'use strict';

  // ═══ DATES ═══

  function isoDate(d) {
    return d.toISOString().split('T')[0];
  }

  function addDays(dt, n) {
    const nd = new Date(dt);
    nd.setDate(nd.getDate() + n);
    return nd;
  }

  // Renvoie la periode de facturation YYYY-MM-DD (UTC).
  function getPeriod(periodType, now) {
    const y = now.getUTCFullYear();
    const m = now.getUTCMonth();
    if (periodType === 'current_month') {
      return {
        start: isoDate(new Date(Date.UTC(y, m, 1))),
        end: isoDate(new Date(Date.UTC(y, m + 1, 0))),
      };
    }
    return {
      start: isoDate(new Date(Date.UTC(y, m - 1, 1))),
      end: isoDate(new Date(Date.UTC(y, m, 0))),
    };
  }

  // ═══ JOURS FERIES (Meeus/Jones/Butcher) ═══

  function computeEaster(year) {
    const a = year % 19;
    const b = Math.floor(year / 100);
    const c = year % 100;
    const d2 = Math.floor(b / 4);
    const e = b % 4;
    const f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d2 - g + 15) % 30;
    const i = Math.floor(c / 4);
    const k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const mm = Math.floor((a + 11 * h + 22 * l) / 451);
    const month = Math.floor((h + l - 7 * mm + 114) / 31);
    const day = ((h + l - 7 * mm + 114) % 31) + 1;
    return new Date(year, month - 1, day);
  }

  function getHolidaysForCountry(year, country) {
    const easter = computeEaster(year);
    const dates = [];
    const c = country || 'FR';
    if (c === 'FR') {
      dates.push(year + '-01-01', isoDateLocal(addDays(easter, 1)), year + '-05-01', year + '-05-08',
        isoDateLocal(addDays(easter, 39)), isoDateLocal(addDays(easter, 50)), year + '-07-14',
        year + '-08-15', year + '-11-01', year + '-11-11', year + '-12-25');
    } else if (c === 'BE') {
      dates.push(year + '-01-01', isoDateLocal(addDays(easter, 1)), year + '-05-01',
        isoDateLocal(addDays(easter, 39)), isoDateLocal(addDays(easter, 50)), year + '-07-21',
        year + '-08-15', year + '-11-01', year + '-11-11', year + '-12-25');
    } else if (c === 'CH') {
      dates.push(year + '-01-01', year + '-01-02', isoDateLocal(addDays(easter, -2)), isoDateLocal(addDays(easter, 1)),
        year + '-05-01', isoDateLocal(addDays(easter, 39)), isoDateLocal(addDays(easter, 50)),
        year + '-08-01', year + '-12-25', year + '-12-26');
    } else if (c === 'LU') {
      dates.push(year + '-01-01', isoDateLocal(addDays(easter, 1)), year + '-05-01', year + '-05-09',
        isoDateLocal(addDays(easter, 39)), isoDateLocal(addDays(easter, 50)), year + '-06-23',
        year + '-08-15', year + '-11-01', year + '-12-25', year + '-12-26');
    } else if (c === 'CA') {
      dates.push(year + '-01-01', isoDateLocal(addDays(easter, -2)), isoDateLocal(addDays(easter, 1)),
        year + '-05-20', year + '-06-24', year + '-07-01', year + '-09-02',
        year + '-10-14', year + '-12-25', year + '-12-26');
    }
    return new Set(dates);
  }

  // Local date string (used for holidays: Easter is computed in local time).
  function isoDateLocal(dt) {
    return dt.getFullYear() + '-' + String(dt.getMonth() + 1).padStart(2, '0') + '-' + String(dt.getDate()).padStart(2, '0');
  }

  // ═══ TVA ═══

  // items: [{amount: number}]. settings: {vat_rate?, vat_exempt?, vat_free?}
  function computeAmounts(items, settings) {
    const subtotal_ht = (items || []).reduce((s, i) => s + (Number(i && i.amount) || 0), 0);
    const vatExempt = !!(settings && (settings.vat_exempt || settings.vat_free));
    const rate = vatExempt ? 0 : Number((settings && settings.vat_rate) || 0);
    if (!rate || rate <= 0) {
      return { subtotal_ht, total_tva: 0, total_ttc: subtotal_ht, vat_rate: 0 };
    }
    const total_tva = Math.round(subtotal_ht * rate) / 100;
    return { subtotal_ht, total_tva, total_ttc: subtotal_ht + total_tva, vat_rate: rate };
  }

  // ═══ VALIDATORS ═══

  function validatePassword(pass) {
    if (!pass || pass.length < 8) return { ok: false, reason: 'too_short' };
    if (!/[A-Z]/.test(pass)) return { ok: false, reason: 'no_upper' };
    if (!/[a-z]/.test(pass)) return { ok: false, reason: 'no_lower' };
    if (!/[0-9]/.test(pass)) return { ok: false, reason: 'no_digit' };
    if (!/[^A-Za-z0-9]/.test(pass)) return { ok: false, reason: 'no_special' };
    return { ok: true };
  }

  function validateSiret(siret) {
    return typeof siret === 'string' && /^[0-9]{14}$/.test(siret);
  }

  function validateEmail(email) {
    return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  // ═══ ICAL ═══

  const FRENCH_DAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

  function getFrenchDay(dt) {
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

  function parseIcalText(content, source) {
    const events = [];
    content = content.replace(/\r\n /g, '').replace(/\r\n\t/g, '');
    const lines = content.split('\n');
    let inEvent = false, dtStart = '', dtEnd = '', summary = '';
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed === 'BEGIN:VEVENT') { inEvent = true; dtStart = dtEnd = summary = ''; }
      else if (trimmed === 'END:VEVENT') {
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

  // ═══ I18N ═══

  function translate(I18N, lang, key, params) {
    let str = (I18N[lang] && I18N[lang][key] != null ? I18N[lang][key] : undefined);
    if (str === undefined) str = (I18N.fr && I18N.fr[key] != null) ? I18N.fr[key] : key;
    if (params) {
      for (const k of Object.keys(params)) str = str.replace('{' + k + '}', params[k]);
    }
    return str;
  }

  // ═══ EXPORTS ═══

  const api = {
    isoDate, isoDateLocal, addDays, getPeriod,
    computeEaster, getHolidaysForCountry,
    computeAmounts,
    validatePassword, validateSiret, validateEmail,
    getFrenchDay, parseIcalDate, parseIcalText,
    translate,
  };

  // Node/CommonJS + ESM
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  // Browser
  if (typeof window !== 'undefined') {
    window.LokizioHelpers = api;
  }
  // Export named for bundlers if ever used
  if (typeof global !== 'undefined' && global && !global.LokizioHelpers) {
    global.LokizioHelpers = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
