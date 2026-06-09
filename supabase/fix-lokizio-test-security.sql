-- ══════════════════════════════════════════════════════════════
-- Fix securite lokizio-test (njjaklfqmvspceoulgiu)
-- Repond aux alertes Supabase Security Advisor du 27/04/2026
-- A executer via: supabase db query --file ... --linked
-- ══════════════════════════════════════════════════════════════

-- ── 1. Supprimer la table de test inutile ──
DROP TABLE IF EXISTS public.test_minimal CASCADE;

-- ── 2. Supprimer la fonction exec_sql (dangereuse, permet SQL arbitraire) ──
DROP FUNCTION IF EXISTS public.exec_sql(text) CASCADE;

-- ── 3. Helpers RLS dans public (avec search_path fixe) ──
CREATE OR REPLACE FUNCTION public.user_org_id() RETURNS uuid AS $$
  SELECT org_id FROM public.members WHERE user_id = auth.uid() AND accepted = true LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

CREATE OR REPLACE FUNCTION public.user_role() RETURNS text AS $$
  SELECT role FROM public.members WHERE user_id = auth.uid() AND accepted = true LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

-- Revoquer EXECUTE sur ces helpers pour anon (pas besoin pour utilisateurs non-connectes)
REVOKE EXECUTE ON FUNCTION public.user_org_id() FROM anon;
REVOKE EXECUTE ON FUNCTION public.user_role() FROM anon;

-- ── 4. RLS sur billing_runs (sensible : tracking facturation) ──
ALTER TABLE public.billing_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members view own org billing_runs" ON public.billing_runs;
CREATE POLICY "Members view own org billing_runs" ON public.billing_runs FOR SELECT
  USING (org_id = public.user_org_id());

DROP POLICY IF EXISTS "Admin manage own org billing_runs" ON public.billing_runs;
CREATE POLICY "Admin manage own org billing_runs" ON public.billing_runs FOR ALL
  USING (org_id = public.user_org_id() AND public.user_role() IN ('admin', 'manager'))
  WITH CHECK (org_id = public.user_org_id() AND public.user_role() IN ('admin', 'manager'));

-- ── 5. RLS sur plannings (meme policy que prod) ──
ALTER TABLE public.plannings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can view plannings" ON public.plannings;
CREATE POLICY "Members can view plannings" ON public.plannings FOR SELECT
  USING (property_id IN (
    SELECT id FROM public.properties WHERE org_id IN (
      SELECT org_id FROM public.members WHERE user_id = auth.uid()
    )
  ));

DROP POLICY IF EXISTS "Admin can manage plannings" ON public.plannings;
CREATE POLICY "Admin can manage plannings" ON public.plannings FOR ALL
  USING (property_id IN (
    SELECT id FROM public.properties WHERE org_id = public.user_org_id()
  ))
  WITH CHECK (property_id IN (
    SELECT id FROM public.properties WHERE org_id = public.user_org_id()
  ));

-- ── 6. Verification ──
SELECT tablename, rowsecurity FROM pg_tables
WHERE schemaname = 'public' AND tablename IN ('billing_runs', 'plannings', 'test_minimal')
ORDER BY tablename;
