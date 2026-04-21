-- Fix: policies that SELECT from `members` inside a policy on `members` itself
-- cause infinite recursion. Use the SECURITY DEFINER helpers instead, which
-- bypass RLS on their internal SELECT.

-- Drop the problematic self-referencing policies
DROP POLICY IF EXISTS "Members view org members" ON members;
DROP POLICY IF EXISTS "Members view properties" ON properties;
DROP POLICY IF EXISTS "Members view invoices" ON invoices;
DROP POLICY IF EXISTS "Members view service requests" ON service_requests;
DROP POLICY IF EXISTS "Staff view reservations" ON reservations;
DROP POLICY IF EXISTS "Members view validations" ON cleaning_validations;
DROP POLICY IF EXISTS "Members view org" ON organizations;
DROP POLICY IF EXISTS "Messages scoped by role" ON messages;

-- Recreate using the SECURITY DEFINER helper (no recursion)
CREATE POLICY "Members view org members" ON members FOR SELECT
  USING (org_id = public.user_org_id());

CREATE POLICY "Members view properties" ON properties FOR SELECT
  USING (org_id = public.user_org_id());

CREATE POLICY "Members view invoices" ON invoices FOR SELECT
  USING (org_id = public.user_org_id());

CREATE POLICY "Members view service requests" ON service_requests FOR SELECT
  USING (org_id = public.user_org_id());

CREATE POLICY "Staff view reservations" ON reservations FOR SELECT
  USING (org_id = public.user_org_id() OR tenant_user_id = auth.uid());

CREATE POLICY "Members view validations" ON cleaning_validations FOR SELECT
  USING (property_id IN (
    SELECT id FROM properties WHERE org_id = public.user_org_id()
  ));

CREATE POLICY "Members view org" ON organizations FOR SELECT
  USING (id = public.user_org_id());

-- Messages: same trick - use helper instead of subquery on members
CREATE POLICY "Messages scoped by role" ON messages FOR SELECT
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

NOTIFY pgrst, 'reload schema';
