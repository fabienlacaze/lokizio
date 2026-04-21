-- ══════════════════════════════════════════════════════════════════════════════
-- Lokizio PROD migration bundle — v9.18 (security + data-leak fixes)
-- A executer UNE SEULE FOIS dans le SQL Editor de ton projet PROD
-- (mrvejwyvhuivmipfwlzz.supabase.co)
--
-- Ce bundle applique :
-- 1. RLS service_requests : provider ne peut update que ses propres requests
-- 2. Messages : colonnes property_id + reservation_id + recipient_user_id pour
--    scoper les messages tenant par reservation (fix fuite de donnees)
-- 3. connection_requests : index unique partiel anti-doublon
--
-- ══════════════════════════════════════════════════════════════════════════════

-- ─── 0. Ensure RLS helpers exist (idempotent, safe to re-run) ───
-- These SECURITY DEFINER helpers are used by all policies below to avoid
-- infinite recursion (policy on members cannot SELECT from members).
-- Placed in public schema because the Supabase dashboard SQL editor
-- denies CREATE FUNCTION in the auth schema.

CREATE OR REPLACE FUNCTION public.user_org_id() RETURNS uuid AS $$
  SELECT org_id FROM public.members WHERE user_id = auth.uid() AND accepted = true LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.user_role() RETURNS text AS $$
  SELECT role FROM public.members WHERE user_id = auth.uid() AND accepted = true LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ─── 1. fix-service-requests-rls.sql ───

DROP POLICY IF EXISTS "Members can update service requests" ON service_requests;
DROP POLICY IF EXISTS "Admin/concierge update service requests" ON service_requests;
CREATE POLICY "Admin/concierge update service requests" ON service_requests FOR UPDATE
  USING (
    org_id = public.user_org_id()
    AND public.user_role() IN ('admin', 'manager', 'concierge')
  );

DROP POLICY IF EXISTS "Provider update own service requests" ON service_requests;
CREATE POLICY "Provider update own service requests" ON service_requests FOR UPDATE
  USING (
    org_id = public.user_org_id()
    AND public.user_role() = 'provider'
    AND (provider_id = auth.uid() OR assigned_to = auth.uid())
  );

-- Cleaning validations: seul admin/concierge peut valider (anti-fraude)
DROP POLICY IF EXISTS "Members can update validations" ON cleaning_validations;
DROP POLICY IF EXISTS "Admin/concierge update validations" ON cleaning_validations;
CREATE POLICY "Admin/concierge update validations" ON cleaning_validations FOR UPDATE
  USING (
    property_id IN (SELECT id FROM properties WHERE org_id = public.user_org_id())
    AND public.user_role() IN ('admin', 'manager', 'concierge')
  );

-- ─── 2. add-messages-context-columns.sql ───

ALTER TABLE messages ADD COLUMN IF NOT EXISTS property_id uuid REFERENCES properties(id) ON DELETE SET NULL;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS reservation_id uuid REFERENCES reservations(id) ON DELETE SET NULL;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS recipient_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_messages_property ON messages(property_id) WHERE property_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_messages_reservation ON messages(reservation_id) WHERE reservation_id IS NOT NULL;

-- RLS tenant chat: filtrage par reservation/property (fix fuite)
DROP POLICY IF EXISTS "Tenant messages scoped" ON messages;
CREATE POLICY "Tenant messages scoped" ON messages FOR SELECT
  USING (
    -- Staff voit tout l'org
    (public.user_role() IN ('admin','manager','concierge','owner','provider') AND org_id = public.user_org_id())
    OR
    -- Tenant: uniquement sa reservation/property + messages a lui
    (public.user_role() = 'tenant' AND (
      sender_id = auth.uid()
      OR recipient_user_id = auth.uid()
      OR reservation_id IN (SELECT id FROM reservations WHERE tenant_user_id = auth.uid())
      OR property_id IN (SELECT property_id FROM reservations WHERE tenant_user_id = auth.uid() AND status = 'active')
    ))
  );

-- ─── 3. add-connection-requests-unique.sql ───

CREATE UNIQUE INDEX IF NOT EXISTS idx_connection_requests_unique_active
  ON connection_requests (
    LEAST(sender_id, receiver_id),
    GREATEST(sender_id, receiver_id)
  )
  WHERE status IN ('pending', 'accepted');

-- ─── 4. app_settings table (legal infos) ───
-- This table is used by legal.js to persist mentions / CGU / CGV / privacy page values.
-- Single row with id=1.

CREATE TABLE IF NOT EXISTS app_settings (
  id int PRIMARY KEY,
  company_name text,
  legal_status text,
  siret text,
  tva_number text,
  address text,
  director_name text,
  contact_email text,
  mediator text,
  price_pro numeric(8,2),
  price_business numeric(8,2),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated read app_settings" ON app_settings;
CREATE POLICY "Authenticated read app_settings" ON app_settings FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Super admin write app_settings" ON app_settings;
CREATE POLICY "Super admin write app_settings" ON app_settings FOR ALL
  USING (EXISTS (SELECT 1 FROM super_admins WHERE user_id = auth.uid()));

NOTIFY pgrst, 'reload schema';
