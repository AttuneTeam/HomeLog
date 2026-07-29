# Implementation Plan — FY Tax Pack

**Track ID:** `fy_tax_pack_20260729`
**Spec:** [spec.md](./spec.md)
**Workflow:** [../../workflow.md](../../workflow.md)

Phases are ordered so that each one ends in something usable. Phase 1 alone makes the existing
tax report correct for FY 2025–26 — if the track stops there, real value has still shipped.

Verification tiers are per `workflow.md`. Tier 1 tasks write tests first.

---

## Phase 1 — Foundations: correctness and financial year [checkpoint: f5e1af6]

*Goal: the existing per-property tax report becomes correct and can be generated for any past
financial year.*

- [x] Task: Introduce a test runner (Tier 1 enabler) `02b9392`
  - [x] Install and configure Vitest with a `test` script and `CI=true` support
  - [x] Add a `tests/` convention consistent with the repo's structure and document it in `tech-stack.md`
  - [x] Confirm a trivial passing test runs via `CI=true npm test`
  - [x] Update `conductor/workflow.md` to remove the "no runner" accommodations now satisfied

- [x] Task: Extract a pure financial-year helper `ab52194`
  - [x] Write failing tests for `lib/tax/fy.ts` covering: AU default 1 July start, a custom FY start on the profile, the most-recently-completed FY resolver, leap years, and boundary dates on 30 June / 1 July
  - [x] Implement `fyBounds(fyEndYear, startMonth, startDay)` and `mostRecentCompletedFy(today, ...)` returning inclusive ISO date bounds and a `2025–26` display label
  - [x] Confirm tests pass

- [x] Task: Fix the `roi_calculator_inputs` query defect `33637df`
  - [x] Correct `app/(dashboard)/properties/[propertyId]/tax-report/page.tsx` to filter by `property_id`
  - [x] Correct the `user_id` upsert in `components/roi-calculator.tsx`
  - [x] Hand-correct `lib/supabase/database.types.ts` to remove the stale `user_id` declaration so this cannot silently type-check again
  - [x] Verify against a local database that stamp duty and depreciation now appear in the CGT cost base

- [x] Task: Replace date-derived FY with explicit selection `f5e1af6`
  - [x] Wire `lib/tax/fy.ts` into the tax report page, removing the `new Date()` derivation
  - [x] Add a financial-year selector defaulting to the most recently completed FY, reflected in the URL
  - [x] Resolve stamp duty from `properties.stamp_duty` first, falling back to `roi_calculator_inputs`, with the source labelled
  - [x] Verify FY 2025–26 can be generated and returns 1 Jul 2025 – 30 Jun 2026 data

- [x] Task: Phase Verification & Checkpoint (Refer to workflow.md) `f5e1af6`

---

## Phase 2 — Schema and per-FY property facts [checkpoint: ca78938]

*Goal: the data model can express ownership, availability, interest and depreciation per year.*

- [x] Task: Add `property_fy_facts` (migration 054) `656818d`
  - [x] Write the migration: `(property_id, financial_year_end)` PK, `ownership_pct` default 100, `days_available_for_rent`, `private_use_days`, `notes`
  - [x] Add an RLS policy scoped through property ownership
  - [x] Hand-add the row type to `lib/supabase/database.types.ts`
  - [x] Verify a non-owner is **denied** access, not merely that the owner is allowed
  - [x] Confirm `npm run db:reset` replays cleanly

- [x] Task: Add `loan_statements` (migration 055) `f266f47`
  - [x] Write the migration: per loan per FY — `financial_year_end`, `interest_paid`, `lender`, `account_ref`, `period_start`, `period_end`, `storage_path`, `extracted` JSONB, `confidence`, `confirmed_at`
  - [x] Add the RLS policy and hand-add the row type
  - [x] Verify non-owner denial and a clean `db:reset`

- [x] Task: Add `depreciation_reports` (migration 056) `103e0e5`
  - [x] Write the migration: per property per FY — `div43_annual`, `div40_annual`, `storage_path`, `qs_firm`, `report_date`
  - [x] Add the RLS policy and hand-add the row type
  - [x] Verify non-owner denial and a clean `db:reset`

- [x] Task: Fix the classification vocabulary mismatch *(inserted — see git note)* `2d68ac9`
  - [x] Write failing tests for a shared resolver mapping `renovations.classification` (`repair`/`capital_improvement`/`initial_repair`) onto the tax vocabulary (`Repair`/`Capital Works`/`Immediate Repair`), with the per-expense manual override taking precedence
  - [x] Implement `lib/tax/classification.ts`
  - [x] Wire the tax report to it, replacing the comparison that silently routed unoverridden capital improvements into repairs
  - [x] Confirm tests pass and the report groups expenses correctly

- [x] Task: Add Div 43 capital works item fields (migration 057) `5b3d412`
  - [x] Add `start_date` and `rate_pct` (default 2.5) to capital works expenses, per the spec's data model section
  - [x] Backfill `start_date` from the existing expense or renovation end date
  - [x] Add the RLS policy if a new table is used; hand-add types *(columns on `expenses`, so the existing policies apply unchanged)*
  - [x] Verify a clean `db:reset`

- [x] Task: Per-FY facts editing UI `9e54777`
  - [x] Build a form to record ownership percentage, days available for rent and private-use days for a selected FY
  - [x] Default to 100% ownership and full-year availability, showing these as assumptions rather than recorded values
  - [~] Verify in light and dark themes, and on a narrow viewport *(deferred to the phase checkpoint — needs a browser)*

- [x] Task: Verify account-deletion invariants still hold `c4d8297`
  - [x] Review `docs/account-deletion.md` — each new file-bearing table must be covered by deletion
  - [x] Extend deletion to cover `loan_statements` and `depreciation_reports` storage objects *(migration 058)*
  - [x] Run `npm run verify:deletion`

- [x] Task: Derive days available from dates *(inserted — user feedback at checkpoint)* `8a0b2bb`
  - [x] Add `available_from` / `available_to` to `property_fy_facts` (migration 059), storing the source fact rather than only the derived count
  - [x] Write failing tests for a pure `daysAvailableInFy` that clamps a date range to the financial year, inclusive
  - [x] Update the panel to take dates and show the computed days
  - [x] Verify the clamping and the round-trip against a local database

- [x] Task: Suggest availability from existing rental periods *(inserted — user feedback at checkpoint)* `ca78938`
  - [x] Write failing tests for a pure `suggestAvailabilityFromTenancies` that clamps tenancies to the FY, bridges vacancy gaps, and reports how many days were bridged
  - [x] Implement it in `lib/tax/fy.ts`
  - [x] Offer the suggestion in the panel with one-click accept, labelled as derived from tenancies and disclosing bridged vacancy
  - [x] Verify against tenancies in a local database

- [x] Task: Phase Verification & Checkpoint (Refer to workflow.md) `ca78938`

---

## Phase 3 — Income, interest and apportionment [checkpoint: 19da84b]

*Goal: every figure that feeds the schedule can be sourced, labelled and apportioned correctly.*

- [x] Task: Rental income resolver `60bd2c1`
  - [x] Write failing tests covering: actuals present, actuals absent falling back to accrual, part-year tenancies clamped to FY bounds, and a material divergence between the two sources
  - [x] Implement a resolver returning the figure, its source (`actual` | `accrued`), and the cross-check value where both exist
  - [x] Surface divergence as a warning in the UI, never silently reconciled
  - [x] Confirm tests pass

- [x] Task: Apportionment helper `ff817bf`
  - [x] Write failing tests covering: 100% ownership, 50% ownership, private-use days reducing deductions but **not** income, and full-year availability
  - [x] Implement apportionment applied to income and deduction lines per the spec
  - [x] Confirm tests pass

- [x] Task: Loan statement upload and extraction `cb26273`
  - [x] Add upload to Storage, following the existing invoice pattern
  - [x] Add an extraction route reusing `pdf-parse` / Claude Vision and `generateObject` with a new zod schema for interest paid, lender, account reference and statement period
  - [x] Wire model access through `lib/ai/anthropic-client.ts` and `lib/ai/openai-client.ts`, not at the call site
  - [x] Confirm the schema rejects malformed extractions rather than coercing them

- [x] Task: Loan statement review UI `4697152`
  - [x] Present the extracted figures for confirmation with the confidence score visible and every field editable, per the staged-review pattern
  - [x] Persist on confirm; retain the file as evidence
  - [x] Show the computed rate-schedule estimate where no statement exists, labelled an estimate and excluded from claimed totals
  - [~] Verify with a real statement PDF and with a deliberately unreadable file *(deferred to the phase checkpoint — needs documents to test with)*

- [x] Task: Improve the interest estimate with loan start date and offset *(inserted — user feedback at checkpoint)* `19da84b`
  - [x] Add `start_date` to `property_loans` (migration 060) so a loan taken out mid-year is not estimated as running all year
  - [x] Write failing tests for a pure estimator that prorates from the loan start, segments by rate changes, and nets off the offset balance
  - [x] Capture the start date in the loan section
  - [x] Wire it into the report's estimate and state the assumptions it rests on

- [x] Task: Phase Verification & Checkpoint (Refer to workflow.md) `19da84b`

---

## Phase 4 — Registers and schedule assembly [checkpoint: 87a7daa]

*Goal: the numbers that appear in the pack are computed and correct.*

- [x] Task: Div 43 capital works register `ebe3a7b`
  - [x] Write failing tests covering: a full-year claim at 2.5%, a part-year first claim apportioned by days, an item beyond its 40-year life claiming nothing, multiple items with different start dates on one property, and the written-down balance
  - [x] Implement the cumulative register: per item — amount, start date, years elapsed, this year's claim, written-down balance
  - [x] Confirm tests pass

- [x] Task: Div 40 via quantity surveyor report `0bf4a45`
  - [x] Add QS report upload and per-FY entry of the stated Div 43 and Div 40 annual figures
  - [x] Retain the report as evidence
  - [x] Where absent, state that plant and equipment is not tracked and direct the agent to the QS report

- [x] Task: Rental schedule builder `f451d30`
  - [x] Write failing tests covering: ATO line ordering, exclusion of `property_type = 'primary_residence'`, exclusion of renovations with `claimable = false`, correct routing of `Repair` / `Immediate Repair` / `Capital Works` classifications, and net income including a loss case
  - [x] Implement `lib/tax/rental-schedule.ts` producing one schedule per property per FY
  - [x] Apply apportionment from Phase 3
  - [x] Confirm tests pass

- [x] Task: Portfolio summary `7d1c872`
  - [x] Aggregate schedules across all investment properties for the FY
  - [x] Carry through the CGT cost base per property
  - [x] Verify totals reconcile against the per-property schedules

- [x] Task: Record the Division 40 method and explain the QS figures *(inserted — user supplied a real depreciation schedule)* `87a7daa`
  - [x] Add `depreciation_method` (migration 061) so the Div 40 election is recorded, not a bare number
  - [x] Add guidance naming the schedule table and the row to find
  - [x] State that Div 43 is identical under both methods

- [x] Task: Phase Verification & Checkpoint (Refer to workflow.md) `87a7daa`

---

## Phase 5 — Pack generation and output [checkpoint: fa58378]

*Goal: one action produces a file the investor forwards to their accountant.*

- [x] Task: Pack PDF document `1a75892`
  - [x] Build the document with `@react-pdf/renderer`, reusing patterns from `components/tax-report-pdf.tsx`
  - [x] Sections: cover, portfolio summary, per-property rental schedules, Div 43 register, CGT cost base, questionnaire, disclaimer
  - [x] Label every estimated figure and state every assumption made where facts were absent
  - [x] Carry the disclaimer required by `product-guidelines.md`

- [x] Task: Pack XLSX workbook `1a75892`
  - [x] One sheet per property plus a summary sheet, using `xlsx`
  - [x] Emit figures as numbers, not preformatted strings, so the agent can compute with them

- [x] Task: Pre-filled questionnaire `1a75892`
  - [x] Pre-answer the rental-property section from the pack data
  - [x] Mark every untracked section explicitly per the spec's list
  - [x] Derive property purchased or sold during the year from `properties.purchase_date` and mark it for confirmation

- [x] Task: Evidence bundle and manifest `1a75892`
  - [x] Collect invoices, loan statements and QS reports as actual files, batching storage fetches rather than looping per expense
  - [x] Generate `manifest.csv` mapping each file to the figure it supports
  - [x] Assemble the ZIP: PDF, XLSX and `evidence/`
  - [x] Verify the ZIP opens with no network access and every referenced document is present

- [x] Task: Generation UI `1a75892`
  - [x] Add the FY-parameterised pack page with a year selector and a generate action
  - [x] Run generation asynchronously with visible progress; never block the interface
  - [x] Handle partial failure by reporting what could not be included rather than failing the whole pack
  - [x] Verify in light and dark themes and on a narrow viewport

- [x] Task: End-to-end verification against the acceptance criteria
  - [x] Walk all 10 acceptance criteria in `spec.md` and record the result of each *(6 verified, 3 pending browser confirmation, 1 partial — see checkpoint note)*
  - [x] Confirm `npm run build` passes and `npm run db:reset` replays cleanly *(build passes; db:reset last replayed all 61 migrations cleanly at migration 061 and none have been added since — not re-run, per the standing instruction to ask first)*
  - [x] Confirm `CI=true npm test` passes *(170 tests)*

- [x] Task: Scope the questionnaire to property only *(inserted — user feedback at checkpoint)* `2d898c8`
  - [x] Replace the five non-property sections with a single scope statement naming what the pack does not cover
  - [x] Update the tests and the spec's FR10 to match the narrowed scope
  - [x] Confirm the rental section is unchanged

- [x] Task: Consolidate onto the property page and rename *(inserted — user feedback at checkpoint)* `fa58378`
  - [x] Move the pack download onto the property page, scoped to that property
  - [x] Rename the route, labels, PDF title and filename to "tax pack"
  - [x] Delete the standalone page and its nav entry

- [x] Task: Phase Verification & Checkpoint (Refer to workflow.md) `fa58378`
