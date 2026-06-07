CREATE TYPE expense_frequency AS ENUM ('monthly', 'quarterly', 'yearly');

CREATE TABLE household_expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  label text NOT NULL,
  amount numeric(12,2) NOT NULL DEFAULT 0,
  frequency expense_frequency NOT NULL DEFAULT 'monthly',
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE household_expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own household expenses"
  ON household_expenses FOR ALL USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION update_household_expenses_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_household_expenses_updated_at
  BEFORE UPDATE ON household_expenses
  FOR EACH ROW EXECUTE FUNCTION update_household_expenses_updated_at();

GRANT ALL ON household_expenses TO service_role;
