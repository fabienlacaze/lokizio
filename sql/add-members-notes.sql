-- Add an optional `notes` column to members so manual contacts can store
-- free-form notes (e.g. "available weekends, has a vehicle").
ALTER TABLE members ADD COLUMN IF NOT EXISTS notes text;
NOTIFY pgrst, 'reload schema';
