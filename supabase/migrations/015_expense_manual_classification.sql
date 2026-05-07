CREATE TYPE manual_tax_classification AS ENUM (
  'Immediate Repair',
  'Repair',
  'Capital Works'
);

ALTER TABLE expenses
  ADD COLUMN manual_classification manual_tax_classification;
