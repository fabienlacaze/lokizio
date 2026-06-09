-- Auto-billing configuration per organization
CREATE TABLE IF NOT EXISTS billing_settings (
  org_id uuid PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
  auto_enabled boolean DEFAULT false,
  frequency text DEFAULT 'monthly' CHECK (frequency IN ('monthly','biweekly')),
  billing_day int DEFAULT 1 CHECK (billing_day BETWEEN 1 AND 28),
  default_status text DEFAULT 'draft' CHECK (default_status IN ('draft','sent')),
  period text DEFAULT 'previous_month' CHECK (period IN ('previous_month','current_month')),
  due_days int DEFAULT 30,
  types_enabled jsonb DEFAULT '{"concierge_to_owner": true, "provider_to_concierge": true}'::jsonb,
  last_run_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- RLS: only org admins can read/write
ALTER TABLE billing_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "billing_settings_admin_all" ON billing_settings;
CREATE POLICY "billing_settings_admin_all" ON billing_settings
  USING (
    EXISTS (
      SELECT 1 FROM members
      WHERE members.org_id = billing_settings.org_id
        AND members.user_id = auth.uid()
        AND members.role IN ('admin','manager')
    )
  );

-- Track which periods have been auto-billed (prevent double-generation)
CREATE TABLE IF NOT EXISTS billing_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  period_start date NOT NULL,
  period_end date NOT NULL,
  invoice_type text NOT NULL,
  client_key text NOT NULL,
  invoice_id uuid REFERENCES invoices(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(org_id, period_start, period_end, invoice_type, client_key)
);

CREATE INDEX IF NOT EXISTS idx_billing_runs_org ON billing_runs(org_id, created_at DESC);
