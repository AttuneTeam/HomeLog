-- Value-add summaries: AI-generated narratives for renovation expenses

CREATE TABLE expense_value_summaries (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  expense_id uuid UNIQUE REFERENCES expenses(id) ON DELETE CASCADE NOT NULL,
  summary_text text NOT NULL,
  generated_at timestamptz DEFAULT now() NOT NULL,
  model_used text,
  is_edited boolean DEFAULT false NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- RLS: access via expense → renovation → property ownership
ALTER TABLE expense_value_summaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own expense value summaries"
  ON expense_value_summaries
  FOR ALL
  USING (
    expense_id IN (
      SELECT e.id FROM expenses e
      JOIN renovations r ON r.id = e.renovation_id
      JOIN properties p ON p.id = r.property_id
      WHERE p.user_id = auth.uid()
    )
  )
  WITH CHECK (
    expense_id IN (
      SELECT e.id FROM expenses e
      JOIN renovations r ON r.id = e.renovation_id
      JOIN properties p ON p.id = r.property_id
      WHERE p.user_id = auth.uid()
    )
  );

CREATE OR REPLACE FUNCTION update_expense_value_summaries_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER expense_value_summaries_updated_at
  BEFORE UPDATE ON expense_value_summaries
  FOR EACH ROW EXECUTE FUNCTION update_expense_value_summaries_updated_at();

-- Grant service role access
GRANT ALL ON expense_value_summaries TO service_role;
