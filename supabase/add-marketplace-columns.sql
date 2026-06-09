-- Ensure marketplace_profiles has all required columns
-- Run this in Supabase SQL Editor

ALTER TABLE marketplace_profiles ADD COLUMN IF NOT EXISTS display_name text DEFAULT '';
ALTER TABLE marketplace_profiles ADD COLUMN IF NOT EXISTS email text DEFAULT '';
ALTER TABLE marketplace_profiles ADD COLUMN IF NOT EXISTS city text DEFAULT '';
ALTER TABLE marketplace_profiles ADD COLUMN IF NOT EXISTS phone text DEFAULT '';
ALTER TABLE marketplace_profiles ADD COLUMN IF NOT EXISTS description text DEFAULT '';
ALTER TABLE marketplace_profiles ADD COLUMN IF NOT EXISTS services jsonb DEFAULT '[]'::jsonb;
ALTER TABLE marketplace_profiles ADD COLUMN IF NOT EXISTS experience_years integer DEFAULT 0;
ALTER TABLE marketplace_profiles ADD COLUMN IF NOT EXISTS availability text DEFAULT 'available';
ALTER TABLE marketplace_profiles ADD COLUMN IF NOT EXISTS visible boolean DEFAULT false;
ALTER TABLE marketplace_profiles ADD COLUMN IF NOT EXISTS role text DEFAULT 'provider';
ALTER TABLE marketplace_profiles ADD COLUMN IF NOT EXISTS org_id uuid;
ALTER TABLE marketplace_profiles ADD COLUMN IF NOT EXISTS rating numeric DEFAULT 0;
ALTER TABLE marketplace_profiles ADD COLUMN IF NOT EXISTS postal_code text DEFAULT '';
ALTER TABLE marketplace_profiles ADD COLUMN IF NOT EXISTS lat numeric;
ALTER TABLE marketplace_profiles ADD COLUMN IF NOT EXISTS lng numeric;
ALTER TABLE marketplace_profiles ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();
ALTER TABLE marketplace_profiles ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Unique constraint on user_id (for upsert)
CREATE UNIQUE INDEX IF NOT EXISTS idx_marketplace_profiles_user_id ON marketplace_profiles(user_id);
