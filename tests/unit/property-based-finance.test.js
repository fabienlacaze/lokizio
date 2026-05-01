// Property-based testing for financial logic.
// fast-check generates 100s of random inputs to find edge cases we'd never write.
//
// Each property is an INVARIANT that must hold for ALL inputs in a domain.
// If fast-check finds a counter-example, it shrinks it to the minimal failing case.

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';

// ── Same logic as auto-bill Edge Function ──
function computeAmounts(items, settings) {
  const subtotal_ht = items.reduce((s, i) => s + (Number(i.amount) || 0), 0);
  const vatExempt = !!(settings && (settings.vat_exempt || settings.vat_free));
  const rate = vatExempt ? 0 : Number(settings?.vat_rate || 0);
  if (!rate || rate <= 0) {
    return { subtotal_ht, total_tva: 0, total_ttc: subtotal_ht, vat_rate: 0 };
  }
  const total_tva = Math.round(subtotal_ht * rate) / 100;
  return { subtotal_ht, total_tva, total_ttc: subtotal_ht + total_tva, vat_rate: rate };
}

// Arbitrary: a list of invoice items with bounded amounts
const itemsArb = fc.array(
  fc.record({ amount: fc.float({ min: Math.fround(-10000), max: Math.fround(100000), noNaN: true }) }),
  { minLength: 0, maxLength: 50 },
);

// Arbitrary: realistic VAT settings (0%, 5.5%, 10%, 20%) or exempt
const settingsArb = fc.oneof(
  fc.constant({ vat_exempt: true }),
  fc.constant({ vat_rate: 0 }),
  fc.constant({ vat_rate: 5.5 }),
  fc.constant({ vat_rate: 10 }),
  fc.constant({ vat_rate: 20 }),
);

describe('computeAmounts — properties', () => {
  it('total_ttc = subtotal_ht + total_tva (always, by construction)', () => {
    fc.assert(
      fc.property(itemsArb, settingsArb, (items, settings) => {
        const r = computeAmounts(items, settings);
        // Allow tiny floating-point error
        expect(r.total_ttc).toBeCloseTo(r.subtotal_ht + r.total_tva, 4);
      }),
      { numRuns: 200 },
    );
  });

  it('all returned values are finite numbers (never NaN/Infinity)', () => {
    fc.assert(
      fc.property(itemsArb, settingsArb, (items, settings) => {
        const r = computeAmounts(items, settings);
        expect(Number.isFinite(r.subtotal_ht)).toBe(true);
        expect(Number.isFinite(r.total_tva)).toBe(true);
        expect(Number.isFinite(r.total_ttc)).toBe(true);
        expect(Number.isFinite(r.vat_rate)).toBe(true);
      }),
      { numRuns: 200 },
    );
  });

  it('VAT exempt always produces total_tva = 0 regardless of items', () => {
    fc.assert(
      fc.property(itemsArb, (items) => {
        const r = computeAmounts(items, { vat_exempt: true, vat_rate: 99 });
        expect(r.total_tva).toBe(0);
        expect(r.total_ttc).toBeCloseTo(r.subtotal_ht, 4);
      }),
      { numRuns: 100 },
    );
  });

  it('zero VAT rate => total_tva = 0', () => {
    fc.assert(
      fc.property(itemsArb, (items) => {
        const r = computeAmounts(items, { vat_rate: 0 });
        expect(r.total_tva).toBe(0);
      }),
      { numRuns: 100 },
    );
  });

  it('positive subtotal + positive rate => positive TVA', () => {
    fc.assert(
      fc.property(
        fc.array(fc.record({ amount: fc.float({ min: Math.fround(1), max: Math.fround(100000), noNaN: true }) }), { minLength: 1, maxLength: 50 }),
        fc.float({ min: Math.fround(1), max: Math.fround(100), noNaN: true }),
        (items, rate) => {
          const r = computeAmounts(items, { vat_rate: rate });
          expect(r.subtotal_ht).toBeGreaterThan(0);
          expect(r.total_tva).toBeGreaterThan(0);
          expect(r.total_ttc).toBeGreaterThan(r.subtotal_ht);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('empty items always produces zeros', () => {
    fc.assert(
      fc.property(settingsArb, (settings) => {
        const r = computeAmounts([], settings);
        expect(r.subtotal_ht).toBe(0);
        expect(r.total_tva).toBe(0);
        expect(r.total_ttc).toBe(0);
      }),
      { numRuns: 50 },
    );
  });

  it('order of items does not affect totals (commutativity)', () => {
    fc.assert(
      fc.property(itemsArb, settingsArb, (items, settings) => {
        const reversed = [...items].reverse();
        const a = computeAmounts(items, settings);
        const b = computeAmounts(reversed, settings);
        expect(a.total_ttc).toBeCloseTo(b.total_ttc, 4);
        expect(a.total_tva).toBeCloseTo(b.total_tva, 4);
      }),
      { numRuns: 100 },
    );
  });

  it('adding a zero-amount item does not change totals', () => {
    fc.assert(
      fc.property(itemsArb, settingsArb, (items, settings) => {
        const a = computeAmounts(items, settings);
        const b = computeAmounts([...items, { amount: 0 }], settings);
        expect(a.total_ttc).toBeCloseTo(b.total_ttc, 4);
      }),
      { numRuns: 100 },
    );
  });

  it('null/undefined settings does not throw', () => {
    fc.assert(
      fc.property(itemsArb, fc.oneof(fc.constant(null), fc.constant(undefined)), (items, settings) => {
        expect(() => computeAmounts(items, settings)).not.toThrow();
      }),
      { numRuns: 50 },
    );
  });

  it('non-numeric garbage (null/undefined) coerce to 0', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.oneof(
            fc.record({ amount: fc.constant(null) }),
            fc.record({ amount: fc.constant(undefined) }),
            fc.record({ amount: fc.constant({}) }),       // object => NaN => 0
            fc.record({ amount: fc.constant('not-a-num') }),
          ),
          { minLength: 0, maxLength: 10 },
        ),
        (items) => {
          const r = computeAmounts(items, { vat_rate: 20 });
          expect(r.subtotal_ht).toBe(0);
          expect(r.total_ttc).toBe(0);
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ── Date arithmetic invariants ──
describe('date period invariants', () => {
  function getPeriodLabel(start, end) {
    if (!start || !end) return '';
    return `${start} → ${end}`;
  }

  it('always returns a non-null string for valid ISO dates', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2020, max: 2030 }),
        fc.integer({ min: 1, max: 12 }),
        fc.integer({ min: 1, max: 28 }),
        (year, month, day) => {
          const s = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const r = getPeriodLabel(s, s);
          expect(typeof r).toBe('string');
          expect(r.length).toBeGreaterThan(0);
        },
      ),
      { numRuns: 100 },
    );
  });
});
