-- ============================================================
-- property_fy_facts: per-financial-year facts about a property
--
-- Ownership share and rental availability both change over time, and a tax
-- pack for a past year must reflect what was true *then*. Storing these on
-- properties would mean today's percentage silently rewrites history: a
-- property sold down from 100% to 50% would report last year's figures at the
-- new share and quietly overstate the deduction.
--
-- Keyed on (property_id, financial_year_end) so each year is its own record.
-- financial_year_end is the calendar year the FY ends in — 2026 for 2025–26,
-- matching lib/tax/fy.ts.
-- ============================================================

create table public.property_fy_facts (
  property_id             uuid not null references public.properties(id) on delete cascade,
  financial_year_end      int  not null check (financial_year_end between 1990 and 2200),

  -- The owner's share of this property, used to apportion both income and
  -- deductions. Defaults to sole ownership.
  ownership_pct           numeric(5,2) not null default 100
                            check (ownership_pct > 0 and ownership_pct <= 100),

  -- Days the property was genuinely available for rent, and days it was put to
  -- private use. Used to apportion DEDUCTIONS only — income is never
  -- apportioned by availability. 366 to allow for a leap year.
  days_available_for_rent int check (days_available_for_rent between 0 and 366),
  private_use_days        int check (private_use_days between 0 and 366),

  notes                   text,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),

  primary key (property_id, financial_year_end)
);

alter table public.property_fy_facts enable row level security;

-- Read for owner, active co-owner, or property viewer (e.g. an accountant).
create policy "property_fy_facts: select" on public.property_fy_facts
  for select using (has_property_read_access(property_id));

-- Write for owner or active co-owner only. Viewers are read-only.
create policy "property_fy_facts: write" on public.property_fy_facts
  for all using (has_property_write_access(property_id))
  with check (has_property_write_access(property_id));

create trigger trg_property_fy_facts_updated_at
  before update on public.property_fy_facts
  for each row execute function public.set_updated_at();

create index on public.property_fy_facts (financial_year_end);

grant select, insert, update, delete on public.property_fy_facts to authenticated;
grant all on public.property_fy_facts to service_role;
