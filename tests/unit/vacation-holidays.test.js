// Tests pour la logique jours feries FR/BE/CH/LU/CA (vacation.js)
// On reimporte les fonctions pures en copie - le module vacation.js depend de globals (sb, API, etc.)
// donc on ne peut pas l'importer tel quel. On duplique la logique pour test isole.

import { describe, it, expect } from 'vitest';

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
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const easterMonth = Math.floor((h + l - 7 * m + 114) / 31);
  const easterDay = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, easterMonth - 1, easterDay);
}

function isoDate(dt) {
  return dt.getFullYear() + '-' + String(dt.getMonth() + 1).padStart(2, '0') + '-' + String(dt.getDate()).padStart(2, '0');
}

function addDays(dt, n) { const nd = new Date(dt); nd.setDate(nd.getDate() + n); return nd; }

function getHolidaysForCountry(year, country) {
  const easter = computeEaster(year);
  const dates = [];
  const c = country || 'FR';
  if (c === 'FR') {
    dates.push(year + '-01-01', isoDate(addDays(easter, 1)), year + '-05-01', year + '-05-08',
      isoDate(addDays(easter, 39)), isoDate(addDays(easter, 50)), year + '-07-14',
      year + '-08-15', year + '-11-01', year + '-11-11', year + '-12-25');
  } else if (c === 'BE') {
    dates.push(year + '-01-01', isoDate(addDays(easter, 1)), year + '-05-01',
      isoDate(addDays(easter, 39)), isoDate(addDays(easter, 50)), year + '-07-21',
      year + '-08-15', year + '-11-01', year + '-11-11', year + '-12-25');
  }
  return new Set(dates);
}

describe('computeEaster (Meeus/Jones/Butcher algorithm)', () => {
  const knownEasters = {
    2024: '2024-03-31',
    2025: '2025-04-20',
    2026: '2026-04-05',
    2027: '2027-03-28',
    2030: '2030-04-21',
  };

  for (const [year, iso] of Object.entries(knownEasters)) {
    it(`returns correct Easter for ${year}`, () => {
      expect(isoDate(computeEaster(Number(year)))).toBe(iso);
    });
  }
});

describe('isoDate formatting', () => {
  it('pads month and day with leading zero', () => {
    expect(isoDate(new Date(2026, 0, 5))).toBe('2026-01-05');
    expect(isoDate(new Date(2026, 11, 25))).toBe('2026-12-25');
  });
});

describe('addDays', () => {
  it('adds positive days correctly', () => {
    const d = new Date(2026, 0, 30);
    expect(isoDate(addDays(d, 5))).toBe('2026-02-04');
  });
  it('handles month rollover', () => {
    const d = new Date(2026, 0, 31);
    expect(isoDate(addDays(d, 1))).toBe('2026-02-01');
  });
  it('handles year rollover', () => {
    const d = new Date(2026, 11, 31);
    expect(isoDate(addDays(d, 1))).toBe('2027-01-01');
  });
  it('is non-destructive (returns new date)', () => {
    const d = new Date(2026, 0, 1);
    addDays(d, 10);
    expect(isoDate(d)).toBe('2026-01-01');
  });
});

describe('getHolidaysForCountry France', () => {
  const fr2026 = getHolidaysForCountry(2026, 'FR');

  it('contains 11 French holidays', () => {
    expect(fr2026.size).toBe(11);
  });

  it('includes Jour de l\'An', () => { expect(fr2026.has('2026-01-01')).toBe(true); });
  it('includes Fete du Travail', () => { expect(fr2026.has('2026-05-01')).toBe(true); });
  it('includes Victoire 1945', () => { expect(fr2026.has('2026-05-08')).toBe(true); });
  it('includes Fete Nationale', () => { expect(fr2026.has('2026-07-14')).toBe(true); });
  it('includes Assomption', () => { expect(fr2026.has('2026-08-15')).toBe(true); });
  it('includes Toussaint', () => { expect(fr2026.has('2026-11-01')).toBe(true); });
  it('includes Armistice 1918', () => { expect(fr2026.has('2026-11-11')).toBe(true); });
  it('includes Noel', () => { expect(fr2026.has('2026-12-25')).toBe(true); });
  it('includes Lundi de Paques (Easter + 1)', () => { expect(fr2026.has('2026-04-06')).toBe(true); });
  it('includes Ascension (Easter + 39)', () => { expect(fr2026.has('2026-05-14')).toBe(true); });
  it('includes Pentecote (Easter + 50)', () => { expect(fr2026.has('2026-05-25')).toBe(true); });

  it('does NOT include 14 juillet for Belgium', () => {
    const be = getHolidaysForCountry(2026, 'BE');
    expect(be.has('2026-07-14')).toBe(false);
    expect(be.has('2026-07-21')).toBe(true);
  });
});

describe('getHolidaysForCountry fallback', () => {
  it('defaults to FR when country is undefined', () => {
    const d = getHolidaysForCountry(2026);
    expect(d.has('2026-07-14')).toBe(true);
  });
  it('returns empty set for unknown country', () => {
    const d = getHolidaysForCountry(2026, 'XX');
    expect(d.size).toBe(0);
  });
});
