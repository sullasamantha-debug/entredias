ALTER TABLE public.podcast_episodes
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'unheard';

UPDATE public.podcast_episodes
  SET status = 'listened'
  WHERE listened_date IS NOT NULL AND status = 'unheard';