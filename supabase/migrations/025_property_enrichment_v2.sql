alter table public.property_enrichment
  add column if not exists sale_history jsonb default '[]'::jsonb,
  add column if not exists suburb_profile jsonb,
  add column if not exists street_and_council_history text;
