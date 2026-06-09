// Production origins are always allowed. Local development origins are only
// allowed when ENV=dev (set in Supabase secrets for the dev project), so prod
// never accepts requests from a malicious localhost server.
const PROD_ORIGINS = [
  'https://fabienlacaze.github.io',
];
const DEV_ORIGINS = [
  'http://localhost:8000',
  'http://127.0.0.1:8000',
  'http://localhost:5173',
];

function getAllowedOrigins(): string[] {
  const env = (Deno.env.get('ENV') || '').toLowerCase();
  if (env === 'dev' || env === 'development' || env === 'test') {
    return [...PROD_ORIGINS, ...DEV_ORIGINS];
  }
  // Auto-detect Stripe test mode: if STRIPE_SECRET_KEY starts with sk_test_,
  // localhost is fine — we're not handling real money. requireAuth still gates
  // every call by JWT, so this isn't an open door.
  const stripeKey = Deno.env.get('STRIPE_SECRET_KEY') || '';
  if (stripeKey.startsWith('sk_test_')) {
    return [...PROD_ORIGINS, ...DEV_ORIGINS];
  }
  return PROD_ORIGINS;
}

export function corsHeaders(req: Request): Record<string, string> {
  const allowedOrigins = getAllowedOrigins();
  const origin = req.headers.get('Origin') || '';
  const allowed = allowedOrigins.includes(origin) ? origin : allowedOrigins[0];
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Vary': 'Origin',
  };
}

export async function requireAuth(req: Request, supabaseUrl: string, anonKey: string): Promise<{ userId: string; token: string }> {
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
