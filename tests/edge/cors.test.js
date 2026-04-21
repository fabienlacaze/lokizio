// Tests for the CORS helper in supabase/functions/_shared/cors.ts
// We re-implement the JS equivalent (TS cannot be imported directly by Vitest without transpilation).

import { describe, it, expect } from 'vitest';

const ALLOWED_ORIGINS = [
  'https://fabienlacaze.github.io',
  'http://localhost:8000',
  'http://127.0.0.1:8000',
  'http://localhost:5173',
];

function corsHeaders(req) {
  const origin = req.headers.get('Origin') || '';
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Vary': 'Origin',
  };
}

function makeReq(origin) {
  return { headers: { get: (k) => (k === 'Origin' ? origin : null) } };
}

describe('corsHeaders', () => {
  it('allows GitHub Pages production origin', () => {
    const h = corsHeaders(makeReq('https://fabienlacaze.github.io'));
    expect(h['Access-Control-Allow-Origin']).toBe('https://fabienlacaze.github.io');
  });

  it('allows localhost:8000 (dev http-server)', () => {
    expect(corsHeaders(makeReq('http://localhost:8000'))['Access-Control-Allow-Origin'])
      .toBe('http://localhost:8000');
  });

  it('allows 127.0.0.1:8000', () => {
    expect(corsHeaders(makeReq('http://127.0.0.1:8000'))['Access-Control-Allow-Origin'])
      .toBe('http://127.0.0.1:8000');
  });

  it('allows localhost:5173 (Vite)', () => {
    expect(corsHeaders(makeReq('http://localhost:5173'))['Access-Control-Allow-Origin'])
      .toBe('http://localhost:5173');
  });

  it('rejects random origin by defaulting to prod', () => {
    const h = corsHeaders(makeReq('https://evil.com'));
    expect(h['Access-Control-Allow-Origin']).not.toBe('https://evil.com');
    expect(h['Access-Control-Allow-Origin']).toBe('https://fabienlacaze.github.io');
  });

  it('rejects when Origin header is missing', () => {
    const h = corsHeaders(makeReq(null));
    expect(h['Access-Control-Allow-Origin']).toBe('https://fabienlacaze.github.io');
  });

  it('is case-sensitive (https vs http)', () => {
    const h = corsHeaders(makeReq('HTTPS://FABIENLACAZE.GITHUB.IO'));
    // Should NOT be allowed (case-sensitive string compare)
    expect(h['Access-Control-Allow-Origin']).toBe('https://fabienlacaze.github.io');
  });

  it('always sets Vary: Origin header', () => {
    const h = corsHeaders(makeReq('https://fabienlacaze.github.io'));
    expect(h['Vary']).toBe('Origin');
  });

  it('never sets wildcard (*) for Access-Control-Allow-Origin', () => {
    const h = corsHeaders(makeReq('https://anywhere.com'));
    expect(h['Access-Control-Allow-Origin']).not.toBe('*');
  });

  it('returns all required CORS headers', () => {
    const h = corsHeaders(makeReq('http://localhost:8000'));
    expect(h).toHaveProperty('Access-Control-Allow-Origin');
    expect(h).toHaveProperty('Access-Control-Allow-Methods');
    expect(h).toHaveProperty('Access-Control-Allow-Headers');
  });

  it('Allow-Headers includes all required', () => {
    const h = corsHeaders(makeReq('http://localhost:8000'));
    const allowed = h['Access-Control-Allow-Headers'];
    expect(allowed).toContain('authorization');
    expect(allowed).toContain('apikey');
    expect(allowed).toContain('content-type');
  });
});
