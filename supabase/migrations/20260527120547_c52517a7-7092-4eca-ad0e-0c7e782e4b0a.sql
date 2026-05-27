DROP POLICY IF EXISTS "podcast covers public read" ON storage.objects;

CREATE POLICY "podcast covers owner list"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'podcast-covers'
  AND auth.uid()::text = (storage.foldername(name))[1]
);