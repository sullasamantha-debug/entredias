
-- Add FITID and import link to finances
ALTER TABLE public.finances
  ADD COLUMN IF NOT EXISTS fitid TEXT,
  ADD COLUMN IF NOT EXISTS ofx_import_id UUID;

CREATE INDEX IF NOT EXISTS idx_finances_fitid ON public.finances (user_id, account_id, fitid) WHERE fitid IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_finances_ofx_import ON public.finances (ofx_import_id) WHERE ofx_import_id IS NOT NULL;

-- OFX imports history
CREATE TABLE IF NOT EXISTS public.ofx_imports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
  file_name TEXT,
  period_start DATE,
  period_end DATE,
  imported_count INTEGER NOT NULL DEFAULT 0,
  skipped_count INTEGER NOT NULL DEFAULT 0,
  duplicate_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ofx_imports TO authenticated;
GRANT ALL ON public.ofx_imports TO service_role;
ALTER TABLE public.ofx_imports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ofx_imports own all" ON public.ofx_imports
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Learned category rules
CREATE TABLE IF NOT EXISTS public.ofx_category_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pattern TEXT NOT NULL,
  category TEXT NOT NULL,
  cat_type TEXT NOT NULL DEFAULT 'despesa',
  hits INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, pattern)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ofx_category_rules TO authenticated;
GRANT ALL ON public.ofx_category_rules TO service_role;
ALTER TABLE public.ofx_category_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ofx_category_rules own all" ON public.ofx_category_rules
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
