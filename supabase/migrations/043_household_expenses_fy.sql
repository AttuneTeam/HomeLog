-- Add financial_year_end to household_expenses so each FY is a separate snapshot.
-- Existing rows are assigned to the current FY at migration time.
ALTER TABLE household_expenses
  ADD COLUMN financial_year_end int NOT NULL DEFAULT
    CASE
      WHEN EXTRACT(MONTH FROM now()) >= 7 THEN EXTRACT(YEAR FROM now())::int + 1
      ELSE EXTRACT(YEAR FROM now())::int
    END;

-- Drop the default — new rows must always specify the FY explicitly.
ALTER TABLE household_expenses ALTER COLUMN financial_year_end DROP DEFAULT;
