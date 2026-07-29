-- ============================================================
-- depreciation_reports: quantity surveyor figures, per property per year
--
-- Division 40 (plant and equipment) depreciation depends on per-asset
-- effective lives, the choice of prime cost versus diminishing value, and the
-- post-9-May-2017 restriction on previously-used plant in second-hand
-- residential property. A quantity surveyor already determines all of this and
-- issues a schedule.
--
-- The product therefore RECORDS what the QS determined rather than deriving it.
-- Rebuilding that logic would duplicate work the QS was paid for and take on
-- liability the product should not hold — consistent with the "decision
-- support, never automated filing" principle in conductor/product.md.
--
-- One row per property per financial year, holding the annual figures that
-- year's schedule states. The same underlying PDF is normally cited by several
-- years, so storage_path repeats across rows by design.
--
-- FILE-BEARING TABLE: storage_path points into the `property-files` bucket.
-- Per docs/account-deletion.md this column MUST be enumerated in both
-- user_storage_objects() and property_storage_objects(). Both functions are
-- redefined later in this phase to include it.
-- ============================================================

create table public.depreciation_reports (
  property_id        uuid not null references public.properties(id) on delete cascade,
  financial_year_end int  not null check (financial_year_end between 1990 and 2200),

  -- Annual deductions as stated by the schedule for this year.
  div43_annual       numeric(12,2) check (div43_annual >= 0),
  div40_annual       numeric(12,2) check (div40_annual >= 0),

  -- The report itself, retained as evidence and shipped in the tax pack.
  storage_path       text,
  qs_firm            text,
  report_date        date,
  notes              text,

  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),

  primary key (property_id, financial_year_end)
);

alter table public.depreciation_reports enable row level security;

create policy "depreciation_reports: select" on public.depreciation_reports
  for select using (has_property_read_access(property_id));

create policy "depreciation_reports: write" on public.depreciation_reports
  for all using (has_property_write_access(property_id))
  with check (has_property_write_access(property_id));

create trigger trg_depreciation_reports_updated_at
  before update on public.depreciation_reports
  for each row execute function public.set_updated_at();

create index on public.depreciation_reports (financial_year_end);

grant select, insert, update, delete on public.depreciation_reports to authenticated;
grant all on public.depreciation_reports to service_role;
