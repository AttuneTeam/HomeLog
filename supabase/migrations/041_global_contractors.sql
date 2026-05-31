-- Normalise contractors into a global shared table so a contractor with the
-- same ABN is never duplicated across users.  A user_contractors join table
-- tracks which contractors each user has worked with.

BEGIN;

-- 1. Drop FK constraints that reference the old per-user contractors table
ALTER TABLE expenses
  DROP CONSTRAINT IF EXISTS expenses_contractor_id_fkey;
ALTER TABLE renovation_quotes
  DROP CONSTRAINT IF EXISTS renovation_quotes_contractor_id_fkey;
ALTER TABLE rental_operating_expenses
  DROP CONSTRAINT IF EXISTS rental_operating_expenses_contractor_id_fkey;

-- 2. Stash the old per-user table
ALTER TABLE contractors RENAME TO _contractors_legacy;

-- 3. Global contractors table — no user_id
CREATE TABLE contractors (
  id             uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name           text NOT NULL,
  abn            text UNIQUE,
  email          text,
  phone          text,
  website        text,
  address        text,
  suburb         text,
  state          text,
  postcode       text,
  trade_category text,
  created_at     timestamptz DEFAULT now() NOT NULL,
  updated_at     timestamptz DEFAULT now() NOT NULL
);

-- 4. Per-user relationship table
CREATE TABLE user_contractors (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       uuid REFERENCES auth.users NOT NULL,
  contractor_id uuid REFERENCES contractors(id) NOT NULL,
  notes         text,
  created_at    timestamptz DEFAULT now() NOT NULL,
  UNIQUE (user_id, contractor_id)
);

-- 5. Temporary mapping: legacy id → new global id
CREATE TEMP TABLE _cid_map (old_id uuid, new_id uuid);

-- 6a. Deduplicate by ABN — one global record per unique ABN
WITH representative AS (
  SELECT DISTINCT ON (abn)
    id, name, abn, email, phone, website,
    address, suburb, state, postcode, trade_category,
    created_at, updated_at
  FROM _contractors_legacy
  WHERE abn IS NOT NULL
  ORDER BY abn, created_at
),
inserted AS (
  INSERT INTO contractors
    (name, abn, email, phone, website, address, suburb, state, postcode, trade_category, created_at, updated_at)
  SELECT
    name, abn, email, phone, website, address, suburb, state, postcode, trade_category, created_at, updated_at
  FROM representative
  RETURNING id, abn
)
INSERT INTO _cid_map (old_id, new_id)
SELECT l.id, i.id
FROM _contractors_legacy l
JOIN inserted i ON l.abn = i.abn
WHERE l.abn IS NOT NULL;

-- 6b. Deduplicate by lower(name) for ABN-less contractors
WITH representative AS (
  SELECT DISTINCT ON (lower(name))
    id, name, email, phone, website,
    address, suburb, state, postcode, trade_category,
    created_at, updated_at
  FROM _contractors_legacy
  WHERE abn IS NULL
  ORDER BY lower(name), created_at
),
inserted AS (
  INSERT INTO contractors
    (name, abn, email, phone, website, address, suburb, state, postcode, trade_category, created_at, updated_at)
  SELECT
    name, NULL, email, phone, website, address, suburb, state, postcode, trade_category, created_at, updated_at
  FROM representative
  RETURNING id, name
)
INSERT INTO _cid_map (old_id, new_id)
SELECT l.id, i.id
FROM _contractors_legacy l
JOIN inserted i ON lower(l.name) = lower(i.name)
WHERE l.abn IS NULL;

-- 7. Update FK columns in linked tables to the new global IDs
UPDATE expenses e
  SET contractor_id = m.new_id
  FROM _cid_map m
  WHERE e.contractor_id = m.old_id;

UPDATE renovation_quotes rq
  SET contractor_id = m.new_id
  FROM _cid_map m
  WHERE rq.contractor_id = m.old_id;

UPDATE rental_operating_expenses roe
  SET contractor_id = m.new_id
  FROM _cid_map m
  WHERE roe.contractor_id = m.old_id;

-- 8. Populate user_contractors from the mapping, carrying over per-user notes
INSERT INTO user_contractors (user_id, contractor_id, notes)
SELECT DISTINCT l.user_id, m.new_id, l.notes
FROM _contractors_legacy l
JOIN _cid_map m ON l.id = m.old_id
ON CONFLICT (user_id, contractor_id) DO NOTHING;

-- 9. Re-add FK constraints pointing at the new global table
ALTER TABLE expenses
  ADD CONSTRAINT expenses_contractor_id_fkey
  FOREIGN KEY (contractor_id) REFERENCES contractors(id);

ALTER TABLE renovation_quotes
  ADD CONSTRAINT renovation_quotes_contractor_id_fkey
  FOREIGN KEY (contractor_id) REFERENCES contractors(id);

ALTER TABLE rental_operating_expenses
  ADD CONSTRAINT rental_operating_expenses_contractor_id_fkey
  FOREIGN KEY (contractor_id) REFERENCES contractors(id);

-- 10. RLS — contractors readable/writable by any authenticated user;
--     user_contractors scoped to owner
ALTER TABLE contractors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read contractors"
  ON contractors FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert contractors"
  ON contractors FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update contractors"
  ON contractors FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE user_contractors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own contractor links"
  ON user_contractors FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 11. updated_at trigger on new contractors table
--     (CREATE OR REPLACE reuses the function from migration 038)
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

-- 12. Service role access
GRANT ALL ON contractors TO service_role;
GRANT ALL ON user_contractors TO service_role;

-- 13. Drop legacy table — cascades its trigger, index, and RLS policies
DROP TABLE _contractors_legacy;

COMMIT;
