-- Fix RLS service_requests: restreindre UPDATE aux admin/concierge + provider sur ses propres requests
-- A executer dans le SQL editor Supabase apres le setup-rls-complete.sql existant.

DROP POLICY IF EXISTS "Members can update service requests" ON service_requests;
DROP POLICY IF EXISTS "Admin/concierge update service requests" ON service_requests;
CREATE POLICY "Admin/concierge update service requests" ON service_requests FOR UPDATE
  USING (
    org_id = auth.user_org_id()
    AND auth.user_role() IN ('admin', 'manager', 'concierge')
  );

DROP POLICY IF EXISTS "Provider update own service requests" ON service_requests;
CREATE POLICY "Provider update own service requests" ON service_requests FOR UPDATE
  USING (
    org_id = auth.user_org_id()
    AND auth.user_role() = 'provider'
    AND (provider_id = auth.uid() OR assigned_to = auth.uid())
  );

-- Cleaning validations: seul admin/concierge peut valider (anti-fraude)
DROP POLICY IF EXISTS "Members can update validations" ON cleaning_validations;
DROP POLICY IF EXISTS "Admin/concierge update validations" ON cleaning_validations;
CREATE POLICY "Admin/concierge update validations" ON cleaning_validations FOR UPDATE
  USING (
    property_id IN (SELECT id FROM properties WHERE org_id = auth.user_org_id())
    AND auth.user_role() IN ('admin', 'manager', 'concierge')
  );

NOTIFY pgrst, 'reload schema';
