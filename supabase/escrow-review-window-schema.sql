-- ══════════════════════════════════════════════════════════════
-- Sprint 3A — Escrow review window (v9.77)
-- Lokizio holds the invoice in 'paid_pending_review' for 7 days after
-- the Stripe payment succeeds. The client can dispute during that window
-- (auto-refund). After the window closes without dispute, status -> 'paid'.
-- ══════════════════════════════════════════════════════════════

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS review_window_until timestamptz,
  ADD COLUMN IF NOT EXISTS disputed_by_client_at timestamptz,
  ADD COLUMN IF NOT EXISTS client_dispute_reason text,
  ADD COLUMN IF NOT EXISTS client_dispute_token text,                  -- magic token for client (no auth needed)
  ADD COLUMN IF NOT EXISTS review_auto_closed_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_invoices_review_pending
  ON public.invoices(review_window_until)
  WHERE status = 'paid_pending_review' AND review_window_until IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_invoices_client_dispute_token
  ON public.invoices(client_dispute_token)
  WHERE client_dispute_token IS NOT NULL;

-- Verification
SELECT 'review_window_until' AS col, count(*) AS exists FROM information_schema.columns WHERE table_schema='public' AND table_name='invoices' AND column_name='review_window_until';
