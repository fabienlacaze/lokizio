-- Extend billing_settings to support provider role (in addition to concierge/admin)
-- Additive migration: does not break existing concierge config

-- 1) Drop the old PK (org_id alone) to allow multiple rows per org (concierge + each provider)
ALTER TABLE billing_settings DROP CONSTRAINT IF EXISTS billing_settings_pkey;

-- 2) Add user_id + role columns
ALTER TABLE billing_settings ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE billing_settings ADD COLUMN IF NOT EXISTS role text DEFAULT 'concierge' CHECK (role IN ('concierge','provider'));

-- 3) Backfill existing rows as concierge config
UPDATE billing_settings SET role = 'concierge' WHERE role IS NULL;

-- 4) New PK: one config per (org, user, role) — for concierge role, user_id can be NULL (org-wide)
CREATE UNIQUE INDEX IF NOT EXISTS billing_settings_unique_key
  ON billing_settings (org_id, COALESCE(user_id, '00000000-0000-0000-0000-000000000000'::uuid), role);

-- 5) Extend types_enabled default to include provider_to_owner
-- (existing rows keep their values; only future inserts use this default)
ALTER TABLE billing_settings ALTER COLUMN types_enabled SET DEFAULT
  '{"concierge_to_owner": true, "provider_to_concierge": true, "provider_to_owner": true}'::jsonb;

-- 6) Update RLS policy: concierge admins OR the provider himself
DROP POLICY IF EXISTS "billing_settings_admin_all" ON billing_settings;
DROP POLICY IF EXISTS "billing_settings_role_access" ON billing_settings;

CREATE POLICY "billing_settings_role_access" ON billing_settings
  USING (
    -- Concierge config: admin/manager of the org
    (role = 'concierge' AND EXISTS (
      SELECT 1 FROM members
      WHERE members.org_id = billing_settings.org_id
        AND members.user_id = auth.uid()
        AND members.role IN ('admin','manager')
    ))
    OR
    -- Provider config: the provider himself
    (role = 'provider' AND user_id = auth.uid())
  );

-- 7) Ensure billing_runs supports provider-owned invoices (no change needed, just verify index)
CREATE INDEX IF NOT EXISTS idx_billing_runs_org_user ON billing_runs(org_id, client_key, period_start);
