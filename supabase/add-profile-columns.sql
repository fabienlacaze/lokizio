-- Ensure members table has all profile/billing columns
-- Run this in Supabase SQL Editor

ALTER TABLE members ADD COLUMN IF NOT EXISTS phone text DEFAULT '';
ALTER TABLE members ADD COLUMN IF NOT EXISTS address text DEFAULT '';
ALTER TABLE members ADD COLUMN IF NOT EXISTS company_name text DEFAULT '';
ALTER TABLE members ADD COLUMN IF NOT EXISTS siret text DEFAULT '';
ALTER TABLE members ADD COLUMN IF NOT EXISTS vat_number text DEFAULT '';
ALTER TABLE members ADD COLUMN IF NOT EXISTS billing_address text DEFAULT '';
ALTER TABLE members ADD COLUMN IF NOT EXISTS vat_regime text DEFAULT 'micro';
