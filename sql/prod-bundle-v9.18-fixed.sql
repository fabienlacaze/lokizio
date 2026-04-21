-- Lokizio PROD v9.18 bundle — adapted to actual prod schema

-- 0. Helpers
CREATE OR REPLACE FUNCTION public.user_org_id() RETURNS uuid AS $$
  SELECT org_id FROM public.members WHERE user_id = auth.uid() AND accepted = true LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.user_role() RETURNS text AS $$
  SELECT role FROM public.members WHERE user_id = auth.uid() AND accepted = true LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- 1a. Add missing columns to service_requests
ALTER TABLE service_requests ADD COLUMN IF NOT EXISTS provider_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE service_requests ADD COLUMN IF NOT EXISTS assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE service_requests ADD COLUMN IF NOT EXISTS assigned_provider_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE service_requests ADD COLUMN IF NOT EXISTS direct_to_owner boolean DEFAULT false;

-- 1b. RLS service_requests
DROP POLICY IF EXISTS "Members can update service requests" ON service_requests;
DROP POLICY IF EXISTS "Admin/concierge update service requests" ON service_requests;
CREATE POLICY "Admin/concierge update service requests" ON service_requests FOR UPDATE
  USING (
    org_id = public.user_org_id()
    AND public.user_role() IN ('admin','manager','concierge')
  );

DROP POLICY IF EXISTS "Provider update own service requests" ON service_requests;
CREATE POLICY "Provider update own service requests" ON service_requests FOR UPDATE
  USING (
    org_id = public.user_org_id()
    AND public.user_role() = 'provider'
    AND (provider_id = auth.uid() OR assigned_to = auth.uid())
  );

-- 1c. cleaning_validations
DROP POLICY IF EXISTS "Members can update validations" ON cleaning_validations;
DROP POLICY IF EXISTS "Admin/concierge update validations" ON cleaning_validations;
CREATE POLICY "Admin/concierge update validations" ON cleaning_validations FOR UPDATE
  USING (
    property_id IN (SELECT id FROM properties WHERE org_id = public.user_org_id())
    AND public.user_role() IN ('admin','manager','concierge')
  );

-- 2. messages context columns
ALTER TABLE messages ADD COLUMN IF NOT EXISTS property_id uuid REFERENCES properties(id) ON DELETE SET NULL;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS reservation_id uuid REFERENCES reservations(id) ON DELETE SET NULL;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS recipient_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_messages_property ON messages(property_id) WHERE property_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_messages_reservation ON messages(reservation_id) WHERE reservation_id IS NOT NULL;

DROP POLICY IF EXISTS "Tenant messages scoped" ON messages;
CREATE POLICY "Tenant messages scoped" ON messages FOR SELECT
  USING (
    (public.user_role() IN ('admin','manager','concierge','owner','provider') AND org_id = public.user_org_id())
    OR
    (public.user_role() = 'tenant' AND (
      sender_id = auth.uid()
      OR recipient_user_id = auth.uid()
      OR reservation_id IN (SELECT id FROM reservations WHERE tenant_user_id = auth.uid())
      OR property_id IN (SELECT property_id FROM reservations WHERE tenant_user_id = auth.uid() AND status = 'active')
    ))
  );

-- 3. connection_requests anti-duplicate
CREATE UNIQUE INDEX IF NOT EXISTS idx_connection_requests_unique_active
  ON connection_requests (
    LEAST(sender_id, receiver_id),
    GREATEST(sender_id, receiver_id)
  )
  WHERE status IN ('pending', 'accepted');

-- 4. app_settings (legal infos)
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
