// Tests for validation rules (password strength, SIRET, email)

import { describe, it, expect } from 'vitest';

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

describe('validatePassword', () => {
  it('rejects too short', () => {
    expect(validatePassword('Ab1!')).toMatchObject({ ok: false, reason: 'too_short' });
  });

  it('rejects when no uppercase', () => {
    expect(validatePassword('abcdef1!')).toMatchObject({ ok: false, reason: 'no_upper' });
  });

  it('rejects when no lowercase', () => {
    expect(validatePassword('ABCDEF1!')).toMatchObject({ ok: false, reason: 'no_lower' });
  });

  it('rejects when no digit', () => {
    expect(validatePassword('Abcdefg!')).toMatchObject({ ok: false, reason: 'no_digit' });
  });

  it('rejects when no special char', () => {
    expect(validatePassword('Abcdef12')).toMatchObject({ ok: false, reason: 'no_special' });
  });

  it('accepts valid password', () => {
    expect(validatePassword('Abcdef1!')).toMatchObject({ ok: true });
    expect(validatePassword('MyS3cur3P@ss')).toMatchObject({ ok: true });
  });

  it('rejects empty or null', () => {
    expect(validatePassword('').ok).toBe(false);
    expect(validatePassword(null).ok).toBe(false);
    expect(validatePassword(undefined).ok).toBe(false);
  });
});

describe('validateSiret', () => {
  it('accepts 14 digits exactly', () => {
    expect(validateSiret('12345678901234')).toBe(true);
  });
  it('rejects 13 digits', () => {
    expect(validateSiret('1234567890123')).toBe(false);
  });
  it('rejects 15 digits', () => {
    expect(validateSiret('123456789012345')).toBe(false);
  });
  it('rejects letters', () => {
    expect(validateSiret('1234567890123A')).toBe(false);
  });
  it('rejects spaces', () => {
    expect(validateSiret('123 456 789 01234')).toBe(false);
  });
  it('rejects empty', () => {
    expect(validateSiret('')).toBe(false);
    expect(validateSiret(null)).toBe(false);
  });
});

describe('validateEmail', () => {
  it.each([
    'user@example.com',
    'fabien65400@hotmail.fr',
    'a+b@c.co',
    'test.name@sub.domain.com',
  ])('accepts %s', (email) => {
    expect(validateEmail(email)).toBe(true);
  });

  it.each([
    'not-an-email',
    'missing@',
    '@missing.com',
    'no-at-sign.com',
    'spaces in@email.com',
    '',
  ])('rejects %s', (email) => {
    expect(validateEmail(email)).toBe(false);
  });
});
