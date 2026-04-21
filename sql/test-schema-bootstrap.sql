-- ══════════════════════════════════════════════════════════════════════════════
-- Lokizio test project bootstrap
-- Applies the complete schema to a fresh Supabase project for integration tests.
-- Run this ONCE in the Supabase SQL editor of your lokizio-test project.
-- ══════════════════════════════════════════════════════════════════════════════

-- ═══ CORE TABLES ═══

CREATE TABLE IF NOT EXISTS organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  plan text DEFAULT 'free' CHECK (plan IN ('free','pro','premium','business')),
  referral_code text UNIQUE,
  referred_by text,
  referral_rewards int DEFAULT 0,
  trial_used boolean DEFAULT false,
  owner_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('admin','manager','concierge','owner','provider','tenant')),
  invited_email text,
  accepted boolean DEFAULT false,
  display_name text,
  company_name text,
  siret text,
  phone text,
  address text,
  billing_address text,
  invited_at timestamptz DEFAULT now(),
  UNIQUE(org_id, user_id)
);

CREATE TABLE IF NOT EXISTS properties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  address text,
  photo text,
  owner_name text,
  owner_email text,
  owner_member_id uuid REFERENCES members(id) ON DELETE SET NULL,
  pricing jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS plannings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid REFERENCES properties(id) ON DELETE CASCADE UNIQUE,
  ical_urls jsonb DEFAULT '[]'::jsonb,
  config jsonb DEFAULT '{}'::jsonb,
  schedule jsonb DEFAULT '{}'::jsonb,
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  property_id uuid REFERENCES properties(id) ON DELETE CASCADE,
  tenant_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  status text DEFAULT 'active' CHECK (status IN ('active','completed','cancelled')),
  access_instructions text,
  notes text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS service_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  property_id uuid REFERENCES properties(id) ON DELETE CASCADE,
  service_type text,
  requested_date date,
  status text DEFAULT 'pending' CHECK (status IN ('pending','assigned','done','cancelled')),
  assigned_provider text,
  assigned_provider_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  provider_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  direct_to_owner boolean DEFAULT false,
  notes text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS cleaning_validations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid REFERENCES properties(id) ON DELETE CASCADE,
  cleaning_date date NOT NULL,
  status text DEFAULT 'pending' CHECK (status IN ('pending','done','skipped')),
  provider_name text,
  provider_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  invoice_number text NOT NULL,
  type text CHECK (type IN ('concierge_to_owner','provider_to_concierge','provider_to_owner','other')),
  status text DEFAULT 'draft' CHECK (status IN ('draft','sent','paid','refused','accepted','cancelled')),
  issuer_name text,
  issuer_siret text,
  issuer_address text,
  issuer_email text,
  client_name text,
  client_email text,
  property_name text,
  items jsonb DEFAULT '[]'::jsonb,
  subtotal_ht numeric(12,2) DEFAULT 0,
  total_tva numeric(12,2) DEFAULT 0,
  total_ttc numeric(12,2) DEFAULT 0,
  vat_rate numeric(5,2) DEFAULT 0,
  period_start date,
  period_end date,
  due_date date,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  sender_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  sender_name text,
  sender_role text,
  recipient_name text,
  recipient_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  body text NOT NULL,
  read boolean DEFAULT false,
  property_id uuid REFERENCES properties(id) ON DELETE SET NULL,
  reservation_id uuid REFERENCES reservations(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS subscriptions (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  plan text DEFAULT 'free' CHECK (plan IN ('free','pro','premium','business')),
  stripe_customer_id text,
  stripe_subscription_id text,
  current_period_end timestamptz,
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS connection_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  sender_name text,
  sender_role text,
  sender_org_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  receiver_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  receiver_name text,
  receiver_role text,
  proposed_role text,
  status text DEFAULT 'pending' CHECK (status IN ('pending','accepted','refused')),
  message text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS marketplace_profiles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role text,
  display_name text,
  company_name text,
  description text,
  city text,
  postal_code text,
  services jsonb DEFAULT '[]'::jsonb,
  photo text,
  availability text DEFAULT 'available' CHECK (availability IN ('available','full','vacation')),
  vacation_periods jsonb DEFAULT '[]'::jsonb,
  country text DEFAULT 'FR',
  is_public boolean DEFAULT false,
  rating numeric(3,2),
  rating_count int DEFAULT 0,
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS billing_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  role text CHECK (role IN ('concierge','provider')),
  auto_enabled boolean DEFAULT false,
  period text DEFAULT 'previous_month' CHECK (period IN ('current_month','previous_month')),
  billing_day int DEFAULT 1,
  types_enabled jsonb DEFAULT '{}'::jsonb,
  due_days int DEFAULT 30,
  default_status text DEFAULT 'draft',
  vat_rate numeric(5,2) DEFAULT 0,
  vat_exempt boolean DEFAULT false,
  last_run_at timestamptz,
  UNIQUE(org_id, role),
  UNIQUE(user_id, role)
);

CREATE TABLE IF NOT EXISTS billing_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  period_start date NOT NULL,
  period_end date NOT NULL,
  invoice_type text NOT NULL,
  client_key text NOT NULL,
  invoice_id uuid REFERENCES invoices(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  provider_token text,
  endpoint text NOT NULL,
  p256dh text,
  auth text,
  keys jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS super_admins (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  granted_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_data (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  data jsonb DEFAULT '{}'::jsonb,
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  display_name text,
  company_name text,
  siret text,
  billing_address text,
  address text,
  phone text,
  invited_email text,
  country text DEFAULT 'FR',
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS email_optout (
  email text PRIMARY KEY,
  opted_out_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS email_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  to_email text,
  subject text,
  type text,
  status text,
  resend_id text,
  error text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS rgpd_consents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  consent_type text,
  cgu_version text,
  privacy_version text,
  user_agent text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS app_settings (
  key text PRIMARY KEY,
  value jsonb,
  updated_at timestamptz DEFAULT now()
);

-- ═══ INDEXES ═══

CREATE INDEX IF NOT EXISTS idx_members_user ON members(user_id);
CREATE INDEX IF NOT EXISTS idx_members_org ON members(org_id);
CREATE INDEX IF NOT EXISTS idx_properties_org ON properties(org_id);
CREATE INDEX IF NOT EXISTS idx_reservations_tenant ON reservations(tenant_user_id, status);
CREATE INDEX IF NOT EXISTS idx_service_requests_org ON service_requests(org_id, requested_date);
CREATE INDEX IF NOT EXISTS idx_invoices_org ON invoices(org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_org ON messages(org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_read ON messages(org_id, read) WHERE read = false;
CREATE INDEX IF NOT EXISTS idx_messages_property ON messages(property_id) WHERE property_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_messages_reservation ON messages(reservation_id) WHERE reservation_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_connection_requests_unique_active
  ON connection_requests (LEAST(sender_id, receiver_id), GREATEST(sender_id, receiver_id))
  WHERE status IN ('pending', 'accepted');

-- ═══ RLS HELPERS ═══
-- Placed in public schema (auth schema is read-only in Supabase dashboard SQL editor).

CREATE OR REPLACE FUNCTION public.user_org_id() RETURNS uuid AS $$
  SELECT org_id FROM public.members WHERE user_id = auth.uid() AND accepted = true LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.user_role() RETURNS text AS $$
  SELECT role FROM public.members WHERE user_id = auth.uid() AND accepted = true LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ═══ RLS POLICIES ═══

-- organizations
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members view org" ON organizations FOR SELECT
  USING (id IN (SELECT org_id FROM members WHERE user_id = auth.uid()));
CREATE POLICY "Admin update org" ON organizations FOR UPDATE
  USING (id = public.user_org_id() AND public.user_role() IN ('admin','manager','concierge'));
CREATE POLICY "Authenticated create org" ON organizations FOR INSERT
  TO authenticated WITH CHECK (true);

-- members
ALTER TABLE members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members view org members" ON members FOR SELECT
  USING (org_id IN (SELECT org_id FROM members WHERE user_id = auth.uid()));
CREATE POLICY "Admin insert member" ON members FOR INSERT TO authenticated
  WITH CHECK (org_id = public.user_org_id() OR user_id = auth.uid());
CREATE POLICY "Admin update member" ON members FOR UPDATE
  USING (org_id = public.user_org_id() AND public.user_role() IN ('admin','manager','concierge'));
CREATE POLICY "Self or admin delete member" ON members FOR DELETE
  USING (user_id = auth.uid() OR (org_id = public.user_org_id() AND public.user_role() IN ('admin','manager','concierge')));

-- properties
ALTER TABLE properties ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members view properties" ON properties FOR SELECT
  USING (org_id IN (SELECT org_id FROM members WHERE user_id = auth.uid()));
CREATE POLICY "Admin manage properties" ON properties FOR ALL
  USING (org_id = public.user_org_id() AND public.user_role() IN ('admin','manager','concierge'));

-- reservations
ALTER TABLE reservations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff view reservations" ON reservations FOR SELECT
  USING (
    org_id IN (SELECT org_id FROM members WHERE user_id = auth.uid())
    OR tenant_user_id = auth.uid()
  );
CREATE POLICY "Admin manage reservations" ON reservations FOR ALL
  USING (org_id = public.user_org_id() AND public.user_role() IN ('admin','manager','concierge','owner'));

-- service_requests
ALTER TABLE service_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members view service requests" ON service_requests FOR SELECT
  USING (org_id IN (SELECT org_id FROM members WHERE user_id = auth.uid()));
CREATE POLICY "Admin insert service requests" ON service_requests FOR INSERT TO authenticated
  WITH CHECK (org_id = public.user_org_id());
CREATE POLICY "Admin/concierge update service requests" ON service_requests FOR UPDATE
  USING (org_id = public.user_org_id() AND public.user_role() IN ('admin','manager','concierge'));
CREATE POLICY "Provider update own service requests" ON service_requests FOR UPDATE
  USING (
    org_id = public.user_org_id()
    AND public.user_role() = 'provider'
    AND (provider_id = auth.uid() OR assigned_to = auth.uid())
  );
CREATE POLICY "Admin delete service requests" ON service_requests FOR DELETE
  USING (org_id = public.user_org_id() AND public.user_role() IN ('admin','manager'));

-- cleaning_validations
ALTER TABLE cleaning_validations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members view validations" ON cleaning_validations FOR SELECT
  USING (property_id IN (SELECT id FROM properties WHERE org_id IN (SELECT org_id FROM members WHERE user_id = auth.uid())));
CREATE POLICY "Admin manage validations" ON cleaning_validations FOR ALL
  USING (property_id IN (SELECT id FROM properties WHERE org_id = public.user_org_id() AND public.user_role() IN ('admin','manager','concierge')));

-- invoices
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members view invoices" ON invoices FOR SELECT
  USING (org_id IN (SELECT org_id FROM members WHERE user_id = auth.uid()));
CREATE POLICY "Members manage invoices" ON invoices FOR ALL
  USING (org_id = public.user_org_id());

-- messages (scoped: tenant sees only reservation/property-linked messages)
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
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
CREATE POLICY "Members insert messages" ON messages FOR INSERT TO authenticated
  WITH CHECK (sender_id = auth.uid());

-- subscriptions
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own subscription" ON subscriptions FOR ALL
  USING (user_id = auth.uid());

-- connection_requests
ALTER TABLE connection_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own connection requests" ON connection_requests FOR SELECT
  USING (sender_id = auth.uid() OR receiver_id = auth.uid());
CREATE POLICY "Sender can create" ON connection_requests FOR INSERT TO authenticated
  WITH CHECK (sender_id = auth.uid());
CREATE POLICY "Receiver or sender can update" ON connection_requests FOR UPDATE
  USING (sender_id = auth.uid() OR receiver_id = auth.uid());

-- marketplace_profiles
ALTER TABLE marketplace_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View public profiles" ON marketplace_profiles FOR SELECT
  USING (is_public = true OR user_id = auth.uid());
CREATE POLICY "Own profile management" ON marketplace_profiles FOR ALL
  USING (user_id = auth.uid());

-- billing_settings
ALTER TABLE billing_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members view billing settings" ON billing_settings FOR SELECT
  USING (
    (org_id IS NOT NULL AND org_id = public.user_org_id())
    OR user_id = auth.uid()
  );
CREATE POLICY "Members manage billing settings" ON billing_settings FOR ALL
  USING (
    (org_id = public.user_org_id() AND public.user_role() IN ('admin','manager','concierge'))
    OR user_id = auth.uid()
  );

-- push_subscriptions
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own push subs" ON push_subscriptions FOR ALL
  USING (user_id = auth.uid());

-- profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View profiles" ON profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Own profile update" ON profiles FOR ALL USING (id = auth.uid());

-- user_data
ALTER TABLE user_data ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own user data" ON user_data FOR ALL USING (user_id = auth.uid());

-- super_admins (no RLS — service role only)
ALTER TABLE super_admins ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read super admins" ON super_admins FOR SELECT TO authenticated USING (true);

-- app_settings (public read)
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read settings" ON app_settings FOR SELECT TO authenticated USING (true);

-- rgpd_consents (own)
ALTER TABLE rgpd_consents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own consents" ON rgpd_consents FOR ALL USING (user_id = auth.uid());

-- email_log (service role only — restrictive policy for users)
ALTER TABLE email_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own sent emails" ON email_log FOR SELECT USING (sender_id = auth.uid());

-- email_optout (public insert via edge function)
ALTER TABLE email_optout ENABLE ROW LEVEL SECURITY;

NOTIFY pgrst, 'reload schema';
