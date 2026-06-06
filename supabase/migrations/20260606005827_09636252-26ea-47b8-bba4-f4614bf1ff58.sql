
-- Planejamento financeiro mensal: receitas previstas + extensão de budgets

CREATE TABLE IF NOT EXISTS public.planned_incomes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  month text NOT NULL,
  description text NOT NULL,
  category text,
  amount numeric NOT NULL DEFAULT 0,
  expected_date date,
  account_id uuid,
  received boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.planned_incomes TO authenticated;
GRANT ALL ON public.planned_incomes TO service_role;

ALTER TABLE public.planned_incomes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "planned_incomes own all" ON public.planned_incomes;
CREATE POLICY "planned_incomes own all" ON public.planned_incomes
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS planned_incomes_user_month_idx ON public.planned_incomes(user_id, month);

-- Extend budgets to support multiple kinds (category / reserve / investment / card)
ALTER TABLE public.budgets ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'category';
ALTER TABLE public.budgets ADD COLUMN IF NOT EXISTS ref_id uuid;
ALTER TABLE public.budgets ADD COLUMN IF NOT EXISTS realized_amount numeric;
ALTER TABLE public.budgets ADD COLUMN IF NOT EXISTS label text;

-- Replace unique constraint to consider kind + ref_id
DROP INDEX IF EXISTS budgets_user_month_cat_idx;
CREATE UNIQUE INDEX IF NOT EXISTS budgets_user_month_unique
  ON public.budgets(user_id, month, kind, COALESCE(category, ''), COALESCE(ref_id::text, ''));
