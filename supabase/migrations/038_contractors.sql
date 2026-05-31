-- Contractor database: normalised contractor records linked to expenses/quotes

CREATE TABLE contractors (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users NOT NULL,
  name text NOT NULL,
  abn text,
  email text,
  phone text,
  website text,
  address text,
  suburb text,
  state text,
  postcode text,
  trade_category text,
  notes text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Dedup by ABN per user (only when ABN is provided)
CREATE UNIQUE INDEX contractors_user_abn_unique
  ON contractors (user_id, abn)
  WHERE abn IS NOT NULL;

-- RLS
ALTER TABLE contractors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own contractors"
  ON contractors
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- updated_at trigger
CREATE OR REPLACE FUNCTION update_contractors_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER contractors_updated_at
  BEFORE UPDATE ON contractors
  FOR EACH ROW EXECUTE FUNCTION update_contractors_updated_at();

-- Link contractor_id to existing tables
ALTER TABLE expenses
  ADD COLUMN IF NOT EXISTS contractor_id uuid REFERENCES contractors(id);

ALTER TABLE renovation_quotes
  ADD COLUMN IF NOT EXISTS contractor_id uuid REFERENCES contractors(id);

ALTER TABLE rental_operating_expenses
  ADD COLUMN IF NOT EXISTS contractor_id uuid REFERENCES contractors(id);

-- Grant service role access
GRANT ALL ON contractors TO service_role;
