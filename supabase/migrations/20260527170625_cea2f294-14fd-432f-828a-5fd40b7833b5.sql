ALTER TABLE public.podcast_episodes ALTER COLUMN status SET DEFAULT 'want';
UPDATE public.podcast_episodes SET status = 'want' WHERE status = 'unheard';