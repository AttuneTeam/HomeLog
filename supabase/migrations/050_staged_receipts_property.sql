-- Bulk import now always happens within the context of a property: the chosen
-- property is recorded on each staged receipt at upload, scoping the review
-- queue and the renovation picker to that property.

alter table public.staged_receipts
  add column if not exists property_id uuid references public.properties(id) on delete set null;

create index if not exists staged_receipts_user_property_idx
  on public.staged_receipts (user_id, property_id);
