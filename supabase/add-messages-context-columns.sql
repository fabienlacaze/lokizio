-- Ajoute des colonnes de contexte aux messages pour filtrage fin (tenant chat notamment).
-- Retro-compatible: anciens messages sans property_id/reservation_id restent visibles par l'org (canal general).

ALTER TABLE messages ADD COLUMN IF NOT EXISTS property_id uuid REFERENCES properties(id) ON DELETE SET NULL;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS reservation_id uuid REFERENCES reservations(id) ON DELETE SET NULL;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS recipient_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_messages_property ON messages(property_id) WHERE property_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_messages_reservation ON messages(reservation_id) WHERE reservation_id IS NOT NULL;

-- RLS: un tenant ne voit que les messages de SA reservation/property (+ ceux qui lui sont explicitement adresses)
DROP POLICY IF EXISTS "Tenant messages scoped" ON messages;
CREATE POLICY "Tenant messages scoped" ON messages FOR SELECT
  USING (
    -- Membre staff (admin/concierge/owner/provider) voit tout l'org
    (auth.user_role() IN ('admin','manager','concierge','owner','provider') AND org_id = auth.user_org_id())
    OR
    -- Tenant: uniquement sa reservation, sa property, ou message qui lui est adresse
    (auth.user_role() = 'tenant' AND (
      sender_id = auth.uid()
      OR recipient_user_id = auth.uid()
      OR reservation_id IN (SELECT id FROM reservations WHERE tenant_user_id = auth.uid())
      OR property_id IN (SELECT property_id FROM reservations WHERE tenant_user_id = auth.uid() AND status = 'active')
    ))
  );

NOTIFY pgrst, 'reload schema';
