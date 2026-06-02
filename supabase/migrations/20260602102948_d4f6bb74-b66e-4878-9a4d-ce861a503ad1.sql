-- Accounts table
CREATE TABLE public.accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  type text NOT NULL DEFAULT 'corrente',
  initial_balance numeric NOT NULL DEFAULT 0,
  color text DEFAULT '#7dd3fc',
  icon text DEFAULT 'Wallet',
  notes text,
  archived boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.accounts TO authenticated;
GRANT ALL ON public.accounts TO service_role;

ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "accounts own all"
ON public.accounts FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Link transactions to accounts (nullable for backward compatibility)
ALTER TABLE public.finances
  ADD COLUMN account_id uuid,
  ADD COLUMN to_account_id uuid;
