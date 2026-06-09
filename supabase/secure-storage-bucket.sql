-- Secure photos bucket: make it private + authenticated-only read
-- Run this in Supabase SQL Editor

-- 1. Make bucket private
UPDATE storage.buckets SET public = false WHERE id = 'lokizio-photos';

-- 2. Drop public read policy if it exists
DROP POLICY IF EXISTS "Public read access for photos" ON storage.objects;

-- 3. Authenticated users can read photos (RLS on properties/validations limits what they actually see)
CREATE POLICY IF NOT EXISTS "Authenticated users can read photos"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'lokizio-photos');

-- Notes:
-- - Clients MUST now request signed URLs to display images:
--   sb.storage.from('lokizio-photos').createSignedUrl(path, 3600)
-- - Public URLs (getPublicUrl) will stop working.
-- - view.html (read-only public view via token) cannot read photos anymore unless we add
--   a dedicated Edge Function that validates the token and returns signed URLs.
