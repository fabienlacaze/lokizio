-- Empeche les doublons de demandes de connexion actives (pending/accepted)
-- Index unique partiel: une seule ligne active par paire sender/receiver.

CREATE UNIQUE INDEX IF NOT EXISTS idx_connection_requests_unique_active
  ON connection_requests (
    LEAST(sender_id, receiver_id),
    GREATEST(sender_id, receiver_id)
  )
  WHERE status IN ('pending', 'accepted');

NOTIFY pgrst, 'reload schema';
