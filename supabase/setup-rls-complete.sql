-- ══════════════════════════════════════════════════════════════
-- Lokizio - RLS (Row Level Security) complet pour TOUTES les tables
-- A executer dans Supabase SQL Editor
-- GRATUIT - inclus dans le plan Supabase Free
-- ══════════════════════════════════════════════════════════════

-- Helper: fonction pour obtenir l'org_id de l'utilisateur courant
CREATE OR REPLACE FUNCTION auth.user_org_id() RETURNS uuid AS $$
  SELECT org_id FROM public.members WHERE user_id = auth.uid() AND accepted = true LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Helper: fonction pour obtenir le role de l'utilisateur courant
CREATE OR REPLACE FUNCTION auth.user_role() RETURNS text AS $$
  SELECT role FROM public.members WHERE user_id = auth.uid() AND accepted = true LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ══════════════════════════════════════════════════════════════
-- TABLE: organizations
-- ══════════════════════════════════════════════════════════════
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;

-- Membre de l'org peut voir son organisation
DROP POLICY IF EXISTS "Members can view own org" ON organizations;
CREATE POLICY "Members can view own org" ON organizations FOR SELECT
  USING (id IN (SELECT org_id FROM members WHERE user_id = auth.uid()));

-- Admin peut modifier son org
DROP POLICY IF EXISTS "Admin can update own org" ON organizations;
CREATE POLICY "Admin can update own org" ON organizations FOR UPDATE
  USING (id = auth.user_org_id() AND auth.user_role() IN ('admin', 'manager'));

-- Tout utilisateur authentifie peut creer une org (inscription)
DROP POLICY IF EXISTS "Authenticated can create org" ON organizations;
CREATE POLICY "Authenticated can create org" ON organizations FOR INSERT
  TO authenticated WITH CHECK (true);

-- ══════════════════════════════════════════════════════════════
-- TABLE: members
-- ══════════════════════════════════════════════════════════════
ALTER TABLE members ENABLE ROW LEVEL SECURITY;

-- Membres de la meme org peuvent se voir
DROP POLICY IF EXISTS "Members can view org members" ON members;
CREATE POLICY "Members can view org members" ON members FOR SELECT
  USING (org_id IN (SELECT org_id FROM members WHERE user_id = auth.uid()));

-- Admin peut ajouter des membres
DROP POLICY IF EXISTS "Admin can add members" ON members;
CREATE POLICY "Admin can add members" ON members FOR INSERT
  TO authenticated WITH CHECK (
    org_id = auth.user_org_id()
    OR NOT EXISTS (SELECT 1 FROM members WHERE user_id = auth.uid())
  );

-- Admin peut modifier les membres + un membre peut modifier son propre profil
DROP POLICY IF EXISTS "Admin or self can update member" ON members;
CREATE POLICY "Admin or self can update member" ON members FOR UPDATE
  USING (
    (org_id = auth.user_org_id() AND auth.user_role() IN ('admin', 'manager'))
    OR user_id = auth.uid()
  );

-- Admin peut supprimer des membres
DROP POLICY IF EXISTS "Admin can delete members" ON members;
CREATE POLICY "Admin can delete members" ON members FOR DELETE
  USING (org_id = auth.user_org_id() AND auth.user_role() IN ('admin', 'manager'));

-- ══════════════════════════════════════════════════════════════
-- TABLE: properties
-- ══════════════════════════════════════════════════════════════
ALTER TABLE properties ENABLE ROW LEVEL SECURITY;

-- Membres de l'org peuvent voir les proprietes
DROP POLICY IF EXISTS "Members can view org properties" ON properties;
CREATE POLICY "Members can view org properties" ON properties FOR SELECT
  USING (org_id IN (SELECT org_id FROM members WHERE user_id = auth.uid()));

-- Admin peut creer/modifier/supprimer des proprietes
DROP POLICY IF EXISTS "Admin can manage properties" ON properties;
CREATE POLICY "Admin can manage properties" ON properties FOR INSERT
  TO authenticated WITH CHECK (org_id = auth.user_org_id());

DROP POLICY IF EXISTS "Admin can update properties" ON properties;
CREATE POLICY "Admin can update properties" ON properties FOR UPDATE
  USING (org_id = auth.user_org_id() AND auth.user_role() IN ('admin', 'manager', 'owner'));

DROP POLICY IF EXISTS "Admin can delete properties" ON properties;
CREATE POLICY "Admin can delete properties" ON properties FOR DELETE
  USING (org_id = auth.user_org_id() AND auth.user_role() IN ('admin', 'manager'));

-- ══════════════════════════════════════════════════════════════
-- TABLE: plannings
-- ══════════════════════════════════════════════════════════════
ALTER TABLE plannings ENABLE ROW LEVEL SECURITY;

-- Membres de l'org peuvent voir les plannings
DROP POLICY IF EXISTS "Members can view plannings" ON plannings;
CREATE POLICY "Members can view plannings" ON plannings FOR SELECT
  USING (property_id IN (SELECT id FROM properties WHERE org_id IN (SELECT org_id FROM members WHERE user_id = auth.uid())));

-- Admin peut modifier les plannings
DROP POLICY IF EXISTS "Admin can manage plannings" ON plannings;
CREATE POLICY "Admin can manage plannings" ON plannings FOR ALL
  USING (property_id IN (SELECT id FROM properties WHERE org_id = auth.user_org_id()));

-- ══════════════════════════════════════════════════════════════
-- TABLE: service_requests
-- ══════════════════════════════════════════════════════════════
ALTER TABLE service_requests ENABLE ROW LEVEL SECURITY;

-- Membres de l'org peuvent voir les service requests
DROP POLICY IF EXISTS "Members can view service requests" ON service_requests;
CREATE POLICY "Members can view service requests" ON service_requests FOR SELECT
  USING (org_id IN (SELECT org_id FROM members WHERE user_id = auth.uid()));

-- Admin ou owner peuvent creer des service requests
DROP POLICY IF EXISTS "Admin/owner can create service requests" ON service_requests;
CREATE POLICY "Admin/owner can create service requests" ON service_requests FOR INSERT
  TO authenticated WITH CHECK (org_id = auth.user_org_id());

-- Admin/concierge peut modifier toutes les requests de l'org.
-- Provider peut modifier UNIQUEMENT les requests qui lui sont assignees.
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

-- Admin peut supprimer
DROP POLICY IF EXISTS "Admin can delete service requests" ON service_requests;
CREATE POLICY "Admin can delete service requests" ON service_requests FOR DELETE
  USING (org_id = auth.user_org_id() AND auth.user_role() IN ('admin', 'manager'));

-- ══════════════════════════════════════════════════════════════
-- TABLE: cleaning_validations
-- ══════════════════════════════════════════════════════════════
ALTER TABLE cleaning_validations ENABLE ROW LEVEL SECURITY;

-- Membres peuvent voir les validations de leur org
DROP POLICY IF EXISTS "Members can view validations" ON cleaning_validations;
CREATE POLICY "Members can view validations" ON cleaning_validations FOR SELECT
  USING (property_id IN (SELECT id FROM properties WHERE org_id IN (SELECT org_id FROM members WHERE user_id = auth.uid())));

-- Membres peuvent creer/modifier les validations
DROP POLICY IF EXISTS "Members can manage validations" ON cleaning_validations;
CREATE POLICY "Members can manage validations" ON cleaning_validations FOR ALL
  USING (property_id IN (SELECT id FROM properties WHERE org_id IN (SELECT org_id FROM members WHERE user_id = auth.uid())));

-- ══════════════════════════════════════════════════════════════
-- TABLE: invoices
-- ══════════════════════════════════════════════════════════════
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

-- Membres de l'org peuvent voir les factures
DROP POLICY IF EXISTS "Members can view invoices" ON invoices;
CREATE POLICY "Members can view invoices" ON invoices FOR SELECT
  USING (org_id IN (SELECT org_id FROM members WHERE user_id = auth.uid()));

-- Admin peut creer/modifier les factures
DROP POLICY IF EXISTS "Admin can manage invoices" ON invoices;
CREATE POLICY "Admin can manage invoices" ON invoices FOR INSERT
  TO authenticated WITH CHECK (org_id = auth.user_org_id());

DROP POLICY IF EXISTS "Admin can update invoices" ON invoices;
CREATE POLICY "Admin can update invoices" ON invoices FOR UPDATE
  USING (org_id IN (SELECT org_id FROM members WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Admin can delete invoices" ON invoices;
CREATE POLICY "Admin can delete invoices" ON invoices FOR DELETE
  USING (org_id = auth.user_org_id() AND auth.user_role() IN ('admin', 'manager'));

-- ══════════════════════════════════════════════════════════════
-- TABLE: messages
-- ══════════════════════════════════════════════════════════════
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Membres de l'org peuvent voir les messages
DROP POLICY IF EXISTS "Members can view messages" ON messages;
CREATE POLICY "Members can view messages" ON messages FOR SELECT
  USING (org_id IN (SELECT org_id FROM members WHERE user_id = auth.uid()));

-- Membres peuvent envoyer des messages
DROP POLICY IF EXISTS "Members can send messages" ON messages;
CREATE POLICY "Members can send messages" ON messages FOR INSERT
  TO authenticated WITH CHECK (org_id IN (SELECT org_id FROM members WHERE user_id = auth.uid()));

-- ══════════════════════════════════════════════════════════════
-- TABLE: subscriptions
-- ══════════════════════════════════════════════════════════════
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

-- Utilisateur peut voir son propre abonnement
DROP POLICY IF EXISTS "User can view own subscription" ON subscriptions;
CREATE POLICY "User can view own subscription" ON subscriptions FOR SELECT
  USING (user_id = auth.uid());

-- Utilisateur peut modifier son abonnement (ou le systeme)
DROP POLICY IF EXISTS "User can manage own subscription" ON subscriptions;
CREATE POLICY "User can manage own subscription" ON subscriptions FOR ALL
  USING (user_id = auth.uid());

-- ══════════════════════════════════════════════════════════════
-- TABLE: marketplace_profiles
-- ══════════════════════════════════════════════════════════════
ALTER TABLE marketplace_profiles ENABLE ROW LEVEL SECURITY;

-- Tout le monde peut voir les profils visibles
DROP POLICY IF EXISTS "Public can view visible profiles" ON marketplace_profiles;
CREATE POLICY "Public can view visible profiles" ON marketplace_profiles FOR SELECT
  TO authenticated USING (visible = true OR user_id = auth.uid());

-- Utilisateur peut gerer son propre profil
DROP POLICY IF EXISTS "User can manage own profile" ON marketplace_profiles;
CREATE POLICY "User can manage own profile" ON marketplace_profiles FOR ALL
  USING (user_id = auth.uid());

-- ══════════════════════════════════════════════════════════════
-- TABLE: connection_requests (deja fait, verification)
-- ══════════════════════════════════════════════════════════════
-- Deja configure dans create-connection-requests.sql

-- ══════════════════════════════════════════════════════════════
-- TABLE: push_subscriptions
-- ══════════════════════════════════════════════════════════════
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "User can manage own push sub" ON push_subscriptions;
CREATE POLICY "User can manage own push sub" ON push_subscriptions FOR ALL
  USING (user_id = auth.uid());

-- ══════════════════════════════════════════════════════════════
-- TABLE: user_data
-- ══════════════════════════════════════════════════════════════
ALTER TABLE user_data ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "User can manage own data" ON user_data;
CREATE POLICY "User can manage own data" ON user_data FOR ALL
  USING (user_id = auth.uid());

-- ══════════════════════════════════════════════════════════════
-- VERIFICATION: Lister toutes les tables avec RLS active
-- ══════════════════════════════════════════════════════════════
SELECT tablename, rowsecurity FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
