-- Add 'read' column to messages for unread badge counter
ALTER TABLE messages ADD COLUMN IF NOT EXISTS read boolean DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_messages_read ON messages(org_id, read) WHERE read = false;
