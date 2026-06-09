-- ══════════════════════════════════════════════════════════════
-- Fix securite Lokizio PROD (mrvejwyvhuivmipfwlzz)
-- Repond aux warnings du Security Advisor
-- A executer via: supabase db query --file ... --linked
-- ══════════════════════════════════════════════════════════════
-- IDEMPOTENT : peut etre re-execute sans risque

-- ╔══════════════════════════════════════════════════════════════╗
-- ║ P1 : Supprimer les policies "always true" qui dupliquent     ║
-- ║       les vraies policies restrictives                        ║
-- ╚══════════════════════════════════════════════════════════════╝

-- ── messages ──
-- msg_select (always true) -> doublon de "Tenant messages scoped" qui est restrictive
DROP POLICY IF EXISTS "msg_select" ON public.messages;

-- msg_insert (always true) -> remplacer par une policy restrictive
-- Logique : un user peut envoyer un message si :
--   - il fait partie de l'org (membre interne)
--   - OU il est tenant et envoie depuis sa reservation
DROP POLICY IF EXISTS "msg_insert" ON public.messages;
DROP POLICY IF EXISTS "msg_insert_scoped" ON public.messages;
CREATE POLICY "msg_insert_scoped" ON public.messages FOR INSERT
  TO authenticated WITH CHECK (
    sender_id = auth.uid()
    AND (
      -- Membre de l'org (admin/manager/concierge/owner/provider)
      org_id IN (SELECT org_id FROM public.members WHERE user_id = auth.uid() AND accepted = true)
      -- OU tenant qui envoie depuis sa reservation
      OR EXISTS (
        SELECT 1 FROM public.reservations r
        WHERE r.tenant_user_id = auth.uid()
          AND (r.id = reservation_id OR r.property_id = property_id)
      )
      -- OU DM annuaire : envoi direct a un user identifie (recipient_user_id non null)
      OR (recipient_user_id IS NOT NULL)
    )
  );

-- ── organizations ──
-- org_select_own (always true) -> remplacer par scope sur les membres
DROP POLICY IF EXISTS "org_select_own" ON public.organizations;
CREATE POLICY "org_select_own" ON public.organizations FOR SELECT
  USING (id IN (SELECT org_id FROM public.members WHERE user_id = auth.uid() AND accepted = true));

-- org_update_own (always true) -> doublon de "organizations_update_members" qui est restrictive
DROP POLICY IF EXISTS "org_update_own" ON public.organizations;

-- ── properties ──
-- props_insert_any (always true) -> doublon de "props_insert" qui est restrictive
DROP POLICY IF EXISTS "props_insert_any" ON public.properties;

-- ╔══════════════════════════════════════════════════════════════╗
-- ║ P2 : Supprimer les fonctions de debug en prod                 ║
-- ╚══════════════════════════════════════════════════════════════╝
DROP FUNCTION IF EXISTS public.debug_check_insert(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.debug_who_am_i() CASCADE;
DROP FUNCTION IF EXISTS public.rls_auto_enable() CASCADE;

-- ╔══════════════════════════════════════════════════════════════╗
-- ║ P3 : Restreindre le bucket lokizio-photos                    ║
-- ║       (retirer le listing public, garder l'acces URL)         ║
-- ╚══════════════════════════════════════════════════════════════╝
-- Le bucket est public=true donc les URLs directes continuent a fonctionner.
-- On retire juste la possibilite de lister tous les fichiers.
DROP POLICY IF EXISTS "public_read" ON storage.objects;

-- ╔══════════════════════════════════════════════════════════════╗
-- ║ P4 : Fixer search_path des fonctions SECURITY DEFINER         ║
-- ╚══════════════════════════════════════════════════════════════╝

-- user_role : helper RLS, doit avoir search_path fixe
CREATE OR REPLACE FUNCTION public.user_role() RETURNS text AS $$
  SELECT role FROM public.members WHERE user_id = auth.uid() AND accepted = true LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

-- increment_cleanings_done : on lit la signature actuelle pour la preserver
-- (recreation avec ALTER pour ne pas casser le corps)
ALTER FUNCTION public.increment_cleanings_done(uuid) SET search_path = public;

-- ╔══════════════════════════════════════════════════════════════╗
-- ║ VERIFICATION FINALE                                           ║
-- ╚══════════════════════════════════════════════════════════════╝
SELECT
  tablename,
  policyname,
  cmd,
  CASE WHEN qual = 'true' OR with_check = 'true' THEN '⚠️  ALWAYS TRUE' ELSE 'ok' END AS status
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('messages', 'organizations', 'properties')
  AND (qual = 'true' OR with_check = 'true')
ORDER BY tablename, cmd, policyname;
