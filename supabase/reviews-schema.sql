-- ══════════════════════════════════════════════════════════════
-- Sprint 3B — Reviews / Notation prestataire (v9.79)
-- - reviews: 1 review par invoice (link verified to a paid invoice)
-- - invoices: + client_review_token (90j, distinct du dispute_token)
-- - VIEW provider_review_stats: average + count per provider, lus
--   publiquement par marketplace.js sans hammering la DB
-- ══════════════════════════════════════════════════════════════

-- ── Token persistant pour noter (90j) ──
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS client_review_token text,
  ADD COLUMN IF NOT EXISTS review_token_expires_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_invoices_client_review_token
  ON public.invoices(client_review_token)
  WHERE client_review_token IS NOT NULL;

-- ── Reviews table ──
CREATE TABLE IF NOT EXISTS public.reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  org_id uuid NOT NULL,                                  -- denormalized for fast filtering
  provider_user_id uuid,                                 -- the provider being reviewed (from invoice.created_by)
  client_email text,                                     -- the client who left the review (from invoice.client_email)
  rating integer NOT NULL,                               -- 1..5
  comment text,
  posted_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'published',              -- 'published' | 'hidden' | 'flagged'
  moderation_note text,
  CHECK (rating BETWEEN 1 AND 5),
  UNIQUE (invoice_id)                                    -- 1 review max per invoice (anti-spam)
);

CREATE INDEX IF NOT EXISTS idx_reviews_provider ON public.reviews(provider_user_id, posted_at DESC) WHERE status = 'published';
CREATE INDEX IF NOT EXISTS idx_reviews_org ON public.reviews(org_id, posted_at DESC);
CREATE INDEX IF NOT EXISTS idx_reviews_status ON public.reviews(status, posted_at DESC);

ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

-- Public read of published reviews (anyone can see them on marketplace cards)
DROP POLICY IF EXISTS "Public read published reviews" ON public.reviews;
CREATE POLICY "Public read published reviews" ON public.reviews
  FOR SELECT USING (status = 'published');

-- The reviewed provider can read their own (even if flagged/hidden)
DROP POLICY IF EXISTS "Provider read own reviews" ON public.reviews;
CREATE POLICY "Provider read own reviews" ON public.reviews
  FOR SELECT USING (auth.uid() = provider_user_id);

-- Super admins manage everything (moderation)
DROP POLICY IF EXISTS "Super admins manage reviews" ON public.reviews;
CREATE POLICY "Super admins manage reviews" ON public.reviews
  FOR ALL USING (auth.uid() IN (SELECT user_id FROM public.super_admins));

-- INSERT only via service_role (the submit-review EF) — token-based auth, no user JWT.

-- ── Stats view (public read) ──
-- Aggregates per provider for fast marketplace card display
CREATE OR REPLACE VIEW public.provider_review_stats AS
SELECT
  provider_user_id,
  COUNT(*) AS review_count,
  ROUND(AVG(rating)::numeric, 1) AS avg_rating,
  COUNT(*) FILTER (WHERE rating = 5) AS count_5,
  COUNT(*) FILTER (WHERE rating = 4) AS count_4,
  COUNT(*) FILTER (WHERE rating = 3) AS count_3,
  COUNT(*) FILTER (WHERE rating = 2) AS count_2,
  COUNT(*) FILTER (WHERE rating = 1) AS count_1,
  MAX(posted_at) AS latest_review_at
FROM public.reviews
WHERE status = 'published' AND provider_user_id IS NOT NULL
GROUP BY provider_user_id;

GRANT SELECT ON public.provider_review_stats TO anon, authenticated;

-- ── Verification ──
SELECT 'reviews' AS t, count(*) AS rows FROM public.reviews
UNION ALL SELECT 'invoices.client_review_token col', count(*) FROM information_schema.columns WHERE table_schema='public' AND table_name='invoices' AND column_name='client_review_token';
