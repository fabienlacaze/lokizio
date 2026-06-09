-- Table: connection_requests
-- Permet aux utilisateurs du marketplace de se connecter entre eux
CREATE TABLE IF NOT EXISTS connection_requests (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sender_name text NOT NULL DEFAULT '',
  sender_role text NOT NULL DEFAULT 'provider',
  sender_org_id uuid,
  receiver_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  receiver_name text NOT NULL DEFAULT '',
  receiver_role text NOT NULL DEFAULT 'provider',
  proposed_role text NOT NULL DEFAULT 'provider',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'refused')),
  message text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Index pour les requetes frequentes
CREATE INDEX IF NOT EXISTS idx_connection_requests_receiver ON connection_requests(receiver_id, status);
CREATE INDEX IF NOT EXISTS idx_connection_requests_sender ON connection_requests(sender_id, status);

-- RLS
ALTER TABLE connection_requests ENABLE ROW LEVEL SECURITY;

-- Politique: un utilisateur peut voir les demandes qu'il a envoyees ou recues
CREATE POLICY "Users can view own connection requests"
  ON connection_requests FOR SELECT
  USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

-- Politique: un utilisateur peut creer une demande (en tant qu'expediteur)
CREATE POLICY "Users can send connection requests"
  ON connection_requests FOR INSERT
  WITH CHECK (auth.uid() = sender_id);

-- Politique: le destinataire peut mettre a jour le statut (accepter/refuser)
CREATE POLICY "Receiver can update connection requests"
  ON connection_requests FOR UPDATE
  USING (auth.uid() = receiver_id);

-- Politique: l'expediteur peut supprimer sa demande
CREATE POLICY "Sender can delete own requests"
  ON connection_requests FOR DELETE
  USING (auth.uid() = sender_id);
