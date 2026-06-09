-- Add vacation periods storage for marketplace profiles + members
-- Format: JSONB array of {from:'YYYY-MM-DD', to:'YYYY-MM-DD', note:''}
ALTER TABLE marketplace_profiles ADD COLUMN IF NOT EXISTS vacation_periods jsonb DEFAULT '[]'::jsonb;
ALTER TABLE members ADD COLUMN IF NOT EXISTS vacation_periods jsonb DEFAULT '[]'::jsonb;
