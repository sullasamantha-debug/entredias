ALTER TABLE public.savings_jars ADD COLUMN IF NOT EXISTS account_id uuid;
ALTER TABLE public.investments ADD COLUMN IF NOT EXISTS institution text;
ALTER TABLE public.investments ADD COLUMN IF NOT EXISTS invested_date date;