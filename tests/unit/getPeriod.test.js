// Tests pour getPeriod() - determine la periode de facturation (current_month vs previous_month)
// Logique dupliquee depuis supabase/functions/auto-bill/index.ts

import { describe, it, expect } from 'vitest';

// Note: the original auto-bill uses d.toISOString() which is UTC-based.
// For testing we construct dates in UTC to avoid timezone flakiness.
function isoDate(d) { return d.toISOString().split('T')[0]; }

function getPeriod(periodType, now) {
  if (periodType === 'current_month') {
    const s = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const e = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0));
    return { start: isoDate(s), end: isoDate(e) };
  }
  const s = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  const e = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0));
  return { start: isoDate(s), end: isoDate(e) };
}

// Helper: build a UTC date for tests
const utc = (y, m, d) => new Date(Date.UTC(y, m, d, 12, 0, 0));

describe('getPeriod', () => {
  it('current_month returns first and last day of the month', () => {
    const p = getPeriod('current_month', utc(2026, 3, 15));
    expect(p.start).toBe('2026-04-01');
    expect(p.end).toBe('2026-04-30');
  });

  it('previous_month (default) returns last month full range', () => {
    const p = getPeriod('previous_month', utc(2026, 3, 15));
    expect(p.start).toBe('2026-03-01');
    expect(p.end).toBe('2026-03-31');
  });

  it('defaults to previous_month when type not specified', () => {
    const p = getPeriod(undefined, utc(2026, 6, 10));
    expect(p.start).toBe('2026-06-01');
    expect(p.end).toBe('2026-06-30');
  });

  it('handles January (previous month = December of previous year)', () => {
    const p = getPeriod('previous_month', utc(2026, 0, 5));
    expect(p.start).toBe('2025-12-01');
    expect(p.end).toBe('2025-12-31');
  });

  it('handles February in a leap year (current month)', () => {
    const p = getPeriod('current_month', utc(2028, 1, 10));
    expect(p.start).toBe('2028-02-01');
    expect(p.end).toBe('2028-02-29');
  });

  it('handles February in a non-leap year', () => {
    const p = getPeriod('current_month', utc(2026, 1, 15));
    expect(p.end).toBe('2026-02-28');
  });
});
