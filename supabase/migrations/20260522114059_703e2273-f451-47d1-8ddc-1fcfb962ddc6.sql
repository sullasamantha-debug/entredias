
-- ============== PODCAST SHOWS + EPISODES (2 níveis) ==============
CREATE TABLE IF NOT EXISTS public.podcast_shows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  platform text,
  cover_url text,
  tags text[] DEFAULT '{}',
  favorite boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.podcast_shows ENABLE ROW LEVEL SECURITY;
CREATE POLICY "podcast_shows own all" ON public.podcast_shows FOR ALL USING (auth.uid()=user_id) WITH CHECK (auth.uid()=user_id);

CREATE TABLE IF NOT EXISTS public.podcast_episodes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  show_id uuid NOT NULL REFERENCES public.podcast_shows(id) ON DELETE CASCADE,
  title text NOT NULL,
  listened_date date,
  duration_seconds integer DEFAULT 0,
  rating integer,
  notes text,
  favorite boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.podcast_episodes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "podcast_episodes own all" ON public.podcast_episodes FOR ALL USING (auth.uid()=user_id) WITH CHECK (auth.uid()=user_id);
CREATE INDEX IF NOT EXISTS idx_pod_eps_show ON public.podcast_episodes(show_id);

-- Migrar dados antigos da tabela podcasts: cria shows agrupados por nome+user e episodes
DO $$
DECLARE r record; new_show_id uuid;
BEGIN
  FOR r IN SELECT DISTINCT user_id, name, category FROM public.podcasts LOOP
    INSERT INTO public.podcast_shows (user_id, name, tags)
    VALUES (r.user_id, r.name, CASE WHEN r.category IS NULL THEN '{}'::text[] ELSE ARRAY[r.category] END)
    RETURNING id INTO new_show_id;

    INSERT INTO public.podcast_episodes (user_id, show_id, title, listened_date, duration_seconds, rating, notes, favorite, created_at)
    SELECT p.user_id, new_show_id, COALESCE(p.episode, p.name), p.date,
           COALESCE(p.duration_min,0)*60, p.rating, p.notes, p.favorite, p.created_at
    FROM public.podcasts p
    WHERE p.user_id = r.user_id AND p.name = r.name AND COALESCE(p.category,'') = COALESCE(r.category,'');
  END LOOP;
END $$;

-- ============== SERIES: tipo + end_date ==============
ALTER TABLE public.series ADD COLUMN IF NOT EXISTS kind text DEFAULT 'serie';
ALTER TABLE public.series ADD COLUMN IF NOT EXISTS end_date date;
ALTER TABLE public.series ADD COLUMN IF NOT EXISTS tags text[] DEFAULT '{}';

-- ============== MOVIES / BOOKS: tags ==============
ALTER TABLE public.movies ADD COLUMN IF NOT EXISTS tags text[] DEFAULT '{}';
ALTER TABLE public.books ADD COLUMN IF NOT EXISTS tags text[] DEFAULT '{}';

-- ============== FINANCES ==============
CREATE TABLE IF NOT EXISTS public.finances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  kind text NOT NULL DEFAULT 'expense', -- expense | income
  amount numeric(12,2) NOT NULL DEFAULT 0,
  category text,
  description text,
  date date NOT NULL DEFAULT current_date,
  payment_method text,
  installments integer DEFAULT 1,
  notes text,
  tags text[] DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.finances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "finances own all" ON public.finances FOR ALL USING (auth.uid()=user_id) WITH CHECK (auth.uid()=user_id);
CREATE INDEX IF NOT EXISTS idx_finances_date ON public.finances(user_id, date);
