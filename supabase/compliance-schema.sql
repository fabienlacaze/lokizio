-- ══════════════════════════════════════════════════════════════
-- Sprint 2 compliance schema (v9.76)
-- - members: + tax_residence_country, tax_id_validated_at, birth_date
-- - app_settings: + dpo_email, dsa_contact, legal_form_short, hosting_provider, share_capital
-- - data_processing_register (RGPD art. 30)
-- - security_incidents (RGPD art. 33 — CNIL breach 72h)
-- - photo_consents (RGPD art. 6, base legale consentement explicite)
-- ══════════════════════════════════════════════════════════════

-- ── members: tax fields for DAC7 (EU directive 2021/514) ──
ALTER TABLE public.members
  ADD COLUMN IF NOT EXISTS tax_residence_country text,                  -- ISO 3166-1 alpha-2 (FR, BE, etc.)
  ADD COLUMN IF NOT EXISTS tax_id_validated_at timestamptz,             -- when the SIRET/TIN was last checked
  ADD COLUMN IF NOT EXISTS tax_residence_proof_url text,                -- optional KYC doc
  ADD COLUMN IF NOT EXISTS birth_date date;                             -- needed for individual sellers under DAC7

CREATE INDEX IF NOT EXISTS idx_members_tax_country ON public.members(tax_residence_country) WHERE tax_residence_country IS NOT NULL;

-- ── app_settings: DPO + DSA + legal completeness ──
ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS dpo_email text,                              -- art.37 RGPD
  ADD COLUMN IF NOT EXISTS dsa_contact_email text,                      -- art.11-12 DSA
  ADD COLUMN IF NOT EXISTS legal_form_short text,                       -- 'EI', 'SAS', 'SARL', 'Micro-entreprise', etc.
  ADD COLUMN IF NOT EXISTS hosting_provider text DEFAULT 'GitHub Pages (Microsoft Corporation, USA) + Supabase (Supabase Inc., USA)',
  ADD COLUMN IF NOT EXISTS share_capital_eur numeric,
  ADD COLUMN IF NOT EXISTS rcs_registration text,                       -- Registre du commerce
  ADD COLUMN IF NOT EXISTS ranking_criteria text,                        -- DSA art.27 + P2B - texte des criteres affiches
  ADD COLUMN IF NOT EXISTS breach_process_url text DEFAULT 'https://fabienlacaze.github.io/lokizio/security-policy.html';

-- Seed defaults so legal docs render correctly (sentinels for the placeholders)
UPDATE public.app_settings SET
  dpo_email = COALESCE(dpo_email, 'dpo@lokizio.com'),
  dsa_contact_email = COALESCE(dsa_contact_email, 'dsa@lokizio.com'),
  ranking_criteria = COALESCE(ranking_criteria,
    'L''ordre d''apparition des prestataires dans l''annuaire est determine par : (1) la completude du profil (50%), (2) la note moyenne des clients (25%), (3) la geolocalisation par rapport au demandeur (15%), (4) l''anciennete d''inscription (10%). Aucune monnaie ne peut acheter un classement plus eleve. Le statut Premium accorde une mise en avant visuelle distincte mais NE modifie PAS l''ordre du classement.')
WHERE TRUE;

-- ── data_processing_register (RGPD art. 30) ──
CREATE TABLE IF NOT EXISTS public.data_processing_register (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  treatment_name text NOT NULL,                          -- e.g. 'Authentification', 'Marketplace annuaire'
  purpose text NOT NULL,                                 -- finalite
  legal_basis text NOT NULL,                             -- art.6: 'consent', 'contract', 'legal_obligation', 'legitimate_interest', etc.
  data_categories text[] NOT NULL,                       -- ['email', 'phone', 'address', 'photos', 'geoloc', 'payment_data']
  data_subjects text[] NOT NULL,                         -- ['users', 'tenants', 'providers', 'public_visitors']
  recipients text[] NOT NULL,                            -- ['Stripe (paiements)', 'Supabase (hosting)', 'Resend (email)']
  retention_period text NOT NULL,                        -- e.g. '10 ans (factures)', '3 ans apres derniere connexion', 'jusqu''au retrait du consentement'
  international_transfers text,                          -- e.g. 'Stripe US (clauses contractuelles types CE)'
  security_measures text,                                -- e.g. 'chiffrement TLS, RLS Postgres, MFA Supabase'
  responsible_party text NOT NULL DEFAULT 'Fabien Lacaze (responsable du traitement) — Lokizio',
  dpo text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dpr_treatment ON public.data_processing_register(treatment_name);

ALTER TABLE public.data_processing_register ENABLE ROW LEVEL SECURITY;

-- Public read (transparence RGPD recommandee)
DROP POLICY IF EXISTS "Public read data_processing_register" ON public.data_processing_register;
CREATE POLICY "Public read data_processing_register" ON public.data_processing_register
  FOR SELECT USING (true);

-- Super admins manage
DROP POLICY IF EXISTS "Super admins manage register" ON public.data_processing_register;
CREATE POLICY "Super admins manage register" ON public.data_processing_register
  FOR ALL USING (auth.uid() IN (SELECT user_id FROM public.super_admins));

-- Seed the 10 standard treatments for Lokizio
INSERT INTO public.data_processing_register (treatment_name, purpose, legal_basis, data_categories, data_subjects, recipients, retention_period, international_transfers, security_measures)
VALUES
  ('Authentification utilisateurs', 'Permettre la creation et la connexion de comptes', 'contract', ARRAY['email','password_hash','last_seen'], ARRAY['users'], ARRAY['Supabase Auth (hosting DB)'], '3 ans apres derniere connexion', 'Supabase US (Standard Contractual Clauses)', 'Hash bcrypt, TLS 1.3, MFA optionnel'),
  ('Marketplace annuaire', 'Mise en relation prestataires <-> clients pour services de conciergerie', 'contract', ARRAY['display_name','photo','city','services','rating','phone','email'], ARRAY['providers','owners','concierges'], ARRAY['Supabase (DB)', 'autres utilisateurs Lokizio'], '3 ans apres suppression du profil ou retrait du consentement', NULL, 'RLS Postgres + audit_log'),
  ('Geolocalisation prestataires', 'Afficher la distance entre client et prestataires dans l''annuaire', 'consent', ARRAY['address','latitude','longitude'], ARRAY['providers','owners'], ARRAY['Nominatim/OpenStreetMap (geocoding)'], '3 ans ou retrait du consentement', 'Nominatim FR/DE (geocoding sans tracking)', 'Pas de stockage IP de l''utilisateur'),
  ('Facturation et paiements', 'Generer et encaisser les factures via Stripe Connect', 'legal_obligation', ARRAY['invoice_number','client_name','client_email','amount','iban_last4','stripe_account_id'], ARRAY['providers','clients'], ARRAY['Stripe Connect (PSP)','Resend (emails de facturation)'], '10 ans (obligation comptable art.L123-22 C.commerce)', 'Stripe US (SCC + Data Processing Agreement)', 'Pas de stockage des numeros de CB, Stripe gere tout'),
  ('Messages internes', 'Communication entre utilisateurs et concierge', 'contract', ARRAY['sender_id','receiver_id','content','timestamp'], ARRAY['users'], ARRAY['Supabase DB'], '2 ans apres derniere activite', NULL, 'RLS Postgres'),
  ('Photos de prestations', 'Preuve de qualite des prestations menage', 'consent', ARRAY['photos','exif_data'], ARRAY['providers','tenants'], ARRAY['Supabase Storage'], '3 ans ou retrait du consentement', NULL, 'Storage privee, URLs signees temporaires'),
  ('Notifications push', 'Alertes prestations, paiements, missions', 'consent', ARRAY['push_subscription','endpoint'], ARRAY['users'], ARRAY['Mozilla autopush / Google FCM (transport)'], 'Jusqu au retrait', 'Mozilla autopush (clauses) / Google FCM (SCC)', 'Endpoint chiffre, content E2E'),
  ('Emails transactionnels', 'Envoi des factures et notifications par email', 'contract', ARRAY['email','subject','html_body','sent_at'], ARRAY['users','clients'], ARRAY['Resend (ESP)','recipients'], '6 mois (logs ESP)', 'Resend US (SCC)', 'Anti-spam + opt-out automatique (email_optout)'),
  ('Audit log securite', 'Tracabilite des actions sensibles pour forensics', 'legal_obligation', ARRAY['user_id','action','metadata','ip','user_agent'], ARRAY['users','admins'], ARRAY['Supabase DB'], '5 ans (recommandation CNIL)', NULL, 'super_admin read only, service_role insert only'),
  ('Stripe Connect (KYC)', 'Onboarding prestataires pour reception paiements en ligne', 'legal_obligation', ARRAY['identity_document','iban','tax_id','address','birth_date'], ARRAY['providers'], ARRAY['Stripe Connect (KYC delegate)'], '10 ans (anti-blanchiment)', 'Stripe US (SCC)', 'Lokizio n''a JAMAIS acces aux donnees KYC, Stripe seule')
ON CONFLICT DO NOTHING;

-- ── security_incidents (RGPD art. 33 — CNIL breach 72h) ──
CREATE TABLE IF NOT EXISTS public.security_incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reported_at timestamptz NOT NULL DEFAULT now(),
  reported_by uuid REFERENCES auth.users(id),
  occurred_at timestamptz,                               -- when the incident actually happened (may differ from reported_at)
  category text NOT NULL,                                 -- 'data_breach' | 'auth_bypass' | 'xss' | 'sql_injection' | 'iban_change_fraud' | 'phishing_via_platform' | 'other'
  severity text NOT NULL DEFAULT 'medium',                -- 'low' | 'medium' | 'high' | 'critical'
  description text NOT NULL,
  affected_users_count integer,
  affected_data_categories text[],                       -- e.g. ['email','phone','iban_last4']
  cnil_notification_required boolean,                    -- true if > likely to result in high risk
  cnil_notification_sent_at timestamptz,                 -- timestamp of CNIL submission (72h cap)
  cnil_notification_reference text,                      -- CNIL acknowledgement id
  affected_users_notified_at timestamptz,
  contained_at timestamptz,                              -- when the incident was contained
  resolved_at timestamptz,
  resolution_summary text,
  status text NOT NULL DEFAULT 'open'                    -- 'open' | 'contained' | 'resolved' | 'cnil_notified'
);

CREATE INDEX IF NOT EXISTS idx_security_incidents_status ON public.security_incidents(status, reported_at DESC);
CREATE INDEX IF NOT EXISTS idx_security_incidents_severity ON public.security_incidents(severity, reported_at DESC);

ALTER TABLE public.security_incidents ENABLE ROW LEVEL SECURITY;
-- Super admins only
DROP POLICY IF EXISTS "Super admins manage incidents" ON public.security_incidents;
CREATE POLICY "Super admins manage incidents" ON public.security_incidents
  FOR ALL USING (auth.uid() IN (SELECT user_id FROM public.super_admins));

-- ── photo_consents (RGPD art. 6 consent) ──
CREATE TABLE IF NOT EXISTS public.photo_consents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  given_at timestamptz NOT NULL DEFAULT now(),
  context text NOT NULL,                                  -- 'cleaning_qc' | 'profile_avatar' | 'property_listing' | 'marketplace_profile'
  ip text,
  user_agent text,
  withdrawn_at timestamptz,
  policy_version text DEFAULT 'v9.76'                     -- version of privacy policy active at consent time
);

CREATE INDEX IF NOT EXISTS idx_photo_consents_user ON public.photo_consents(user_id, given_at DESC);
CREATE INDEX IF NOT EXISTS idx_photo_consents_active ON public.photo_consents(user_id, context) WHERE withdrawn_at IS NULL;

ALTER TABLE public.photo_consents ENABLE ROW LEVEL SECURITY;

-- Users can read their own consents (RGPD right of access)
DROP POLICY IF EXISTS "Users read own photo_consents" ON public.photo_consents;
CREATE POLICY "Users read own photo_consents" ON public.photo_consents
  FOR SELECT USING (auth.uid() = user_id);

-- Users can insert their own consents (when they accept the banner)
DROP POLICY IF EXISTS "Users insert own photo_consents" ON public.photo_consents;
CREATE POLICY "Users insert own photo_consents" ON public.photo_consents
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can withdraw (update) their own consents
DROP POLICY IF EXISTS "Users update own photo_consents" ON public.photo_consents;
CREATE POLICY "Users update own photo_consents" ON public.photo_consents
  FOR UPDATE USING (auth.uid() = user_id);

-- Super admins read all
DROP POLICY IF EXISTS "Super admins read photo_consents" ON public.photo_consents;
CREATE POLICY "Super admins read photo_consents" ON public.photo_consents
  FOR SELECT USING (auth.uid() IN (SELECT user_id FROM public.super_admins));

-- ── Verification ──
SELECT 'members.tax_residence_country' AS check_item, count(*) AS yes FROM information_schema.columns WHERE table_schema='public' AND table_name='members' AND column_name='tax_residence_country'
UNION ALL SELECT 'app_settings.dpo_email', count(*) FROM information_schema.columns WHERE table_schema='public' AND table_name='app_settings' AND column_name='dpo_email'
UNION ALL SELECT 'data_processing_register rows', count(*) FROM public.data_processing_register
UNION ALL SELECT 'security_incidents table', count(*) FROM public.security_incidents
UNION ALL SELECT 'photo_consents table', count(*) FROM public.photo_consents;
