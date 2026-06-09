-- Add rating / stats columns to marketplace_profiles and service_requests
-- Run in Supabase SQL Editor

-- Marketplace: rating moyen + compteur avis + compteur prestations
ALTER TABLE marketplace_profiles ADD COLUMN IF NOT EXISTS rating numeric DEFAULT 0;
ALTER TABLE marketplace_profiles ADD COLUMN IF NOT EXISTS rating_count integer DEFAULT 0;
ALTER TABLE marketplace_profiles ADD COLUMN IF NOT EXISTS cleanings_done integer DEFAULT 0;

-- Service requests: lier un service a un user_id prestataire (au-dela du simple nom)
ALTER TABLE service_requests ADD COLUMN IF NOT EXISTS assigned_provider_user_id uuid;
ALTER TABLE service_requests ADD COLUMN IF NOT EXISTS rating_owner integer;
ALTER TABLE service_requests ADD COLUMN IF NOT EXISTS rating_concierge integer;
ALTER TABLE service_requests ADD COLUMN IF NOT EXISTS comment_owner text;
ALTER TABLE service_requests ADD COLUMN IF NOT EXISTS comment_concierge text;

-- RPC pour incrementer atomiquement cleanings_done
CREATE OR REPLACE FUNCTION increment_cleanings_done(p_user_id uuid)
RETURNS void AS $$
BEGIN
  UPDATE marketplace_profiles
  SET cleanings_done = COALESCE(cleanings_done, 0) + 1
  WHERE user_id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Permettre aux users authentifies d'appeler la RPC
GRANT EXECUTE ON FUNCTION increment_cleanings_done(uuid) TO authenticated;
