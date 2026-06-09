-- Créer le bucket pour les photos Lokizio
-- À exécuter dans Supabase SQL Editor

-- 1. Créer le bucket (public pour lecture, auth pour upload)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'lokizio-photos',
  'lokizio-photos',
  true,  -- public read access
  1048576,  -- 1MB max par fichier (les photos sont compressées côté client)
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- 2. Policy: tout utilisateur authentifié peut uploader
CREATE POLICY "Authenticated users can upload photos"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'lokizio-photos');

-- 3. Policy: lecture publique (les URLs sont partagées entre membres)
CREATE POLICY "Public read access for photos"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'lokizio-photos');

-- 4. Policy: un utilisateur peut supprimer ses propres uploads
CREATE POLICY "Users can delete own photos"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'lokizio-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

-- 5. Policy: un utilisateur peut mettre à jour ses propres uploads (upsert)
CREATE POLICY "Users can update own photos"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'lokizio-photos');
