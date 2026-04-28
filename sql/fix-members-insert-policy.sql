-- Fix: allow concierges/admins/managers to add manual contacts (members)
-- to their org. The previous policy may have been restricted to self-join only.
--
-- A concierge adding a "manual contact" inserts a row with:
--   org_id = his org id, user_id = NULL, accepted = false
-- This must be allowed for the concierge of that org.

DROP POLICY IF EXISTS "Admin insert member" ON members;

CREATE POLICY "Admin insert member" ON members FOR INSERT TO authenticated
  WITH CHECK (
    -- Self-join: a user can always insert his own member row (onboarding)
    user_id = auth.uid()
    OR
    -- Admin/manager/concierge of the org can add anyone (manual contact, invite)
    (
      org_id = public.user_org_id()
      AND public.user_role() IN ('admin', 'manager', 'concierge')
    )
  );

NOTIFY pgrst, 'reload schema';
