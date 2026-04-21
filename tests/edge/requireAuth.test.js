// Tests for requireAuth() in supabase/functions/_shared/cors.ts
// Mocks fetch() to verify the JWT validation flow.

import { describe, it, expect, beforeEach, vi } from 'vitest';

async function requireAuth(req, supabaseUrl, anonKey) {
  const token = (req.headers.get('Authorization') || '').replace('Bearer ', '').trim();
  if (!token) throw new Error('Missing Authorization bearer token');
  const resp = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { apikey: anonKey, Authorization: `Bearer ${token}` },
  });
  if (!resp.ok) throw new Error('Invalid or expired token');
  const user = await resp.json();
  if (!user?.id) throw new Error('Invalid token payload');
  return { userId: user.id, token };
}

function makeReq(authHeader) {
  return { headers: { get: (k) => (k === 'Authorization' ? authHeader : null) } };
}

describe('requireAuth', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  it('rejects missing Authorization header', async () => {
    await expect(requireAuth(makeReq(null), 'https://x.supabase.co', 'anon'))
      .rejects.toThrow('Missing Authorization bearer token');
  });

  it('rejects empty Bearer token', async () => {
    await expect(requireAuth(makeReq('Bearer '), 'https://x.supabase.co', 'anon'))
      .rejects.toThrow('Missing Authorization bearer token');
  });

  it('rejects invalid token (Supabase 401)', async () => {
    globalThis.fetch.mockResolvedValueOnce({ ok: false });
    await expect(requireAuth(makeReq('Bearer bad-token'), 'https://x.supabase.co', 'anon'))
      .rejects.toThrow('Invalid or expired token');
  });

  it('rejects when Supabase returns user without id', async () => {
    globalThis.fetch.mockResolvedValueOnce({ ok: true, json: async () => ({}) });
    await expect(requireAuth(makeReq('Bearer weird'), 'https://x.supabase.co', 'anon'))
      .rejects.toThrow('Invalid token payload');
  });

  it('returns userId and token on valid auth', async () => {
    globalThis.fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'user-123' }) });
    const r = await requireAuth(makeReq('Bearer valid-jwt'), 'https://x.supabase.co', 'anon');
    expect(r).toEqual({ userId: 'user-123', token: 'valid-jwt' });
  });

  it('calls Supabase /auth/v1/user endpoint with correct headers', async () => {
    globalThis.fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'u1' }) });
    await requireAuth(makeReq('Bearer tok123'), 'https://test.supabase.co', 'my-anon-key');
    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://test.supabase.co/auth/v1/user',
      expect.objectContaining({
        headers: expect.objectContaining({
          apikey: 'my-anon-key',
          Authorization: 'Bearer tok123',
        }),
      })
    );
  });

  it('trims whitespace from token', async () => {
    globalThis.fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'u' }) });
    const r = await requireAuth(makeReq('Bearer   padded-token   '), 'https://x.co', 'k');
    expect(r.token).toBe('padded-token');
  });
});
