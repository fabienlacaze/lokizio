-- Missing column: organizations.onboarding_completed
-- Used by the app to decide whether to show the welcome wizard on first login.

ALTER TABLE organizations ADD COLUMN IF NOT EXISTS onboarding_completed boolean DEFAULT false;

NOTIFY pgrst, 'reload schema';
