// Shared security helpers for Edge Functions (v9.73 sprint security).
//
// Exports:
//   audit(opts) — insert a row into public.audit_log (service_role).
//   checkRateLimit(opts) — sliding window rate limit; throws if exceeded.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

let _admin: ReturnType<typeof createClient> | null = null;
function getAdmin() {
  if (!_admin) _admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  return _admin;
}

export interface AuditOpts {
  user_id?: string | null;
  org_id?: string | null;
  action: string;                                    // e.g. 'stripe.refund', 'iban.change'
  resource_type?: string;
  resource_id?: string;
  ip?: string;
  user_agent?: string;
  metadata?: Record<string, unknown>;
  severity?: 'info' | 'warning' | 'critical';
}

export async function audit(opts: AuditOpts): Promise<void> {
  try {
    const admin = getAdmin();
    await admin.from('audit_log').insert({
      user_id: opts.user_id || null,
      org_id: opts.org_id || null,
      action: opts.action,
      resource_type: opts.resource_type || null,
      resource_id: opts.resource_id || null,
      ip: opts.ip || null,
      user_agent: opts.user_agent || null,
      metadata: opts.metadata || null,
      severity: opts.severity || 'info',
    });
  } catch (e) {
    // Audit failure must never break the calling function. Log and continue.
    console.error('audit() failed:', e, 'opts:', opts);
  }
}

export interface RateLimitOpts {
  user_id: string;
  bucket: string;                                    // unique identifier for the action being limited
  max_per_window: number;                            // e.g. 50
  window_seconds: number;                            // e.g. 3600 for 1h
}

export interface RateLimitResult {
  allowed: boolean;
  count: number;
  limit: number;
  reset_at: string;                                  // ISO timestamp when count resets
}

// Sliding window rate limiter using public.rate_limits table.
// Buckets are quantized to window_seconds for predictable counting.
export async function checkRateLimit(opts: RateLimitOpts): Promise<RateLimitResult> {
  const now = Date.now();
  const windowMs = opts.window_seconds * 1000;
  // Quantize to the start of the current window
  const windowStartMs = Math.floor(now / windowMs) * windowMs;
  const windowStart = new Date(windowStartMs).toISOString();
  const resetAt = new Date(windowStartMs + windowMs).toISOString();

  const admin = getAdmin();
  // Increment via upsert
  const { data, error } = await admin.rpc('increment_rate_limit', {
    p_user_id: opts.user_id,
    p_bucket: opts.bucket,
    p_window_start: windowStart,
  });
  let count: number;
  if (error || data == null) {
    // Fallback: manual upsert (RPC may not be deployed yet)
    const { data: row } = await admin
      .from('rate_limits')
      .select('count')
      .eq('user_id', opts.user_id)
      .eq('bucket', opts.bucket)
      .eq('window_start', windowStart)
      .maybeSingle();
    const newCount = (row?.count || 0) + 1;
    await admin.from('rate_limits').upsert({
      user_id: opts.user_id,
      bucket: opts.bucket,
      window_start: windowStart,
      count: newCount,
    }, { onConflict: 'user_id,bucket,window_start' });
    count = newCount;
  } else {
    count = Number(data);
  }

  return {
    allowed: count <= opts.max_per_window,
    count,
    limit: opts.max_per_window,
    reset_at: resetAt,
  };
}

// Helper: throw a 429 Response if rate limit exceeded.
export async function enforceRateLimit(opts: RateLimitOpts, cors: Record<string, string>): Promise<Response | null> {
  const result = await checkRateLimit(opts);
  if (!result.allowed) {
    // Audit the rate limit hit
    audit({
      user_id: opts.user_id,
      action: 'rate_limit.exceeded',
      resource_type: opts.bucket,
      metadata: { count: result.count, limit: result.limit, reset_at: result.reset_at },
      severity: 'warning',
    }).catch(() => {});
    return Response.json({
      error: 'Rate limit exceeded',
      bucket: opts.bucket,
      limit: result.limit,
      count: result.count,
      reset_at: result.reset_at,
    }, {
      status: 429,
      headers: { ...cors, 'Retry-After': String(opts.window_seconds) },
    });
  }
  return null; // allowed
}
