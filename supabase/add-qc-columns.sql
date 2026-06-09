-- Add QC columns for photo quality control
-- Run in Supabase SQL Editor

-- Checklist config per property (array of rooms to photograph)
ALTER TABLE properties ADD COLUMN IF NOT EXISTS qc_checklist jsonb DEFAULT '[]'::jsonb;

-- Photos uploaded by provider per service request
ALTER TABLE service_requests ADD COLUMN IF NOT EXISTS qc_photos jsonb DEFAULT NULL;

-- Dynamic pricing config per organization
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS dynamic_pricing jsonb DEFAULT NULL;

-- Last iCal refresh timestamp per property
ALTER TABLE properties ADD COLUMN IF NOT EXISTS last_ical_refresh timestamptz DEFAULT NULL;
