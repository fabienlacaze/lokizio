// Edge cases that real code has crashed on — explicit regression tests.
// Each test is a "this should NOT throw" or "this should produce a sane fallback".

import { describe, it, expect } from 'vitest';

// ── computeAmounts edge cases ──
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

describe('computeAmounts edge cases', () => {
  it('handles negative amounts (refund line)', () => {
    const r = computeAmounts([{ amount: 100 }, { amount: -30 }], { vat_rate: 20 });
    expect(r.subtotal_ht).toBe(70);
    expect(r.total_ttc).toBeGreaterThan(0);
  });

  it('handles fractional amounts (centime precision)', () => {
    const r = computeAmounts([{ amount: 33.33 }, { amount: 66.67 }], { vat_rate: 20 });
    expect(r.subtotal_ht).toBeCloseTo(100, 2);
    expect(r.total_ttc).toBeCloseTo(120, 2);
  });

  it('does not NaN on string amounts (best-effort coercion)', () => {
    const r = computeAmounts([{ amount: '100' }, { amount: '50' }], { vat_rate: 20 });
    expect(r.subtotal_ht).toBe(150);
    expect(Number.isNaN(r.total_ttc)).toBe(false);
  });

  it('skips garbage amounts gracefully', () => {
    const r = computeAmounts([{ amount: 'foo' }, { amount: null }, { amount: 100 }], { vat_rate: 20 });
    expect(r.subtotal_ht).toBe(100);
  });

  it('rate above 100% does not produce negative TTC', () => {
    const r = computeAmounts([{ amount: 100 }], { vat_rate: 150 });
    expect(r.total_ttc).toBeGreaterThan(100);
  });

  it('huge amounts do not overflow', () => {
    const r = computeAmounts([{ amount: 1e9 }], { vat_rate: 20 });
    expect(Number.isFinite(r.total_ttc)).toBe(true);
  });

  it('settings = null does not throw', () => {
    expect(() => computeAmounts([{ amount: 100 }], null)).not.toThrow();
  });

  it('vat_exempt overrides rate', () => {
    const r = computeAmounts([{ amount: 100 }], { vat_rate: 20, vat_exempt: true });
    expect(r.total_tva).toBe(0);
    expect(r.total_ttc).toBe(100);
  });
});

// ── Date edge cases (planning, reservations) ──
describe('date edge cases', () => {
  function fmtFR(iso) {
    return iso && iso.length >= 10 ? `${iso.substring(8, 10)}/${iso.substring(5, 7)}/${iso.substring(0, 4)}` : '';
  }

  it('handles empty date', () => {
    expect(fmtFR('')).toBe('');
    expect(fmtFR(null)).toBe('');
    expect(fmtFR(undefined)).toBe('');
  });

  it('handles malformed date (current behavior — no validation)', () => {
    // KNOWN ISSUE: fmtFR doesn't validate, just slices chars 0-10. A 10-char garbage
    // string produces garbage output. Caller is expected to pass real ISO dates.
    expect(fmtFR('2026')).toBe(''); // too short — handled by length check
  });

  it('formats valid ISO date', () => {
    expect(fmtFR('2026-04-15')).toBe('15/04/2026');
  });

  it('does not crash on date with timezone suffix', () => {
    expect(fmtFR('2026-04-15T12:00:00Z')).toBe('15/04/2026');
  });

  it('past date is still valid (history)', () => {
    expect(fmtFR('1999-12-31')).toBe('31/12/1999');
  });

  it('far-future date does not break', () => {
    expect(fmtFR('2099-01-01')).toBe('01/01/2099');
  });
});

// ── Property config edge cases ──
describe('property config edge cases', () => {
  function getActiveProperty(config, activeId) {
    if (!config || !config.properties || !config.properties.length) return null;
    const id = activeId || config.activeProperty || config.properties[0].id;
    return config.properties.find((p) => p.id === id) || config.properties[0];
  }

  it('returns null when config is undefined', () => {
    expect(getActiveProperty(undefined)).toBeNull();
  });

  it('returns null when properties is missing', () => {
    expect(getActiveProperty({})).toBeNull();
  });

  it('returns null when properties is empty', () => {
    expect(getActiveProperty({ properties: [] })).toBeNull();
  });

  it('falls back to first property when activeId not found', () => {
    const cfg = { properties: [{ id: 'a' }, { id: 'b' }] };
    expect(getActiveProperty(cfg, 'nonexistent')).toEqual({ id: 'a' });
  });

  it('returns matching property when activeId is valid', () => {
    const cfg = { properties: [{ id: 'a' }, { id: 'b' }] };
    expect(getActiveProperty(cfg, 'b')).toEqual({ id: 'b' });
  });
});

// ── Phone validation edge cases ──
describe('phone validation', () => {
  // Same regex as in saveProfile (/^[\d\s+\-().]{5,30}$/)
  const PHONE_RE = /^[\d\s+\-().]{5,30}$/;

  it('accepts French formats', () => {
    expect(PHONE_RE.test('06 12 34 56 78')).toBe(true);
    expect(PHONE_RE.test('+33 6 12 34 56 78')).toBe(true);
    expect(PHONE_RE.test('06.12.34.56.78')).toBe(true);
    expect(PHONE_RE.test('(06)12-34-56-78')).toBe(true);
  });

  it('rejects empty string (caller handles separately)', () => {
    expect(PHONE_RE.test('')).toBe(false);
  });

  it('rejects too short', () => {
    expect(PHONE_RE.test('1234')).toBe(false);
  });

  it('rejects too long', () => {
    expect(PHONE_RE.test('1234567890123456789012345678901')).toBe(false);
  });

  it('rejects letters', () => {
    expect(PHONE_RE.test('06abcd5678')).toBe(false);
  });

  it('rejects SQL injection attempt', () => {
    expect(PHONE_RE.test("'; DROP TABLE members;--")).toBe(false);
  });
});

// ── iCal URL edge cases ──
describe('iCal URL validation (ical-proxy isAllowed)', () => {
  const ALLOWED_HOSTS = [
    'airbnb.com', 'airbnb.fr', 'airbnb.co.uk',
    'admin.booking.com', 'booking.com',
    'vrbo.com', 'homeaway.com', 'abritel.fr',
    'calendar.google.com',
    'outlook.live.com', 'outlook.office365.com',
    'icloud.com',
    'gites-de-france.com',
  ];

  function isAllowed(urlStr) {
    try {
      const u = new URL(urlStr);
      if (u.protocol !== 'https:' && u.protocol !== 'webcal:') return false;
      const host = u.hostname.toLowerCase();
      return ALLOWED_HOSTS.some((a) => host === a || host.endsWith('.' + a));
    } catch {
      return false;
    }
  }

  it('accepts airbnb.com subdomain', () => {
    expect(isAllowed('https://www.airbnb.com/calendar/ical/123.ics')).toBe(true);
  });

  it('accepts admin.booking.com', () => {
    expect(isAllowed('https://admin.booking.com/hotel/calendar.ics')).toBe(true);
  });

  it('rejects http (insecure)', () => {
    expect(isAllowed('http://airbnb.com/cal.ics')).toBe(false);
  });

  it('rejects file://', () => {
    expect(isAllowed('file:///etc/passwd')).toBe(false);
  });

  it('rejects internal IP (SSRF)', () => {
    expect(isAllowed('https://169.254.169.254/')).toBe(false);
  });

  it('rejects subdomain similar to allowed (typosquat)', () => {
    expect(isAllowed('https://airbnb.com.evil.example/cal.ics')).toBe(false);
  });

  it('rejects malformed URL', () => {
    expect(isAllowed('not a url')).toBe(false);
    expect(isAllowed('')).toBe(false);
  });
});

// ── Email validation ──
describe('email format', () => {
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  it('accepts standard formats', () => {
    expect(EMAIL_RE.test('user@example.com')).toBe(true);
    expect(EMAIL_RE.test('first.last+tag@sub.domain.co.uk')).toBe(true);
  });

  it('rejects bad formats', () => {
    expect(EMAIL_RE.test('no-at-sign')).toBe(false);
    expect(EMAIL_RE.test('@no-local')).toBe(false);
    expect(EMAIL_RE.test('no-domain@')).toBe(false);
    expect(EMAIL_RE.test('spaces in@email.com')).toBe(false);
  });
});

// ── XSS / HTML escaping ──
describe('HTML escaping (esc helper)', () => {
  function esc(s) {
    if (s == null) return '';
    return String(s).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }

  it('escapes script tags', () => {
    expect(esc('<script>alert(1)</script>')).toBe('&lt;script&gt;alert(1)&lt;/script&gt;');
  });

  it('escapes attribute injection', () => {
    expect(esc('" onclick="evil()')).toBe('&quot; onclick=&quot;evil()');
  });

  it('handles null/undefined', () => {
    expect(esc(null)).toBe('');
    expect(esc(undefined)).toBe('');
  });

  it('handles non-string types', () => {
    expect(esc(123)).toBe('123');
    expect(esc(true)).toBe('true');
  });
});
