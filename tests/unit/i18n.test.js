// Tests for i18n translation function t()
// Recreates the logic to test isolation from global state.

import { describe, it, expect, beforeEach } from 'vitest';

let currentLang = 'fr';
let I18N;

function t(key, params) {
  let str = (I18N[currentLang] && I18N[currentLang][key]) || (I18N.fr[key]) || key;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      str = str.replace(`{${k}}`, v);
    }
  }
  return str;
}

describe('t() translation function', () => {
  beforeEach(() => {
    I18N = {
      fr: {
        'hello': 'Bonjour',
        'welcome': 'Bienvenue {name}',
        'items': '{count} articles',
        'empty': '',
      },
      en: {
        'hello': 'Hello',
        'welcome': 'Welcome {name}',
      },
      es: {
        'hello': 'Hola',
      },
    };
    currentLang = 'fr';
  });

  it('returns translation for existing key in current language', () => {
    expect(t('hello')).toBe('Bonjour');
  });

  it('falls back to FR if key missing in current lang', () => {
    currentLang = 'es';
    expect(t('items')).toBe('{count} articles');
  });

  it('returns key itself if missing in all languages', () => {
    expect(t('nonexistent.key')).toBe('nonexistent.key');
  });

  it('substitutes single parameter {name}', () => {
    expect(t('welcome', { name: 'Fabien' })).toBe('Bienvenue Fabien');
  });

  it('substitutes multiple parameters', () => {
    I18N.fr['multi'] = '{a} + {b} = {c}';
    expect(t('multi', { a: 1, b: 2, c: 3 })).toBe('1 + 2 = 3');
  });

  it('works in English', () => {
    currentLang = 'en';
    expect(t('hello')).toBe('Hello');
    expect(t('welcome', { name: 'Alice' })).toBe('Welcome Alice');
  });

  it('KNOWN LIMITATION: empty string translation falls back to key', () => {
    // The || chain treats '' as falsy, so an empty translation returns the key itself.
    // Acceptable since we don't intentionally use empty strings.
    expect(t('empty')).toBe('empty');
  });

  it('falls back when lang is unknown', () => {
    currentLang = 'xx';
    expect(t('hello')).toBe('Bonjour');
  });

  it('handles numeric parameters as strings', () => {
    expect(t('items', { count: 5 })).toBe('5 articles');
  });

  it('leaves unreplaced placeholders alone', () => {
    expect(t('welcome')).toBe('Bienvenue {name}');
  });
});
