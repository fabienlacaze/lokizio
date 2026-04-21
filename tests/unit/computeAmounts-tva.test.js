// Tests pour le calcul TVA (auto-bill Edge Function)
// Duplique la logique de supabase/functions/auto-bill/index.ts:computeAmounts

import { describe, it, expect } from 'vitest';

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

describe('computeAmounts (TVA auto-bill)', () => {
  it('returns zero when items are empty', () => {
    expect(computeAmounts([], { vat_rate: 20 })).toEqual({
      subtotal_ht: 0, total_tva: 0, total_ttc: 0, vat_rate: 20,
    });
  });

  it('no VAT when rate is 0', () => {
    const r = computeAmounts([{ amount: 100 }, { amount: 50 }], { vat_rate: 0 });
    expect(r.subtotal_ht).toBe(150);
    expect(r.total_tva).toBe(0);
    expect(r.total_ttc).toBe(150);
  });

  it('no VAT when vat_exempt flag set (art. 293B)', () => {
    const r = computeAmounts([{ amount: 1000 }], { vat_rate: 20, vat_exempt: true });
    expect(r.total_tva).toBe(0);
    expect(r.total_ttc).toBe(1000);
    expect(r.vat_rate).toBe(0);
  });

  it('no VAT when vat_free flag set (alias)', () => {
    const r = computeAmounts([{ amount: 500 }], { vat_rate: 20, vat_free: true });
    expect(r.total_tva).toBe(0);
    expect(r.total_ttc).toBe(500);
  });

  it('20% VAT France standard', () => {
    const r = computeAmounts([{ amount: 100 }], { vat_rate: 20 });
    expect(r.subtotal_ht).toBe(100);
    expect(r.total_tva).toBe(20);
    expect(r.total_ttc).toBe(120);
    expect(r.vat_rate).toBe(20);
  });

  it('10% VAT reduced rate', () => {
    const r = computeAmounts([{ amount: 100 }, { amount: 200 }], { vat_rate: 10 });
    expect(r.subtotal_ht).toBe(300);
    expect(r.total_tva).toBe(30);
    expect(r.total_ttc).toBe(330);
  });

  it('5.5% VAT super-reduced with 2-decimal rounding', () => {
    const r = computeAmounts([{ amount: 100 }], { vat_rate: 5.5 });
    expect(r.subtotal_ht).toBe(100);
    expect(r.total_tva).toBe(5.5);
    expect(r.total_ttc).toBe(105.5);
  });

  it('handles non-round amounts correctly', () => {
    const r = computeAmounts([{ amount: 33.33 }, { amount: 66.67 }], { vat_rate: 20 });
    expect(r.subtotal_ht).toBe(100);
    expect(r.total_tva).toBe(20);
    expect(r.total_ttc).toBe(120);
  });

  it('rounds TVA to 2 decimals', () => {
    // 7.5 * 20/100 = 1.5 exact
    const r = computeAmounts([{ amount: 7.5 }], { vat_rate: 20 });
    expect(r.total_tva).toBe(1.5);
  });

  it('handles missing settings gracefully', () => {
    const r = computeAmounts([{ amount: 100 }], undefined);
    expect(r.subtotal_ht).toBe(100);
    expect(r.total_tva).toBe(0);
    expect(r.total_ttc).toBe(100);
  });

  it('handles null items amounts as 0', () => {
    const r = computeAmounts([{ amount: null }, { amount: 50 }], { vat_rate: 20 });
    expect(r.subtotal_ht).toBe(50);
    expect(r.total_tva).toBe(10);
  });

  it('negative rate is treated as 0', () => {
    const r = computeAmounts([{ amount: 100 }], { vat_rate: -5 });
    expect(r.total_tva).toBe(0);
    expect(r.total_ttc).toBe(100);
  });
});
