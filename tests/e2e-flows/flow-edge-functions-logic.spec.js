// Edge Function logic tests against PROD (read-only safe).
// We test surface area: auth checks, CORS, input validation, allowlists.
// We DO NOT trigger real side-effects (no real billing, no real emails).

import { test, expect } from '@playwright/test';

const FUNCTIONS_URL = 'https://mrvejwyvhuivmipfwlzz.supabase.co/functions/v1';

// ── ical-proxy: SSRF prevention ──
test.describe('ical-proxy SSRF allowlist', () => {
  test('rejects request with no body', async () => {
    const r = await fetch(`${FUNCTIONS_URL}/ical-proxy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '',
    });
    expect([400, 500]).toContain(r.status);
  });

  test('rejects request without url field', async () => {
    const r = await fetch(`${FUNCTIONS_URL}/ical-proxy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(r.status).toBe(400);
    const j = await r.json();
    expect(j.error).toMatch(/missing.*url/i);
  });

  test('rejects URL with non-https scheme', async () => {
    const r = await fetch(`${FUNCTIONS_URL}/ical-proxy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'http://example.com/file.ics' }),
    });
    expect(r.status).toBe(403);
  });

  test('rejects URL outside the allowlist', async () => {
    const r = await fetch(`${FUNCTIONS_URL}/ical-proxy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'https://evil-host.example.com/file.ics' }),
    });
    expect(r.status).toBe(403);
  });

  test('rejects internal IP (SSRF attempt)', async () => {
    const r = await fetch(`${FUNCTIONS_URL}/ical-proxy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'https://169.254.169.254/' }), // AWS metadata
    });
    expect(r.status).toBe(403);
  });

  test('rejects file:// (SSRF attempt)', async () => {
    const r = await fetch(`${FUNCTIONS_URL}/ical-proxy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'file:///etc/passwd' }),
    });
    expect(r.status).toBe(403);
  });

  test('handles OPTIONS preflight (CORS)', async () => {
    const r = await fetch(`${FUNCTIONS_URL}/ical-proxy`, { method: 'OPTIONS' });
    expect(r.status).toBe(200);
    expect(r.headers.get('access-control-allow-origin')).toBeTruthy();
    expect(r.headers.get('access-control-allow-methods') || '').toContain('POST');
  });
});

// ── auto-bill: requires auth ──
test.describe('auto-bill requires auth', () => {
  test('rejects unauthenticated POST', async () => {
    const r = await fetch(`${FUNCTIONS_URL}/auto-bill`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect([401, 403, 404]).toContain(r.status);
  });

  test('rejects POST with garbage Authorization header', async () => {
    const r = await fetch(`${FUNCTIONS_URL}/auto-bill`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer notavalidtoken' },
      body: JSON.stringify({}),
    });
    expect([401, 403, 404]).toContain(r.status);
  });
});

// ── send-email: requires auth + valid template ──
test.describe('send-email requires auth', () => {
  test('rejects unauthenticated POST', async () => {
    const r = await fetch(`${FUNCTIONS_URL}/send-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: 'attacker@test.local', subject: 'X', body: 'Y' }),
    });
    expect([401, 403, 404]).toContain(r.status);
  });
});

// ── refresh-ical: requires service_role or cron secret ──
test.describe('refresh-ical access control', () => {
  test('rejects POST with no auth and no secret', async () => {
    const r = await fetch(`${FUNCTIONS_URL}/refresh-ical`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect([401, 403, 404]).toContain(r.status);
  });

  test('rejects POST with wrong secret query param', async () => {
    const r = await fetch(`${FUNCTIONS_URL}/refresh-ical?secret=wrong`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect([401, 403, 404]).toContain(r.status);
  });
});

// ── delete-account: requires user JWT ──
test.describe('delete-account requires user auth', () => {
  test('rejects unauthenticated POST', async () => {
    const r = await fetch(`${FUNCTIONS_URL}/delete-account`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect([401, 403, 404]).toContain(r.status);
  });
});

// ── change-subscription / create-portal / create-checkout: auth required ──
for (const fn of ['change-subscription', 'create-portal', 'create-checkout']) {
  test.describe(`${fn} requires auth`, () => {
    test('rejects unauthenticated POST', async () => {
      const r = await fetch(`${FUNCTIONS_URL}/${fn}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      expect([401, 403, 404]).toContain(r.status);
    });
  });
}

// ── stripe-webhook: requires valid signature (covered by flow-rgpd-stripe.spec.js) ──
// ── email-unsubscribe: public endpoint ──
test.describe('email-unsubscribe is publicly callable', () => {
  test('accepts GET with unsubscribe token (or rejects gracefully)', async () => {
    const r = await fetch(`${FUNCTIONS_URL}/email-unsubscribe?token=invalid`, {
      method: 'GET',
    });
    // Either 200 (no-op for invalid token, idempotent UX) or 4xx (validation)
    expect(r.status).toBeLessThan(500);
  });
});
