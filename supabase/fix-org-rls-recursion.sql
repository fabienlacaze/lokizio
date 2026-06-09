-- ══════════════════════════════════════════════════════════════
-- Fix recursion RLS sur organizations <-> members
-- ══════════════════════════════════════════════════════════════
-- PROBLEME :
-- La policy SELECT de "organizations" qui filtre via members,
-- combinee a la policy SELECT de "members" qui filtre via organizations,
-- creait une recursion infinie (PostgreSQL erreur 42P17).
-- Resultat : SELECT organizations renvoyait HTTP 500 et l'app
-- affichait "Erreur: organisation introuvable" au login.
--
-- SOLUTION :
-- Utiliser une fonction SECURITY DEFINER qui contourne RLS pour
-- evaluer l'appartenance du user aux organisations sans recursion.
-- ══════════════════════════════════════════════════════════════

-- 1. Helper: retourne tous les org_id du user courant (multi-org)
CREATE OR REPLACE FUNCTION public.user_org_ids() RETURNS SETOF uuid AS $$
  SELECT org_id FROM public.members
  WHERE user_id = auth.uid() AND accepted = true
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

REVOKE EXECUTE ON FUNCTION public.user_org_ids() FROM anon;

-- 2. Restaurer org_select_own avec scope strict via le helper
DROP POLICY IF EXISTS "org_select_own" ON public.organizations;
CREATE POLICY "org_select_own" ON public.organizations FOR SELECT
  USING (id IN (SELECT public.user_org_ids()));

-- 3. Verification : aucune ERROR au security advisor
-- (a verifier via : supabase db advisors --type security --linked)
