-- ══════════════════════════════════════════════════════════════
-- Stripe Connect Express schema additions (v9.66 / Phase 1)
-- Direct charges model with 3% Lokizio application fee.
-- A executer dans le SQL Editor du projet PROD (mrvejwyvhuivmipfwlzz).
-- ══════════════════════════════════════════════════════════════

-- ── members: chaque user (concierge/owner/provider/tenant) peut avoir un compte Stripe Express ──
ALTER TABLE public.members
  ADD COLUMN IF NOT EXISTS stripe_account_id text,                  -- acct_xxx returned by Stripe
  ADD COLUMN IF NOT EXISTS stripe_charges_enabled boolean DEFAULT false,    -- KYC: accepte les paiements
  ADD COLUMN IF NOT EXISTS stripe_payouts_enabled boolean DEFAULT false,    -- KYC: peut recevoir des payouts
  ADD COLUMN IF NOT EXISTS stripe_details_submitted boolean DEFAULT false,  -- onboarding terminee
  ADD COLUMN IF NOT EXISTS stripe_account_country text,             -- 'FR', 'BE', etc. choisi a l'onboarding
  ADD COLUMN IF NOT EXISTS stripe_onboarding_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS stripe_account_updated_at timestamptz;   -- derniere maj via webhook account.updated

-- ── invoices: tracking d'un Payment Intent Stripe lie a la facture ──
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS stripe_payment_intent_id text,           -- pi_xxx
  ADD COLUMN IF NOT EXISTS stripe_payment_status text,              -- 'requires_payment_method', 'succeeded', 'canceled', etc.
  ADD COLUMN IF NOT EXISTS stripe_paid_at timestamptz,              -- timestamp succeeded webhook
  ADD COLUMN IF NOT EXISTS stripe_application_fee_amount integer,   -- en centimes, ce que Lokizio prend
  ADD COLUMN IF NOT EXISTS stripe_destination_account_id text,      -- acct_ destination = beneficiaire
  ADD COLUMN IF NOT EXISTS payment_link text;                       -- URL hosted Stripe Checkout / Payment Link

-- ── Indexes pour perfs ──
CREATE INDEX IF NOT EXISTS idx_members_stripe_account
  ON public.members(stripe_account_id) WHERE stripe_account_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_invoices_stripe_pi
  ON public.invoices(stripe_payment_intent_id) WHERE stripe_payment_intent_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_invoices_stripe_payment_status
  ON public.invoices(stripe_payment_status) WHERE stripe_payment_status IS NOT NULL;

-- ── Constants table: configuration Stripe Connect ──
-- Plutot que de hardcoder le taux 3% dans le code, on le met en DB pour pouvoir
-- l'ajuster sans deploy.
CREATE TABLE IF NOT EXISTS public.platform_config (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_at timestamptz DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id)
);

INSERT INTO public.platform_config (key, value)
VALUES ('stripe_connect', '{
  "fee_percent": 3.0,
  "fee_fixed_cents": 0,
  "enabled": true,
  "test_mode": true,
  "supported_countries": ["FR", "BE", "CH", "LU", "CA", "DE", "ES", "IT", "PT", "NL", "GB", "US"]
}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- RLS: only super_admins can read/write platform_config
ALTER TABLE public.platform_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Super admins can read platform_config" ON public.platform_config;
CREATE POLICY "Super admins can read platform_config" ON public.platform_config
  FOR SELECT USING (auth.uid() IN (SELECT user_id FROM public.super_admins));
DROP POLICY IF EXISTS "Super admins can write platform_config" ON public.platform_config;
CREATE POLICY "Super admins can write platform_config" ON public.platform_config
  FOR ALL USING (auth.uid() IN (SELECT user_id FROM public.super_admins));

-- ── Verification ──
SELECT 'members.stripe columns' AS table_check,
       count(*) AS column_count
FROM information_schema.columns
WHERE table_schema='public' AND table_name='members' AND column_name LIKE '%stripe%';

SELECT 'invoices.stripe columns' AS table_check,
       count(*) AS column_count
FROM information_schema.columns
WHERE table_schema='public' AND table_name='invoices' AND column_name LIKE '%stripe%';

SELECT 'platform_config rows' AS table_check, count(*) AS row_count FROM public.platform_config;
