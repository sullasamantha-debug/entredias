-- Add status columns to podcast_shows
ALTER TABLE public.podcast_shows
  ADD COLUMN IF NOT EXISTS show_status text NOT NULL DEFAULT 'ongoing',
  ADD COLUMN IF NOT EXISTS interest_status text NOT NULL DEFAULT 'listening';

-- Create storage bucket for podcast covers (public read)
INSERT INTO storage.buckets (id, name, public)
VALUES ('podcast-covers', 'podcast-covers', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies: public read, authenticated users manage own folder
CREATE POLICY "podcast covers public read"
ON storage.objects FOR SELECT
USING (bucket_id = 'podcast-covers');

CREATE POLICY "podcast covers insert own"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'podcast-covers'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "podcast covers update own"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'podcast-covers'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "podcast covers delete own"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'podcast-covers'
  AND auth.uid()::text = (storage.foldername(name))[1]
);
