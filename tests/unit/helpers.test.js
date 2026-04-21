// Tests d'INTEGRATION: importe vraiment le module helpers.js du projet.
// Garantit que les changements dans helpers.js sont detectes (contrairement
// aux autres tests qui dupliquent la logique par isolement).

import { describe, it, expect } from 'vitest';
import helpers from '../../helpers.js';

describe('helpers.js (real module import)', () => {
  it('exports all expected functions', () => {
    expect(typeof helpers.isoDate).toBe('function');
    expect(typeof helpers.getPeriod).toBe('function');
    expect(typeof helpers.computeAmounts).toBe('function');
    expect(typeof helpers.validatePassword).toBe('function');
    expect(typeof helpers.validateSiret).toBe('function');
    expect(typeof helpers.validateEmail).toBe('function');
    expect(typeof helpers.getHolidaysForCountry).toBe('function');
    expect(typeof helpers.parseIcalText).toBe('function');
    expect(typeof helpers.translate).toBe('function');
  });

  describe('getPeriod via real module', () => {
    const utc = (y, m, d) => new Date(Date.UTC(y, m, d, 12, 0));
    it('current_month April 2026', () => {
      const p = helpers.getPeriod('current_month', utc(2026, 3, 15));
      expect(p).toEqual({ start: '2026-04-01', end: '2026-04-30' });
    });
    it('previous_month from January', () => {
      const p = helpers.getPeriod('previous_month', utc(2026, 0, 5));
      expect(p).toEqual({ start: '2025-12-01', end: '2025-12-31' });
    });
    it('leap year February', () => {
      const p = helpers.getPeriod('current_month', utc(2028, 1, 10));
      expect(p.end).toBe('2028-02-29');
    });
  });

  describe('computeAmounts via real module', () => {
    it('20% VAT standard', () => {
      const r = helpers.computeAmounts([{ amount: 100 }], { vat_rate: 20 });
      expect(r).toEqual({ subtotal_ht: 100, total_tva: 20, total_ttc: 120, vat_rate: 20 });
    });
    it('VAT exempt (art. 293B)', () => {
      const r = helpers.computeAmounts([{ amount: 500 }], { vat_rate: 20, vat_exempt: true });
      expect(r.total_tva).toBe(0);
      expect(r.total_ttc).toBe(500);
    });
    it('handles undefined settings', () => {
      const r = helpers.computeAmounts([{ amount: 100 }], undefined);
      expect(r.total_tva).toBe(0);
      expect(r.total_ttc).toBe(100);
    });
    it('handles empty items', () => {
      expect(helpers.computeAmounts([], { vat_rate: 20 }).subtotal_ht).toBe(0);
    });
  });

  describe('validators via real module', () => {
    it('password strength chain', () => {
      expect(helpers.validatePassword('ValidPass1!').ok).toBe(true);
      expect(helpers.validatePassword('short').ok).toBe(false);
    });
    it('SIRET format', () => {
      expect(helpers.validateSiret('12345678901234')).toBe(true);
      expect(helpers.validateSiret('invalid')).toBe(false);
    });
    it('email format', () => {
      expect(helpers.validateEmail('user@example.com')).toBe(true);
      expect(helpers.validateEmail('broken')).toBe(false);
    });
  });

  describe('holidays via real module', () => {
    it('FR 2026 has 11 holidays', () => {
      expect(helpers.getHolidaysForCountry(2026, 'FR').size).toBe(11);
    });
    it('Easter 2026 is April 5', () => {
      const easter = helpers.computeEaster(2026);
      expect(easter.getMonth()).toBe(3);
      expect(easter.getDate()).toBe(5);
    });
  });

  describe('iCal parser via real module', () => {
    it('extracts events', () => {
      const ical = 'BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nDTSTART;VALUE=DATE:20260420\r\nDTEND;VALUE=DATE:20260425\r\nSUMMARY:Test\r\nEND:VEVENT\r\nEND:VCALENDAR';
      const events = helpers.parseIcalText(ical, 'test');
      expect(events).toHaveLength(1);
      expect(events[0].summary).toBe('Test');
    });
  });

  describe('translate via real module', () => {
    const I18N = {
      fr: { hello: 'Bonjour', bye: '' },
      en: { hello: 'Hello' },
    };
    it('returns current lang translation', () => {
      expect(helpers.translate(I18N, 'en', 'hello')).toBe('Hello');
    });
    it('falls back to FR when missing', () => {
      expect(helpers.translate(I18N, 'es', 'hello')).toBe('Bonjour');
    });
    it('interpolates params', () => {
      I18N.fr.greet = 'Salut {name}';
      expect(helpers.translate(I18N, 'fr', 'greet', { name: 'Fabien' })).toBe('Salut Fabien');
    });
    it('FIXED: empty string translation returns empty (not key)', () => {
      // helpers.translate() handles empty strings correctly (uses != null check)
      expect(helpers.translate(I18N, 'fr', 'bye')).toBe('');
    });
  });
});
