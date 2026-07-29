# Implementation Plan — Rental statement capture

**Track ID:** `rental_statement_capture_20260730`
**Spec:** [spec.md](./spec.md)

Structured per [workflow.md](../../workflow.md). Tier 1 work writes failing tests first; every
phase closes with the Phase Completion Verification and Checkpointing Protocol.

---

## Phase 1: Schema & storage foundation  (Tier 1)  [checkpoint: a3584a4]

- [x] Task: Migration 063 — extend `rental_payments` `9b1953a`
  - [x] Add the ten nullable columns with `>= 0` checks, and `confidence` checked 0–1
  - [x] Header comment records: why the table was extended rather than replaced (rows already
        exist in production), that `amount` means GROSS rent, and that `other_outgoings` is
        reconciliation-only and must never become a deduction path
  - [x] Mark it a FILE-BEARING TABLE per `docs/account-deletion.md`
- [x] Task: Migration 064 — redefine the storage-object functions `9bb0eaa`
  - [x] `user_storage_objects()` and `property_storage_objects()` both enumerate
        `rental_payments.statement_path` in the `property-files` bucket
  - [x] Ownership resolved through `properties.user_id`, never by upload-path prefix
  - [x] `docs/account-deletion.md` registry and deploy note updated (moved forward from Phase 6,
        per that file's own maintenance rule)
- [x] Task: Hand-update `lib/supabase/database.types.ts` `ff94402`
  - [x] Extend the `RentalPayment` row type and the `rental_payments` entry under
        `Database["public"]["Tables"]` (Row / Insert / Update)
  - [x] Do NOT run `supabase gen types`
- [x] Task: Verify schema and access `a3584a4`
  - [x] `npm run db:reset` — confirm a clean replay from scratch (done in task 1)
  - [x] Confirm migration 062's read/write policies cover the new columns (verify, don't assume)
  - [x] Confirm a NON-OWNER is DENIED select and update; record the exact SQL and observed output
  - [x] `npm run verify:deletion` — statement objects are removed with the property
        (harness extended: it previously had no coverage of `statement_path` at all)
- [x] Task: Phase Verification & Checkpoint (Refer to workflow.md) `a3584a4`

## Phase 1.5: Correct the gross-versus-net defect  (Tier 1)  [checkpoint: d3b700f]

Added mid-track. `lib/email-parser/parse-statement.ts:51` instructs the model to store the NET
amount disbursed in `amount`, explicitly not the gross rent figure, while
`lib/tax/rental-income.ts#actualRentForFy` reports that column as gross rent. This understates
assessable income and contradicts the invariant migration 063 documents. Six of seven local rows
are affected. Fixed here rather than deferred, because this track introduces `net_received`, which
is where the parser's figure belongs.

- [x] Task: Write a failing regression test for the statement parser `8fd6834`
  - [x] Fixture from the OWN10905 text asserts `amount` is GROSS rent ($4,400), not net ($760.20)
  - [x] Asserts `net_received` captures the disbursed figure
  - [x] Asserts the four fee buckets are populated from the statement
  - [x] Confirm the test FAILS against the current prompt before changing it
- [x] Task: Repoint `lib/email-parser/parse-statement.ts` `8fd6834`
  - [x] `amount` extracts gross rent; the instruction at line 51 is inverted, with a comment
        recording that reporting it as gross is what `actualRentForFy` requires
  - [x] `net_received` extracts "You Received" / "Withdrawal by EFT" / "Net to owner"
  - [x] Fee buckets and `other_outgoings` extracted while the prompt is being changed
  - [x] Prompt builder and response parser split out of the model call so the invariant is
        reachable from a test without contacting a provider
- [x] Task: Verify the inbound-email handler persists the new fields `6e63c55`
  - [x] `app/api/inbound-email/handler.ts` writes gross to `amount` and the rest to their columns
  - [x] Ingested rows are NOT auto-confirmed — `fees_confirmed_at` stays null for review
  - [x] `npm run verify:rent-ingest` proves the mapping end to end (16 checks)
- [x] Task: Correct the affected historical rows `618b576`
  - [x] Identify every `rental_payments` row whose `amount` came from the parser
  - [x] Restate `amount` as gross and populate `net_received` from the original statements
        (2 of 7 rows — statements #1 and #7 located; both reconcile exactly)
  - [x] Report any row that cannot be corrected without the source document rather than guessing
        (5 rows flagged in `notes`; FY2026 income still understated by $2,377.32)
  - [ ] **OPEN — needs the user:** statements #2–#6, and a production run of the script
- [x] Task: Migration 065 — other rental-related income `d3b700f`
  - [x] Add `other_income numeric(10,2)` and `other_income_note text`, both nullable
  - [x] Header comment records that tenant reimbursements are assessable income on a SEPARATE ATO
        line from gross rent, and that FR5's reconciliation is wrong without them
  - [x] Hand-update `database.types.ts` (Row / Insert / Update)
  - [x] Existing rows unaffected
  - [ ] **DEBT:** `npm run db:reset` clean replay deferred — would discard the 618b576 data
        correction, whose restore needs interactive `db:sync`
- [x] Task: Extend the parser for other income `d3b700f`
  - [x] Failing test first: a December-shaped fixture with $6.80 water recovery reconciles only
        when `otherIncome` is included, and fails on the FR5 identity without it
  - [x] Prompt asks for `otherIncome` and `otherIncomeNote`, and states that a tenant
        reimbursement is NOT rent and must not be added to `amount`
  - [x] Handler persists both columns
- [x] Task: Phase Verification & Checkpoint (Refer to workflow.md) `d3b700f`

## Phase 2: Domain logic  (Tier 1 — tests first)

- [x] Task: Write failing tests for `lib/tax/agent-fees.ts` `44a8873`
  - [x] Confirmed statement fees resolve as `source: "actual"`
  - [x] No statements in the year → `management_fee_pct` estimate, `source: "estimated"`
  - [x] UNCONFIRMED fees are excluded; the estimate is returned instead
  - [x] Actual and estimate are NEVER summed (guards the $242 double-count)
  - [x] Payments outside the financial year are excluded
  - [x] Financial-year boundary respects a non-July FY start from the profile
  - [x] `sundry_fees` is returned separately from the commission fees
  - [x] OWN10905 fixture resolves to $1,485.00 commission and $8.80 sundry
- [x] Task: Implement `resolveAgentFees` to green, mirroring `resolveRentalIncome`'s shape `44a8873`
  - [x] Added beyond plan: `partial` / `paymentsInYear` / `paymentsWithConfirmedFees`, because a
        partial actual can be SMALLER than the estimate and must be disclosed, not hidden
- [x] Task: Write failing tests for the statement reconciliation helper `8b477a3`
  - [x] OWN10905 ties: `4400 − 1493.80 − 2146 = 760.20`
  - [x] December ties ONLY with other income: `(4400 + 6.80) − 387.86 = 4018.94`; without it the
        identity is off by exactly $6.80 and would flag a correct statement (FR14)
  - [x] A discrepancy within the $1.00 tolerance passes; beyond it fails
  - [x] Absent `net_received` returns not-applicable, not a failure
  - [x] A brought-forward balance mismatch reports, never throws
- [x] Task: Implement the reconciliation helper to green `8b477a3`
- [x] Task: Add `agentSundries` and `otherIncome` to `RentalScheduleInput` `a14a2e3`
  - [x] Test: commission feeds `agent_fees`, sundries feed the existing `sundry` line
  - [x] Test: other income surfaces as "Other rental-related income" and is NOT folded into gross
        rent — folding it would break the accrual cross-check against `weekly_rent × weeks` (FR14)
  - [x] Test: existing `rental-schedule` and `portfolio` tests still pass unchanged
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)

## Phase 3: Extraction & upload  (Tier 2)

- [ ] Task: `lib/ai/extract-rental-statement.ts`
  - [ ] Zod schema: gross rent, four fee buckets, other outgoings, net received, agent name,
        statement ref, period start/end, confidence
  - [ ] File passed to Claude directly — no server-side `pdf-parse` (see the comment in
        `app/api/loan-statements/extract/route.ts` for why)
  - [ ] Model wiring via `lib/ai/anthropic-client.ts`, not at the call site
  - [ ] Fixture-based test using the OWN10905 text; no live model call
- [ ] Task: `POST /api/rental-statements/extract`
  - [ ] Auth check; store to `property-files` BEFORE extraction
  - [ ] Extraction failure keeps the upload and records the error in `extracted`
  - [ ] `fees_confirmed_at` left null
  - [ ] Insert failure removes the stored object; RLS rejection → 403 with a human message
- [ ] Task: `app/actions/rental-statements.ts` — confirm and delete
  - [ ] Confirm sets `fees_confirmed_at`
  - [ ] Delete removes the storage object as well as the column value
- [ ] Task: Verify — happy path with the real OWN10905 PDF, plus two failure paths
        (unreadable file, and a property the caller cannot write to)
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)

## Phase 4: Rent tab UI  (Tier 3)

- [ ] Task: Statement upload in `components/rental-payments-section.tsx`
  - [ ] Upload control in the add/edit dialog; existing rows unaffected
  - [ ] View link via signed URL
- [ ] Task: Fee breakdown fields and display
  - [ ] Four fee inputs plus other outgoings and net received
  - [ ] Manual entry confirms on save; extracted figures show a Confirm action
  - [ ] Edited-from-extracted visibly distinguished, as `loan-statements-panel.tsx` does
- [ ] Task: Reconciliation indicator — ties / doesn't tie, advisory tone, never blocking
- [ ] Task: Verify responsive layout, and legibility in BOTH light and dark themes
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)

## Phase 5: Tax pack & consistency  (Tier 2)

- [ ] Task: Route the tax pack through `resolveAgentFees`
  - [ ] Replace the inline `management_fee_pct` calculation at `tax-pack/page.tsx:281-286`
  - [ ] Select the new columns in the `rental_payments` query
  - [ ] Pass `agentSundries` into `buildRentalSchedule`
- [ ] Task: Disclose the fee source in the report and the pack, mirroring income's actual/accrued
      labelling
- [ ] Task: Add unconfirmed statement fees to `packOmissions`
- [ ] Task: Statement evidence in the pack
  - [ ] One `EvidenceItem` per statement, `kind: "Rental statement"`
  - [ ] Manifest entry names the lines it supports
- [ ] Task: Route `components/financial-position-view.tsx:257` through the same resolver
  - [ ] Confirm it reports the SAME agent-fee figure as the tax pack for the same year
- [ ] Task: Verify all ten acceptance criteria against the real statement
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)

## Phase 6: Documentation

- [ ] Task: Document the invariants this feature depends on
  - [ ] Why `amount` is gross rent, and why `other_outgoings` is never deducted
  - [ ] Why agent fees carry an actual/estimate split and must never be summed
  - [ ] Add `rental_payments.statement_path` to the file-bearing table list in
        `docs/account-deletion.md`
- [ ] Task: Record the deferred work
  - [ ] The `lib/xero/mapper.ts:246` agent-fee change and why it was deferred
  - [ ] The historical gross-versus-net audit of existing `rental_payments` rows
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)
