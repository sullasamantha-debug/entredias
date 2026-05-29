
-- finance_settings
CREATE TABLE public.finance_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  initial_balance numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.finance_settings TO authenticated;
GRANT ALL ON public.finance_settings TO service_role;
ALTER TABLE public.finance_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "finance_settings own all" ON public.finance_settings FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- savings_jars
CREATE TABLE public.savings_jars (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  current_amount numeric NOT NULL DEFAULT 0,
  goal numeric,
  color text DEFAULT '#7dd3fc',
  icon text DEFAULT 'PiggyBank',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.savings_jars TO authenticated;
GRANT ALL ON public.savings_jars TO service_role;
ALTER TABLE public.savings_jars ENABLE ROW LEVEL SECURITY;
CREATE POLICY "savings_jars own all" ON public.savings_jars FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- savings_movements
CREATE TABLE public.savings_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  jar_id uuid NOT NULL,
  kind text NOT NULL DEFAULT 'deposit',
  amount numeric NOT NULL DEFAULT 0,
  date date NOT NULL DEFAULT CURRENT_DATE,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.savings_movements TO authenticated;
GRANT ALL ON public.savings_movements TO service_role;
ALTER TABLE public.savings_movements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "savings_movements own all" ON public.savings_movements FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- investments
CREATE TABLE public.investments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  category text DEFAULT 'outros',
  invested_amount numeric NOT NULL DEFAULT 0,
  current_amount numeric NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.investments TO authenticated;
GRANT ALL ON public.investments TO service_role;
ALTER TABLE public.investments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "investments own all" ON public.investments FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- credit_cards
CREATE TABLE public.credit_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  card_limit numeric NOT NULL DEFAULT 0,
  closing_day integer NOT NULL DEFAULT 1,
  due_day integer NOT NULL DEFAULT 10,
  color text DEFAULT '#a78bfa',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.credit_cards TO authenticated;
GRANT ALL ON public.credit_cards TO service_role;
ALTER TABLE public.credit_cards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "credit_cards own all" ON public.credit_cards FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- budgets
CREATE TABLE public.budgets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  month text NOT NULL,
  category text,
  amount numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.budgets TO authenticated;
GRANT ALL ON public.budgets TO service_role;
ALTER TABLE public.budgets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "budgets own all" ON public.budgets FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE UNIQUE INDEX budgets_user_month_cat_idx ON public.budgets (user_id, month, COALESCE(category, ''));

-- finances additions
ALTER TABLE public.finances ADD COLUMN IF NOT EXISTS card_id uuid;
ALTER TABLE public.finances ADD COLUMN IF NOT EXISTS paid boolean NOT NULL DEFAULT true;
ALTER TABLE public.finances ADD COLUMN IF NOT EXISTS invoice_month text;
