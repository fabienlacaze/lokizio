-- Public job postings on the marketplace.
-- A concierge publishes a service request here when she can't find
-- a provider in her own team. Marketplace providers can browse and
-- apply.

CREATE TABLE IF NOT EXISTS marketplace_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  posted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  service_request_id uuid REFERENCES service_requests(id) ON DELETE CASCADE,
  service_type text NOT NULL,
  requested_date date,
  property_name text,
  property_address text,
  property_city text,
  description text,
  budget numeric(10,2),
  status text DEFAULT 'open' CHECK (status IN ('open', 'taken', 'cancelled', 'expired')),
  taken_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_marketplace_jobs_status ON marketplace_jobs(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_marketplace_jobs_city ON marketplace_jobs(property_city) WHERE status = 'open';
CREATE INDEX IF NOT EXISTS idx_marketplace_jobs_org ON marketplace_jobs(org_id);

ALTER TABLE marketplace_jobs ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can browse open jobs
DROP POLICY IF EXISTS "Browse open jobs" ON marketplace_jobs;
CREATE POLICY "Browse open jobs" ON marketplace_jobs FOR SELECT TO authenticated
  USING (status = 'open' OR org_id = public.user_org_id() OR posted_by = auth.uid() OR taken_by = auth.uid());

-- Org members can post on behalf of their org
DROP POLICY IF EXISTS "Org members can post jobs" ON marketplace_jobs;
CREATE POLICY "Org members can post jobs" ON marketplace_jobs FOR INSERT TO authenticated
  WITH CHECK (org_id = public.user_org_id() AND posted_by = auth.uid());

-- The org that posted can update / cancel; the provider who took it can mark as taken
DROP POLICY IF EXISTS "Org or taker can update" ON marketplace_jobs;
CREATE POLICY "Org or taker can update" ON marketplace_jobs FOR UPDATE TO authenticated
  USING (org_id = public.user_org_id() OR posted_by = auth.uid() OR taken_by = auth.uid());

NOTIFY pgrst, 'reload schema';
