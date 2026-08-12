CREATE TABLE public.investment_movements (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  investment_id uuid NOT NULL REFERENCES public.investments(id) ON DELETE CASCADE,
  kind text NOT NULL,
  amount numeric NOT NULL,
  date date NOT NULL,
  account_id uuid REFERENCES public.accounts(id) ON DELETE SET NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.investment_movements TO authenticated;
GRANT ALL ON public.investment_movements TO service_role;

ALTER TABLE public.investment_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own investment movements"
ON public.investment_movements FOR ALL TO authenticated
USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

ALTER TABLE public.savings_movements
  ADD COLUMN IF NOT EXISTS account_id uuid REFERENCES public.accounts(id) ON DELETE SET NULL;
