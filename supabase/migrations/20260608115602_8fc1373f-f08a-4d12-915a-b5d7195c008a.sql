CREATE TABLE public.finance_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('receita','despesa','reserva','investimento')),
  color TEXT,
  icon TEXT,
  archived BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX finance_categories_user_type_name_uniq
  ON public.finance_categories (user_id, type, lower(name));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.finance_categories TO authenticated;
GRANT ALL ON public.finance_categories TO service_role;
ALTER TABLE public.finance_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "finance_categories own all" ON public.finance_categories
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);