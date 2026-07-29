# Specification — FY Tax Pack

**Track ID:** `fy_tax_pack_20260729`
**Type:** Feature
**Status:** New

## Overview

Australian tax agents send their clients a checklist at tax time. For an investor, the
rental-property section of that checklist is the most laborious part to answer: annual rental
income, management statements, repairs and improvements split by tax treatment, and loan interest
statements — assembled per property, for a specific financial year, with evidence attached.

Home Base already holds most of this data but cannot currently produce it. The existing tax report
is per-property, is hardcoded to the *current* financial year, omits loan interest entirely, and
silently drops stamp duty and depreciation because of a broken query.

This track delivers the **FY Tax Pack**: a financial-year-parameterised, portfolio-wide export
that an investor generates once and forwards to their accountant. It is Phase 0 of the go-to-market
described in `docs/b2b-strategy-pitch.md` — the artifact that makes the tool worth an accountant's
time and opens the distribution channel.

## Goals

1. An investor can select any financial year and generate a complete, correct pack for their whole
   portfolio in one action.
2. The pack answers the rental-property section of a standard tax-agent checklist without further
   manual assembly.
3. Every figure is traceable to the document behind it, and estimates are visibly distinguished
   from recorded facts.
4. What Home Base does *not* track is stated explicitly rather than silently omitted.

## Non-goals

- Lodging or preparing a tax return. The pack is decision support for a human agent.
- Answering the non-rental sections of a tax checklist (work-related deductions, offsets, shares
  and crypto, business income, HELP debt). These are out of the product's domain; the pack flags
  them as untracked.
- The accountant roster view and bulk multi-client generation. Deferred to a follow-on track.

## Users & stories

- **As an investor**, I select FY 2025–26 and download a single file I can forward to my
  accountant, so I don't spend a weekend assembling spreadsheets and chasing invoices.
- **As an investor with a co-owned property**, the pack reports my share of income and deductions,
  not the whole property's, so my accountant doesn't have to apportion it manually.
- **As an accountant** receiving the pack, I can see each figure's source, whether it is an actual
  or an estimate, and open the supporting invoice without a link that has expired.

## Functional requirements

### FR1 — Financial year selection

- FY bounds are computed by a pure helper taking an explicit financial-year-end year, honouring
  the user's configured `profiles.financial_year_start_month` / `_day` (AU default 1 July).
- The current derivation in `app/(dashboard)/properties/[propertyId]/tax-report/page.tsx`, which
  infers the FY from `new Date()`, is replaced by this helper. Today that derivation returns
  FY2026–27 and cannot produce the year a 2026 return actually needs.
- The UI offers a year selector defaulting to the most recently *completed* financial year, not
  the in-progress one, since that is the year being prepared.
- Selection is reflected in the URL so a pack view is linkable and reloadable.

### FR2 — Correct source data (bug fix)

- `roi_calculator_inputs` is queried by `property_id`. The current `.eq("user_id", user.id)`
  filter references a column dropped by migration `009_roi_per_property.sql`, so the query fails
  and stamp duty and depreciation are silently absent from the CGT cost base.
- The same defect in `components/roi-calculator.tsx` (upserting `user_id`) is corrected.
- `lib/supabase/database.types.ts` is corrected by hand to match the real schema, removing the
  stale `user_id` declaration that let this type-check.
- Stamp duty resolves from `properties.stamp_duty` first, falling back to
  `roi_calculator_inputs.stamp_duty`, with the source labelled.

### FR3 — Per-FY property facts

New per-year facts, so historical years stay correct when circumstances change:

- **Ownership percentage** — the owner's share. Applied to income and deductions in the pack.
  Defaults to 100%.
- **Days available for rent** and **private-use days** — used to apportion *deductions*. Income is
  not apportioned by availability.
- Where facts are absent for a year, the pack assumes 100% ownership and full-year availability
  **and states that assumption explicitly** rather than presenting it as recorded.

### FR4 — Rental income

- Income is sourced from `rental_payments` (actual, ingested from agent emails) where records
  exist within the FY.
- Where none exist, fall back to the `rental_periods` accrual (weekly rent × FY-clamped weeks).
- The pack states which source was used per property, and shows the other as a cross-check where
  both are available. A material divergence between them is surfaced as a warning, not hidden.

### FR5 — Loan interest

- The user uploads an annual loan statement per loan per FY.
- Interest paid, lender, account identifier and statement period are extracted using the existing
  pipeline (Storage → `pdf-parse` / Claude Vision → `generateObject` with a zod schema), following
  the staged-review pattern: extraction proposes, the user confirms.
- The extracted figure is editable; the statement file is retained as evidence and included in the
  pack.
- Where no statement exists, the pack may show the computed estimate from `property_loans` and
  `loan_interest_rates`, **clearly labelled an estimate and excluded from claimed totals.**

### FR6 — Rental schedule

Per property, in ATO rental-schedule line order:

- Gross rent, then deductions: interest, council rates, water, insurance, land tax, strata fees,
  agent management fees, repairs and maintenance, capital works (Div 43), other.
- Repairs are drawn from expenses classified `Repair` / `Immediate Repair`, plus
  `rental_operating_expenses` in the `repairs_maintenance` category.
- Renovations with `claimable = false` and properties with `property_type = 'primary_residence'`
  are excluded.
- Each line is apportioned by ownership percentage and, where deductions are affected, by private
  use.
- Ends with net rental income or loss.

### FR7 — Capital works (Div 43) register

- A cumulative register across all years, not only the selected FY.
- Each capital works item carries its own completion date and starts its own 40-year run from
  that date; the register shows, per item, the amount, start date, years elapsed, this year's
  claim, and the written-down balance.
- The rate defaults to 2.5% per annum and is stored per item so a different rate can be recorded
  where one applies. Eligibility by construction date is determined by the user's quantity
  surveyor, not inferred by the product.
- Part-year items in their first year are apportioned by days.

### FR8 — Div 40 (plant & equipment)

- The user uploads a quantity surveyor report and records the annual Div 43 and Div 40 figures it
  states, per FY.
- The report is retained as evidence and included in the pack.
- No per-asset effective-life modelling. Where no QS report exists, the pack states that plant and
  equipment depreciation is not tracked and directs the agent to the QS report.

### FR9 — Evidence index

- Every expense, operating expense, loan statement and QS report referenced by a figure appears in
  an index with its date, supplier, ABN, amount, GST, the schedule line it feeds, and its file.
- Documents are exported as actual files, not links. Signed storage URLs currently expire after
  one hour and are unusable in an emailed report.

### FR10 — Pre-filled questionnaire

- The pack includes the tax-agent checklist with the rental-property section pre-answered from the
  data, and every other section marked **"Not tracked in Home Base — please answer."**
- Sections explicitly listed as untracked: motor vehicle, travel, clothing and laundry,
  self-education, other work-related expenses and WFH hours, private health insurance, spouse and
  dependants, zone offsets, shares/managed funds/crypto disposals, business income, HELP/HECS.
- Where the product *can* partially answer — property purchased or sold during the year, derived
  from `properties.purchase_date` — it does so and marks it for confirmation.

### FR11 — Output

- A single ZIP containing:
  - `tax-pack-<FY>.pdf` — cover, portfolio summary, per-property rental schedules, Div 43
    register, CGT cost base, questionnaire, disclaimer.
  - `tax-pack-<FY>.xlsx` — the same figures as data, one sheet per property plus a summary sheet,
    so the agent can key or import them.
  - `evidence/` — invoices, loan statements and QS reports, named predictably and listed in a
    `manifest.csv` that maps each file to the figure it supports.
- Generation is asynchronous with visible progress; the UI is never blocked on it.

## Non-functional requirements

- **Correctness over completeness.** A figure that cannot be sourced is omitted and flagged, never
  estimated silently.
- **Trust.** Every tax-facing page carries the disclaimer required by `product-guidelines.md`. AI
  extraction is reviewable and overridable.
- **Isolation.** All queries run under RLS with `createClient`. A user can only ever generate a
  pack over data they own or that is shared with them.
- **Performance.** Signed-URL generation and file fetching are batched, not sequential per
  expense. The current report generates signed URLs in a loop; the pack must not.
- **Accessibility & theming.** Any new UI is legible in light and dark themes and keyboard
  navigable.

## Data model changes

New migrations, sequentially numbered from `054`:

- `property_fy_facts` — `(property_id, financial_year_end)` primary key; `ownership_pct`,
  `days_available_for_rent`, `private_use_days`, `notes`.
- `loan_statements` — per loan per FY; `financial_year_end`, `interest_paid`, `lender`,
  `account_ref`, `period_start`, `period_end`, `storage_path`, `extracted` JSONB, `confirmed_at`.
- `depreciation_reports` — per property per FY; `div43_annual`, `div40_annual`, `storage_path`,
  `qs_firm`, `report_date`.
- `capital_works_items` — either a new table or columns on existing capital expenses, carrying
  `start_date`, `rate_pct` (default 2.5) and `amount` for the Div 43 register.

Every new table gets an RLS policy scoped through property ownership, and a hand-written entry in
`lib/supabase/database.types.ts`.

## Acceptance criteria

1. Selecting FY 2025–26 in July 2026 produces a pack for 1 Jul 2025 – 30 Jun 2026, not the
   current year.
2. The CGT cost base section shows stamp duty and depreciation where recorded; the
   `roi_calculator_inputs` query no longer references a non-existent column.
3. A property with a rental payment recorded in the FY reports income from actuals and says so; a
   property without one reports the accrual and labels it an estimate.
4. A property at 50% ownership reports half the gross rent and half of each deduction.
5. An uploaded loan statement is extracted, presented for confirmation, editable, and its interest
   appears on the schedule's interest line with the file in the pack.
6. A capital works item completed mid-FY three years ago shows three years elapsed, a part-year
   first claim, a full 2.5% claim this year, and the correct written-down balance.
7. The downloaded ZIP opens without network access, and every document referenced in the PDF is
   present in `evidence/` and listed in `manifest.csv`.
8. A primary residence and a renovation marked `claimable = false` appear nowhere in the pack.
9. The questionnaire lists every untracked section explicitly.
10. `npm run build` passes; `npm run db:reset` replays all migrations cleanly.

## Out of scope

- Accountant roster view and bulk multi-client pack generation.
- Per-asset Div 40 register with effective lives, methods and disposals.
- CGT event calculation on disposal (the pack reports cost base only).
- Non-rental checklist sections beyond flagging them as untracked.
- Direct lodgement, or emailing the pack to the agent from within the product.
- Internationalisation. AUD and the Australian FY model only.

## Risks & open questions

- **AI extraction accuracy on loan statements.** Lender formats vary. Mitigated by the
  staged-review pattern: the user confirms before the figure is used. Confidence is surfaced.
- **No test framework.** Per `workflow.md`, the domain math here is Tier 1 — highest consequence
  if wrong. This track introduces a test runner for the new FY and Div 43 helpers rather than
  deferring it, since the calculations are pure and cheap to cover.
- **Div 43 eligibility by construction date** is genuinely complex and jurisdiction-dependent. The
  product records what the QS determined; it does not attempt to determine eligibility itself.
- **Divergence between actual and accrued rent** may reveal missing data rather than an error.
  Surfaced as a warning for the user to investigate, never silently reconciled.
