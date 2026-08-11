ALTER TABLE public.ofx_imports
  ADD COLUMN IF NOT EXISTS source_type text NOT NULL DEFAULT 'ofx',
  ADD COLUMN IF NOT EXISTS found_count integer NOT NULL DEFAULT 0;