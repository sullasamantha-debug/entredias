CREATE TABLE public.tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL,
  description text,
  date date NOT NULL DEFAULT current_date,
  due_date date,
  priority text NOT NULL DEFAULT 'media',
  category text,
  tags text[],
  status text NOT NULL DEFAULT 'pendente',
  completed_at timestamptz,
  goal_id uuid REFERENCES public.goals(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tasks TO authenticated;
GRANT ALL ON public.tasks TO service_role;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own tasks" ON public.tasks FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.wishes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  category text,
  wish_type text NOT NULL DEFAULT 'comprar',
  image_url text,
  link text,
  estimated_value numeric,
  paid_value numeric,
  priority text NOT NULL DEFAULT 'media',
  tags text[],
  notes text,
  status text NOT NULL DEFAULT 'quero',
  added_date date NOT NULL DEFAULT current_date,
  realized_date date,
  goal_id uuid REFERENCES public.goals(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.wishes TO authenticated;
GRANT ALL ON public.wishes TO service_role;
ALTER TABLE public.wishes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own wishes" ON public.wishes FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.list_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  scope text NOT NULL DEFAULT 'both',
  color text,
  icon text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, name)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.list_categories TO authenticated;
GRANT ALL ON public.list_categories TO service_role;
ALTER TABLE public.list_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own list categories" ON public.list_categories FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_wishes_updated_at BEFORE UPDATE ON public.wishes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();