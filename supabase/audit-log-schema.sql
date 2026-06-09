-- ══════════════════════════════════════════════════════════════
-- Audit log (v9.73 Quick Win #4)
-- Captures sensitive actions for forensics + compliance.
-- Service-role insert only (Edge Functions). Super_admin read.
-- ══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ts timestamptz NOT NULL DEFAULT now(),
  user_id uuid,                                 -- actor; nullable for system actions
  org_id uuid,                                  -- impacted org
  action text NOT NULL,                         -- e.g. 'stripe.refund', 'iban.change', 'invoice.create', 'login.suspicious'
  resource_type text,                           -- e.g. 'invoice', 'member', 'stripe_account'
  resource_id text,                             -- the impacted row id
  ip text,                                      -- client IP if known
  user_agent text,                              -- client UA if known
  metadata jsonb,                               -- contextual fields (amounts, before/after, etc.)
  severity text DEFAULT 'info'                  -- 'info' | 'warning' | 'critical'
);

CREATE INDEX IF NOT EXISTS idx_audit_log_ts ON public.audit_log(ts DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_user ON public.audit_log(user_id, ts DESC) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_audit_log_org ON public.audit_log(org_id, ts DESC) WHERE org_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_audit_log_action ON public.audit_log(action, ts DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_severity ON public.audit_log(severity, ts DESC) WHERE severity IN ('warning', 'critical');

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- Only super_admins can read
DROP POLICY IF EXISTS "Super admins read audit_log" ON public.audit_log;
CREATE POLICY "Super admins read audit_log" ON public.audit_log
  FOR SELECT USING (auth.uid() IN (SELECT user_id FROM public.super_admins));

-- No one inserts via PostgREST — only service_role (bypasses RLS by design).
-- This way, the audit trail cannot be tampered with by users.

-- ══════════════════════════════════════════════════════════════
-- Rate limits (Quick Win #1, #2)
-- ══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.rate_limits (
  user_id uuid NOT NULL,
  bucket text NOT NULL,                         -- 'send_email_h', 'stripe_payment_create_min', etc.
  window_start timestamptz NOT NULL,
  count integer NOT NULL DEFAULT 1,
  PRIMARY KEY (user_id, bucket, window_start)
);

CREATE INDEX IF NOT EXISTS idx_rate_limits_user_bucket ON public.rate_limits(user_id, bucket, window_start DESC);

-- Cleanup helper: keep last 24h only
CREATE OR REPLACE FUNCTION public.cleanup_old_rate_limits()
RETURNS void AS $$
BEGIN
  DELETE FROM public.rate_limits WHERE window_start < now() - interval '24 hours';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RLS: service_role only (Edge Functions). Users never see this.
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;
-- No SELECT policy = no user can read.

-- ══════════════════════════════════════════════════════════════
-- Profile reports (Quick Win #6 - DSA art. 16)
-- ══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.profile_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ts timestamptz NOT NULL DEFAULT now(),
  reported_profile_id uuid NOT NULL,            -- the marketplace_profiles.id being reported
  reported_user_id uuid,                        -- copy of profile.user_id for fast lookup
  reporter_user_id uuid NOT NULL,               -- who's reporting
  category text NOT NULL,                       -- 'fake_profile' | 'scam' | 'inappropriate' | 'other'
  description text,                             -- free text from reporter
  status text NOT NULL DEFAULT 'pending',       -- 'pending' | 'reviewed' | 'actioned' | 'dismissed'
  reviewed_by uuid,
  reviewed_at timestamptz,
  resolution_note text
);

CREATE INDEX IF NOT EXISTS idx_profile_reports_status ON public.profile_reports(status, ts DESC);
CREATE INDEX IF NOT EXISTS idx_profile_reports_profile ON public.profile_reports(reported_profile_id, ts DESC);

ALTER TABLE public.profile_reports ENABLE ROW LEVEL SECURITY;
-- Users can insert their own reports
DROP POLICY IF EXISTS "Users insert own reports" ON public.profile_reports;
CREATE POLICY "Users insert own reports" ON public.profile_reports
  FOR INSERT WITH CHECK (auth.uid() = reporter_user_id);
-- Users can read their own reports
DROP POLICY IF EXISTS "Users read own reports" ON public.profile_reports;
CREATE POLICY "Users read own reports" ON public.profile_reports
  FOR SELECT USING (auth.uid() = reporter_user_id);
-- Super_admins read all + update
DROP POLICY IF EXISTS "Super admins manage reports" ON public.profile_reports;
CREATE POLICY "Super admins manage reports" ON public.profile_reports
  FOR ALL USING (auth.uid() IN (SELECT user_id FROM public.super_admins));

-- ══════════════════════════════════════════════════════════════
-- Cleaning signature (Quick Win #7 - anti-dispute evidence)
-- Added on cleaning_validations table if it exists.
-- ══════════════════════════════════════════════════════════════

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='cleaning_validations') THEN
    EXECUTE 'ALTER TABLE public.cleaning_validations
      ADD COLUMN IF NOT EXISTS signature_received_at timestamptz,
      ADD COLUMN IF NOT EXISTS signature_received_by_user_id uuid,
      ADD COLUMN IF NOT EXISTS signature_method text';
  END IF;
END $$;

-- Verification
SELECT 'audit_log' AS t, count(*) AS rows FROM public.audit_log
UNION ALL SELECT 'rate_limits', count(*) FROM public.rate_limits
UNION ALL SELECT 'profile_reports', count(*) FROM public.profile_reports;
