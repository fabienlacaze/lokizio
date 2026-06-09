-- ══════════════════════════════════════════════════════════════
-- Test tooling tables (v9.74 — Sprint outils de test reel)
-- user_feedback : in-app feedback widget
-- demo_org_seed : tracking comptes demo et leur reset
-- ══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.user_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ts timestamptz NOT NULL DEFAULT now(),
  user_id uuid NOT NULL,
  rating integer,                                   -- 1-5, nullable
  text text NOT NULL,
  page_url text,
  user_agent text,
  screenshot_data_url text,                         -- base64 data URL, capped 2MB
  app_version text,
  status text NOT NULL DEFAULT 'new',               -- 'new' | 'triaged' | 'addressed' | 'dismissed'
  reply text,                                        -- super_admin notes
  CHECK (rating IS NULL OR (rating BETWEEN 1 AND 5))
);

CREATE INDEX IF NOT EXISTS idx_user_feedback_ts ON public.user_feedback(ts DESC);
CREATE INDEX IF NOT EXISTS idx_user_feedback_status ON public.user_feedback(status, ts DESC);
CREATE INDEX IF NOT EXISTS idx_user_feedback_user ON public.user_feedback(user_id, ts DESC);

ALTER TABLE public.user_feedback ENABLE ROW LEVEL SECURITY;

-- Users can read their own feedback
DROP POLICY IF EXISTS "Users read own feedback" ON public.user_feedback;
CREATE POLICY "Users read own feedback" ON public.user_feedback
  FOR SELECT USING (auth.uid() = user_id);

-- Super admins manage all
DROP POLICY IF EXISTS "Super admins manage feedback" ON public.user_feedback;
CREATE POLICY "Super admins manage feedback" ON public.user_feedback
  FOR ALL USING (auth.uid() IN (SELECT user_id FROM public.super_admins));

-- Insert via service_role only (Edge Function).

-- ══════════════════════════════════════════════════════════════
-- Demo seed tracking (optional, for nightly reset)
-- ══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.demo_org_state (
  org_id uuid PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_reset_at timestamptz,
  last_visitor_at timestamptz,
  visit_count integer NOT NULL DEFAULT 0
);

ALTER TABLE public.demo_org_state ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Super admins read demo_org_state" ON public.demo_org_state;
CREATE POLICY "Super admins read demo_org_state" ON public.demo_org_state
  FOR SELECT USING (auth.uid() IN (SELECT user_id FROM public.super_admins));

-- Verification
SELECT 'user_feedback' AS t, count(*) AS rows FROM public.user_feedback
UNION ALL SELECT 'demo_org_state', count(*) FROM public.demo_org_state;
