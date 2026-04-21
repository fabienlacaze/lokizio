-- Fix: ensure authenticated users can create orgs + their own member row
-- during onboarding (first login auto-creates an organization).

-- Organizations: any authenticated user can insert
DROP POLICY IF EXISTS "Authenticated create org" ON organizations;
CREATE POLICY "Authenticated create org" ON organizations FOR INSERT
  TO authenticated WITH CHECK (true);

-- Members: authenticated user can insert themselves (self-join) OR admin can invite
DROP POLICY IF EXISTS "Admin insert member" ON members;
CREATE POLICY "Admin insert member" ON members FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR org_id = public.user_org_id());

-- Subscriptions: own
DROP POLICY IF EXISTS "Own subscription" ON subscriptions;
CREATE POLICY "Own subscription" ON subscriptions FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

NOTIFY pgrst, 'reload schema';
