-- v9.27: properties.service_config + properties.required_services
-- Stores per-property service configuration (Menage standard, frequency, prices)
-- Apply ONCE in Supabase prod SQL Editor.

ALTER TABLE properties ADD COLUMN IF NOT EXISTS service_config jsonb DEFAULT '{}'::jsonb;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS required_services jsonb DEFAULT '[]'::jsonb;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS message_template text;

NOTIFY pgrst, 'reload schema';
