-- AI-generated renovation-level value-add summaries

CREATE TABLE renovation_summaries (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  renovation_id uuid UNIQUE REFERENCES renovations(id) ON DELETE CASCADE NOT NULL,
  summary_text text NOT NULL,
  generated_at timestamptz DEFAULT now() NOT NULL,
  model_used text,
  is_edited boolean DEFAULT false NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE renovation_summaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own renovation summaries"
  ON renovation_summaries
  FOR ALL
  USING (
    renovation_id IN (
      SELECT r.id FROM renovations r
      JOIN properties p ON p.id = r.property_id
      WHERE p.user_id = auth.uid()
    )
  )
  WITH CHECK (
    renovation_id IN (
      SELECT r.id FROM renovations r
      JOIN properties p ON p.id = r.property_id
      WHERE p.user_id = auth.uid()
    )
  );

CREATE OR REPLACE FUNCTION update_renovation_summaries_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER renovation_summaries_updated_at
  BEFORE UPDATE ON renovation_summaries
  FOR EACH ROW EXECUTE FUNCTION update_renovation_summaries_updated_at();

GRANT ALL ON renovation_summaries TO service_role;
