-- Add relance tracking to service_requests (max 2 relances per prestation)
ALTER TABLE service_requests ADD COLUMN IF NOT EXISTS relance_count integer DEFAULT 0;
ALTER TABLE service_requests ADD COLUMN IF NOT EXISTS relance_at timestamp with time zone;
