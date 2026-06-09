-- Table email_log pour tracker les emails envoyés
CREATE TABLE IF NOT EXISTS email_log (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  sender_id uuid REFERENCES auth.users(id),
  to_email text NOT NULL,
  subject text NOT NULL DEFAULT '',
  type text DEFAULT 'generic',
  status text DEFAULT 'pending',
  resend_id text,
  error text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_log_sender ON email_log(sender_id, created_at);

ALTER TABLE email_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own emails" ON email_log FOR SELECT
  USING (auth.uid() = sender_id);

CREATE POLICY "Users can insert emails" ON email_log FOR INSERT
  WITH CHECK (auth.uid() = sender_id);
