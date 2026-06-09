-- ══════════════════════════════════════════════════════════════
-- Sprint 3C + 3D — KYC metier Lokizio + AML monitoring (v9.81)
-- ══════════════════════════════════════════════════════════════

-- ── members: KYC status global (lokizio-level, distinct du Stripe KYC) ──
ALTER TABLE public.members
  ADD COLUMN IF NOT EXISTS lokizio_kyc_status text DEFAULT 'not_started',
  ADD COLUMN IF NOT EXISTS lokizio_kyc_validated_at timestamptz,
  ADD COLUMN IF NOT EXISTS lokizio_kyc_validated_by uuid,
  ADD COLUMN IF NOT EXISTS lokizio_kyc_refusal_reason text;

-- kyc status values: 'not_started' | 'incomplete' | 'pending_review' | 'validated' | 'refused' | 'expired'
CREATE INDEX IF NOT EXISTS idx_members_kyc_status
  ON public.members(lokizio_kyc_status)
  WHERE lokizio_kyc_status != 'not_started';

-- ── provider_kyc_documents: docs uploades par le prestataire ──
CREATE TABLE IF NOT EXISTS public.provider_kyc_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  document_type text NOT NULL,                          -- 'siret' | 'rc_pro' | 'identity' | 'kbis' | 'tax_residence'
  storage_path text NOT NULL,                            -- path in Supabase Storage (private bucket)
  original_filename text,
  file_size_bytes integer,
  mime_type text,
  uploaded_at timestamptz NOT NULL DEFAULT now(),
  validated_at timestamptz,
  validated_by uuid,
  validation_status text NOT NULL DEFAULT 'pending',     -- 'pending' | 'validated' | 'refused'
  refusal_reason text,
  expires_at timestamptz,                                -- e.g. RC Pro expires after 1 year
  UNIQUE (user_id, document_type)                        -- 1 doc actif par type par user (newest replaces)
);

CREATE INDEX IF NOT EXISTS idx_kyc_docs_user ON public.provider_kyc_documents(user_id, uploaded_at DESC);
CREATE INDEX IF NOT EXISTS idx_kyc_docs_status ON public.provider_kyc_documents(validation_status, uploaded_at DESC);

ALTER TABLE public.provider_kyc_documents ENABLE ROW LEVEL SECURITY;

-- Users see/manage own docs
DROP POLICY IF EXISTS "Users manage own kyc docs" ON public.provider_kyc_documents;
CREATE POLICY "Users manage own kyc docs" ON public.provider_kyc_documents
  FOR ALL USING (auth.uid() = user_id);

-- Super admins manage all
DROP POLICY IF EXISTS "Super admins manage kyc docs" ON public.provider_kyc_documents;
CREATE POLICY "Super admins manage kyc docs" ON public.provider_kyc_documents
  FOR ALL USING (auth.uid() IN (SELECT user_id FROM public.super_admins));

-- ── provider_charter_signatures: signature electronique de la charte ──
CREATE TABLE IF NOT EXISTS public.provider_charter_signatures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  charter_version text NOT NULL,                         -- e.g. 'v1.0'
  signed_at timestamptz NOT NULL DEFAULT now(),
  ip text,
  user_agent text,
  revoked_at timestamptz                                  -- can be revoked if charter changes
);

CREATE INDEX IF NOT EXISTS idx_charter_user ON public.provider_charter_signatures(user_id, signed_at DESC);
CREATE INDEX IF NOT EXISTS idx_charter_active
  ON public.provider_charter_signatures(user_id, charter_version)
  WHERE revoked_at IS NULL;

ALTER TABLE public.provider_charter_signatures ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users insert own signatures" ON public.provider_charter_signatures;
CREATE POLICY "Users insert own signatures" ON public.provider_charter_signatures
  FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users read own signatures" ON public.provider_charter_signatures;
CREATE POLICY "Users read own signatures" ON public.provider_charter_signatures
  FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Super admins read signatures" ON public.provider_charter_signatures;
CREATE POLICY "Super admins read signatures" ON public.provider_charter_signatures
  FOR SELECT USING (auth.uid() IN (SELECT user_id FROM public.super_admins));

-- ══════════════════════════════════════════════════════════════
-- Sprint 3D — AML monitoring
-- ══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.aml_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  user_id uuid,                                          -- subject of the alert
  org_id uuid,
  alert_type text NOT NULL,                              -- 'threshold_30d' | 'rapid_succession' | 'self_billing' | 'fragmentation'
  severity text NOT NULL DEFAULT 'medium',               -- 'low' | 'medium' | 'high' | 'critical'
  details jsonb NOT NULL,                                -- specific signals (amounts, count, time window, etc.)
  status text NOT NULL DEFAULT 'open',                   -- 'open' | 'reviewed' | 'tracfin_reported' | 'dismissed'
  reviewed_by uuid,
  reviewed_at timestamptz,
  resolution_note text,
  tracfin_reference text                                  -- TRACFIN declaration ref if reported
);

CREATE INDEX IF NOT EXISTS idx_aml_alerts_status ON public.aml_alerts(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_aml_alerts_user ON public.aml_alerts(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_aml_alerts_severity ON public.aml_alerts(severity, created_at DESC);

ALTER TABLE public.aml_alerts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Super admins manage aml" ON public.aml_alerts;
CREATE POLICY "Super admins manage aml" ON public.aml_alerts
  FOR ALL USING (auth.uid() IN (SELECT user_id FROM public.super_admins));

-- ── VIEW: 30-day rolling volume per user (used by aml-scan) ──
CREATE OR REPLACE VIEW public.aml_30day_volume_per_user AS
SELECT
  i.created_by AS user_id,
  i.org_id,
  COUNT(*) AS tx_count_30d,
  SUM(COALESCE(i.total_ttc, 0)) AS total_volume_eur_30d,
  MAX(i.stripe_paid_at) AS last_tx_at,
  COUNT(*) FILTER (WHERE i.total_ttc < 750) AS small_tx_count_30d
FROM public.invoices i
WHERE i.stripe_payment_status = 'succeeded'
  AND i.stripe_paid_at > now() - interval '30 days'
GROUP BY i.created_by, i.org_id;

GRANT SELECT ON public.aml_30day_volume_per_user TO authenticated;

-- ── Verification ──
SELECT 'members.kyc cols' AS check_item, count(*) AS yes FROM information_schema.columns WHERE table_schema='public' AND table_name='members' AND column_name LIKE 'lokizio_kyc%'
UNION ALL SELECT 'provider_kyc_documents', count(*) FROM public.provider_kyc_documents
UNION ALL SELECT 'provider_charter_signatures', count(*) FROM public.provider_charter_signatures
UNION ALL SELECT 'aml_alerts', count(*) FROM public.aml_alerts
UNION ALL SELECT 'aml_30day_volume_per_user', count(*) FROM public.aml_30day_volume_per_user;
